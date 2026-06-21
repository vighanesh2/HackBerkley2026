"""
Marketplace Listing Agent — deploy on Agentverse as a Hosted Agent.

Required Agent Secrets (Agentverse editor → Secrets):
  ASI_API_KEY            — from https://asi1.ai/dashboard/api-keys
  MARKETPLACE_API_URL    — e.g. https://your-app.vercel.app/api/listings
  LISTINGS_API_SECRET    — same value as in your Next.js .env.local

Optional:
  NEXT_PUBLIC_APP_URL    — base URL for listing links (defaults to MARKETPLACE_API_URL origin)
"""

import json
import os
import re
from datetime import datetime, timezone
from urllib.parse import quote
from uuid import uuid4

import requests
from openai import OpenAI
from uagents import Agent, Context, Protocol
from uagents_core.contrib.protocols.chat import (
    ChatAcknowledgement,
    ChatMessage,
    EndSessionContent,
    MetadataContent,
    TextContent,
    chat_protocol_spec,
)

agent = Agent()
protocol = Protocol(spec=chat_protocol_spec)

STEPS = ("idle", "title", "description", "price", "category", "confirm")


def storage_key(sender: str) -> str:
    return f"listing:{sender}"


def get_session(ctx: Context, sender: str) -> dict:
    return ctx.storage.get(storage_key(sender)) or {"step": "idle", "draft": {}}


def save_session(ctx: Context, sender: str, session: dict) -> None:
    ctx.storage.set(storage_key(sender), session)


def clear_session(ctx: Context, sender: str) -> None:
    ctx.storage.set(storage_key(sender), None)


def add_seller_watch(ctx: Context, sender: str) -> None:
    watchlist = ctx.storage.get("watchlist") or []
    if sender not in watchlist:
        watchlist.append(sender)
    ctx.storage.set("watchlist", watchlist)


def parse_price(text: str) -> float | None:
    match = re.sub(r",", "", text).replace("$", " ").strip()
    found = re.search(r"(\d+(?:\.\d{1,2})?)", match)
    if not found:
        return None
    return float(found.group(1))


def normalize_message(text: str) -> str:
    """Strip @mentions — ASI:One sends messages like '@sellanything yes'."""
    message = text.strip()
    message = re.sub(r"^@\S+\s*", "", message)
    message = re.sub(r"\s+@\S+\s*", " ", message)
    return message.strip()


def is_affirmative(text: str) -> bool:
    lower = normalize_message(text).lower()
    if lower in {"yes", "y", "confirm", "post", "post it", "yeah", "yep", "sure", "ok", "okay"}:
        return True
    return any(w in {"yes", "y", "yeah", "yep", "sure", "confirm", "post"} for w in lower.split())


def is_negative(text: str) -> bool:
    lower = normalize_message(text).lower()
    if lower in {"no", "n", "cancel", "stop", "nope"}:
        return True
    return any(w in {"no", "n", "cancel", "nope", "stop"} for w in lower.split())


def wants_to_list(text: str) -> bool:
    lower = text.lower()
    return any(
        word in lower
        for word in ("sell", "list", "post", "marketplace", "shopify", "product")
    )


def build_summary(draft: dict) -> str:
    return (
        "Here's your listing:\n"
        f"Title: {draft.get('title')}\n"
        f"Description: {draft.get('description')}\n"
        f"Price: ${draft.get('price')}\n"
        f"Category: {draft.get('category')}\n\n"
        'Reply "yes" to post or "no" to cancel.'
    )


def get_asi_client() -> OpenAI | None:
    api_key = os.environ.get("ASI_API_KEY")
    if not api_key:
        return None
    return OpenAI(base_url="https://api.asi1.ai/v1", api_key=api_key)


def ask_asi(system_prompt: str, user_prompt: str) -> str | None:
    client = get_asi_client()
    if not client:
        return None

    try:
        response = client.chat.completions.create(
            model="asi1-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=512,
        )
        content = response.choices[0].message.content
        return str(content) if content else None
    except Exception:
        return None


def extract_listing_from_message(text: str) -> dict | None:
    prompt = (
        "Extract marketplace listing fields from the user message. "
        "Return strict JSON with keys: title, description, price, category. "
        "Use null for missing fields. price must be a number without currency symbol."
    )
    raw = ask_asi(prompt, text)
    if not raw:
        return None

    try:
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start == -1 or end <= start:
            return None
        data = json.loads(raw[start:end])
        if not isinstance(data, dict):
            return None
        return data
    except json.JSONDecodeError:
        return None


