"""
Diagram Drawing Coach — standalone Agentverse hosted agent for ASI:One.

Teaches users to reproduce diagrams step-by-step on a live canvas with vision +
voice coaching and a shadow reference overlay.

Required Agent Secrets:
  DRAWING_APP_URL          — e.g. https://your-app.vercel.app  (no trailing slash)
  AGENT_API_SECRET         — must match AGENT_COURSE_API_SECRET (or LISTINGS_API_SECRET) on Vercel

Legacy env names still work:
  APP_BASE_URL + LISTINGS_API_SECRET
"""

from __future__ import annotations

import asyncio
import os
import re
from datetime import datetime, timezone
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

AGENT_VERSION = "2026-06-21-v2"

DIAGRAM_KEYWORDS = re.compile(
    r"\b("
    r"draw|sketch|diagram|canvas|schematic|circuit|flowchart|"
    r"neural network|block diagram|learn to draw|help me draw|"
    r"teach me to draw|how to draw|copy this diagram|tracing"
    r")\b",
    re.IGNORECASE,
)

SHORT_REPLIES = {"yes", "no", "y", "n", "ok", "okay", "start", "go", "sure", "thanks"}


def normalize_message(text: str) -> str:
    message = text.strip()
    message = re.sub(r"^@\S+\s*", "", message)
    message = re.sub(r"\s+@\S+\s*", " ", message)
    return message.strip()


def extract_user_text(msg: ChatMessage) -> str:
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


def is_session_start(msg: ChatMessage) -> bool:
    return any(isinstance(item, StartSessionContent) for item in msg.content)


def get_app_base_url() -> str | None:
    for key in ("DRAWING_APP_URL", "APP_BASE_URL", "NEXT_PUBLIC_APP_URL"):
        value = os.environ.get(key, "").strip().rstrip("/")
        if value:
            return value

    legacy = os.environ.get("MARKETPLACE_API_URL", "").strip().rstrip("/")
    if legacy:
        return legacy.split("/api/")[0]

    return None


def get_agent_api_secret() -> str | None:
    for key in ("AGENT_API_SECRET", "AGENT_COURSE_API_SECRET", "LISTINGS_API_SECRET"):
        value = os.environ.get(key, "").strip()
        if value:
            return value
    return None


def api_headers() -> dict[str, str]:
    headers = {"Content-Type": "application/json"}
    secret = get_agent_api_secret()
    if secret:
        headers["X-Agent-Api-Key"] = secret
    return headers


def diagram_topic_from_message(message: str) -> str:
    cleaned = normalize_message(message)
    cleaned = DIAGRAM_KEYWORDS.sub("", cleaned)
    cleaned = re.sub(
        r"^(please|can you|could you|i want to|i need to|help me)\s+",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" .,-")
    return cleaned or "diagram practice"


def is_diagram_request(message: str) -> bool:
    normalized = message.lower().strip()
    if normalized in SHORT_REPLIES:
        return False
    if len(normalized) < 4:
        return False
    return True


def check_backend_health(ctx: Context) -> str:
    base = get_app_base_url()
    if not base:
        return "Backend: not configured (set DRAWING_APP_URL)"

    try:
        response = requests.get(f"{base}/api/drawing/health", timeout=15)
        response.raise_for_status()
        data = response.json()
        vision = "yes" if data.get("visionConfigured") else "no"
        secret = "yes" if data.get("agentSecretConfigured") else "no"
        return f"Backend: ok (vision={vision}, agentSecret={secret})"
    except requests.RequestException as error:
        ctx.logger.warning(f"Health check failed: {error}")
        return f"Backend: unreachable ({error})"


def config_status_message(ctx: Context | None = None) -> str:
    backend = check_backend_health(ctx) if ctx else "Backend: (ping from agent chat to verify)"
    return "\n".join(
        [
            f"Diagram Drawing Coach is online (script {AGENT_VERSION}).",
            f"App URL: {'configured' if get_app_base_url() else 'MISSING — set DRAWING_APP_URL'}",
            f"Agent secret: {'configured' if get_agent_api_secret() else 'MISSING — set AGENT_API_SECRET'}",
            backend,
        ]
    )


