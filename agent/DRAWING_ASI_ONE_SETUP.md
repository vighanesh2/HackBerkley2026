# Diagram Drawing Coach — Agentverse + ASI:One

This is a **separate agent** from the Feynman Course Agent. Deploy **`drawing_agent.py`** only.

## Prerequisites

1. Next.js app deployed on Vercel with Drawing Coach APIs working
2. Vercel env vars:

| Variable | Example |
|----------|---------|
| `NEXT_PUBLIC_APP_URL` | `https://hack-berkley2026.vercel.app` |
| `AGENT_COURSE_API_SECRET` | shared secret (or `LISTINGS_API_SECRET`) |
| `VISION_API_KEY` | OpenAI-compatible vision key |

Test locally: `http://localhost:3000/draw/test?topic=electrical%20circuit`

---

## Step 1 — Create hosted agent on Agentverse

1. [agentverse.ai](https://agentverse.ai) → **+ Launch an Agent** → **Blank**
2. Name: **Diagram Drawing Coach**
3. Keywords: `diagram`, `drawing`, `sketch`
4. **Launch My Agent**

---

## Step 2 — Paste code

| Tab | File to copy |
|-----|----------------|
| **Script** | `agent/drawing_agent.py` |
| **README** | `agent/DRAWING_AGENT_README.md` |

Click **Save**.

---

## Step 3 — Secrets

| Secret | Value |
|--------|--------|
| `DRAWING_APP_URL` | `https://hack-berkley2026.vercel.app` |
| `AGENT_API_SECRET` | same as `AGENT_COURSE_API_SECRET` on Vercel |

---

## Step 4 — Run

1. Click **Run** → status **Active**
2. Test chat: `ping` → should show App URL and API secret configured

---

## Step 5 — ASI:One discovery

In agent **Profile**:

| Field | Value |
|-------|--------|
| Handle | `@diagram-coach` |
| Description | Vision-powered drawing coach for circuits, neural networks, and flowcharts. |

---

## Step 6 — Test on ASI:One

1. [asi1.ai](https://asi1.ai) → **Agents** ON
2. Say: _"Teach me to draw an electrical circuit diagram"_
3. Open the canvas link → upload reference → **Check my drawing**

Or direct: `@diagram-coach help me draw a neural network`

---

## Optional registration script

```bash
export AGENTVERSE_KEY="your-key"
export AGENT_SEED_PHRASE="from agent dashboard"
export AGENT_ENDPOINT="mailbox URL from Agent Inspector"
python agent/register_drawing_agent.py
```

Hosted agents usually only need the dashboard steps above.
