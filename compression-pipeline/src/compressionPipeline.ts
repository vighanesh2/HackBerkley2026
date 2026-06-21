import { createHash } from "node:crypto";

import { TheTokenCompany, type CompressResult } from "the-token-company";

import {
  CompressionTarget,
  type CompressibleChunk,
  type CompressibleInput,
  type CompressionStats,
} from "./compressionTypes.js";

export { CompressionTarget } from "./compressionTypes.js";
export type { CompressibleChunk, CompressibleInput, CompressionStats } from "./compressionTypes.js";

export type CompressionResult<TInput extends CompressibleInput> = {
  compressed: CompressedOutput<TInput>;
  stats: CompressionStats;
};

export type CompressionClient = {
  compress(
    text: string,
    options: {
      model?: string;
      aggressiveness?: number;
      appId?: string;
    },
  ): Promise<CompressResult>;
};

export type CompressionCache = Map<string, CachedCompression>;

export type CompressContextOptions = {
  client?: CompressionClient;
  cache?: CompressionCache;
  target?: CompressionTarget;
  model?: string;
  aggressiveness?: number;
  appId?: string;
  now?: () => number;
};

type CompressedOutput<TInput extends CompressibleInput> = TInput extends string
  ? string
  : TInput extends Array<infer TItem>
    ? TItem[]
    : TInput;

type CachedCompression = {
  compressed: unknown;
  stats: CompressionStats;
};

type NormalizedInput =
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
      units: Array<{ text: string }>;
    }
  | {
      kind: "object";
      isEmpty: boolean;
      emptyValue: CompressibleChunk;
      original: CompressibleChunk;
      text: string;
      units: Array<{ text: string }>;
    };

type AggregatedCompressResult = Pick<CompressResult, "inputTokens" | "outputTokens" | "tokensSaved">;

const DEFAULT_MODEL = "bear-2";
const DEFAULT_APP_ID = "course-generator-compression";
const DEFAULT_AGGRESSIVENESS = 0.4;

export function createCompressionCache(): CompressionCache {
  return new Map();
}

export function createTokenCompanyClient({
  apiKey = getTokenCompanyApiKey(),
  timeout = 5000,
  appId = DEFAULT_APP_ID,
}: {
  apiKey?: string;
  timeout?: number;
  appId?: string;
} = {}): CompressionClient {
  if (!apiKey) {
    throw new Error("Missing Token Company API key. Set TOKEN_COMPANY_API_KEY, TTC_API_KEY, or THE_TOKEN_COMPANY_API_KEY.");
  }

  return new TheTokenCompany({
    apiKey,
    timeout,
    appId,
  });
}

export async function compressContext<TInput extends CompressibleInput>(
  input: TInput,
  options: CompressContextOptions = {},
): Promise<CompressionResult<TInput>> {
  const {
    client,
    cache,
    target = CompressionTarget.RETRIEVED_SOURCES,
    model = DEFAULT_MODEL,
    aggressiveness = DEFAULT_AGGRESSIVENESS,
    appId = DEFAULT_APP_ID,
    now = performanceNow,
  } = options;

  const normalized = normalizeInput(input);

  if (normalized.isEmpty) {
    return {
      compressed: normalized.emptyValue as CompressedOutput<TInput>,
      stats: createZeroStats(target),
    };
  }

  const cacheKey = cache
    ? createCacheKey({ input: normalized.text, target, model, aggressiveness, appId })
    : undefined;

  if (cache && cacheKey && cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);

    if (cached) {
      return {
        compressed: cloneValue(cached.compressed) as CompressedOutput<TInput>,
        stats: {
          ...cached.stats,
          cache_hit: true,
          latency_ms: 0,
        },
      };
    }
  }

  const start = now();

  try {
    const compressor = client ?? createTokenCompanyClient({ appId });
    const compressedResult = await compressNormalizedInput(normalized, compressor, {
      model,
      aggressiveness,
      appId,
    });
    const latencyMs = Math.max(0, Math.round(now() - start));
    const stats = createSuccessStats({
      result: compressedResult.stats,
      target,
      latencyMs,
    });

    if (cache && cacheKey) {
      cache.set(cacheKey, {
        compressed: cloneValue(compressedResult.compressed),
        stats: { ...stats },
      });
    }

    return {
      compressed: compressedResult.compressed as CompressedOutput<TInput>,
      stats,
    };
  } catch (error) {
    const latencyMs = Math.max(0, Math.round(now() - start));
    const tokenEstimate = estimateTokens(normalized.text);

    return {
      compressed: cloneValue(input) as CompressedOutput<TInput>,
      stats: {
        original_tokens: tokenEstimate,
        compressed_tokens: tokenEstimate,
        tokens_saved: 0,
        pct_saved: 0,
        fallback: true,
        empty_input: false,
        cache_hit: false,
        latency_ms: latencyMs,
        target,
        error: getErrorMessage(error),
      },
    };
  }
}