def text_message(text: str) -> ChatMessage:
    return ChatMessage(
        timestamp=datetime.now(timezone.utc),
        msg_id=uuid4(),
        content=[
            TextContent(type="text", text=text),
            EndSessionContent(type="end-session"),
        ],
    )


def call_create_drawing_session(ctx: Context, sender: str, topic: str) -> str | None:
    base = get_app_base_url()
    if not base:
        ctx.logger.error("DRAWING_APP_URL is not configured")
        return None

    secret = get_agent_api_secret()
    if not secret:
        ctx.logger.error("AGENT_API_SECRET is not set")
        return None

    api_url = f"{base}/api/drawing/session"

    try:
        response = requests.post(
            api_url,
            json={"sessionId": sender, "topic": topic},
            headers=api_headers(),
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


async def start_drawing_coach(ctx: Context, sender: str, topic: str) -> None:
    url = await asyncio.to_thread(call_create_drawing_session, ctx, sender, topic)
    if url:
        if url.startswith("http://localhost") or url.startswith("https://localhost"):
            ctx.logger.warning(f"Session URL points to localhost: {url}")
        reply = (
            f"Your **Diagram Drawing Coach** session is ready.\n\n"
            f"**Open this link:** {url}\n\n"
            "1. Upload the reference diagram you want to learn\n"
            "2. Click **Check my drawing** for step-by-step guidance\n"
            "3. The shadow reference and coach will explain each part as you draw\n\n"
            "Works best in **Chrome** with microphone enabled."
        )
    else:
        reply = (
            "I couldn't start a drawing session. Check Agentverse secrets and Vercel env:\n"
            "• `DRAWING_APP_URL` → your Vercel URL (e.g. https://hack-berkley2026.vercel.app)\n"
            "• `AGENT_API_SECRET` → same value as `AGENT_API_SECRET` or `LISTINGS_API_SECRET` on Vercel\n"
            "• On Vercel set `NEXT_PUBLIC_APP_URL` to your production URL (not localhost)\n\n"
            "Send `ping` to verify backend health."
        )
    await ctx.send(sender, text_message(reply))


@agent.on_event("startup")
async def on_startup(ctx: Context):
    ctx.logger.info(config_status_message(ctx))


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
                    "Hi! I'm the **Diagram Drawing Coach** — I help you learn diagrams by drawing.\n\n"
                    "Tell me what diagram you want to practice, for example:\n"
                    "• _Teach me to draw an electrical circuit_\n"
                    "• _Help me sketch a neural network diagram_\n"
                    "• _I want to learn a flowchart for a login process_"
                ),
            )
            return

        if not message:
            await ctx.send(
                sender,
                text_message(
                    "What diagram would you like to learn to draw? "
                    "Example: _electrical circuit diagram_"
                ),
            )
            return

        if message.lower() in {"ping", "health", "status"}:
            await ctx.send(sender, text_message(config_status_message(ctx)))
            return

        if not is_diagram_request(message):
            await ctx.send(
                sender,
                text_message(
                    "I'm specialized in **diagram drawing practice**. "
                    "Tell me which diagram you want to learn — e.g. "
                    "_\"teach me to draw a circuit diagram\"_."
                ),
            )
            return

        topic = diagram_topic_from_message(message)
        await start_drawing_coach(ctx, sender, topic)
    except Exception as error:
        ctx.logger.exception("Unhandled drawing agent error")
        await ctx.send(
            sender,
            text_message(f"Something went wrong. Check Agentverse logs. ({error})"),
        )


@protocol.on_message(ChatAcknowledgement)
async def handle_ack(ctx: Context, sender: str, msg: ChatAcknowledgement):
    pass


agent.include(protocol, publish_manifest=True)
