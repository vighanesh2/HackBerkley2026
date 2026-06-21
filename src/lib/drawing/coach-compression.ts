import {
  compressContext,
  createCompressionCache,
  createTokenCompanyClient,
} from "@/lib/compression/compressionPipeline";
import { compressWithLocalAlgorithm } from "@/lib/compression/localCompressor";
import { CompressionTarget, type CompressionStats } from "@/lib/compression/compressionTypes";
import {
  buildCompressionTelemetry,
  type CompressionDashboardTelemetry,
} from "@/lib/compression/compressionTelemetry";
import { DRAWING_COACH_SYSTEM_PROMPT } from "@/lib/drawing/coach-prompt";
import { estimateTokens, getTargetPctSaved } from "@/lib/drawing/target-ratio-compressor";
import type { CompressionRunResult, CompressorMode } from "@/types/compression";

export type CoachCompressorMode = Exclude<CompressorMode, "none">;

export type CoachCompressionResult = {
  compressedTips: string[];
  compressedTranscript: string;
  comparison: CompressionRunResult[];
  activeMode: CoachCompressorMode;
  telemetry: CompressionDashboardTelemetry;
};

const compressionCache = createCompressionCache();

const MODE_LABELS: Record<CompressorMode, string> = {
  none: "Downstream (no compression)",
  local: "Our algorithm",
  "token-company": "Token API",
};

const DRAWING_TARGET_LABELS: Record<CompressionTarget, string> = {
  [CompressionTarget.RETRIEVED_SOURCES]: "Prompt scaffold",
  [CompressionTarget.CONVERSATION_HISTORY]: "Coach history",
  [CompressionTarget.CARRIED_COURSE_CONTEXT]: "Learner speech",
};

const DRAWING_PROTECTED_SECTIONS = [
  "System prompt",
  "JSON schema",
  "Reference + canvas images",
];

type ContextBlock = {
  text: string;
  target: CompressionTarget;
};

type BlockCompression = {
  compressed: string;
  stats: CompressionStats;
};

function getTokenCompanyApiKey(): string | undefined {
  return (
    process.env.TOKEN_COMPANY_API_KEY?.trim() ||
    process.env.TTC_API_KEY?.trim() ||
    process.env.THE_TOKEN_COMPANY_API_KEY?.trim()
  );
}

export function isCoachCompressionEnabled(): boolean {
  return process.env.DRAWING_COMPRESSION_ENABLED !== "false";
}

function createStats({
  originalTokens,
  compressedTokens,
  target,
  latencyMs,
  emptyInput,
  fallback = false,
  error,
}: {
  originalTokens: number;
  compressedTokens: number;
  target: CompressionTarget;
  latencyMs: number;
  emptyInput: boolean;
  fallback?: boolean;
  error?: string;
}): CompressionStats {
  const tokensSaved = Math.max(0, originalTokens - compressedTokens);
  const pctSaved =
    originalTokens > 0 ? Math.round((tokensSaved / originalTokens) * 10_000) / 100 : 0;

  return {
    original_tokens: originalTokens,
    compressed_tokens: compressedTokens,
    tokens_saved: tokensSaved,
    pct_saved: pctSaved,
    fallback,
    empty_input: emptyInput,
    cache_hit: false,
    latency_ms: latencyMs,
    target,
    ...(error ? { error } : {}),
  };
}

async function compressBlock(
  text: string,
  target: CompressionTarget,
  query: string,
  mode: CompressorMode,
): Promise<BlockCompression> {
  const trimmed = text.trim();
  const originalTokens = estimateTokens(trimmed);

  if (!trimmed || mode === "none") {
    return {
      compressed: trimmed,
      stats: createStats({
        originalTokens,
        compressedTokens: originalTokens,
        target,
        latencyMs: 0,
        emptyInput: !trimmed,
      }),
    };
  }

  const start = performance.now();
  const aggressiveness = getTargetPctSaved();

  if (mode === "local") {
    const result = await compressWithLocalAlgorithm(trimmed, {
      query,
      focusTerms: query.split(/\s+/).filter(Boolean).slice(0, 8),
      target,
      aggressiveness,
    });

    return {
      compressed: result.compressed as string,
      stats: result.stats,
    };
  }

  try {
    const result = await compressContext(trimmed, {
      cache: compressionCache,
      target,
      appId: "diagram-drawing-coach",
      aggressiveness,
      client: createTokenCompanyClient({ appId: "diagram-drawing-coach" }),
    });

    return {
      compressed: (result.compressed as string).trim() || trimmed,
      stats: {
        ...result.stats,
        latency_ms: Math.max(0, Math.round(performance.now() - start)),
      },
    };
  } catch (error) {
    return {
      compressed: trimmed,
      stats: createStats({
        originalTokens,
        compressedTokens: originalTokens,
        target,
        latencyMs: Math.max(0, Math.round(performance.now() - start)),
        emptyInput: false,
        fallback: true,
        error: error instanceof Error ? error.message : "Token API compression failed",
      }),
    };
  }
}

async function runCompressionMode(
  blocks: ContextBlock[],
  query: string,
  mode: CompressorMode,
): Promise<{
  compressedBlocks: string[];
  stats: CompressionStats[];
  originalTokens: number;
  compressedTokens: number;
  latencyMs: number;
  fallback: boolean;
}> {
  const results = await Promise.all(
    blocks.map((block) => compressBlock(block.text, block.target, query, mode)),
  );

  const stats = results.map((result) => result.stats);
  const originalTokens = stats.reduce((sum, entry) => sum + entry.original_tokens, 0);
  const compressedTokens = stats.reduce((sum, entry) => sum + entry.compressed_tokens, 0);
  const latencyMs = stats.reduce((sum, entry) => sum + entry.latency_ms, 0);

  return {
    compressedBlocks: results.map((result) => result.compressed),
    stats,
    originalTokens,
    compressedTokens,
    latencyMs,
    fallback: stats.some((entry) => entry.fallback),
  };
}

