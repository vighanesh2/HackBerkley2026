import type { RagIndex } from "@/lib/course/rag/types";

/** In-process vector store keyed by session or user source id. */
const indexes = new Map<string, RagIndex>();

export function getRagIndex(sessionKey: string): RagIndex | null {
  return indexes.get(sessionKey) ?? null;
}

export function saveRagIndex(index: RagIndex): void {
  indexes.set(index.sessionKey, index);
}

export function clearRagIndex(sessionKey: string): void {
  indexes.delete(sessionKey);
}

export function hasFreshIndex(sessionKey: string, sourceHash: string): boolean {
  const existing = indexes.get(sessionKey);
  return Boolean(existing && existing.sourceHash === sourceHash);
}