def get_listings_api_url() -> str | None:
    api_url = os.environ.get("MARKETPLACE_API_URL", "").strip().rstrip("/")
    if not api_url:
        return None
    if not api_url.endswith("/api/listings"):
        api_url = f"{api_url}/api/listings"
    return api_url


def get_notifications_api_url() -> str | None:
    listings_url = get_listings_api_url()
    if not listings_url:
        return None
    return listings_url.replace("/api/listings", "/api/notifications")


def auth_headers() -> dict:
    secret = os.environ.get("LISTINGS_API_SECRET")
    headers = {"Content-Type": "application/json"}
    if secret:
        headers["Authorization"] = f"Bearer {secret}"
    return headers


def terminal_card_message(narration: str, root: dict) -> ChatMessage:
    return ChatMessage(
        timestamp=datetime.now(timezone.utc),
        msg_id=uuid4(),
        content=[
            TextContent(type="text", text=narration),
            MetadataContent(
                type="metadata",
                metadata={
                    "card_protocol_version": "1",
                    "requires_card_interaction": "false",
                    "is_terminal": "true",
                    "card_kind": "custom",
                    "card_payload": json.dumps({"root": root}),
                    "preferred_drawer_width_px": "420",
                },
            ),
            EndSessionContent(type="end-session"),
        ],
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


def live_card_root(title: str, price: float, category: str, listing_url: str | None) -> dict:
    children = [
        {"type": "badge", "label": "LIVE", "variant": "success"},
        {"type": "text", "value": f"${price:g} · {category}", "style": "body"},
    ]
    if listing_url:
        children.append({"type": "text", "value": listing_url, "style": "muted"})
    return {
        "type": "section",
        "title": title,
        "subtitle": "Your listing is live",
        "children": children,
    }


def sold_card_root(title: str, price: float) -> dict:
    return {
        "type": "section",
        "title": title,
        "subtitle": "Great news!",
        "children": [
            {"type": "badge", "label": "SOLD ✓", "variant": "success"},
            {"type": "text", "value": f"Sold for ${price:g}", "style": "emphasis"},
            {
                "type": "text",
                "value": "Payment received — your item found a buyer.",
                "style": "muted",
            },
        ],
    }


def post_listing(ctx: Context, draft: dict, seller_id: str) -> dict:
    api_url = get_listings_api_url()
    secret = os.environ.get("LISTINGS_API_SECRET")

    if not api_url:
        return {"ok": False, "error": "MARKETPLACE_API_URL is not configured in Agent Secrets."}

    headers = {"Content-Type": "application/json"}
    if secret:
        headers["Authorization"] = f"Bearer {secret}"

    payload = {
        "title": draft["title"],
        "description": draft["description"],
        "price": draft["price"],
        "category": draft["category"],
        "sellerId": seller_id,
    }

    try:
        response = requests.post(api_url, json=payload, headers=headers, timeout=20)
        response.raise_for_status()
        data = response.json()
        listing_url = data.get("shopifyUrl") or data.get("url")
        admin_url = data.get("shopifyAdminUrl")
        return {
            "ok": True,
            "title": draft["title"],
            "price": draft["price"],
            "category": draft["category"],
            "listing_url": listing_url,
            "admin_url": admin_url,
            "product_id": data.get("listing", {}).get("shopifyProductId"),
        }
    except requests.RequestException as error:
        ctx.logger.exception("Failed to post listing")
        response_text = ""
        if hasattr(error, "response") and error.response is not None:
            try:
                err_json = error.response.json()
                response_text = err_json.get("error", "") or str(err_json)
            except Exception:
                response_text = error.response.text[:200]
        detail = response_text or str(error)
        return {"ok": False, "error": detail}


def process_message(ctx: Context, sender: str, text: str) -> str:
    message = normalize_message(text)
    session = get_session(ctx, sender)
    step = session.get("step", "idle")
    draft = session.get("draft", {})

    if step == "confirm":
        return 'Please reply "yes" to post or "no" to cancel.'

    if step == "idle":
        if not wants_to_list(message):
            return (
                "What would you like me to sell? "
                'Describe the item and price — e.g. "my desk for $80".'
            )

        extracted = extract_listing_from_message(message)
        if extracted:
            filled = {k: v for k, v in extracted.items() if v not in (None, "")}
            draft.update(filled)

        price = parse_price(message)
        if price is not None and not draft.get("price"):
            draft["price"] = price

        if draft.get("title") and draft.get("price") and not draft.get("description"):
            session["draft"] = draft
            session["step"] = "description"
            save_session(ctx, sender, session)
            return "Got the title and price. What description should buyers see?"

        missing = [field for field in ("title", "description", "price", "category") if not draft.get(field)]
        if not missing:
            session["draft"] = draft
            session["step"] = "confirm"
            save_session(ctx, sender, session)
            return build_summary(draft)

        session["draft"] = draft
        session["step"] = missing[0]
        save_session(ctx, sender, session)

        prompts = {
            "title": "What would you like me to sell?",
            "description": "Great. Now give me a short description for buyers.",
            "price": "What price should I list it for? (e.g. 120 or $120)",
            "category": "What category fits best? (e.g. Electronics, Furniture, Clothing)",
        }
        return prompts[missing[0]]

    field_prompts = {
        "title": ("title", "description", "Great. Now give me a short description for buyers."),
        "description": ("description", "price", "What price should I list it for? (e.g. 120 or $120)"),
        "price": ("price", "category", "What category fits best? (e.g. Electronics, Furniture, Clothing)"),
        "category": ("category", "confirm", None),
    }

    if step in field_prompts:
        field, next_step, next_prompt = field_prompts[step]

        if field == "price":
            price = parse_price(message)
            if price is None:
                return "I couldn't read that price. Please send a number like 75 or $75."
            draft["price"] = price
        else:
            draft[field] = message

        if next_step == "confirm":
            session["draft"] = draft
            session["step"] = "confirm"
            save_session(ctx, sender, session)
            return build_summary(draft)

        session["draft"] = draft
        session["step"] = next_step
        save_session(ctx, sender, session)
        return next_prompt or build_summary(draft)

    session["step"] = "idle"
    save_session(ctx, sender, session)
    return "Tell me what you'd like to sell to start a new listing."


@protocol.on_message(ChatMessage)
async def handle_message(ctx: Context, sender: str, msg: ChatMessage):
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
    session = get_session(ctx, sender)

    if session.get("step") == "confirm" and is_affirmative(message):
        draft = session.get("draft", {})
        required = ("title", "description", "price", "category")
        if not all(draft.get(field) for field in required):
            clear_session(ctx, sender)
            await ctx.send(
                sender,
                text_message(
                    "Something was missing from the draft. Tell me what you'd like to sell to start over."
                ),
            )
            return

        await ctx.send(sender, text_message("Publishing your listing..."))
        result = post_listing(ctx, draft, seller_id=sender)
        clear_session(ctx, sender)

        if result.get("ok"):
            add_seller_watch(ctx, sender)
            card = live_card_root(
                title=str(result["title"]),
                price=float(result["price"]),
                category=str(result["category"]),
                listing_url=result.get("listing_url"),
            )
            narration = f"Done! {result['title']} is live."
            await ctx.send(sender, terminal_card_message(narration, card))
            return

        await ctx.send(
            sender,
            text_message(f"Could not publish your listing: {result.get('error', 'Unknown error')}"),
        )
        return

    if session.get("step") == "confirm" and is_negative(message):
        clear_session(ctx, sender)
        await ctx.send(
            sender,
            text_message("Listing cancelled. Tell me what you'd like to sell whenever you're ready."),
        )
        return

    reply = process_message(ctx, sender, text)
    await ctx.send(sender, text_message(reply))


@protocol.on_message(ChatAcknowledgement)
async def handle_ack(ctx: Context, sender: str, msg: ChatAcknowledgement):
    pass


@agent.on_interval(period=15.0)
async def poll_sold_notifications(ctx: Context):
    watchlist = ctx.storage.get("watchlist") or []
    if not watchlist:
        return

    api_url = get_notifications_api_url()
    if not api_url:
        return

    headers = auth_headers()

    for seller in watchlist:
        try:
            response = requests.get(
                f"{api_url}?sellerId={quote(seller, safe='')}",
                headers=headers,
                timeout=10,
            )
            response.raise_for_status()
            notifications = response.json().get("notifications", [])
        except Exception:
            ctx.logger.exception("Failed to poll sold notifications")
            continue

        delivered_ids = []
        for note in notifications:
            title = str(note.get("title", "Your item"))
            price = float(note.get("price", 0))
            card = sold_card_root(title, price)
            await ctx.send(
                seller,
                terminal_card_message(f"✓ Sold! {title} just found a buyer.", card),
            )
            if note.get("id"):
                delivered_ids.append(note["id"])

        if not delivered_ids:
            continue

        try:
            requests.post(
                api_url,
                headers=headers,
                json={"action": "ack", "ids": delivered_ids},
                timeout=10,
            )
        except Exception:
            ctx.logger.exception("Failed to ack sold notifications")


agent.include(protocol, publish_manifest=True)
