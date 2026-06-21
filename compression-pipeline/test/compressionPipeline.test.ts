import { describe, expect, it } from "vitest";

import {
  CompressionTarget,
  type CompressionClient,
  compressContext,
  createCompressionCache,
} from "../src/compressionPipeline.js";

type MockCall = {
  text: string;
  options: Parameters<CompressionClient["compress"]>[1];
};

function createMockClient({
  output = "compressed text",
  inputTokens = 10,
  outputTokens = 4,
}: {
  output?: string;
  inputTokens?: number;
  outputTokens?: number;
} = {}): CompressionClient & { calls: MockCall[] } {
  const calls: MockCall[] = [];

  return {
    calls,
    async compress(text: string, options: Parameters<CompressionClient["compress"]>[1]) {
      calls.push({ text, options });

      return {
        output,
        inputTokens,
        outputTokens,
        tokensSaved: inputTokens - outputTokens,
        compressionRatio: inputTokens / outputTokens,
      };
    },
  };
}

describe("compressContext", () => {
  it("compresses chunk input and returns stats", async () => {
    const client = createMockClient({
      output: "compressed chunk",
      inputTokens: 12,
      outputTokens: 5,
    });

    const input = [{ id: "chunk-1", content: "This is a retrieved source chunk with extra filler." }];

    const result = await compressContext(input, {
      client,
      target: CompressionTarget.RETRIEVED_SOURCES,
      aggressiveness: 0.4,
      now: () => 100,
    });

    expect(result.compressed).toEqual([{ id: "chunk-1", content: "compressed chunk" }]);
    expect(client.calls).toHaveLength(1);
    expect(client.calls[0]?.text).toBe(input[0]?.content);
    expect(client.calls[0]?.options).toEqual({
      model: "bear-2",
      aggressiveness: 0.4,
      appId: "course-generator-compression",
    });

    expect(result.stats).toMatchObject({
      original_tokens: 12,
      compressed_tokens: 5,
      tokens_saved: 7,
      pct_saved: 58.33,
      fallback: false,
      empty_input: false,
      cache_hit: false,
      target: CompressionTarget.RETRIEVED_SOURCES,
    });
    expect(typeof result.stats.latency_ms).toBe("number");
  });

  it("returns original input with fallback stats when compression fails", async () => {
    const calls: MockCall[] = [];
    const client: CompressionClient & { calls: MockCall[] } = {
      calls,
      async compress(text: string, options: Parameters<CompressionClient["compress"]>[1]) {
        calls.push({ text, options });
        throw new Error("TTC API unavailable");
      },
    };

    const input = [
      { id: "chunk-1", content: "Original retrieved source text." },
      { id: "chunk-2", content: "Second source text." },
    ];

    const result = await compressContext(input, {
      client,
      target: CompressionTarget.RETRIEVED_SOURCES,
    });

    expect(result.compressed).toEqual(input);
    expect(client.calls).toHaveLength(1);
    expect(result.stats.fallback).toBe(true);
    expect(result.stats.empty_input).toBe(false);
    expect(result.stats.original_tokens).toBe(result.stats.compressed_tokens);
    expect(result.stats.tokens_saved).toBe(0);
    expect(result.stats.pct_saved).toBe(0);
    expect(result.stats.error).toMatch(/TTC API unavailable/);
  });

  it("returns empty output and does not call API for empty input", async () => {
    const client = createMockClient();

    const result = await compressContext([], {
      client,
      target: CompressionTarget.RETRIEVED_SOURCES,
    });

    expect(result.compressed).toEqual([]);
    expect(client.calls).toHaveLength(0);
    expect(result.stats).toEqual({
      original_tokens: 0,
      compressed_tokens: 0,
      tokens_saved: 0,
      pct_saved: 0,
      fallback: false,
      empty_input: true,
      cache_hit: false,
      latency_ms: 0,
      target: CompressionTarget.RETRIEVED_SOURCES,
    });
  });

  it("caches repeated compression inputs", async () => {
    const client = createMockClient({
      output: "cached compressed text",
      inputTokens: 20,
      outputTokens: 8,
    });
    const cache = createCompressionCache();
    const input = "Long carried course context that appears in repeated calls.";

    const first = await compressContext(input, {
      client,
      cache,
      target: CompressionTarget.CARRIED_COURSE_CONTEXT,
      aggressiveness: 0.6,
    });
    const second = await compressContext(input, {
      client,
      cache,
      target: CompressionTarget.CARRIED_COURSE_CONTEXT,
      aggressiveness: 0.6,
    });

    expect(client.calls).toHaveLength(1);
    expect(first.stats.cache_hit).toBe(false);
    expect(second.stats.cache_hit).toBe(true);
    expect(second.stats.latency_ms).toBe(0);
    expect(second.compressed).toBe("cached compressed text");
    expect(second.stats.original_tokens).toBe(first.stats.original_tokens);
    expect(second.stats.compressed_tokens).toBe(first.stats.compressed_tokens);
  });
});

