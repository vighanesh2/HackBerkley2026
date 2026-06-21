import { getCourseModel } from "@/lib/course/llm";
import { formatRetrievedChunks, type RetrievedChunk } from "@/lib/course/rag/retrieve";

/** Step 3 — compress retrieved chunks into a tight prompt-ready summary. */
export async function compressRetrievedChunks(
  chunks: RetrievedChunk[],
  query: string,
): Promise<string> {
  if (chunks.length === 0) return "";

  const raw = formatRetrievedChunks(chunks);
  if (raw.length <= 1_200) {
    return raw;
  }

  const model = getCourseModel();
  const response = await model.invoke([
    {
      role: "system",
      content: [
        "You compress source excerpts for course generation.",
        "Keep only facts, definitions, steps, examples, and terminology relevant to the query.",
        "Use short bullet points. No preamble. Max 600 words.",
      ].join(" "),
    },
    {
      role: "user",
      content: [`Query/topic: ${query}`, "", "Source excerpts:", raw].join("\n"),
    },
  ]);

  return String(response.content).trim();
}

export function ragPromptSection(compressed: string, query: string): string {
  if (!compressed.trim()) return "";

  return [
    "RETRIEVED SOURCE MATERIAL (RAG) — ground the course in these excerpts from the learner's upload.",
    `Retrieval query: ${query}`,
    "Use their terminology and structure where helpful; fill gaps they have not covered.",
    "---",
    compressed,
    "---",
  ].join("\n");
}
