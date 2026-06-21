"""
Feynman Course Agent — deploy on Agentverse as a Hosted Agent.

Required Agent Secrets:
  MARKETPLACE_API_URL    — e.g. https://your-app.vercel.app/api/course
  AGENTVERSE_API_KEY     — for searching & messaging video specialist agents
  ASI_API_KEY            — only if the backend URL is not configured (fallback chat)

The hosted backend runs LangGraph + ASI-1 for course generation and Feynman tutoring.
This agent also queries other Agentverse agents to find the best related videos.
"""

from __future__ import annotations

import asyncio
import os
import re
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

import requests
from uagents import Agent, Context, Protocol
from uagents_core.contrib.protocols.chat import (
    ChatAcknowledgement,
    ChatMessage,
    EndSessionContent,
    TextContent,
    chat_protocol_spec,
)

agent = Agent()
protocol = Protocol(spec=chat_protocol_spec)

AGENTVERSE_SEARCH_URL = "https://agentverse.ai/v1/search/agents"
AGENT_ADDRESS_PATTERN = re.compile(r"^agent1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{59}$")

URL_PATTERN = re.compile(
    r"https?://(?:www\.)?(?:youtube\.com/watch\?v=[\w-]+|youtu\.be/[\w-]+|"
    r"vimeo\.com/\d+|[\w.-]+\.(?:edu|org|com)/[^\s\])\"']+)",
    re.IGNORECASE,
)
TITLE_URL_PATTERN = re.compile(
    r"(.+?)\s*\|\s*(https?://\S+)\s*\|\s*(.+)",
    re.IGNORECASE | re.DOTALL,
)

SHORT_REPLIES = {
    "yes",
    "no",
    "y",
    "n",
    "yeah",
    "yep",
    "ok",
    "okay",
    "continue",
    "start",
    "next",
    "go",
    "sure",
}


NOTES_MARKER = re.compile(r"(?:^|\n)---\s*notes\s*---\s*\n", re.IGNORECASE)


def split_topic_and_notes(message: str) -> tuple[str, str | None]:
    match = NOTES_MARKER.search(message)
    if not match:
        return message, None
    topic = message[: match.start()].strip()
    notes = message[match.end() :].strip()
    return (topic or message, notes or None)


def normalize_message(text: str) -> str:
    message = text.strip()
    message = re.sub(r"^@\S+\s*", "", message)
    message = re.sub(r"\s+@\S+\s*", " ", message)
    return message.strip()


def is_likely_topic_request(message: str) -> bool:
    normalized = message.lower().strip()
    if normalized in SHORT_REPLIES:
        return False
    if len(normalized) < 8:
        return False
    return True


def get_course_api_url() -> str | None:
    api_url = os.environ.get("MARKETPLACE_API_URL", "").strip().rstrip("/")
    if not api_url:
        return None
    if not api_url.endswith("/api/course"):
        if api_url.endswith("/api/listings"):
            api_url = api_url.replace("/api/listings", "/api/course")
        else:
            api_url = f"{api_url}/api/course"
    return api_url


def get_agentverse_api_key() -> str | None:
    key = os.environ.get("AGENTVERSE_API_KEY", "").strip()
    return key or None


def search_video_agents(api_key: str, topic: str, limit: int = 5) -> list[dict[str, Any]]:
    queries = [
        f"youtube video educational {topic}",
        "video search youtube educational tutorial",
        "online video recommendation learning",
    ]

    for query in queries:
        payload = {
            "search_text": query,
            "semantic_search": True,
            "limit": limit,
            "offset": 0,
            "sort": "relevancy",
            "direction": "desc",
            "cutoff": "balanced",
            "exclude_geo_agents": True,
            "source": "agentverse",
            "filters": {"state": ["active"]},
        }

        try:
            response = requests.post(
                AGENTVERSE_SEARCH_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=20,
            )
            response.raise_for_status()
            agents = response.json().get("agents", [])
            if agents:
                return agents
        except requests.RequestException:
            continue

    return []


