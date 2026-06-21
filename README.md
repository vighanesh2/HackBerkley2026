# Feynman Course Agent

AI agent (ASI:One + Agentverse + **LangGraph**) that **generates personalized courses** and teaches using the **Feynman Learning Technique**.

## Why LangGraph (not plain LangChain)?

| Tool | Best for |
|------|----------|
| **LangChain** | Single-shot chains — one prompt in, one answer out |
| **LangGraph** | Multi-step workflows with **loops and state** |

The Feynman Technique is inherently cyclic: **teach → explain back → find gaps → re-teach → repeat**. LangGraph models that as an explicit state graph (`outline → teach → challenge → evaluate → remediate`). LangChain alone would fight you on the loop.

## Architecture

```
User → ASI:One Chat → Agentverse Agent (agent/agent.py)
                              ↓
                    Next.js /api/course (LangGraph + ASI-1)
                              ↓
              Feynman loop per module until mastery
```

## Feynman loop

1. **Outline** — LLM generates 4–6 modules from your topic
2. **Teach** — simple explanation + analogy + example
3. **Challenge** — you explain it back in your own words
4. **Evaluate** — structured pass/fail + gap list
5. **Remediate** — re-teach gaps, challenge again
6. **Advance** — next module or course complete

## Quick start

### 1. Configure environment

```bash
cp .env.example .env.local
```

```env
ASI_API_KEY=your-key-from-asi1.ai-dashboard
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 2. Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and try: *"I want to learn Python data structures"*.

### 3. Deploy Agentverse agent

1. Deploy this app to Vercel with `ASI_API_KEY` set
2. Paste `agent/agent.py` into Agentverse **Build** tab
3. Paste `agent/AGENTVERSE_README.md` into **README** tab
4. Set secret: `MARKETPLACE_API_URL` = `https://your-app.vercel.app/api/course`
5. Test on ASI:One with Agents toggle on

## API

### `POST /api/course`

```json
{
  "message": "I want to learn quantum computing basics",
  "sessionId": "optional-session-key"
}
```

Response:

```json
{
  "reply": "...",
  "phase": "outline_ready",
  "topic": "quantum computing basics",
  "moduleIndex": 0,
  "moduleCount": 5
}
```

## Project structure

```
src/lib/course/feynman-graph.ts   ← LangGraph state machine
src/lib/course/llm.ts             ← ASI-1 client
src/app/api/course/route.ts       ← HTTP API
agent/agent.py                    ← Agentverse chat bridge
```
