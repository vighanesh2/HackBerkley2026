import { ragPromptSection, compressRetrievedChunks } from "@/lib/course/rag/compress";
import { recordCompressionStats } from "@/lib/course/rag/compressionStore";
import { ingestSourceMaterial } from "@/lib/course/rag/ingest";
import { retrieveRelevantChunks } from "@/lib/course/rag/retrieve";
import type { RagContext } from "@/lib/course/rag/types";
import { hasUserNotes, notesPromptSection } from "@/lib/course/notes";

export type BuildRagContextOptions = {
  sessionKey: string;
  sourceText: string;
  query: string;
  topK?: number;
};

/**
 * Full RAG pipeline:
 * 1. Ingestion — chunk, embed, store
 * 2. Retrieval — pull relevant chunks for the query
 * 3. Compression — squeeze chunks via Token Company API before the LLM prompt
 * 4. (Generation happens in the caller using ragPromptSection output)
 */
export async function buildRagContext(
  options: BuildRagContextOptions,
): Promise<RagContext & { promptSection: string }> {
  const { sessionKey, sourceText, query, topK = 6 } = options;

  if (!hasUserNotes(sourceText)) {
    return {
      compressed: "",
      chunkCount: 0,
      retrievedCount: 0,
      usedRag: false,
      promptSection: "",
    };
  }

  const { index } = await ingestSourceMaterial(sessionKey, sourceText);
  const retrieved = await retrieveRelevantChunks(index, query, topK);
  const { compressed, stats } = await compressRetrievedChunks(retrieved, query);

  // Store stats so the API route can include them in the response for the UI
  recordCompressionStats(sessionKey, stats);

  return {
    compressed,
    chunkCount: index.chunks.length,
    retrievedCount: retrieved.length,
    usedRag: true,
    promptSection: compressed
      ? ragPromptSection(compressed, query)
      : notesPromptSection(sourceText),
  };
}

export { ragPromptSection };
