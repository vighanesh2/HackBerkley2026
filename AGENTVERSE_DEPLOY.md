# SellAnything — Hackathon Agent (ASI:One + Agentverse + Shopify)

Autonomous commerce agent: discovered on ASI:One, executes real Shopify product creation.

## Hackathon fit

| Requirement | How we meet it |
|-------------|----------------|
| Discoverable on ASI:One | Agent Chat Protocol + Agentverse README |
| Understands intent | ASI-1 parses free-form sell requests |
| Takes meaningful action | Creates live Shopify products via Admin API |
| More than a chatbot | Multi-step workflow + external API execution + confirmation gate |

## Architecture

```
ASI:One Chat  →  Agentverse (agent/agent.py)  →  Vercel API  →  Shopify
```

Shopify credentials live on **Vercel only**. The Agentverse agent never sees them — it calls your API with a shared secret.

---

## Step 1 — Deploy the Next.js backend (Vercel)

The agent needs a **public URL** — Agentverse cannot reach `localhost`.

1. Push repo to GitHub
2. Import at [vercel.com](https://vercel.com) → deploy
3. Add **Environment Variables** in Vercel:

| Variable | Value |
|----------|--------|
| `LISTINGS_API_SECRET` | same as local |
| `SHOPIFY_STORE_DOMAIN` | `sellanything-ne4kduzf.myshopify.com` |
| `SHOPIFY_CLIENT_ID` | from Dev Dashboard |
| `SHOPIFY_CLIENT_SECRET` | from Dev Dashboard |
| `SHOPIFY_API_VERSION` | `2026-04` |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` |

4. Redeploy after adding env vars
5. Your agent API URL: **`https://your-app.vercel.app/api/listings`**

Test:

```bash
curl -X POST https://your-app.vercel.app/api/listings \
  -H "Authorization: Bearer YOUR_LISTINGS_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","description":"Hackathon test","price":9.99,"category":"Other"}'
```

Should return `"publishedToShopify": true` and a `shopifyUrl`.

---

## Step 2 — Deploy agent on Agentverse (Hosted — recommended for hackathon)

**You do NOT need `register_chat_agent` for hosted agents.**  
That script is only for external agents running on Render/your laptop with a mailbox.

### Hosted agent (paste & run)

1. Go to **[agentverse.ai](https://agentverse.ai)** → sign in
2. **+ Launch an Agent** → blank script
3. **Build tab** — paste entire contents of `agent/agent.py`
4. **README tab** — paste entire contents of `agent/AGENTVERSE_README.md`
5. **Secrets** (left sidebar, key icon):

| Secret | Value |
|--------|--------|
| `ASI_API_KEY` | from [asi1.ai/dashboard/api-keys](https://asi1.ai/dashboard/api-keys) |
| `MARKETPLACE_API_URL` | `https://hack-berkley2026.vercel.app/api/listings` |
| `LISTINGS_API_SECRET` | same as Vercel |

6. Click **Run** — agent should show as active in Almanac

### External agent (optional — uses `register_chat_agent`)

Only if you run the agent outside Agentverse (Render, local + mailbox):

| Variable | Purpose |
|----------|---------|
| `AGENTVERSE_KEY` | API key from Agentverse profile |
| `AGENT_SEED_PHRASE` | unique seed for your agent |
| `AGENT_ENDPOINT` | **mailbox URL from Agent Inspector** — NOT Vercel |
| `MARKETPLACE_API_URL` | `https://hack-berkley2026.vercel.app/api/listings` |

```bash
python agent/register_external.py
```

**Common mistake:** passing `https://hack-berkley2026.vercel.app/` as the registration endpoint.  
That URL is your **Shopify backend**, not the agent. The agent endpoint comes from Agent Inspector after starting a mailbox agent.

---

## Step 3 — Test on ASI:One

1. Open **[asi1.ai](https://asi1.ai)**
2. Turn on the **Agents** toggle
3. Ask: *"Find an agent that posts products to Shopify"*
4. Click **Chat with Agent** on SellAnything
5. Say: *"Sell my desk for $80"* → follow prompts → *"yes"*
6. Open the Shopify Admin link in the response

---

## Demo script for judges (60 seconds)

> "Most AI apps stop at conversation. SellAnything is an Agentverse agent discoverable on ASI:One. I tell it what I want to sell in plain English. It uses ASI-1 to understand my intent, walks me through a confirmation flow, then executes a real Shopify Admin API call. The product is live in the store — here's the admin link."

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `app_not_installed` | Install SellAnything app on dev store; release version with `write_products` |
| `401 Unauthorized` | `LISTINGS_API_SECRET` mismatch between Agentverse and Vercel |
| Agent can't reach API | Use Vercel URL, not localhost |
| `MARKETPLACE_API_URL is not configured` | Add secret in Agentverse Secrets tab |

---

## Docs

- [ASI:One compatible hosted agent](https://agentverse.ai/docs/uAgents/asimini-agent)
- [Enable Chat Protocol](https://docs.agentverse.ai/documentation/getting-started/enable-chat-protocol)
- [Agentverse hosted agents](https://docs.agentverse.ai/documentation/create-agents/hosted-agents)
