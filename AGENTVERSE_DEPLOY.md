# Diagram Drawing Coach — Deploy Guide

## 1. Deploy Next.js to Vercel

Push to GitHub → import on [vercel.com](https://vercel.com).

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` |
| `AGENT_API_SECRET` | random secret — **same on Agentverse** |
| `VISION_API_KEY` | OpenAI-compatible vision key |
| `VISION_MODEL` | optional — default `gpt-4o-mini` |
| `NEXT_PUBLIC_SUPABASE_URL` | optional — reference image storage |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | optional |
| `SUPABASE_SERVICE_ROLE_KEY` | optional |

Run `supabase/schema.sql` if using Supabase (drawing sessions + reference bucket).

Health check: `GET https://your-app.vercel.app/api/drawing/health`

---

## 2. Create Agentverse hosted agent

1. [agentverse.ai](https://agentverse.ai) → **+ Launch an Agent** → Blank
2. Name: **Diagram Drawing Coach**
3. Keywords: `diagram`, `drawing`, `sketch`

### Build → Script

Paste all of **`agent/drawing_agent.py`**

### Profile / Description (README)

Agentverse does **not** always show a separate README upload. Paste **`agent/DRAWING_AGENT_README.md`** into:

- Agent **Overview** / **Description**, or
- **Profile** text field in the agent dashboard

This text is what ASI:One uses for discovery.

### Secrets

| Secret | Value |
|--------|--------|
| `DRAWING_APP_URL` | `https://your-app.vercel.app` |
| `AGENT_API_SECRET` | same as Vercel |

Click **Run** → status **Active**

Set handle: **`@diagram-coach`**

---

## 3. Test

### Agentverse chat

Send: `ping`

Expected:

```
Diagram Drawing Coach is online.
App URL: configured
Agent secret: configured
Backend: ok (vision=yes, agentSecret=yes)
```

### ASI:One

1. [asi1.ai](https://asi1.ai) → **Agents** ON
2. *"Teach me to draw an electrical circuit"*
3. Open canvas link → upload reference → **Check my drawing**

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Backend: unreachable` | Wrong `DRAWING_APP_URL`; redeploy Vercel |
| `agentSecret=no` on health | Set `AGENT_API_SECRET` on Vercel and redeploy |
| `401` on session create | Match `AGENT_API_SECRET` on Agentverse and Vercel |
| Canvas link is localhost | Set `NEXT_PUBLIC_APP_URL` on Vercel |
| Vision coach errors | Set `VISION_API_KEY` on Vercel |
