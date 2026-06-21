import { chunkSourceText } from "@/lib/course/rag/chunk";
import { embedChunks, hashSource } from "@/lib/course/rag/embeddings";
import { getRagIndex, hasFreshIndex, saveRagIndex } from "@/lib/course/rag/store";
import type { RagIndex } from "@/lib/course/rag/types";

export type IngestResult = {
  index: RagIndex;
  created: boolean;
};

/** Step 1 — chunk source material, embed, and store in the vector index. */
export async function ingestSourceMaterial(
  sessionKey: string,
  sourceText: string,
): Promise<IngestResult> {
  const normalized = sourceText.trim();
  const sourceHash = hashSource(normalized);

  if (hasFreshIndex(sessionKey, sourceHash)) {
    return { index: getRagIndex(sessionKey)!, created: false };
  }

  const chunks = chunkSourceText(normalized);
  const { vectors, mode } = await embedChunks(chunks);

  const index: RagIndex = {
    sessionKey,
    sourceHash,
    chunks,
    vectors,
    vectorMode: mode,
    ingestedAt: Date.now(),
  };

  saveRagIndex(index);
  return { index, created: true };
}
