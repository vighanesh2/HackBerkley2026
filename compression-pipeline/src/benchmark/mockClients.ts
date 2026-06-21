import type { CompressResult } from "the-token-company";

import type { CompressionClient } from "../compressionPipeline.js";
import type { BenchmarkSession, CourseGenerator, QualityJudge, QualityScore } from "./types.js";

export function createMockCompressionClient(): CompressionClient {
  return {
    async compress(text, options): Promise<CompressResult> {
      const inputTokens = estimateTokens(text);
      const aggressiveness = options.aggressiveness ?? 0.4;
      const keepRatio = Math.max(0.45, 1 - aggressiveness * 0.75);
      const outputTokens = Math.max(1, Math.round(inputTokens * keepRatio));
      const output = compressWords(text, outputTokens);

      return {
        output,
        inputTokens,
        outputTokens,
        tokensSaved: Math.max(0, inputTokens - outputTokens),
        compressionRatio: inputTokens / outputTokens,
      };
    },
  };
}

export function createMockCourseGenerator(): CourseGenerator {
  return {
    async generateCourse({ session, variant }) {
      const focus = session.expectedCourseFocus.join(", ");
      const variantNote =
        variant === "compressed"
          ? "This course is generated from compressed retrieved context."
          : "This course is generated from full retrieved context.";

      return [
        `Course: ${session.topic}`,
        variantNote,
        `Overview: Explain ${session.topic} using simple language and source-grounded examples.`,
        `Core concepts: ${focus}.`,
        "Feynman questions:",
        `1. Can you explain ${session.expectedCourseFocus[0] ?? "the first concept"} to a younger student?`,
        `2. What would be a common misconception about ${session.topic}?`,
        "Quick self-check: summarize the topic without jargon, then connect each core concept to an example.",
      ].join("\n");
    },
  };
}

export function createMockQualityJudge(): QualityJudge {
  return {
    async judgePair({ session, outputA, outputB }) {
      return {
        outputA: scoreOutput(session, outputA, "Mock blind score for output A."),
        outputB: scoreOutput(session, outputB, "Mock blind score for output B."),
      };
    },
  };
}

function scoreOutput(session: BenchmarkSession, output: string, rationale: string): QualityScore {
  const lower = output.toLowerCase();
  const covered = session.expectedCourseFocus.filter((term) => lower.includes(term.toLowerCase())).length;
  const coverageRatio = session.expectedCourseFocus.length > 0 ? covered / session.expectedCourseFocus.length : 1;
  const hasFeynmanQuestions = lower.includes("feynman") || lower.includes("explain");
  const accuracy = round(8.5 + coverageRatio * 1.2);
  const coverage = round(8 + coverageRatio * 1.8);
  const questionQuality = hasFeynmanQuestions ? 9.2 : 7.8;
  const overall = round((accuracy + coverage + questionQuality) / 3);

  return {
    accuracy,
    coverage,
    questionQuality,
    overall,
    rationale,
  };
}

function compressWords(text: string, targetTokens: number): string {
  const words = text.split(/\s+/).filter(Boolean);
  const targetWords = Math.max(1, Math.min(words.length, Math.round(targetTokens * 0.75)));
  return words.slice(0, targetWords).join(" ");
}

function estimateTokens(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }

  return Math.ceil(trimmed.length / 4);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

