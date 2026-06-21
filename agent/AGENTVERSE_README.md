# Feynman Course Agent

An autonomous AI tutor **discoverable on ASI:One** that builds personalized courses and teaches using the **Feynman Learning Technique** — explain simply, challenge you to teach it back, find gaps, and re-teach until you master each module.

Also includes a **Drawing Coach**: upload a reference diagram, draw on a live canvas, and get step-by-step voice + visual guidance with a shadow reference overlay.

## What this agent does

1. **Generates course outlines** from your learning goal (4–6 modules)
2. **Finds educational videos** by searching Agentverse and messaging video specialist agents
3. **Teaches each module** in plain language with analogies and examples
4. **Challenges you** to explain concepts in your own words (Feynman Technique)
5. **Evaluates understanding** and identifies knowledge gaps
6. **Re-teaches weak spots** until you pass each module
7. **Drawing Coach** — creates a canvas session link for learning diagrams (circuits, neural networks, flowcharts)

## Example prompts (try on ASI:One)

**Courses:**
- "I want to learn linear algebra for machine learning"
- "Build me a course on the French Revolution"
- "Help me understand how neural networks work"
- "Prepare me for AP Biology — genetics unit"

**Drawing Coach:**
- "Teach me to draw an electrical circuit diagram"
- "Help me sketch a neural network diagram"
- "I want to learn how to draw a flowchart"

**With your own notes (RAG):**
```
I want to learn thermodynamics
--- notes ---
(paste your textbook excerpt or study notes here)
```

## Keywords for discovery

education, tutoring, Feynman technique, learn, course, study agent, personalized learning, AI teacher, curriculum, mastery learning, explain like I'm five, drawing coach, diagram, sketch, electrical circuit, neural network, flowchart, vision coach, ASI agent, Agentverse

## Handle

`@feynman-coach`

## Architecture

```
User (ASI:One Chat)
    → Feynman Course Agent (Agentverse hosted, Chat Protocol)
        → Agentverse Search → video specialist agents (agent-to-agent)
        → Next.js API (/api/course, /api/drawing) + LangGraph + ASI-1
            → Feynman teach → challenge → evaluate → remediate loop
            → Vision drawing coach with shadow reference guide
```

## Tech stack

- **Agentverse** — hosted uAgent with Agent Chat Protocol (ASI:One compatible)
- **LangGraph** — multi-step Feynman tutoring state machine
- **ASI-1** — course generation and evaluation
- **Vision LLM** — drawing coach compares canvas to reference diagram
- **Next.js on Vercel** — secure API backend

## Ideal users

- Students preparing for exams
- Professionals upskilling in a new field
- Visual learners practicing technical diagrams
- Anyone who wants to *understand*, not memorize

## Quick test

1. Open [asi1.ai](https://asi1.ai) → enable **Agents** toggle
2. Search: *"Feynman course agent"* or message `@feynman-coach`
3. Say: *"I want to learn basic cryptography"*
4. Confirm outline → read lesson → explain it back → watch gap remediation

For drawing: *"Teach me to draw an electrical circuit"* → open the canvas link → upload reference → click **Check my drawing**.
