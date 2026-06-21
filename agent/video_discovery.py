"""
Discover educational videos by searching Agentverse and messaging specialist agents.

Requires Agent Secret: AGENTVERSE_API_KEY (from agentverse.ai/profile/api-keys)
"""

from __future__ import annotations

import os
import re
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

import requests
from uagents import Context
from uagents_core.contrib.protocols.chat import ChatMessage, TextContent

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


def chat_message(text: str) -> ChatMessage:
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

    for agent in agents[:3]:
        address = agent.get("address")
        if not address:
            continue

        name = agent.get("name") or "Agentverse agent"
        ctx.logger.info(f"Querying video agent {name} ({address}) for topic: {topic}")

        try:
            response, status = await ctx.send_and_receive(
                address,
                chat_message(prompt),
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

        url = parsed["url"]
        if url in seen_urls:
            continue

        seen_urls.add(url)
        videos.append(
            {
                "title": parsed["title"],
                "url": url,
                "reason": parsed["reason"],
                "source": name,
            }
        )

        if len(videos) >= 2:
            break

    return videos
