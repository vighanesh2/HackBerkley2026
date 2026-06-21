import {
  CompressionTarget,
  type CompressibleChunk,
  type CompressionClient,
  type CompressionStats,
} from "../compressionPipeline.js";
import { compressContext, createCompressionCache } from "../compressionPipeline.js";
import { buildCompressionTelemetry } from "../compressionTelemetry.js";
import { compressWithLocalAlgorithm } from "../localCompressor.js";
import { buildCoursePrompt, buildHistoryText } from "./prompts.js";
import type {
  AggressivenessBenchmarkResult,
  BenchmarkRunResult,
  BenchmarkSession,
  CompressorMode,
  CourseGenerator,
  QualityJudge,
  SessionBenchmarkResult,
} from "./types.js";

const DEFAULT_QUALITY_HOLD_TOLERANCE = 0.25;
const DEFAULT_COMPRESSOR_MODES: CompressorMode[] = ["none", "local", "token-company"];

export async function runBenchmark({
  sessions,
  aggressivenessLevels,
  compressorModes = DEFAULT_COMPRESSOR_MODES,
  generator,
  judge,
  compressionClient,
  qualityHoldTolerance = DEFAULT_QUALITY_HOLD_TOLERANCE,
}: {
  sessions: BenchmarkSession[];
  aggressivenessLevels: number[];
  compressorModes?: CompressorMode[];
  generator: CourseGenerator;
  judge: QualityJudge;
  compressionClient?: CompressionClient;
  qualityHoldTolerance?: number;
}): Promise<BenchmarkRunResult> {
  const levels: AggressivenessBenchmarkResult[] = [];

  for (const compressorMode of compressorModes) {
    for (const aggressiveness of aggressivenessLevels) {
      const sessionResults: SessionBenchmarkResult[] = [];

      for (const session of sessions) {
        sessionResults.push(
          await runSessionBenchmark({
            session,
            compressorMode,
            aggressiveness,
            generator,
            judge,
            ...(compressionClient ? { compressionClient } : {}),
            qualityHoldTolerance,
          }),
        );
      }

      levels.push({
        compressorMode,
        aggressiveness,
        sessions: sessionResults,
        summary: summarizeLevel(sessionResults),
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    qualityHoldTolerance,
    compressorModes,
    levels,
    recommendation: chooseRecommendation(levels),
  };
}

async function runSessionBenchmark({
  session,
  compressorMode,
  aggressiveness,
  generator,
  judge,
  compressionClient,
  qualityHoldTolerance,
}: {
  session: BenchmarkSession;
  compressorMode: CompressorMode;
  aggressiveness: number;
  generator: CourseGenerator;
  judge: QualityJudge;
  compressionClient?: CompressionClient;
  qualityHoldTolerance: number;
}): Promise<SessionBenchmarkResult> {
  const cache = createCompressionCache();
  const historyText = buildHistoryText(session);
  const compressedSources = await compressBenchmarkInput(session.retrievedChunks, {
    session,
    mode: compressorMode,
    ...(compressionClient ? { compressionClient } : {}),
    cache,
    target: CompressionTarget.RETRIEVED_SOURCES,
    aggressiveness,
  });
  const compressedHistory = await compressBenchmarkInput(historyText, {
    session,
    mode: compressorMode,
    ...(compressionClient ? { compressionClient } : {}),
    cache,
    target: CompressionTarget.CONVERSATION_HISTORY,
    aggressiveness,
  });
  const compressedCarriedContext = await compressBenchmarkInput(session.carriedCourseContext, {
    session,
    mode: compressorMode,
    ...(compressionClient ? { compressionClient } : {}),
    cache,
    target: CompressionTarget.CARRIED_COURSE_CONTEXT,
    aggressiveness,
  });

  const uncompressedPrompt = buildCoursePrompt({
    topic: session.topic,
    retrievedSources: session.retrievedChunks,
    conversationHistory: historyText,
    carriedCourseContext: session.carriedCourseContext,
    currentUserTurn: session.currentUserTurn,
  });
  const compressedPrompt = buildCoursePrompt({
    topic: session.topic,
    retrievedSources: compressedSources.compressed as CompressibleChunk[],
    conversationHistory: compressedHistory.compressed,
    carriedCourseContext: compressedCarriedContext.compressed,
    currentUserTurn: session.currentUserTurn,
  });

  const uncompressedCourse = await generator.generateCourse({
    session,
    prompt: uncompressedPrompt,
    variant: "uncompressed",
  });
  const compressedCourse = await generator.generateCourse({
    session,
    prompt: compressedPrompt,
    variant: "compressed",
  });

  const judged = await judge.judgePair({
    session,
    outputA: uncompressedCourse,
    outputB: compressedCourse,
  });
  const qualityDelta = round(judged.outputB.overall - judged.outputA.overall);
  const stats = [compressedSources.stats, compressedHistory.stats, compressedCarriedContext.stats];
  const telemetry = buildCompressionTelemetry({
    stats,
    quality: {
      uncompressed: judged.outputA.overall,
      compressed: judged.outputB.overall,
    },
  });

  return {
    sessionId: session.id,
    topic: session.topic,
    compressorMode,
    aggressiveness,
    stats,
    tokenTotals: telemetry.totals,
    uncompressedCourse,
    compressedCourse,
    quality: {
      uncompressed: judged.outputA,
      compressed: judged.outputB,
      delta: qualityDelta,
      held: qualityDelta >= -qualityHoldTolerance,
    },
  };
}

async function compressBenchmarkInput<TInput extends string | CompressibleChunk[]>(
  input: TInput,
  {
    session,
    mode,
    compressionClient,
    cache,
    target,
    aggressiveness,
  }: {
    session: BenchmarkSession;
    mode: CompressorMode;
    compressionClient?: CompressionClient;
    cache: ReturnType<typeof createCompressionCache>;
    target: CompressionTarget;
    aggressiveness: number;
  },
) {
  if (mode === "none") {
    return noCompression(input, target);
  }

  if (mode === "local") {
    return compressWithLocalAlgorithm(input, {
      query: `${session.topic} ${session.currentUserTurn}`,
      focusTerms: session.expectedCourseFocus,
      target,
      aggressiveness,
    });
  }

  return compressContext(input, {
    ...(compressionClient ? { client: compressionClient } : {}),
    cache,
    target,
    aggressiveness,
  });
}

function noCompression<TInput extends string | CompressibleChunk[]>(input: TInput, target: CompressionTarget) {
  const text: string = Array.isArray(input)
    ? input.map((chunk) => (typeof chunk.content === "string" ? chunk.content : chunk.text ?? "")).join("\n\n")
    : input;
  const tokens = estimateTokens(text);

  return {
    compressed: structuredClone(input),
    stats: {
      original_tokens: tokens,
      compressed_tokens: tokens,
      tokens_saved: 0,
      pct_saved: 0,
      fallback: false,
      empty_input: tokens === 0,
      cache_hit: false,
      latency_ms: 0,
      target,
    },
  };
}

function summarizeLevel(sessions: SessionBenchmarkResult[]): AggressivenessBenchmarkResult["summary"] {
  const originalTokens = sum(sessions, (session) => session.tokenTotals.originalTokens);
  const compressedTokens = sum(sessions, (session) => session.tokenTotals.compressedTokens);
  const tokensSaved = Math.max(0, originalTokens - compressedTokens);
  const pctSaved = originalTokens > 0 ? round((tokensSaved / originalTokens) * 100) : 0;
  const averageUncompressedQuality = average(sessions, (session) => session.quality.uncompressed.overall);
  const averageCompressedQuality = average(sessions, (session) => session.quality.compressed.overall);
  const averageQualityDelta = round(averageCompressedQuality - averageUncompressedQuality);
  const qualityHeldRate = sessions.length > 0 ? round((sessions.filter((session) => session.quality.held).length / sessions.length) * 100) : 0;

  return {
    originalTokens,
    compressedTokens,
    tokensSaved,
    pctSaved,
    averageUncompressedQuality,
    averageCompressedQuality,
    averageQualityDelta,
    qualityHeldRate,
  };
}

function chooseRecommendation(levels: AggressivenessBenchmarkResult[]): BenchmarkRunResult["recommendation"] {
  const passing = levels
    .filter((level) => level.summary.qualityHeldRate === 100)
    .sort((a, b) => b.summary.pctSaved - a.summary.pctSaved);
  const best = passing[0];

  if (!best) {
    return null;
  }

  return {
    compressorMode: best.compressorMode,
    aggressiveness: best.aggressiveness,
    pctSaved: best.summary.pctSaved,
    averageQualityDelta: best.summary.averageQualityDelta,
    qualityHeldRate: best.summary.qualityHeldRate,
  };
}

function estimateTokens(text: string): number {
  const trimmed = text.trim();
  return trimmed ? Math.ceil(trimmed.length / 4) : 0;
}

function sum<T>(items: T[], selector: (item: T) => number): number {
  return items.reduce((total, item) => total + selector(item), 0);
}

function average<T>(items: T[], selector: (item: T) => number): number {
  if (items.length === 0) {
    return 0;
  }

  return round(sum(items, selector) / items.length);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function statsForDashboard(result: BenchmarkRunResult): CompressionStats[] {
  const recommended = result.recommendation;
  const level = recommended
    ? result.levels.find((entry) => entry.aggressiveness === recommended.aggressiveness)
    : result.levels[0];

  return level?.sessions.flatMap((session) => session.stats) ?? [];
}

