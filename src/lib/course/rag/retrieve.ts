import {
  cosineSimilarity,
  denseCosineSimilarity,
  embedQuery,
} from "@/lib/course/rag/embeddings";
import type { RagChunk, RagIndex } from "@/lib/course/rag/types";

export type RetrievedChunk = RagChunk & { score: number };

/** Step 2 — retrieve the most relevant chunks for a query. */
export async function retrieveRelevantChunks(
  index: RagIndex,
  query: string,
  topK = 6,
): Promise<RetrievedChunk[]> {
  if (index.chunks.length === 0 || !query.trim()) return [];

  const queryVector = await embedQuery(query, index.vectorMode);
  const scored: RetrievedChunk[] = [];

  for (let i = 0; i < index.chunks.length; i += 1) {
    const chunk = index.chunks[i];
    const vector = index.vectors[i];

    const score =
      index.vectorMode === "dense"
        ? denseCosineSimilarity(queryVector as number[], vector as number[])
        : cosineSimilarity(queryVector as Map<string, number>, vector as Map<string, number>);

    scored.push({ ...chunk, score });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(topK, scored.length))
    .filter((item) => item.score > 0);
}

export function formatRetrievedChunks(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "";

  return chunks
    .map((chunk, rank) => {
      const heading = chunk.heading ? `[${chunk.heading}] ` : "";
      return `(${rank + 1}) ${heading}${chunk.text}`;
    })
    .join("\n\n");
}