function toRunResult(
  mode: CompressorMode,
  run: Awaited<ReturnType<typeof runCompressionMode>>,
  active: boolean,
): CompressionRunResult {
  const tokensSaved = Math.max(0, run.originalTokens - run.compressedTokens);
  const pctSaved =
    run.originalTokens > 0 ? Math.round((tokensSaved / run.originalTokens) * 10_000) / 100 : 0;

  return {
    mode,
    label: MODE_LABELS[mode],
    originalTokens: run.originalTokens,
    compressedTokens: run.compressedTokens,
    tokensSaved,
    pctSaved,
    latencyMs: run.latencyMs,
    fallback: run.fallback,
    active,
  };
}

function splitCompressedTips(compressed: string, fallback: string[]): string[] {
  const trimmed = compressed.trim();
  if (!trimmed) return fallback;

  const lines = trimmed
    .split(/\n+/)
    .map((line) => line.replace(/^\d+\.\s*/, "").trim())
    .filter(Boolean);

  return lines.length > 0 ? lines : [trimmed];
}

function buildPromptScaffold(topic: string): string {
  return [
    `Learning goal: ${topic}`,
    "Compare REFERENCE (first image) vs CURRENT canvas (second image).",
    "The learner can see a faint shadow of the reference while you guide them.",
    "Both images share the same coordinate frame: top-left (0,0) to bottom-right (1,1).",
    "Return JSON with keys: currentPart, explanation, tip, severity, nextStep, praise, hintShapes.",
    "Give one concrete micro-instruction at a time and continue from prior coaching when history is provided.",
    "Use spatial language and dashed hintShapes only for the next micro-step.",
  ].join("\n");
}

function buildHistoryText(recentTips: string[]): string {
  return recentTips
    .map((tip, index) => {
      const normalized = tip.replace(/\s+/g, " ").trim();
      return `${index + 1}. ${normalized}`;
    })
    .join("\n");
}

function buildBlocks(input: {
  topic: string;
  recentTips: string[];
  transcript?: string;
}): ContextBlock[] {
  return [
    {
      text: buildPromptScaffold(input.topic),
      target: CompressionTarget.RETRIEVED_SOURCES,
    },
    {
      text: buildHistoryText(input.recentTips),
      target: CompressionTarget.CONVERSATION_HISTORY,
    },
    {
      text: input.transcript?.trim() ?? "",
      target: CompressionTarget.CARRIED_COURSE_CONTEXT,
    },
  ];
}

function buildDrawingTelemetry(
  stats: CompressionStats[],
  protectedTokens: number,
): CompressionDashboardTelemetry {
  const telemetry = buildCompressionTelemetry({
    stats,
    quality: { compressed: 0, uncompressed: 0 },
    protectedSections: DRAWING_PROTECTED_SECTIONS,
  });

  const compressibleOriginal = telemetry.totals.originalTokens;
  const compressibleCompressed = telemetry.totals.compressedTokens;
  const tokensSaved = Math.max(0, compressibleOriginal - compressibleCompressed);
  const pctSaved =
    compressibleOriginal > 0 ? Math.round((tokensSaved / compressibleOriginal) * 10_000) / 100 : 0;

  return {
    ...telemetry,
    totals: {
      originalTokens: compressibleOriginal + protectedTokens,
      compressedTokens: compressibleCompressed + protectedTokens,
      tokensSaved,
      pctSaved,
    },
    sources: telemetry.sources.map((source) => ({
      ...source,
      label: DRAWING_TARGET_LABELS[source.target] ?? source.label,
    })),
  };
}

function resolveActiveMode(
  tokenRun: Awaited<ReturnType<typeof runCompressionMode>>,
  localRun: Awaited<ReturnType<typeof runCompressionMode>>,
): CoachCompressorMode {
  if (!isCoachCompressionEnabled()) return "local";
  if (getTokenCompanyApiKey() && !tokenRun.fallback && tokenRun.originalTokens > 0) {
    return "token-company";
  }
  return "local";
}

export async function compressCoachContext(input: {
  topic: string;
  recentTips: string[];
  transcript?: string;
}): Promise<CoachCompressionResult> {
  const blocks = buildBlocks(input);
  const [noneRun, tokenRun, localRun] = await Promise.all([
    runCompressionMode(blocks, input.topic, "none"),
    runCompressionMode(blocks, input.topic, "token-company"),
    runCompressionMode(blocks, input.topic, "local"),
  ]);

  const activeMode = resolveActiveMode(tokenRun, localRun);
  const activeRun = activeMode === "token-company" ? tokenRun : localRun;
  const protectedTokens = estimateTokens(DRAWING_COACH_SYSTEM_PROMPT) + 2 * 765;

  const comparison: CompressionRunResult[] = [
    toRunResult("none", noneRun, false),
    toRunResult("token-company", tokenRun, activeMode === "token-company"),
    toRunResult("local", localRun, activeMode === "local"),
  ];

  return {
    compressedTips: splitCompressedTips(activeRun.compressedBlocks[1] ?? "", input.recentTips),
    compressedTranscript: activeRun.compressedBlocks[2] ?? "",
    comparison,
    activeMode,
    telemetry: buildDrawingTelemetry(activeRun.stats, protectedTokens),
  };
}
