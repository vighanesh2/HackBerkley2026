import { CompressionTarget, type CompressionStats } from "./compressionTypes.js";
import type { BenchmarkRunResult, CompressorMode } from "./benchmark/types.js";

export type QualityScore = {
  compressed: number;
  uncompressed: number;
};

export type SourceTelemetry = {
  target: CompressionTarget;
  label: string;
  originalTokens: number;
  compressedTokens: number;
  tokensSaved: number;
  pctSaved: number;
  fallback: boolean;
  emptyInput: boolean;
};

export type CompressionDashboardTelemetry = {
  apiStatus: "healthy" | "fallback" | "idle";
  totals: {
    originalTokens: number;
    compressedTokens: number;
    tokensSaved: number;
    pctSaved: number;
  };
  quality: QualityScore;
  sources: SourceTelemetry[];
  protectedSections: string[];
  resilience: {
    normal: boolean;
    fallback: boolean;
    empty: boolean;
  };
};

export type BenchmarkComparisonRow = {
  compressorMode: CompressorMode;
  label: string;
  aggressiveness: number;
  pctSaved: number;
  averageQuality: number;
  qualityDelta: number;
  qualityHeldRate: number;
};

export type QualityCurvePoint = {
  compressorMode: CompressorMode;
  aggressiveness: number;
  pctSaved: number;
  averageQuality: number;
  qualityDelta: number;
  qualityHeldRate: number;
};

const TARGET_LABELS: Record<CompressionTarget, string> = {
  [CompressionTarget.RETRIEVED_SOURCES]: "Retrieved sources",
  [CompressionTarget.CONVERSATION_HISTORY]: "Q&A history",
  [CompressionTarget.CARRIED_COURSE_CONTEXT]: "Carried context",
};

const SOURCE_ORDER = [
  CompressionTarget.RETRIEVED_SOURCES,
  CompressionTarget.CONVERSATION_HISTORY,
  CompressionTarget.CARRIED_COURSE_CONTEXT,
];

export function buildCompressionTelemetry({
  stats,
  quality,
  protectedSections = ["System prompt", "Course schema", "Current user turn"],
}: {
  stats: CompressionStats[];
  quality: QualityScore;
  protectedSections?: string[];
}): CompressionDashboardTelemetry {
  const sources = SOURCE_ORDER.map((target) => buildSourceTelemetry(target, stats));
  const originalTokens = sources.reduce((sum, source) => sum + source.originalTokens, 0);
  const compressedTokens = sources.reduce((sum, source) => sum + source.compressedTokens, 0);
  const tokensSaved = Math.max(0, originalTokens - compressedTokens);
  const pctSaved = originalTokens > 0 ? roundPercent((tokensSaved / originalTokens) * 100) : 0;
  const hasFallback = stats.some((entry) => entry.fallback);
  const hasActivity = stats.some((entry) => !entry.empty_input);

  return {
    apiStatus: hasFallback ? "fallback" : hasActivity ? "healthy" : "idle",
    totals: {
      originalTokens,
      compressedTokens,
      tokensSaved,
      pctSaved,
    },
    quality,
    sources,
    protectedSections,
    resilience: {
      normal: stats.some((entry) => !entry.fallback && !entry.empty_input),
      fallback: hasFallback,
      empty: stats.some((entry) => entry.empty_input),
    },
  };
}

export function buildCompressionTelemetryFromBenchmark(result: BenchmarkRunResult): CompressionDashboardTelemetry {
  const recommended = result.recommendation;
  const level = recommended
    ? result.levels.find(
        (entry) => entry.compressorMode === recommended.compressorMode && entry.aggressiveness === recommended.aggressiveness,
      )
    : result.levels[0];

  if (!level) {
    return buildCompressionTelemetry({
      stats: [],
      quality: { compressed: 0, uncompressed: 0 },
    });
  }

  return buildCompressionTelemetry({
    stats: level.sessions.flatMap((session) => session.stats),
    quality: {
      compressed: level.summary.averageCompressedQuality,
      uncompressed: level.summary.averageUncompressedQuality,
    },
  });
}

export function buildBenchmarkComparisonRows(result: BenchmarkRunResult): BenchmarkComparisonRow[] {
  return result.compressorModes
    .map((mode) => {
      const levels = result.levels.filter((level) => level.compressorMode === mode);
      const recommendedForMode =
        result.recommendation?.compressorMode === mode
          ? result.levels.find(
              (level) => level.compressorMode === mode && level.aggressiveness === result.recommendation?.aggressiveness,
            )
          : [...levels]
              .filter((level) => level.summary.qualityHeldRate === 100)
              .sort((a, b) => b.summary.pctSaved - a.summary.pctSaved)[0] ?? levels[0];

      if (!recommendedForMode) {
        return null;
      }

      return {
        compressorMode: mode,
        label: modeLabel(mode),
        aggressiveness: recommendedForMode.aggressiveness,
        pctSaved: recommendedForMode.summary.pctSaved,
        averageQuality: recommendedForMode.summary.averageCompressedQuality,
        qualityDelta: recommendedForMode.summary.averageQualityDelta,
        qualityHeldRate: recommendedForMode.summary.qualityHeldRate,
      };
    })
    .filter((row): row is BenchmarkComparisonRow => row !== null);
}

export function buildQualityCurve(result: BenchmarkRunResult): QualityCurvePoint[] {
  return result.levels.map((level) => ({
    compressorMode: level.compressorMode,
    aggressiveness: level.aggressiveness,
    pctSaved: level.summary.pctSaved,
    averageQuality: level.summary.averageCompressedQuality,
    qualityDelta: level.summary.averageQualityDelta,
    qualityHeldRate: level.summary.qualityHeldRate,
  }));
}

function modeLabel(mode: CompressorMode): string {
  if (mode === "none") {
    return "No compression";
  }

  if (mode === "local") {
    return "Our local compressor";
  }

  return "Token Company";
}

function buildSourceTelemetry(target: CompressionTarget, stats: CompressionStats[]): SourceTelemetry {
  const matchingStats = stats.filter((entry) => entry.target === target);
  const originalTokens = matchingStats.reduce((sum, entry) => sum + entry.original_tokens, 0);
  const compressedTokens = matchingStats.reduce((sum, entry) => sum + entry.compressed_tokens, 0);
  const tokensSaved = matchingStats.reduce((sum, entry) => sum + entry.tokens_saved, 0);
  const pctSaved = originalTokens > 0 ? roundPercent((tokensSaved / originalTokens) * 100) : 0;

  return {
    target,
    label: TARGET_LABELS[target],
    originalTokens,
    compressedTokens,
    tokensSaved,
    pctSaved,
    fallback: matchingStats.some((entry) => entry.fallback),
    emptyInput: matchingStats.length === 0 || matchingStats.every((entry) => entry.empty_input),
  };
}

function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}

