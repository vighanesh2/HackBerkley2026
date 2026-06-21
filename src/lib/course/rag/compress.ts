import { formatRetrievedChunks, type RetrievedChunk } from "@/lib/course/rag/retrieve";
import type { CompressionStats } from "@/lib/course/rag/compressionStore";

export type { CompressionStats };

export type CompressResult = {
  compressed: string;
  stats: CompressionStats;
};

// ---------------------------------------------------------------------------
// Local token compression algorithm
// Ported from compression-pipeline/src/localCompressor.ts
// Scores sentences by query relevance, information density, definitions, and
// position, then keeps the highest-scoring sentences within a token budget.
// ---------------------------------------------------------------------------

const DEFAULT_AGGRESSIVENESS = 0.4;

type SentenceCandidate = {
  text: string;
  index: number;
  score: number;
  tokens: Set<string>;
};

function estimateTokens(text: string): number {
  return Math.ceil(text.trim().length / 4);
}

function keepRatio(aggressiveness: number): number {
  const bounded = Math.min(0.95, Math.max(0.05, aggressiveness));
  return Math.max(0.25, 1 - bounded * 0.72);
}

function tokenize(text: string): Set<string> {
  const stopWords = new Set([
    "the", "and", "or", "but", "for", "with", "that", "this",
    "from", "into", "about", "using", "through", "should", "would",
    "could", "what", "when", "where", "which",
  ]);
  return new Set(
    text
      .toLowerCase()
      .match(/[a-z0-9]+/g)
      ?.filter((t) => t.length > 2 && !stopWords.has(t)) ?? [],
  );
}

function cosineLikeOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let overlap = 0;
  for (const token of a) if (b.has(token)) overlap++;
  return overlap / Math.sqrt(a.size * b.size);
}

function informationDensityBoost(sentence: string): number {
  const hasNumber = /\b\d+(\.\d+)?%?\b/.test(sentence);
  const capitalizedTerms = sentence.match(/\b[A-Z][a-zA-Z]{2,}\b/g)?.length ?? 0;
  return (hasNumber ? 0.1 : 0) + Math.min(0.12, capitalizedTerms * 0.025);
}

function scoreSentence(
  sentence: string,
  index: number,
  total: number,
  queryTokens: Set<string>,
  focusTerms: string[],
): SentenceCandidate {
  const tokens = tokenize(sentence);
  const relevance = cosineLikeOverlap(tokens, queryTokens);
  const focusBoost = focusTerms.some((t) => sentence.toLowerCase().includes(t.toLowerCase())) ? 0.18 : 0;
  const infoBoost = informationDensityBoost(sentence);
  const definitionBoost = /\b(is|are|means|refers to|defined as)\b/i.test(sentence) ? 0.08 : 0;
  const positionBoost = index === 0 || index === total - 1 ? 0.04 : 0;
  const lengthPenalty = sentence.length > 360 ? 0.05 : 0;

  return {
    text: sentence,
    index,
    tokens,
    score: relevance * 0.62 + focusBoost + infoBoost + definitionBoost + positionBoost - lengthPenalty,
  };
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection++;
  return intersection / (a.size + b.size - intersection);
}

function compressText(
  text: string,
  query: string,
  focusTerms: string[] = [],
  aggressiveness = DEFAULT_AGGRESSIVENESS,
): string {
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length <= 1) return text;

  const originalTokens = estimateTokens(text);
  const budget = Math.max(1, Math.round(originalTokens * keepRatio(aggressiveness)));
  const queryTokens = tokenize(`${query} ${focusTerms.join(" ")}`);

  const candidates = sentences
    .map((s, i) => scoreSentence(s, i, sentences.length, queryTokens, focusTerms))
    .sort((a, b) => b.score - a.score);

  const kept: SentenceCandidate[] = [];
  let usedTokens = 0;

  for (const candidate of candidates) {
    const candidateTokens = estimateTokens(candidate.text);
    if (usedTokens + candidateTokens > budget && kept.length > 0) continue;
    if (kept.some((k) => jaccard(candidate.tokens, k.tokens) > 0.9)) continue;
    kept.push(candidate);
    usedTokens += candidateTokens;
    if (usedTokens >= budget) break;
  }

  // Put top-2 scoring sentences first, rest in original order
  const top = [...kept].sort((a, b) => b.score - a.score).slice(0, 2);
  const topIndexes = new Set(top.map((c) => c.index));
  const rest = kept.filter((c) => !topIndexes.has(c.index)).sort((a, b) => a.index - b.index);
  return [...top, ...rest].map((c) => c.text).join(" ");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Step 3 — compress retrieved RAG chunks using the local sentence-scoring
 * algorithm before they're assembled into the LLM prompt.
 * No external API required — runs entirely in-process.
 */
export async function compressRetrievedChunks(
  chunks: RetrievedChunk[],
  query: string,
  aggressiveness = DEFAULT_AGGRESSIVENESS,
): Promise<CompressResult> {
  if (chunks.length === 0) {
    return {
      compressed: "",
      stats: {
        original_tokens: 0,
        compressed_tokens: 0,
        tokens_saved: 0,
        pct_saved: 0,
        latency_ms: 0,
        fallback: false,
        cache_hit: false,
        empty_input: true,
      },
    };
  }

  const raw = formatRetrievedChunks(chunks);
  const start = performance.now();
  const compressed = compressText(raw, query, [], aggressiveness);
  const latencyMs = Math.round(performance.now() - start);

  const originalTokens = estimateTokens(raw);
  const compressedTokens = estimateTokens(compressed);
  const saved = Math.max(0, originalTokens - compressedTokens);
  const pct = originalTokens > 0 ? Math.round((saved / originalTokens) * 10_000) / 100 : 0;

  return {
    compressed,
    stats: {
      original_tokens: originalTokens,
      compressed_tokens: compressedTokens,
      tokens_saved: saved,
      pct_saved: pct,
      latency_ms: latencyMs,
      fallback: false,
      cache_hit: false,
      empty_input: false,
    },
  };
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
