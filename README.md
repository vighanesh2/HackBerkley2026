# Diagram Drawing Coach

Learn technical diagrams by **drawing** — circuits, neural networks, flowcharts — with a vision AI coach, shadow reference overlay, and voice guidance.

**ASI:One agent:** deploy `agent/drawing_agent.py` on Agentverse (handle `@diagram-coach`).

## Architecture

```
ASI:One  →  Agentverse (drawing_agent.py)
                →  POST /api/drawing/session  (creates canvas link)
User     →  /draw/[sessionId]  (canvas + vision coach)
                →  POST /api/drawing/coach   (vision feedback)
                →  POST /api/drawing/reference (upload hidden reference)
```

## Local dev

```bash
cp .env.example .env.local   # if you have one
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you land on the canvas to upload a reference and start drawing.

### Required env vars

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_APP_URL` | Canvas links (e.g. `http://localhost:3000`) |
| `AGENT_API_SECRET` | Auth for Agentverse → API calls |
| `VISION_API_KEY` | Vision coach (or `OPENAI_API_KEY`) |
| `DEEPGRAM_API_KEY` | Optional — Deepgram voice (STT + TTS); falls back to browser speech if unset |

Optional: Supabase for reference image storage (`NEXT_PUBLIC_SUPABASE_URL`, keys).

## Agentverse deploy

See [AGENTVERSE_DEPLOY.md](./AGENTVERSE_DEPLOY.md) and [agent/DRAWING_ASI_ONE_SETUP.md](./agent/DRAWING_ASI_ONE_SETUP.md).

**Agent secrets:**

| Secret | Value |
|--------|--------|
| `DRAWING_APP_URL` | `https://your-app.vercel.app` |
| `AGENT_API_SECRET` | same as Vercel |

**Script:** `agent/drawing_agent.py`  
**Profile README:** paste `agent/DRAWING_AGENT_README.md` in Agentverse agent description / overview (there is no separate README tab on all plans — use the agent profile **Description** or **Overview** field).

## API

| Route | Auth | Purpose |
|-------|------|---------|
| `GET /api/drawing/health` | none | Health check for agent `ping` |
| `POST /api/drawing/session` | agent key or user session | Create canvas session |
| `POST /api/drawing/coach` | none (session id) | Vision coaching |
| `POST /api/drawing/reference` | none | Upload reference image |
| `GET /api/drawing/ghost` | none | Shadow reference image |

Agent auth header: `X-Agent-Api-Key: <AGENT_API_SECRET>`
