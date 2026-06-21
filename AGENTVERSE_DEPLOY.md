# Feynman Course Agent — Deploy Guide

## Architecture

```
ASI:One Chat  →  Agentverse (agent/agent.py)  →  Vercel /api/course  →  LangGraph + ASI-1
```

## Step 1 — Deploy Next.js to Vercel

1. Push to GitHub and import on [vercel.com](https://vercel.com)
2. Set environment variable:

| Variable | Value |
|----------|--------|
| `ASI_API_KEY` | from [asi1.ai/dashboard/api-keys](https://asi1.ai/dashboard/api-keys) |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` |

3. Redeploy

Your course API: **`https://your-app.vercel.app/api/course`**

## Step 2 — Deploy agent on Agentverse

1. [agentverse.ai](https://agentverse.ai) → **+ Launch an Agent** → blank script
2. **Build** — paste `agent/agent.py`
3. **README** — paste `agent/AGENTVERSE_README.md`
4. **Secrets**:

| Secret | Value |
|--------|--------|
| `MARKETPLACE_API_URL` | `https://your-app.vercel.app/api/course` |
| `AGENTVERSE_API_KEY` | from [agentverse.ai/profile/api-keys](https://agentverse.ai/profile/api-keys) |

5. Click **Run**

## Step 3 — Test on ASI:One

1. Open [asi1.ai](https://asi1.ai) → **Agents** toggle on
2. Chat with your agent or search for Feynman / course learning
3. Say: *"I want to learn basic cryptography"*
4. Confirm outline → read lesson → explain back → watch gap remediation

## Demo script (60 seconds)

> "Most AI tutors just dump text. This agent generates a full course from your goal, then uses the Feynman Technique — teach simply, you explain back, it finds gaps and re-teaches until you actually understand. The tutoring loop runs on LangGraph with ASI-1."

## Troubleshooting

| Error | Fix |
|-------|-----|
| `ASI_API_KEY is not configured` | Add key in Vercel env vars and redeploy |
| `Course API is not configured` | Set `MARKETPLACE_API_URL` to `/api/course` in Agentverse |
| Agent timeout | Course generation can take 10–30s; agent timeout is 60s |
