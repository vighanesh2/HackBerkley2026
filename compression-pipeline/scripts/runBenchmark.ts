import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { benchmarkSessions } from "../src/benchmark/sessions.js";
import { createMockCompressionClient, createMockCourseGenerator, createMockQualityJudge } from "../src/benchmark/mockClients.js";
import { createOpenAICourseGenerator, createOpenAIQualityJudge } from "../src/benchmark/openAIClients.js";
import { runBenchmark } from "../src/benchmark/runner.js";
import { createTokenCompanyClient } from "../src/compressionPipeline.js";
import { loadDotEnv } from "./loadDotEnv.js";

const args = parseArgs(process.argv.slice(2));
const outputPath = resolve(process.cwd(), args.output ?? "public/latest-benchmark.json");
const levels = parseLevels(args.levels ?? "0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9");
const maxSessions = Number(args.sessions ?? benchmarkSessions.length);
const mode = args.mode ?? "mock";

loadDotEnv();

const clients = createClients(mode);

const result = await runBenchmark({
  sessions: benchmarkSessions.slice(0, maxSessions),
  aggressivenessLevels: levels,
  compressionClient: clients.compressionClient,
  generator: clients.generator,
  judge: clients.judge,
});

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);

console.log(`Benchmark complete: ${outputPath}`);
for (const level of result.levels) {
  console.log(
    `compressor=${level.compressorMode} aggressiveness=${level.aggressiveness} saved=${level.summary.pctSaved}% quality_delta=${level.summary.averageQualityDelta} held=${level.summary.qualityHeldRate}%`,
  );
}

if (result.recommendation) {
  console.log(
    `recommended=${result.recommendation.compressorMode}@${result.recommendation.aggressiveness} saved=${result.recommendation.pctSaved}% quality_delta=${result.recommendation.averageQualityDelta}`,
  );
} else {
  console.log("recommended=none; no aggressiveness level held quality across all sessions");
}

function createClients(mode: string) {
  if (mode === "mock") {
    return {
      compressionClient: createMockCompressionClient(),
      generator: createMockCourseGenerator(),
      judge: createMockQualityJudge(),
    };
  }

  if (mode === "openai") {
    return {
      compressionClient: createTokenCompanyClient(),
      generator: createOpenAICourseGenerator(),
      judge: createOpenAIQualityJudge(),
    };
  }

  throw new Error(`Unsupported benchmark mode "${mode}". Use "mock" or "openai".`);
}

function parseArgs(argv: string[]): Record<string, string> {
  const parsed: Record<string, string> = {};

  for (const arg of argv) {
    if (!arg.startsWith("--")) {
      continue;
    }

    const [key, value = "true"] = arg.slice(2).split("=");
    if (key) {
      parsed[key] = value;
    }
  }

  return parsed;
}

function parseLevels(value: string): number[] {
  const levels = value
    .split(",")
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isFinite(entry));

  if (levels.length === 0) {
    throw new Error("At least one aggressiveness level is required.");
  }

  return levels;
}

