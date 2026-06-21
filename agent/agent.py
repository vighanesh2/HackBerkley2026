"""
Feynman Course Agent — deploy on Agentverse as a Hosted Agent.

Required Agent Secrets:
  COURSE_API_URL           — e.g. https://your-app.vercel.app/api/course
  AGENT_COURSE_API_SECRET  — must match AGENT_COURSE_API_SECRET on Vercel (server auth)
  AGENTVERSE_API_KEY       — searches Agentverse + messages video specialist agents (agent-to-agent)

Optional:
  ENABLE_AGENT_VIDEO_DISCOVERY=false  — disable agent-to-agent video lookup (default: on when AGENTVERSE_API_KEY is set)

Legacy secret name MARKETPLACE_API_URL still works for COURSE_API_URL.

The hosted backend runs LangGraph + ASI-1 + RAG (when notes are included).
Web users sign in via Supabase; Agentverse calls use the shared API secret.
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
    StartSessionContent,
    TextContent,
    chat_protocol_spec,
)

agent = Agent()
protocol = Protocol(spec=chat_protocol_spec)

AGENTVERSE_SEARCH_URL = "https://agentverse.ai/v1/search/agents"

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

DRAWING_REQUEST_PATTERN = re.compile(
    r"\b("
    r"draw|sketch|diagram|canvas|learn to draw|help me draw|"
    r"teach me to draw|how to draw|trace this|copy this diagram"
    r")\b",
    re.IGNORECASE,
)


def get_drawing_session_api_url() -> str | None:
    course_url = get_course_api_url()
    if not course_url:
        return None
    base = course_url.rsplit("/api/course", 1)[0]
    return f"{base}/api/drawing/session"


def is_likely_drawing_request(message: str) -> bool:
    return bool(DRAWING_REQUEST_PATTERN.search(message))


def drawing_topic_from_message(message: str) -> str:
    cleaned = normalize_message(message)
    cleaned = DRAWING_REQUEST_PATTERN.sub("", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" .,-")
    return cleaned or "diagram drawing practice"


def call_create_drawing_session(ctx: Context, sender: str, topic: str) -> str | None:
    api_url = get_drawing_session_api_url()
    if not api_url:
        ctx.logger.error("Drawing session API URL is not configured")
        return None

    secret = get_agent_api_secret()
    if not secret:
        ctx.logger.error("AGENT_COURSE_API_SECRET is not set")
        return None

    try:
        response = requests.post(
            api_url,
            json={"sessionId": sender, "topic": topic},
            headers=course_api_headers(),
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()
        return str(data.get("url") or "")
    except requests.RequestException as error:
        ctx.logger.exception("Failed to create drawing session")
        detail = str(error)
        if hasattr(error, "response") and error.response is not None:
            try:
                detail = error.response.json().get("error", detail)
            except Exception:
                detail = error.response.text[:200]
        ctx.logger.error(f"Drawing session error: {detail}")
        return None


async def process_drawing_session(ctx: Context, sender: str, topic: str) -> None:
    url = await asyncio.to_thread(call_create_drawing_session, ctx, sender, topic)
    if url:
        reply = (
            f"Your drawing coach is ready.\n\n"
            f"**Open this link:** {url}\n\n"
            "Upload the reference diagram you want to learn, then draw on the canvas. "
            "The AI will watch your progress and guide you by voice."
        )
    else:
        reply = (
            "I couldn't start a drawing session. Confirm COURSE_API_URL and "
            "AGENT_COURSE_API_SECRET on Vercel and Agentverse."
        )
    await ctx.send(sender, text_message(reply))


def split_topic_and_notes(message: str) -> tuple[str, str | None]:
    match = NOTES_MARKER.search(message)
    if not match:
        return message, None
    topic = message[: match.start()].strip()
    notes = message[match.end() :].strip()
    return (topic or message, notes or None)


def extract_user_text(msg: ChatMessage) -> str:
    """ASI:One sends user messages from agent addresses — never filter those out."""
    if hasattr(msg, "text") and callable(msg.text):
        try:
            text = str(msg.text() or "").strip()
            if text:
                return normalize_message(text)
        except Exception:
            pass

    parts: list[str] = []
    for item in msg.content:
        if isinstance(item, TextContent):
            parts.append(item.text)
    return normalize_message("\n".join(parts))


def normalize_message(text: str) -> str:
    message = text.strip()
    message = re.sub(r"^@\S+\s*", "", message)
    message = re.sub(r"\s+@\S+\s*", " ", message)
    return message.strip()


def is_session_start(msg: ChatMessage) -> bool:
    return any(isinstance(item, StartSessionContent) for item in msg.content)


def is_likely_topic_request(message: str) -> bool:
    normalized = message.lower().strip()
    if normalized in SHORT_REPLIES:
        return False
    if len(normalized) < 8:
        return False
    return True


def get_course_api_url() -> str | None:
    api_url = (
        os.environ.get("COURSE_API_URL", "").strip()
        or os.environ.get("MARKETPLACE_API_URL", "").strip()
    ).rstrip("/")
    if not api_url:
        return None
    if not api_url.endswith("/api/course"):
        if api_url.endswith("/api/listings"):
            api_url = api_url.replace("/api/listings", "/api/course")
        else:
            api_url = f"{api_url}/api/course"
    return api_url


def get_agent_api_secret() -> str | None:
    key = (
        os.environ.get("AGENT_COURSE_API_SECRET", "").strip()
        or os.environ.get("LISTINGS_API_SECRET", "").strip()
    )
    return key or None


def course_api_headers() -> dict[str, str]:
    headers = {"Content-Type": "application/json"}
    secret = get_agent_api_secret()
    if secret:
        headers["X-Agent-Api-Key"] = secret
    return headers


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


def progress_message(text: str) -> ChatMessage:
    """Deprecated — ASI:One needs EndSessionContent within ~30s; use text_message for quick replies."""
    return text_message(text)


async def process_course_request(
    ctx: Context,
    sender: str,
    course_message: str,
    notes: str | None,
    topic: str | None = None,
) -> None:
    try:
        video_task: asyncio.Task[list[dict[str, str]]] | None = None
        if topic and should_use_agent_video_discovery():
            ctx.logger.info(f"Querying Agentverse video specialist agents for: {topic}")
            video_task = asyncio.create_task(
                discover_videos_from_agents(ctx, topic, timeout=15.0)
            )

        reply = await asyncio.to_thread(
            call_course_api,
            ctx,
            sender,
            course_message,
            None,
            None,
            notes,
        )

        videos: list[dict[str, str]] = []
        if video_task is not None:
            videos = await video_task

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

        await ctx.send(sender, text_message(reply))
    except Exception as error:
        ctx.logger.exception("Background course request failed")
        await ctx.send(
            sender,
            text_message(
                "Course generation failed. Check Agentverse logs and confirm "
                f"COURSE_API_URL + AGENT_COURSE_API_SECRET on Vercel. ({error})"
            ),
        )


def config_status_message() -> str:
    parts = [
        "Feynman Course Agent is online.",
        f"Course API: {'configured' if get_course_api_url() else 'MISSING — set COURSE_API_URL'}",
        f"API secret: {'configured' if get_agent_api_secret() else 'MISSING — set AGENT_COURSE_API_SECRET'}",
        f"Video agents: {'enabled (Agentverse search)' if should_use_agent_video_discovery() else 'disabled — set AGENTVERSE_API_KEY'}",
    ]
    return "\n".join(parts)


def should_use_agent_video_discovery() -> bool:
    """Agent-to-agent video discovery — default on when AGENTVERSE_API_KEY is set."""
    flag = os.environ.get("ENABLE_AGENT_VIDEO_DISCOVERY", "").strip().lower()
    if flag in {"0", "false", "no"}:
        return False
    if flag in {"1", "true", "yes"}:
        return bool(get_agentverse_api_key())
    return bool(get_agentverse_api_key())


def video_discovery_enabled() -> bool:
    return should_use_agent_video_discovery()


def course_prompt_for_topic(topic: str) -> str:
    cleaned = topic.strip()
    lower = cleaned.lower()
    if lower.startswith("i want to learn") or lower.startswith("teach me"):
        return cleaned
    return f"I want to learn {cleaned}"


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
            "Course API is not configured. Set COURSE_API_URL to your deployed "
            "/api/course endpoint in Agent Secrets."
        )

    secret = get_agent_api_secret()
    if not secret:
        return (
            "AGENT_COURSE_API_SECRET is not set in Agent Secrets. "
            "It must match the same value on your Vercel deployment."
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
            headers=course_api_headers(),
            timeout=120,
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


@agent.on_event("startup")
async def on_startup(ctx: Context):
    ctx.logger.info(config_status_message())


@protocol.on_message(ChatMessage)
async def handle_message(ctx: Context, sender: str, msg: ChatMessage):
    ctx.logger.info(f"ChatMessage from {sender}")

    await ctx.send(
        sender,
        ChatAcknowledgement(
            timestamp=datetime.now(timezone.utc),
            acknowledged_msg_id=msg.msg_id,
        ),
    )

    message = extract_user_text(msg)

    try:
        if not message and is_session_start(msg):
            await ctx.send(
                sender,
                text_message(
                    "Hi! I'm the Feynman Course Agent — discoverable on ASI:One.\n\n"
                    "Tell me what you want to learn and I'll build a course using the Feynman Technique. "
                    "Or say *\"teach me to draw a circuit diagram\"* for the Drawing Coach.\n\n"
                    "Example: \"I want to learn Python basics\""
                ),
            )
            return

        if not message:
            reply = (
                "What would you like to learn? I'll build a course (with RAG if you add "
                "--- notes --- and your material) and teach you using the Feynman Technique."
            )
            await ctx.send(sender, text_message(reply))
            return

        if message.lower() in {"ping", "health", "status"}:
            await ctx.send(sender, text_message(config_status_message()))
            return

        if is_likely_drawing_request(message):
            topic = drawing_topic_from_message(message)
            await ctx.send(
                sender,
                text_message(
                    f"Setting up your drawing coach for **{topic}**. "
                    "I'll send the canvas link in my next message…"
                ),
            )
            asyncio.create_task(process_drawing_session(ctx, sender, topic))
            return

        if is_likely_topic_request(message):
            topic, notes = split_topic_and_notes(message)
            course_message = course_prompt_for_topic(topic)

            await ctx.send(
                sender,
                text_message(
                    f"Got it — building your course on **{topic.strip()}**. "
                    "I'm also asking Agentverse video specialist agents for recommendations. "
                    "This usually takes 30–90 seconds — I'll send everything in my next message."
                ),
            )

            asyncio.create_task(
                process_course_request(ctx, sender, course_message, notes, topic)
            )
            return

        await ctx.send(sender, text_message("One moment…"))
        asyncio.create_task(
            process_course_request(ctx, sender, message, None, None)
        )
    except Exception as error:
        ctx.logger.exception("Unhandled agent error")
        await ctx.send(
            sender,
            text_message(
                "Something went wrong on my side. Check Agentverse logs, confirm "
                f"COURSE_API_URL and AGENT_COURSE_API_SECRET, then try again. ({error})"
            ),
        )


@protocol.on_message(ChatAcknowledgement)
async def handle_ack(ctx: Context, sender: str, msg: ChatAcknowledgement):
    pass


agent.include(protocol, publish_manifest=True)
