import { describe, expect, it } from "vitest";

import { buildCompressionTelemetry } from "../src/compressionTelemetry.js";
import { CompressionTarget, type CompressionStats } from "../src/compressionTypes.js";

function stat(overrides: Partial<CompressionStats>): CompressionStats {
  return {
    original_tokens: 0,
    compressed_tokens: 0,
    tokens_saved: 0,
    pct_saved: 0,
    fallback: false,
    empty_input: false,
    cache_hit: false,
    latency_ms: 0,
    target: CompressionTarget.RETRIEVED_SOURCES,
    ...overrides,
  };
}

describe("buildCompressionTelemetry", () => {
  it("aggregates totals and per-source savings", () => {
    const telemetry = buildCompressionTelemetry({
      stats: [
        stat({
          target: CompressionTarget.RETRIEVED_SOURCES,
          original_tokens: 12_100,
          compressed_tokens: 6_300,
          tokens_saved: 5_800,
          pct_saved: 47.93,
        }),
        stat({
          target: CompressionTarget.CONVERSATION_HISTORY,
          original_tokens: 4_800,
          compressed_tokens: 3_200,
          tokens_saved: 1_600,
          pct_saved: 33.33,
        }),
        stat({
          target: CompressionTarget.CARRIED_COURSE_CONTEXT,
          original_tokens: 1_540,
          compressed_tokens: 1_290,
          tokens_saved: 250,
          pct_saved: 16.23,
        }),
      ],
      quality: { compressed: 9.1, uncompressed: 9.2 },
    });

    expect(telemetry.apiStatus).toBe("healthy");
    expect(telemetry.totals).toEqual({
      originalTokens: 18_440,
      compressedTokens: 10_790,
      tokensSaved: 7_650,
      pctSaved: 41.49,
    });
    expect(telemetry.sources.map((source) => source.label)).toEqual([
      "Retrieved sources",
      "Q&A history",
      "Carried context",
    ]);
    expect(telemetry.resilience).toEqual({
      normal: true,
      fallback: false,
      empty: false,
    });
  });

  it("marks fallback and empty branches separately", () => {
    const telemetry = buildCompressionTelemetry({
      stats: [
        stat({
          target: CompressionTarget.RETRIEVED_SOURCES,
          original_tokens: 100,
          compressed_tokens: 100,
          fallback: true,
        }),
        stat({
          target: CompressionTarget.CONVERSATION_HISTORY,
          empty_input: true,
        }),
      ],
      quality: { compressed: 8.8, uncompressed: 8.9 },
    });

    expect(telemetry.apiStatus).toBe("fallback");
    expect(telemetry.resilience).toEqual({
      normal: false,
      fallback: true,
      empty: true,
    });
  });
});