def rank_agents(agents: list[dict[str, Any]]) -> list[dict[str, Any]]:
    def score(agent: dict[str, Any]) -> float:
        name = (agent.get("name") or "").lower()
        description = (agent.get("short_description") or agent.get("readme") or "").lower()
        text = f"{name} {description}"
        video_hint = sum(
            1 for keyword in ("video", "youtube", "watch", "tutorial", "media")
            if keyword in text
        )
        interactions = float(agent.get("recent_interactions") or agent.get("total_interactions") or 0)
        success = float(agent.get("recent_success_rate") or 0)
        return video_hint * 10 + interactions * 0.01 + success

    return sorted(agents, key=score, reverse=True)


def agent_chat_message(text: str) -> ChatMessage:
    return ChatMessage(
        timestamp=datetime.now(timezone.utc),
        msg_id=uuid4(),
        content=[TextContent(type="text", text=text)],
    )


def extract_chat_text(message: ChatMessage) -> str:
    parts: list[str] = []
    for item in message.content:
        if isinstance(item, TextContent):
            parts.append(item.text)
    return "\n".join(parts).strip()


def parse_video_from_response(text: str) -> dict[str, str] | None:
    text = text.strip()
    if not text:
        return None

    pipe_match = TITLE_URL_PATTERN.search(text)
    if pipe_match:
        title, url, reason = pipe_match.groups()
        return {
            "title": title.strip(),
            "url": url.strip().rstrip(".,)"),
            "reason": reason.strip(),
        }

    urls = URL_PATTERN.findall(text)
    if not urls:
        return None

    url = urls[0].rstrip(".,)")
    title = "Recommended video"
    for line in text.splitlines():
        line = line.strip()
        if url in line:
            title = line.replace(url, "").strip(" -:|•") or title
            break

    return {"title": title, "url": url, "reason": "Suggested by an Agentverse video agent."}


def validate_youtube_url(url: str) -> dict[str, str] | None:
    """Confirm the video exists and is embeddable via YouTube oEmbed."""
    try:
        response = requests.get(
            "https://www.youtube.com/oembed",
            params={"url": url, "format": "json"},
            timeout=8,
        )
        if response.status_code != 200:
            return None
        data = response.json()
        title = str(data.get("title", "")).strip()
        return {"title": title or "YouTube video", "url": url}
    except requests.RequestException:
        return None


async def discover_videos_from_agents(
    ctx: Context,
    topic: str,
    timeout: float = 18.0,
) -> list[dict[str, str]]:
    api_key = get_agentverse_api_key()
    if not api_key:
        ctx.logger.warning("AGENTVERSE_API_KEY not set — skipping agent video discovery")
        return []

    agents = rank_agents(search_video_agents(api_key, topic))
    if not agents:
        ctx.logger.warning("No video agents found on Agentverse")
        return []

    prompt = (
        f"Find the single best free online video (prefer YouTube) to learn: {topic}. "
        "Reply in this exact format:\n"
        "TITLE | URL | one sentence why it's good"
    )

    videos: list[dict[str, str]] = []
    seen_urls: set[str] = set()

    for candidate in agents[:3]:
        address = candidate.get("address")
        if not address:
            continue

        name = candidate.get("name") or "Agentverse agent"
        ctx.logger.info(f"Querying video agent {name} ({address}) for topic: {topic}")

        try:
            response, status = await ctx.send_and_receive(
                address,
                agent_chat_message(prompt),
                response_type=ChatMessage,
                timeout=timeout,
            )
        except Exception as error:
            ctx.logger.warning(f"Video agent {name} failed: {error}")
            continue

        if not isinstance(response, ChatMessage):
            ctx.logger.warning(f"Video agent {name} returned unexpected type: {status}")
            continue

        parsed = parse_video_from_response(extract_chat_text(response))
        if not parsed:
            ctx.logger.warning(f"Video agent {name} returned no parseable URL")
            continue

        validated = validate_youtube_url(parsed["url"])
        if not validated:
            ctx.logger.warning(f"Video agent {name} returned invalid/unavailable URL")
            continue

        url = validated["url"]
        if url in seen_urls:
            continue

        seen_urls.add(url)
        videos.append(
            {
                "title": validated["title"],
                "url": url,
                "reason": parsed["reason"],
                "source": name,
            }
        )

        if len(videos) >= 2:
            break

    return videos


