# Feynman Course Agent — Deploy Guide

## Architecture

```
ASI:One Chat  →  Agentverse (agent/agent.py)
                      ├─ Agentverse Search → video specialist agents (agent-to-agent)
                      └─ Vercel /api/course  →  LangGraph + RAG + ASI-1
Web browser   →  Next.js (Supabase auth)  →  same /api/course  →  YouTube search fallback + library saves
```

**Videos:** On ASI:One, your hosted agent searches Agentverse for video agents and messages them directly. The web app uses server-side YouTube search as a fallback when users are logged in on the site.

Agentverse uses a **shared API secret** (not Supabase login). The web app uses **email/password + Supabase**.

## Step 1 — Deploy Next.js to Vercel

1. Push to GitHub and import on [vercel.com](https://vercel.com)
2. Set environment variables:

| Variable | Value |
|----------|--------|
| `ASI_API_KEY` | from [asi1.ai/dashboard/api-keys](https://asi1.ai/dashboard/api-keys) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role (instant sign-up, optional) |
| `AGENT_COURSE_API_SECRET` | random secret string — **same value** as Agentverse secret |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` |
| `VISION_API_KEY` | OpenAI (or compatible) key for **Drawing Coach** vision (`gpt-4o-mini`) |
| `VISION_MODEL` | optional — defaults to `gpt-4o-mini` |

3. Run `supabase/schema.sql` in Supabase SQL Editor
4. Redeploy

Your course API: **`https://your-app.vercel.app/api/course`**

## Step 2 — Deploy agent on Agentverse

1. [agentverse.ai](https://agentverse.ai) → **+ Launch an Agent** → blank script
2. **Build** — paste `agent/agent.py`
3. **README** — paste `agent/AGENTVERSE_README.md`
4. **Secrets**:

| Secret | Value |
|--------|--------|
| `COURSE_API_URL` | `https://your-app.vercel.app/api/course` |
| `AGENT_COURSE_API_SECRET` | same random string as Vercel |
| `AGENTVERSE_API_KEY` | from [agentverse.ai/profile/api-keys](https://agentverse.ai/profile/api-keys) — **required for agent-to-agent video discovery** |

Legacy names `MARKETPLACE_API_URL` and `LISTINGS_API_SECRET` still work.

5. Click **Run**

## Step 3 — Test on ASI:One

**Full walkthrough:** [agent/ASI_ONE_SETUP.md](./agent/ASI_ONE_SETUP.md)

### Make it discoverable

1. In Agentverse agent **Profile**, set handle: `@feynman-coach`
2. Keep agent status **Active** (click **Run**)
3. Use keywords at launch: `education`, `tutoring`, `Feynman`
4. Paste [`agent/AGENTVERSE_README.md`](./agent/AGENTVERSE_README.md) in the README tab

### Course mode

1. Open [asi1.ai](https://asi1.ai) → **Agents** toggle on
2. Chat with your agent or search for Feynman / course learning
3. Say: *"I want to learn basic cryptography"*
4. Confirm outline → read lesson → explain back → watch gap remediation

### Drawing Coach mode

1. Say: *"Teach me to draw a neural network diagram"*
2. Agent replies with a link: `https://your-app.vercel.app/draw/{sessionId}`
3. Open the link → upload reference diagram → draw on canvas
4. Allow microphone — the AI coach compares your canvas to the reference and speaks tips

Requires `VISION_API_KEY` on Vercel. Works best in **Chrome** (continuous speech recognition).

## Diagram Drawing Coach agent (separate)

For a **dedicated ASI:One agent** that only handles diagram drawing (not full courses), deploy **`agent/drawing_agent.py`** — see [agent/DRAWING_ASI_ONE_SETUP.md](./agent/DRAWING_ASI_ONE_SETUP.md).

| Agentverse secret | Value |
|-------------------|--------|
| `DRAWING_APP_URL` | `https://your-app.vercel.app` |
| `AGENT_API_SECRET` | same as `AGENT_COURSE_API_SECRET` on Vercel |

Suggested handle: `@diagram-coach`

### Optional: RAG notes via agent chat

```
I want to learn linear algebra
--- notes ---
Your pasted textbook excerpt or study notes here...
```

## Demo script (60 seconds)

> "Most AI tutors just dump text. This agent generates a full course from your goal — grounded in your notes via RAG — then uses the Feynman Technique. The tutoring loop runs on LangGraph with ASI-1."

## Troubleshooting

| Error | Fix |
|-------|-----|
| `ASI_API_KEY is not configured` | Add key in Vercel env vars and redeploy |
| `Unauthorized` / 401 from course API | Set matching `AGENT_COURSE_API_SECRET` on Vercel **and** Agentverse |
| `Course API is not configured` | Set `COURSE_API_URL` in Agentverse secrets (full `https://…/api/course` URL) |
| Agent timeout / keeps loading / "Could not reach the agent" | **Most common:** old `agent.py` ignored all ASI:One senders (they use `agent1…` addresses). Re-paste latest `agent/agent.py` and click **Run**. Also confirm agent status is **Active**. |
| Agent status not **Active** | Agentverse dashboard → click **Run** |
| No videos in ASI:One course | Confirm `AGENTVERSE_API_KEY` in Agentverse secrets. Send `ping` — should say `Video agents: enabled`. Check Agentverse logs for video agent queries. |
| Drawing coach says vision not configured | Add `VISION_API_KEY` on Vercel and redeploy |
| Mic / voice not working | Use Chrome; click **Mic on** after uploading reference |