function normalizeInput(input: CompressibleInput): NormalizedInput {
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
      units: [{ text }],
    };
  }

  const text = getTextField(input).trim();

  return {
    kind: "object",
    isEmpty: text.length === 0,
    emptyValue: { ...input },
    original: input,
    text,
    units: [{ text }],
  };
}

async function compressNormalizedInput(
  normalized: NormalizedInput,
  compressor: CompressionClient,
  options: { model: string; aggressiveness: number; appId: string },
): Promise<{ compressed: unknown; stats: AggregatedCompressResult }> {
  if (normalized.kind === "array") {
    const output = normalized.original.map((item) => cloneValue(item));
    const results: CompressResult[] = [];

    for (const unit of normalized.units) {
      const result = await compressor.compress(unit.text, options);
      results.push(result);
      const existingItem = output[unit.index];
      if (existingItem !== undefined) {
        output[unit.index] = setItemText(existingItem, result.output);
      }
    }

    return {
      compressed: output,
      stats: aggregateCompressResults(results),
    };
  }

  const result = await compressor.compress(normalized.text, options);

  if (normalized.kind === "object") {
    return {
      compressed: setTextField(normalized.original, result.output),
      stats: aggregateCompressResults([result]),
    };
  }

  return {
    compressed: result.output,
    stats: aggregateCompressResults([result]),
  };
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

function getItemText(item: string | CompressibleChunk): string {
  if (typeof item === "string") {
    return item;
  }

  return getTextField(item);
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

function setItemText(item: string | CompressibleChunk, text: string): string | CompressibleChunk {
  if (typeof item === "string") {
    return text;
  }

  if (item && typeof item === "object") {
    return setTextField(item, text);
  }

  return item;
}

function aggregateCompressResults(results: CompressResult[]): AggregatedCompressResult {
  const inputTokens = results.reduce((sum, result) => sum + Number(result.inputTokens ?? 0), 0);
  const outputTokens = results.reduce((sum, result) => sum + Number(result.outputTokens ?? 0), 0);
  const tokensSaved = results.reduce((sum, result) => {
    const fallbackSaved = Number(result.inputTokens ?? 0) - Number(result.outputTokens ?? 0);
    return sum + Number(result.tokensSaved ?? fallbackSaved);
  }, 0);

  return {
    inputTokens,
    outputTokens,
    tokensSaved,
  };
}

function createSuccessStats({
  result,
  target,
  latencyMs,
}: {
  result: AggregatedCompressResult;
  target: CompressionTarget;
  latencyMs: number;
}): CompressionStats {
  const originalTokens = Number(result.inputTokens ?? 0);
  const compressedTokens = Number(result.outputTokens ?? 0);
  const tokensSaved = Math.max(0, Number(result.tokensSaved ?? originalTokens - compressedTokens));
  const pctSaved = originalTokens > 0 ? roundPercent((tokensSaved / originalTokens) * 100) : 0;

  return {
    original_tokens: originalTokens,
    compressed_tokens: compressedTokens,
    tokens_saved: tokensSaved,
    pct_saved: pctSaved,
    fallback: false,
    empty_input: false,
    cache_hit: false,
    latency_ms: latencyMs,
    target,
  };
}

function createZeroStats(target: CompressionTarget): CompressionStats {
  return {
    original_tokens: 0,
    compressed_tokens: 0,
    tokens_saved: 0,
    pct_saved: 0,
    fallback: false,
    empty_input: true,
    cache_hit: false,
    latency_ms: 0,
    target,
  };
}

function createCacheKey(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function estimateTokens(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }

  return Math.ceil(trimmed.length / 4);
}

function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}

function cloneValue<TValue>(value: TValue): TValue {
  return structuredClone(value);
}

function performanceNow(): number {
  return performance.now();
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function getTokenCompanyApiKey(): string | undefined {
  return process.env.TOKEN_COMPANY_API_KEY ?? process.env.TTC_API_KEY ?? process.env.THE_TOKEN_COMPANY_API_KEY;
}