def text_message(text: str) -> ChatMessage:
    return ChatMessage(
        timestamp=datetime.now(timezone.utc),
        msg_id=uuid4(),
        content=[
            TextContent(type="text", text=text),
            EndSessionContent(type="end-session"),
        ],
    )


def call_course_api(
    ctx: Context,
    sender: str,
    message: str,
    agent_videos: list[dict[str, str]] | None = None,
    action: str | None = None,
    user_notes: str | None = None,
) -> str:
    api_url = get_course_api_url()
    if not api_url:
        return (
            "Course API is not configured. Set MARKETPLACE_API_URL to your deployed "
            "/api/course endpoint in Agent Secrets."
        )

    payload: dict = {"message": message, "sessionId": sender}
    if agent_videos:
        payload["agentVideos"] = agent_videos
    if action:
        payload["action"] = action
    if user_notes:
        payload["userNotes"] = user_notes

    try:
        response = requests.post(
            api_url,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=90,
        )
        response.raise_for_status()
        data = response.json()
        return str(data.get("reply", "Course agent returned an empty reply."))
    except requests.RequestException as error:
        ctx.logger.exception("Failed to call course API")
        detail = str(error)
        if hasattr(error, "response") and error.response is not None:
            try:
                detail = error.response.json().get("error", detail)
            except Exception:
                detail = error.response.text[:200]
        return f"Could not reach the course service: {detail}"


def format_video_note(videos: list[dict[str, str]]) -> str:
    if not videos:
        return ""
    lines = ["", "**Recommended videos** (via Agentverse agents):"]
    for video in videos[:2]:
        title = video.get("title", "Video")
        url = video.get("url", "")
        source = video.get("source", "Agentverse")
        lines.append(f"• [{title}]({url}) — _from {source}_")
    return "\n".join(lines)


@protocol.on_message(ChatMessage)
async def handle_message(ctx: Context, sender: str, msg: ChatMessage):
    if AGENT_ADDRESS_PATTERN.match(sender):
        return

    await ctx.send(
        sender,
        ChatAcknowledgement(
            timestamp=datetime.now(timezone.utc),
            acknowledged_msg_id=msg.msg_id,
        ),
    )

    text = ""
    for item in msg.content:
        if isinstance(item, TextContent):
            text += item.text

    message = normalize_message(text)
    if not message:
        reply = (
            "What would you like to learn? I'll build a course, find the best videos "
            "via other Agentverse agents, and teach you using the Feynman Technique."
        )
    elif is_likely_topic_request(message):
        topic, notes = split_topic_and_notes(message)
        ctx.logger.info(f"Topic request — querying Agentverse video agents for: {topic}")

        videos, reply = await asyncio.gather(
            discover_videos_from_agents(ctx, topic),
            asyncio.to_thread(call_course_api, ctx, sender, topic, None, None, notes),
        )

        if videos:
            await asyncio.to_thread(
                call_course_api,
                ctx,
                sender,
                "",
                videos,
                "attachVideos",
            )
            reply = f"{reply}{format_video_note(videos)}"
    else:
        reply = await asyncio.to_thread(call_course_api, ctx, sender, message, None)

    await ctx.send(sender, text_message(reply))


@protocol.on_message(ChatAcknowledgement)
async def handle_ack(ctx: Context, sender: str, msg: ChatAcknowledgement):
    pass


agent.include(protocol, publish_manifest=True)
