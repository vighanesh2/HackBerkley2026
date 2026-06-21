# Feynman Course Agent

An autonomous AI agent discoverable on **ASI:One** that **generates personalized courses** and teaches using the **Feynman Learning Technique** — not just answering questions, but guiding real understanding.

## Problem solved

Most AI tutors dump information. People think they understand until they try to explain it. **Feynman Course Agent** builds a structured course from your goal, teaches each module in plain language, then makes you explain it back — and closes the gaps until you actually get it.

## What this agent does (real actions)

1. **Generates a course outline** from your topic (4–6 modules, foundations → application)
2. **Finds the best videos** by searching Agentverse and messaging specialist video agents
3. **Drawing Coach** — agent creates a canvas session; vision + voice guides you while you draw a reference diagram
4. **Teaches simply** — Feynman-style explanations with analogies and examples
5. **Challenges you** — explain the module in your own words
6. **Evaluates understanding** — structured gap analysis via LLM
7. **Remediates** — re-teaches weak spots until you pass
8. **Advances module-by-module** until the course is complete

## Example prompts (try on ASI:One)

- "I want to learn linear algebra for machine learning"
- "Build me a course on the French Revolution"
- "Help me understand how neural networks work"
- "Teach me to draw a circuit diagram"
- "I want to learn how to sketch a flowchart"
- "Prepare me for AP Biology unit on genetics"

## Keywords for discovery

learn, course, education, tutoring, Feynman technique, study agent, personalized learning, explain like I'm five, mastery learning, AI teacher, curriculum generator, video recommendation, youtube, ASI agent

## Architecture

```
User (ASI:One Chat)
    → Agentverse Hosted Agent (ACP)
        → Agentverse Search API (find video specialist agents)
        → Agent-to-agent chat (request best YouTube/video links)
        → Next.js API (/api/course) + X-Agent-Api-Key
            → LangGraph Feynman state machine + RAG on uploaded notes
                → ASI-1 (outline, teach, evaluate)
```

Web app users hit the same API after Supabase login and get cloud library saves.

## Tech stack

- **Agentverse** — hosted uAgent with Agent Chat Protocol (ASI:One compatible)
- **LangGraph** — orchestrates outline → teach → challenge → evaluate → remediate loop
- **ASI-1** — course generation and tutoring intelligence
- **Next.js** — secure API layer on Vercel

## Ideal users

- Students preparing for exams
- Professionals upskilling in a new domain
- Anyone who wants to *understand*, not memorize

## Demo flow for judges

1. Open ASI:One → enable **Agents** toggle
2. Search: *"agent that teaches using Feynman technique"*
3. Say: *"I want to learn basic cryptography"*
4. Confirm the outline → read the lesson → explain it back
5. Watch the agent identify gaps and re-teach until you master each module
