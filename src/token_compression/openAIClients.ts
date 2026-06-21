import OpenAI from "openai";

import type { BenchmarkSession, CourseGenerator, QualityJudge, QualityScore } from "./types.js";

const DEFAULT_MODEL = "gpt-4.1-mini";

export function createOpenAICourseGenerator({
  apiKey = process.env.OPENAI_API_KEY,
  model = process.env.BENCHMARK_LLM_MODEL ?? DEFAULT_MODEL,
}: {
  apiKey?: string;
  model?: string;
} = {}): CourseGenerator {
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY for real benchmark generation.");
  }

  const client = new OpenAI({ apiKey });

  return {
    async generateCourse({ prompt }) {
      const response = await client.chat.completions.create({
        model,
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "You generate concise, source-grounded course modules. Follow the requested structure exactly and avoid unsupported facts.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      return response.choices[0]?.message.content ?? "";
    },
  };
}

export function createOpenAIQualityJudge({
  apiKey = process.env.OPENAI_API_KEY,
  model = process.env.BENCHMARK_JUDGE_MODEL ?? process.env.BENCHMARK_LLM_MODEL ?? DEFAULT_MODEL,
}: {
  apiKey?: string;
  model?: string;
} = {}): QualityJudge {
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY for real benchmark judging.");
  }

  const client = new OpenAI({ apiKey });

  return {
    async judgePair({ session, outputA, outputB }) {
      const response = await client.chat.completions.create({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are a blind evaluator for course quality. Score both outputs independently. Do not prefer either output by position.",
          },
          {
            role: "user",
            content: buildJudgePrompt({ session, outputA, outputB }),
          },
        ],
      });

      return parseJudgeJson(response.choices[0]?.message.content ?? "");
    },
  };
}

function buildJudgePrompt({
  session,
  outputA,
  outputB,
}: {
  session: BenchmarkSession;
  outputA: string;
  outputB: string;
}): string {
  return [
    "Score Output A and Output B for a generated course module.",
    "You do not know which output used compressed context.",
    "Score each metric from 0 to 10.",
    "",
    `Topic: ${session.topic}`,
    `Expected focus: ${session.expectedCourseFocus.join(", ")}`,
    "",
    "Metrics:",
    "- accuracy: factual correctness against the expected focus",
    "- coverage: whether the expected focus is covered",
    "- questionQuality: whether the Feynman-style questions are useful",
    "- overall: holistic course usefulness",
    "",
    "Return only JSON with this exact shape:",
    JSON.stringify({
      outputA: {
        accuracy: 9,
        coverage: 9,
        questionQuality: 9,
        overall: 9,
        rationale: "short reason",
      },
      outputB: {
        accuracy: 9,
        coverage: 9,
        questionQuality: 9,
        overall: 9,
        rationale: "short reason",
      },
    }),
    "",
    "Output A:",
    outputA,
    "",
    "Output B:",
    outputB,
  ].join("\n");
}

function parseJudgeJson(content: string): { outputA: QualityScore; outputB: QualityScore } {
  const parsed = JSON.parse(content) as {
    outputA?: Partial<QualityScore>;
    outputB?: Partial<QualityScore>;
  };

  return {
    outputA: normalizeScore(parsed.outputA, "Missing outputA score"),
    outputB: normalizeScore(parsed.outputB, "Missing outputB score"),
  };
}

function normalizeScore(score: Partial<QualityScore> | undefined, fallbackRationale: string): QualityScore {
  return {
    accuracy: clampScore(score?.accuracy),
    coverage: clampScore(score?.coverage),
    questionQuality: clampScore(score?.questionQuality),
    overall: clampScore(score?.overall),
    rationale: typeof score?.rationale === "string" ? score.rationale : fallbackRationale,
  };
}

function clampScore(value: unknown): number {
  const numeric = typeof value === "number" ? value : 0;
  return Math.min(10, Math.max(0, Math.round(numeric * 100) / 100));
}

