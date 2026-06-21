import {
  CompressionTarget,
  type CompressibleChunk,
  type CompressibleInput,
  type CompressionStats,
} from "./compressionTypes";
import type { CompressionResult } from "./compressionPipeline";

export type LocalCompressionOptions = {
  query: string;
  focusTerms?: string[];
  target?: CompressionTarget;
  aggressiveness?: number;
  now?: () => number;
};

type SentenceCandidate = {
  text: string;
  index: number;
  score: number;
  tokens: Set<string>;
};

type CompressedOutput<TInput extends CompressibleInput> = TInput extends string
  ? string
  : TInput extends Array<infer TItem>
    ? TItem[]
    : TInput;

const DEFAULT_AGGRESSIVENESS = 0.4;

export async function compressWithLocalAlgorithm<TInput extends CompressibleInput>(
  input: TInput,
  options: LocalCompressionOptions,
): Promise<CompressionResult<TInput>> {
  const {
    query,
    focusTerms = [],
    target = CompressionTarget.RETRIEVED_SOURCES,
    aggressiveness = DEFAULT_AGGRESSIVENESS,
    now = performanceNow,
  } = options;
  const start = now();
  const normalized = normalizeInput(input);

  if (normalized.isEmpty) {
    return {
      compressed: normalized.emptyValue as CompressedOutput<TInput>,
      stats: createStats({
        originalTokens: 0,
        compressedTokens: 0,
        target,
        latencyMs: 0,
        emptyInput: true,
      }),
    };
  }

  const compressed = compressNormalized(normalized, {
    query,
    focusTerms,
    aggressiveness,
  });
  const originalTokens = estimateTokens(normalized.text);
  const compressedText = getCompressedText(compressed);
  const compressedTokens = estimateTokens(compressedText);
  const latencyMs = Math.max(0, Math.round(now() - start));

  return {
    compressed: compressed.value as CompressedOutput<TInput>,
    stats: createStats({
      originalTokens,
      compressedTokens,
      target,
      latencyMs,
      emptyInput: false,
    }),
  };
}

function normalizeInput(input: CompressibleInput):
  | {
      kind: "array";
      isEmpty: boolean;
      emptyValue: [];
      original: Array<string | CompressibleChunk>;
      text: string;
      units: Array<{ index: number; text: string }>;
    }
  | {
      kind: "string";
      isEmpty: boolean;
      emptyValue: "";
      text: string;
    }
  | {
      kind: "object";
      isEmpty: boolean;
      emptyValue: CompressibleChunk;
      original: CompressibleChunk;
      text: string;
    } {
  if (Array.isArray(input)) {
    const units = input
      .map((item, index) => ({ index, text: getItemText(item).trim() }))
      .filter((unit) => unit.text.length > 0);

    return {
      kind: "array",
      isEmpty: units.length === 0,
      emptyValue: [],
      original: input,
      text: units.map((unit) => unit.text).join("\n\n"),
      units,
    };
  }

  if (typeof input === "string") {
    const text = input.trim();
    return {
      kind: "string",
      isEmpty: text.length === 0,
      emptyValue: "",
      text,
    };
  }

  const text = getTextField(input).trim();
  return {
    kind: "object",
    isEmpty: text.length === 0,
    emptyValue: { ...input },
    original: input,
    text,
  };
}

function compressNormalized(
  normalized: ReturnType<typeof normalizeInput>,
  options: { query: string; focusTerms: string[]; aggressiveness: number },
): { value: unknown; text: string } {
  if (normalized.kind === "array") {
    const output = normalized.original.map((item) => cloneValue(item));
    const compressedTexts: string[] = [];

    for (const unit of normalized.units) {
      const compressedText = compressText(unit.text, options);
      compressedTexts.push(compressedText);
      const existing = output[unit.index];
      if (existing !== undefined) {
        output[unit.index] = setItemText(existing, compressedText);
      }
    }

    return { value: output, text: compressedTexts.join("\n\n") };
  }

  const text = compressText(normalized.text, options);

  if (normalized.kind === "object") {
    return {
      value: setTextField(normalized.original, text),
      text,
    };
  }

  return { value: text, text };
}

