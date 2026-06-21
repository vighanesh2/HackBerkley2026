import { OpenAIEmbeddings } from "@langchain/openai";
import type { RagChunk } from "@/lib/course/rag/types";

export type EmbeddingMode = "dense" | "lexical";

export function hashSource(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return String(hash);
}

export function lexicalVector(text: string): Map<string, number> {
  const words = text.toLowerCase().match(/\b[a-z0-9]{3,}\b/g) ?? [];
  const freq = new Map<string, number>();
  for (const word of words) {
    freq.set(word, (freq.get(word) ?? 0) + 1);
  }
  return freq;
}

export function cosineSimilarity(
  a: Map<string, number>,
  b: Map<string, number>,
): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const value of a.values()) normA += value * value;
  for (const value of b.values()) normB += value * value;

  const smaller = a.size < b.size ? a : b;
  const larger = a.size < b.size ? b : a;

  for (const [key, value] of smaller) {
    const other = larger.get(key);
    if (other) dot += value * other;
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function denseCosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function getEmbeddingClient(): OpenAIEmbeddings | null {
  const apiKey = process.env.ASI_API_KEY?.trim();
  if (!apiKey) return null;

  return new OpenAIEmbeddings({
    apiKey,
    model: "text-embedding-3-small",
    configuration: {
      baseURL: "https://api.asi1.ai/v1",
    },
  });
}

export async function embedTexts(texts: string[]): Promise<{
  vectors: number[][] | Map<string, number>[];
  mode: EmbeddingMode;
}> {
  if (texts.length === 0) {
    return { vectors: [], mode: "lexical" };
  }

  const client = getEmbeddingClient();
  if (client) {
    try {
      const vectors = await client.embedDocuments(texts);
      if (vectors.length === texts.length && vectors.every((v) => v.length > 0)) {
        return { vectors, mode: "dense" };
      }
    } catch {
      // Fall back to lexical retrieval when embedding API is unavailable.
    }
  }

  return {
    vectors: texts.map(lexicalVector),
    mode: "lexical",
  };
}

export async function embedQuery(
  query: string,
  mode: EmbeddingMode,
): Promise<number[] | Map<string, number>> {
  if (mode === "lexical") {
    return lexicalVector(query);
  }

  const client = getEmbeddingClient();
  if (!client) {
    return lexicalVector(query);
  }

  try {
    return await client.embedQuery(query);
  } catch {
    return lexicalVector(query);
  }
}

export async function embedChunks(chunks: RagChunk[]): Promise<{
  vectors: number[][] | Map<string, number>[];
  mode: EmbeddingMode;
}> {
  return embedTexts(chunks.map((chunk) => chunk.text));
}
