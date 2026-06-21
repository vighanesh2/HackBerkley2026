import { describe, expect, it } from "vitest";

import { buildBenchmarkComparisonRows, buildCompressionTelemetryFromBenchmark, buildQualityCurve } from "../src/compressionTelemetry.js";
import { createMockCompressionClient, createMockCourseGenerator, createMockQualityJudge } from "../src/benchmark/mockClients.js";
import { runBenchmark } from "../src/benchmark/runner.js";
import { benchmarkSessions } from "../src/benchmark/sessions.js";

describe("runBenchmark", () => {
  it("runs paired compressed vs uncompressed sessions and recommends a quality-held level", async () => {
    const result = await runBenchmark({
      sessions: benchmarkSessions.slice(0, 2),
      aggressivenessLevels: [0.2, 0.4],
      compressionClient: createMockCompressionClient(),
      generator: createMockCourseGenerator(),
      judge: createMockQualityJudge(),
    });

    expect(result.compressorModes).toEqual(["none", "local", "token-company"]);
    expect(result.levels).toHaveLength(6);
    expect(result.levels[0]?.sessions).toHaveLength(2);
    expect(result.levels[0]?.summary.originalTokens).toBeGreaterThan(0);
    expect(result.levels[0]?.summary.compressedTokens).toBeGreaterThan(0);
    expect(result.levels.some((level) => level.compressorMode === "local" && level.summary.tokensSaved > 0)).toBe(true);
    expect(result.levels.some((level) => level.compressorMode === "token-company" && level.summary.tokensSaved > 0)).toBe(true);
    expect(result.levels[0]?.summary.qualityHeldRate).toBe(100);
    expect(result.recommendation?.aggressiveness).toBe(0.4);
  });

  it("converts benchmark output into dashboard telemetry", async () => {
    const result = await runBenchmark({
      sessions: benchmarkSessions.slice(0, 1),
      aggressivenessLevels: [0.4],
      compressionClient: createMockCompressionClient(),
      generator: createMockCourseGenerator(),
      judge: createMockQualityJudge(),
    });

    const telemetry = buildCompressionTelemetryFromBenchmark(result);
    const comparisonRows = buildBenchmarkComparisonRows(result);
    const curve = buildQualityCurve(result);

    expect(telemetry.totals.originalTokens).toBeGreaterThan(0);
    expect(telemetry.totals.compressedTokens).toBeGreaterThan(0);
    expect(telemetry.totals.pctSaved).toBeGreaterThan(0);
    expect(telemetry.quality.compressed).toBeGreaterThan(0);
    expect(telemetry.quality.uncompressed).toBeGreaterThan(0);
    expect(comparisonRows.map((row) => row.compressorMode)).toEqual(["none", "local", "token-company"]);
    expect(curve).toHaveLength(3);
  });
});

