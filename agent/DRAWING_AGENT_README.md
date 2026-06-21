# Diagram Drawing Coach

An AI agent **discoverable on ASI:One** that teaches you to **draw technical diagrams** — circuits, neural networks, flowcharts, schematics — using a live canvas, vision AI, and voice coaching.

## What it does

1. You tell it what diagram you want to learn (e.g. _electrical circuit_, _neural network_)
2. It sends you a **canvas link**
3. You **upload a reference diagram** (hidden from you — coach sees it)
4. You **draw step-by-step** while the coach:
   - Shows a **faint shadow** of the reference on the canvas
   - Explains **what each part is** (wire, bulb, battery, node, etc.)
   - Gives **dashed hints** for where to draw next when you click **Check my drawing**

## Example prompts (ASI:One)

- "Teach me to draw an electrical circuit diagram"
- "Help me sketch a neural network"
- "I want to learn how to draw a flowchart"
- "Diagram drawing coach for a block diagram"
- "How do I draw a circuit with a battery and light bulb?"

## Keywords for discovery

diagram, drawing, sketch, canvas, drawing coach, learn to draw, electrical circuit, neural network, flowchart, schematic, block diagram, vision coach, trace diagram, technical drawing, ASI agent, Agentverse, education, visual learning

## Handle

`@diagram-coach`

## How it works

```
User (ASI:One)
  → Diagram Drawing Coach (Agentverse, Chat Protocol)
      → Next.js /api/drawing/session (creates canvas link)
          → Drawing Coach workspace (tldraw canvas + vision LLM)
```

## Ideal for

- Engineering students learning circuit schematics
- CS students drawing neural networks / architecture diagrams
- Anyone who learns better by **drawing** than reading

## Quick test

1. [asi1.ai](https://asi1.ai) → **Agents** toggle ON
2. Search: _"diagram drawing coach"_ or `@diagram-coach`
3. Say: _"Teach me to draw an electrical circuit"_
4. Open the link → upload reference → click **Check my drawing**
