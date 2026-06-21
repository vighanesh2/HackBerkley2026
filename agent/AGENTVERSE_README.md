# SellAnything — Shopify Commerce Agent

An autonomous AI agent discoverable on **ASI:One** that turns natural language into **live Shopify product listings**. This is not a chatbot — it completes a real e-commerce workflow end to end.

## Problem solved

Selling online is friction-heavy: sellers must write titles, descriptions, set prices, pick categories, and publish manually. **SellAnything** lets a user say *"Sell my road bike for $450"* and the agent handles the rest — collecting missing details, confirming, then **creating a real product on Shopify** via the Admin API.

## What this agent does (real actions)

1. **Understands intent** — uses ASI-1 to parse free-form selling requests
2. **Collects product data** — multi-step conversation with persistent state (`ctx.storage`)
3. **Confirms before acting** — shows a draft summary; user approves with "yes"
4. **Executes a transaction** — calls a secure backend that runs Shopify `productCreate` + price update
5. **Returns proof** — live storefront URL + Shopify Admin link

## Example prompts (try on ASI:One)

- "I want to sell my road bike for $450"
- "Help me list a used MacBook on my Shopify store"
- "Post my IKEA desk — furniture, $80, good condition"
- "List item"

## Keywords for discovery

shopify, ecommerce, sell products, list items, online store, commerce agent, product listing, automate selling, ASI agent, marketplace automation, create product, storefront

## Architecture

```
User (ASI:One Chat)
    → Agentverse Hosted Agent (ACP + ASI-1)
        → Next.js API (/api/listings)
            → Shopify Admin GraphQL API
                → Live product on merchant store
```

## Tech stack

- **Agentverse** — hosted uAgent with Agent Chat Protocol (ASI:One compatible)
- **ASI-1** — intent parsing and natural language understanding
- **Next.js** — secure action layer (Shopify credentials never exposed to chat)
- **Shopify Admin API** — real product creation

## Ideal users

- Small sellers who want to list inventory quickly
- Hackathon demo: merchant says what to sell → product appears in Shopify Admin in seconds

## Demo flow for judges

1. Open ASI:One → enable **Agents** toggle
2. Search: *"agent that posts products to Shopify"*
3. Chat with **SellAnything**
4. Say: *"Sell my vintage camera for $120"*
5. Confirm with *"yes"*
6. Open the returned Shopify Admin link — product is live
