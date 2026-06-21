export enum CompressionTarget {
  RETRIEVED_SOURCES = "retrieved_sources",
  CONVERSATION_HISTORY = "conversation_history",
  CARRIED_COURSE_CONTEXT = "carried_course_context",
}

export type CompressibleChunk = {
  id?: string;
  content?: string;
  text?: string;
  [key: string]: unknown;
};

export type CompressibleInput = string | CompressibleChunk | Array<string | CompressibleChunk>;

export type CompressionStats = {
  original_tokens: number;
  compressed_tokens: number;
  tokens_saved: number;
  pct_saved: number;
  fallback: boolean;
  empty_input: boolean;
  cache_hit: boolean;
  latency_ms: number;
  target: CompressionTarget;
  error?: string;
};