function compressText(text: string, options: { query: string; focusTerms: string[]; aggressiveness: number }): string {
  const sentences = splitSentences(text);
  if (sentences.length <= 1) {
    return text;
  }

  const originalTokens = estimateTokens(text);
  const budget = Math.max(1, Math.round(originalTokens * keepRatio(options.aggressiveness)));
  const queryTokens = tokenize(`${options.query} ${options.focusTerms.join(" ")}`);
  const candidates = sentences
    .map((sentence, index) => scoreSentence(sentence, index, sentences.length, queryTokens, options.focusTerms))
    .sort((a, b) => b.score - a.score);
  const kept: SentenceCandidate[] = [];
  let usedTokens = 0;

  for (const candidate of candidates) {
    const candidateTokens = estimateTokens(candidate.text);
    if (usedTokens + candidateTokens > budget && kept.length > 0) {
      continue;
    }

    if (isDuplicate(candidate, kept)) {
      continue;
    }

    kept.push(candidate);
    usedTokens += candidateTokens;

    if (usedTokens >= budget) {
      break;
    }
  }

  const reordered = reorderHighValueFirst(kept);
  return reordered.map((candidate) => candidate.text).join(" ");
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
  const focusBoost = focusTerms.some((term) => sentence.toLowerCase().includes(term.toLowerCase())) ? 0.18 : 0;
  const informationBoost = informationDensityBoost(sentence);
  const definitionBoost = /\b(is|are|means|refers to|defined as)\b/i.test(sentence) ? 0.08 : 0;
  const positionBoost = index === 0 || index === total - 1 ? 0.04 : 0;
  const lengthPenalty = sentence.length > 360 ? 0.05 : 0;

  return {
    text: sentence,
    index,
    tokens,
    score: relevance * 0.62 + focusBoost + informationBoost + definitionBoost + positionBoost - lengthPenalty,
  };
}

function cosineLikeOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) {
    return 0;
  }

  let overlap = 0;
  for (const token of a) {
    if (b.has(token)) {
      overlap += 1;
    }
  }

  return overlap / Math.sqrt(a.size * b.size);
}

function informationDensityBoost(sentence: string): number {
  const hasNumber = /\b\d+(\.\d+)?%?\b/.test(sentence);
  const capitalizedTerms = sentence.match(/\b[A-Z][a-zA-Z]{2,}\b/g)?.length ?? 0;
  const entityBoost = Math.min(0.12, capitalizedTerms * 0.025);
  return (hasNumber ? 0.1 : 0) + entityBoost;
}

function isDuplicate(candidate: SentenceCandidate, kept: SentenceCandidate[]): boolean {
  return kept.some((existing) => jaccard(candidate.tokens, existing.tokens) > 0.9);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) {
    return 1;
  }

  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) {
      intersection += 1;
    }
  }

  return intersection / (a.size + b.size - intersection);
}

function reorderHighValueFirst(candidates: SentenceCandidate[]): SentenceCandidate[] {
  const top = [...candidates].sort((a, b) => b.score - a.score).slice(0, 2);
  const topIndexes = new Set(top.map((candidate) => candidate.index));
  const rest = candidates.filter((candidate) => !topIndexes.has(candidate.index)).sort((a, b) => a.index - b.index);
  return [...top, ...rest];
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function tokenize(text: string): Set<string> {
  const stopWords = new Set([
    "the",
    "and",
    "or",
    "but",
    "for",
    "with",
    "that",
    "this",
    "from",
    "into",
    "about",
    "using",
    "through",
    "should",
    "would",
    "could",
    "what",
    "when",
    "where",
    "which",
  ]);

  return new Set(
    text
      .toLowerCase()
      .match(/[a-z0-9]+/g)
      ?.filter((token) => token.length > 2 && !stopWords.has(token)) ?? [],
  );
}

function keepRatio(aggressiveness: number): number {
  const bounded = Math.min(0.95, Math.max(0.05, aggressiveness));
  return Math.max(0.25, 1 - bounded * 0.72);
}

function getItemText(item: string | CompressibleChunk): string {
  return typeof item === "string" ? item : getTextField(item);
}

function getTextField(item: CompressibleChunk): string {
  if (typeof item.content === "string") {
    return item.content;
  }

  if (typeof item.text === "string") {
    return item.text;
  }

  return "";
}

function setItemText(item: string | CompressibleChunk, text: string): string | CompressibleChunk {
  return typeof item === "string" ? text : setTextField(item, text);
}

function setTextField(item: CompressibleChunk, text: string): CompressibleChunk {
  if (Object.hasOwn(item, "content")) {
    return { ...item, content: text };
  }

  if (Object.hasOwn(item, "text")) {
    return { ...item, text };
  }

  return { ...item, content: text };
}

function createStats({
  originalTokens,
  compressedTokens,
  target,
  latencyMs,
  emptyInput,
}: {
  originalTokens: number;
  compressedTokens: number;
  target: CompressionTarget;
  latencyMs: number;
  emptyInput: boolean;
}): CompressionStats {
  const tokensSaved = Math.max(0, originalTokens - compressedTokens);
  const pctSaved = originalTokens > 0 ? Math.round((tokensSaved / originalTokens) * 10_000) / 100 : 0;

  return {
    original_tokens: originalTokens,
    compressed_tokens: compressedTokens,
    tokens_saved: tokensSaved,
    pct_saved: pctSaved,
    fallback: false,
    empty_input: emptyInput,
    cache_hit: false,
    latency_ms: latencyMs,
    target,
  };
}

function estimateTokens(text: string): number {
  const trimmed = text.trim();
  return trimmed ? Math.ceil(trimmed.length / 4) : 0;
}

function getCompressedText(compressed: { value: unknown; text: string }): string {
  return compressed.text;
}

function cloneValue<TValue>(value: TValue): TValue {
  return structuredClone(value);
}

function performanceNow(): number {
  return performance.now();
}

