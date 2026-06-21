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
from uuid import uuid4

import requests
from openai import OpenAI
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

STEPS = ("idle", "title", "description", "price", "category", "confirm")


def storage_key(sender: str) -> str:
    return f"listing:{sender}"


def get_session(ctx: Context, sender: str) -> dict:
    return ctx.storage.get(storage_key(sender)) or {"step": "idle", "draft": {}}


def save_session(ctx: Context, sender: str, session: dict) -> None:
    ctx.storage.set(storage_key(sender), session)


def clear_session(ctx: Context, sender: str) -> None:
    ctx.storage.set(storage_key(sender), None)


def parse_price(text: str) -> float | None:
    match = re.sub(r",", "", text).replace("$", " ").strip()
    found = re.search(r"(\d+(?:\.\d{1,2})?)", match)
    if not found:
        return None
    return float(found.group(1))


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
        'Reply "yes" to auto-post to Shopify or "no" to cancel.'
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


def post_listing(ctx: Context, draft: dict, seller_id: str) -> str:
    api_url = os.environ.get("MARKETPLACE_API_URL")
    secret = os.environ.get("LISTINGS_API_SECRET")

    if not api_url:
        return "MARKETPLACE_API_URL is not configured in Agent Secrets."

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
        if listing_url:
            reply = f"Done! Your product is live on Shopify.\n\nStore: {listing_url}"
            if admin_url:
                reply += f"\nAdmin: {admin_url}"
            return reply
        return "Product posted to Shopify successfully."
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
        return f"Could not post to Shopify: {detail}"


def process_message(ctx: Context, sender: str, text: str) -> str:
    message = text.strip()
    lower = message.lower()
    session = get_session(ctx, sender)
    step = session.get("step", "idle")
    draft = session.get("draft", {})

    if step == "confirm":
        if lower in {"yes", "y", "confirm", "post", "post it"}:
            required = ("title", "description", "price", "category")
            if not all(draft.get(field) for field in required):
                clear_session(ctx, sender)
                return "Something was missing from the draft. Say \"list item\" to start over."

            reply = post_listing(ctx, draft, seller_id=sender[:16])
            clear_session(ctx, sender)
            return reply

        if lower in {"no", "n", "cancel"}:
            clear_session(ctx, sender)
            return 'Listing cancelled. Say "list item" whenever you want to try again.'

        return 'Please reply "yes" to post or "no" to cancel.'

    if step == "idle":
        if not wants_to_list(message):
            asi_reply = ask_asi(
                "You are a Shopify listing assistant. Help users post products to their Shopify store. "
                "Keep replies under 3 sentences.",
                message,
            )
            if asi_reply:
                return asi_reply
            return (
                'I auto-post products to Shopify for you. Say "list item" or '
                'describe what you want to sell, e.g. "Sell my desk for $80".'
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
            "title": "What is the product title?",
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
    return 'Say "list item" to start a new listing.'


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

    reply = process_message(ctx, sender, text)

    await ctx.send(
        sender,
        ChatMessage(
            timestamp=datetime.now(timezone.utc),
            msg_id=uuid4(),
            content=[
                TextContent(type="text", text=reply),
                EndSessionContent(type="end-session"),
            ],
        ),
    )


@protocol.on_message(ChatAcknowledgement)
async def handle_ack(ctx: Context, sender: str, msg: ChatAcknowledgement):
    pass


agent.include(protocol, publish_manifest=True)
