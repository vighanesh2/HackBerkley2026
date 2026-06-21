import { z } from "zod";
import {
  buildCoachUserPrompt,
  DRAWING_COACH_SYSTEM_PROMPT,
} from "@/lib/drawing/coach-prompt";
import type { CoachSeverity, CoachTip } from "@/types/drawing";

const hintShapeSchema = z.object({
  type: z.enum(["rectangle", "ellipse", "arrow", "line"]),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1).optional(),
  h: z.number().min(0).max(1).optional(),
  x2: z.number().min(0).max(1).optional(),
  y2: z.number().min(0).max(1).optional(),
  label: z.string().optional(),
});

const coachTipSchema = z.object({
  tip: z.string().min(1),
  severity: z.enum(["info", "nudge", "fix"]),
  nextStep: z.string(),
  praise: z.string(),
  currentPart: z.string(),
  explanation: z.string(),
  hintShapes: z.array(hintShapeSchema).optional(),
});

export function isVisionConfigured(): boolean {
  return Boolean(
    process.env.VISION_API_KEY?.trim() ||
      process.env.OPENAI_API_KEY?.trim() ||
      process.env.ASI_API_KEY?.trim(),
  );
}

function getVisionConfig(): {
  apiKey: string;
  baseURL: string;
  model: string;
} {
  const apiKey =
    process.env.VISION_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    process.env.ASI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("VISION_API_KEY (or OPENAI_API_KEY / ASI_API_KEY) is not configured");
  }

  const baseURL =
    process.env.VISION_API_BASE_URL?.trim() ||
    process.env.OPENAI_BASE_URL?.trim() ||
    "https://api.openai.com/v1";

  const model =
    process.env.VISION_MODEL?.trim() ||
    process.env.OPENAI_VISION_MODEL?.trim() ||
    "gpt-4o-mini";

  return { apiKey, baseURL: baseURL.replace(/\/$/, ""), model };
}

function toDataUrl(image: string): string {
  if (image.startsWith("data:")) return image;
  return `data:image/png;base64,${image}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function pickString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function normalizeHintShapes(value: unknown): CoachTip["hintShapes"] {
  if (!Array.isArray(value)) return undefined;

  const shapes = value
    .map((item) => {
      const record = asRecord(item);
      if (!record) return null;

      const typeRaw = String(record.type ?? "rectangle").toLowerCase();
      const type =
        typeRaw.includes("line") || typeRaw.includes("wire")
          ? "line"
          : typeRaw.includes("arrow")
            ? "arrow"
            : typeRaw.includes("ellipse") ||
                typeRaw.includes("circle") ||
                typeRaw.includes("oval")
              ? "ellipse"
              : "rectangle";

      const x = Number(record.x);
      const y = Number(record.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

      const w = record.w !== undefined ? Number(record.w) : undefined;
      const h = record.h !== undefined ? Number(record.h) : undefined;
      const x2 = record.x2 !== undefined ? Number(record.x2) : undefined;
      const y2 = record.y2 !== undefined ? Number(record.y2) : undefined;
      const label =
        typeof record.label === "string" && record.label.trim()
          ? record.label.trim()
          : undefined;

      return {
        type,
        x: Math.min(1, Math.max(0, x)),
        y: Math.min(1, Math.max(0, y)),
        ...(w !== undefined && Number.isFinite(w)
          ? { w: Math.min(1, Math.max(0.02, w)) }
          : {}),
        ...(h !== undefined && Number.isFinite(h)
          ? { h: Math.min(1, Math.max(0, h)) }
          : {}),
        ...(x2 !== undefined && Number.isFinite(x2)
          ? { x2: Math.min(1, Math.max(0, x2)) }
          : {}),
        ...(y2 !== undefined && Number.isFinite(y2)
          ? { y2: Math.min(1, Math.max(0, y2)) }
          : {}),
        ...(label ? { label } : {}),
      };
    })
    .filter(Boolean) as NonNullable<CoachTip["hintShapes"]>;

  return shapes.length > 0 ? shapes.slice(0, 3) : undefined;
}

function normalizeSeverity(value: unknown): CoachSeverity {
  const raw = String(value ?? "info").toLowerCase();
  if (raw.includes("fix") || raw.includes("wrong") || raw.includes("error")) return "fix";
  if (raw.includes("nudge") || raw.includes("almost") || raw.includes("close")) return "nudge";
  return "info";
}

function unwrapCoachPayload(parsed: unknown): Record<string, unknown> | null {
  const root = asRecord(parsed);
  if (!root) return null;

  const nestedKeys = ["coach", "response", "result", "feedback", "data"];
  for (const key of nestedKeys) {
    const nested = asRecord(root[key]);
    if (nested && (pickString(nested, ["tip", "message", "instruction"]) || nested.nextStep)) {
      return nested;
    }
  }

  return root;
}

function parseJsonContent(content: string): unknown {
  const trimmed = content.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      return JSON.parse(fenced[1].trim());
    }

    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }

    throw new Error("Vision coach returned invalid JSON");
  }
}

function normalizeCoachTip(parsed: unknown): CoachTip {
  const record = unwrapCoachPayload(parsed);
  if (!record) {
    throw new Error("Vision coach returned non-object JSON");
  }

  const tip = pickString(record, [
    "tip",
    "message",
    "instruction",
    "spoken",
    "spokenTip",
    "feedback",
    "coachingTip",
  ]);

  const nextStep = pickString(record, [
    "nextStep",
    "next_step",
    "next",
    "action",
    "suggestion",
  ]);

  const praise = pickString(record, ["praise", "encouragement", "positive", "compliment"]);

  const currentPart = pickString(record, [
    "currentPart",
    "current_part",
    "part",
    "component",
    "element",
    "focus",
  ]);

  const explanation = pickString(record, [
    "explanation",
    "explain",
    "description",
    "whatItIs",
    "what_it_is",
    "context",
  ]);

  const normalized = {
    tip: tip || nextStep || praise || "Keep going — add the next major shape from the reference.",
    severity: normalizeSeverity(record.severity ?? record.level ?? record.priority),
    nextStep: nextStep || tip || "Continue matching the reference layout.",
    praise: praise || "",
    currentPart: currentPart || "Next part",
    explanation:
      explanation ||
      tip ||
      "Match the next section of the shadow reference diagram on your canvas.",
    hintShapes: normalizeHintShapes(
      record.hintShapes ?? record.hint_shapes ?? record.hints ?? record.guideShapes,
    ),
  };

  const result = coachTipSchema.safeParse(normalized);
  if (result.success) return result.data;

  console.warn("[drawing-coach] schema fallback:", result.error.flatten(), parsed);
  return normalized;
}

export async function analyzeDrawingCoach(input: {
  topic: string;
  referenceImage: string;
  canvasImage: string;
  transcript?: string;
  trigger: string;
  recentTips?: string[];
}): Promise<CoachTip> {
  const { apiKey, baseURL, model } = getVisionConfig();

  const userText = buildCoachUserPrompt({
    topic: input.topic,
    transcript: input.transcript,
    trigger: input.trigger,
    recentTips: input.recentTips,
  });

  const response = await fetch(`${baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: DRAWING_COACH_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            {
              type: "image_url",
              image_url: { url: toDataUrl(input.referenceImage), detail: "high" },
            },
            {
              type: "image_url",
              image_url: { url: toDataUrl(input.canvasImage), detail: "high" },
            },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(45000),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => response.statusText);
    throw new Error(`Vision coach failed (${response.status}): ${detail.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("Vision coach returned an empty response");
  }

  const parsed = parseJsonContent(content);
  return normalizeCoachTip(parsed);
}
