import type { CompressionDashboardTelemetry } from "@/lib/compression/compressionTelemetry";

export type CompressorMode = "none" | "local" | "token-company";

export type CompressionRunResult = {
  mode: CompressorMode;
  label: string;
  originalTokens: number;
  compressedTokens: number;
  tokensSaved: number;
  pctSaved: number;
  latencyMs: number;
  fallback: boolean;
  active: boolean;
};

export type CompressionSnapshot = {
  telemetry: CompressionDashboardTelemetry;
  comparison: CompressionRunResult[];
  activeMode: Exclude<CompressorMode, "none">;
  at: string;
};
