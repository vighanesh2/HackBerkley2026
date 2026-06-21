/**
 * Module-level store for compression stats, keyed by session ID.
 * Lets the API route read back stats that were recorded deep inside the RAG pipeline.
 */

export type CompressionStats = {
  original_tokens: number;
  compressed_tokens: number;
  tokens_saved: number;
  pct_saved: number;
  latency_ms: number;
  fallback: boolean;
  cache_hit: boolean;
  empty_input: boolean;
  error?: string;
};

type Entry = { stats: CompressionStats; timestamp: number };

const store = new Map<string, Entry>();
const TTL_MS = 15 * 60 * 1000; // 15 minutes

export function recordCompressionStats(sessionKey: string, stats: CompressionStats): void {
  store.set(sessionKey, { stats, timestamp: Date.now() });
  // Prune stale entries to avoid memory leak
  const cutoff = Date.now() - TTL_MS;
  for (const [key, entry] of store) {
    if (entry.timestamp < cutoff) store.delete(key);
  }
}

export function getCompressionStats(sessionKey: string): CompressionStats | null {
  return store.get(sessionKey)?.stats ?? null;
}
