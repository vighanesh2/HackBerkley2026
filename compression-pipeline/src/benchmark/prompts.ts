import type { CompressibleChunk } from "../compressionTypes.js";
import type { BenchmarkSession, CoursePromptParts } from "./types.js";

export function buildHistoryText(session: BenchmarkSession): string {
  return session.conversationHistory.map((turn) => `${turn.role}: ${turn.content}`).join("\n\n");
}

export function buildCoursePrompt(parts: CoursePromptParts): string {
  return [
    "You are generating a grounded mini-course using the Feynman technique.",
    "Keep factual claims tied to the provided retrieved source material.",
    "Ask short explanation questions that make the learner explain ideas simply.",
    "",
    `Topic: ${parts.topic}`,
    "",
    "Retrieved source material:",
    formatSources(parts.retrievedSources),
    "",
    "Old Q&A history:",
    parts.conversationHistory || "No prior history.",
    "",
    "Carried course context:",
    parts.carriedCourseContext || "No carried context.",
    "",
    "Current user request:",
    parts.currentUserTurn,
    "",
    "Generate the course with sections: overview, core concepts, Feynman questions, and quick self-check.",
  ].join("\n");
}

export function formatSources(sources: CompressibleChunk[] | string): string {
  if (typeof sources === "string") {
    return sources || "No retrieved sources.";
  }

  if (sources.length === 0) {
    return "No retrieved sources.";
  }

  return sources
    .map((source, index) => {
      const content = typeof source.content === "string" ? source.content : source.text;
      const title = typeof source.sourceTitle === "string" ? ` (${source.sourceTitle})` : "";
      return `[${index + 1}]${title} ${content ?? ""}`;
    })
    .join("\n\n");
}

