# Feynman Course Agent — Agentverse + ASI:One Setup

Follow these steps to launch the agent on **Agentverse** and make it **discoverable on ASI:One**.

## Prerequisites

1. **Vercel app deployed** with env vars (see [AGENTVERSE_DEPLOY.md](../AGENTVERSE_DEPLOY.md))
2. **Agentverse account** — [agentverse.ai](https://agentverse.ai)
3. **Agentverse API key** — [agentverse.ai/profile/api-keys](https://agentverse.ai/profile/api-keys)

Generate a shared secret (use the same value on Vercel **and** Agentverse):

```bash
openssl rand -hex 32
```

Set on Vercel as `AGENT_COURSE_API_SECRET` (or `LISTINGS_API_SECRET`).

---

## Step 1 — Create the hosted agent

1. Go to [agentverse.ai](https://agentverse.ai) → **Agents** → **+ Launch an Agent**
2. Choose **Create an Agent** → **Blank** template
3. Name: `Feynman Course Agent`
4. Keywords (pick 3 for discovery):
   - `education`
   - `tutoring`
   - `Feynman`
5. Click **Launch My Agent**

---

## Step 2 — Paste the code

### Build tab → Script

Copy the entire contents of [`agent/agent.py`](./agent.py) into the editor.

The agent already includes:

- **Agent Chat Protocol** (ASI:One compatible)
- `publish_manifest=True` (required for discovery)
- Course generation via your Vercel `/api/course` API
- Drawing Coach — sends a canvas link when users ask to draw diagrams
- Agent-to-agent video discovery on Agentverse

Click **Save**.

### Build tab → README

Copy the entire contents of [`agent/AGENTVERSE_README.md`](./AGENTVERSE_README.md).

This README is what ASI:One uses to match user queries to your agent.

---

## Step 3 — Agent secrets

In the agent **Secrets** panel, add:

| Secret | Example value |
|--------|----------------|
| `COURSE_API_URL` | `https://hack-berkley2026.vercel.app/api/course` |
| `AGENT_COURSE_API_SECRET` | same secret as on Vercel |
| `AGENTVERSE_API_KEY` | your Agentverse API key |

Replace the Vercel URL with your deployed app URL if different.

---

## Step 4 — Run the agent

1. Click **Run** in the Agentverse dashboard
2. Confirm status is **Active**
3. Send `ping` in the test chat — you should see:

```
Feynman Course Agent is online.
Course API: configured
API secret: configured
Video agents: enabled (Agentverse search)
```

If anything shows `MISSING`, fix secrets and Run again.

---

## Step 5 — Optimize for ASI:One discovery

In the agent **Profile** / dashboard settings:

| Field | Suggested value |
|-------|-----------------|
| **Handle** | `@feynman-coach` (max 20 chars; helps direct lookup on ASI:One) |
| **Short description** | Generates personalized courses and teaches with the Feynman Technique. Includes a vision drawing coach. |
| **Avatar** | Upload a simple education/tutor icon |

Make sure the agent stays **Active** (Run). Inactive agents are not discoverable.

---

## Step 6 — Test on ASI:One

1. Open [asi1.ai](https://asi1.ai)
2. Turn on the **Agents** toggle in chat
3. Try one of these:

**Course mode:**
> I want to learn basic cryptography

**Drawing Coach mode:**
> Teach me to draw an electrical circuit diagram

**Direct handle (after setting @feynman-coach):**
> @feynman-coach help me learn neural networks

**Health check:**
> ping

---

## Optional — Hackathon / programmatic registration

If your hackathon page asks you to run a registration script:

```bash
cd agent
pip install uagents-core requests
export AGENTVERSE_KEY="your-agentverse-api-key"
export AGENT_SEED_PHRASE="seed phrase shown in Agentverse agent dashboard"
export COURSE_API_URL="https://your-app.vercel.app/api/course"
python register_feynman_agent.py
```

For **hosted agents**, the seed phrase is in your Agentverse agent dashboard after creation. The endpoint is usually your agent’s mailbox/inspector URL — only needed for external (non-hosted) agents.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Agent not found on ASI:One | Agents toggle ON; agent **Active**; README has education keywords |
| `Course API: MISSING` | Set `COURSE_API_URL` secret (full `/api/course` URL) |
| `401 Unauthorized` from course API | Match `AGENT_COURSE_API_SECRET` on Vercel and Agentverse |
| Drawing link goes to localhost | Set `NEXT_PUBLIC_APP_URL` on Vercel to your production URL |
| Agent timeout | Re-paste latest `agent.py`; confirm **Run**; check Agentverse logs |
