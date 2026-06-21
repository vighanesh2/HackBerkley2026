export const DRAWING_COACH_JSON_SCHEMA = `{
  "currentPart": "short name of the piece to draw now, e.g. Top wire, Light bulb, Battery",
  "explanation": "1-2 sentences explaining what this part is, where it sits in the diagram, and how to draw the symbol",
  "tip": "one short spoken instruction for the stroke/shape to make right now",
  "severity": "info" | "nudge" | "fix",
  "nextStep": "repeat the single action in different words",
  "praise": "brief encouragement or empty string",
  "hintShapes": [
    {
      "type": "line" | "rectangle" | "ellipse" | "arrow",
      "x": 0.0-1.0,
      "y": 0.0-1.0,
      "x2": 0.0-1.0,
      "y2": 0.0-1.0,
      "w": 0.0-1.0,
      "h": 0.0-1.0,
      "label": "optional short label"
    }
  ]
}`;

export const DRAWING_COACH_SYSTEM_PROMPT = `You are a patient drawing coach helping a learner reproduce a reference diagram on a blank canvas.

While you guide them, the learner sees a FAINT SHADOW of the full reference diagram behind their canvas. Your job is to name each part, explain what it actually is, and tell them exactly what to draw next.

You receive TWO images:
1. REFERENCE — the target diagram
2. CURRENT — what the learner has drawn so far (may be blank or partial)

Always fill in currentPart and explanation:
- currentPart: the specific component or segment they should focus on now (e.g. "Circuit outline", "Top wire", "Light bulb", "Open switch", "Battery")
- explanation: what that part represents in the diagram and how to draw its symbol (e.g. "The light bulb sits on the right side. Draw a circle with an X inside it.")

Coordinate system for hintShapes:
- (0,0) = top-left of the drawing frame, (1,1) = bottom-right
- Match the reference layout proportions
- hintShapes are dashed ghost guides for ONLY the next micro-step (1–3 shapes max)

Hint shape rules:
- Use "line" for straight wires, connectors, or frame edges (x,y = start, x2,y2 = end)
- Use "rectangle" for boxes or outer frames
- Use "ellipse" for circles (e.g. light bulbs, nodes)
- Use "arrow" only for directed flowchart arrows — NOT for circuit wires
- Every hintShape must match your spoken tip

Coaching strategy:
- Give ONE concrete micro-instruction at a time
- Use spatial language: top edge, left side, center, below the top wire
- If the canvas is blank, start with the skeleton/outline first, then add one symbol at a time
- For electrical circuits: outline loop → top wire → bulb → switch → battery
- Continue from prior coaching when history is provided — do not repeat completed steps

Respond with JSON ONLY — no markdown fences — using exactly these keys:
${DRAWING_COACH_JSON_SCHEMA}`;

export function buildCoachUserPrompt(options: {
  topic: string;
  transcript?: string;
  trigger: string;
  recentTips?: string[];
}): string {
  const isHint = options.trigger === "hint";
  const parts = [
    `Learning goal: ${options.topic}`,
    `Check trigger: ${options.trigger}`,
    "Compare REFERENCE (first image) vs CURRENT canvas (second image).",
    "The learner can see a faint shadow of the reference while you guide them.",
    "Both images share the same coordinate frame: top-left (0,0) to bottom-right (1,1).",
    isHint
      ? "The learner asked for a visual hint. Name the part in currentPart, explain it in explanation, and return hintShapes for where to draw (1–3 dashed guides)."
      : "Return JSON with keys: currentPart, explanation, tip, severity, nextStep, praise, hintShapes.",
  ];

  if (options.recentTips?.length) {
    parts.push(
      `Recent coaching already given (continue from here, do not repeat):\n${options.recentTips.map((tip, i) => `${i + 1}. ${tip}`).join("\n")}`,
    );
  }

  if (options.transcript?.trim()) {
    parts.push(`Recent learner speech: "${options.transcript.trim()}"`);
  }

  return parts.join("\n");
}

export function buildCoachSpoken(tip: {
  praise?: string;
  currentPart?: string;
  explanation?: string;
  tip?: string;
}): string {
  const segments: string[] = [];
  if (tip.praise?.trim()) segments.push(tip.praise.trim());
  if (tip.currentPart?.trim()) {
    segments.push(`Now drawing: ${tip.currentPart.trim()}.`);
  }
  if (tip.explanation?.trim()) segments.push(tip.explanation.trim());
  if (tip.tip?.trim()) segments.push(tip.tip.trim());
  return segments.join(" ").trim();
}
