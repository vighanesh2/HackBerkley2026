import type { CompressibleChunk, CompressionStats } from "./compressionTypes";

export type CompressorMode = "none" | "local" | "token-company";

export type BenchmarkSession = {
  id: string;
  topic: string;
  currentUserTurn: string;
  retrievedChunks: CompressibleChunk[];
  conversationHistory: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  carriedCourseContext: string;
  expectedCourseFocus: string[];
};

export type CoursePromptParts = {
  topic: string;
  retrievedSources: CompressibleChunk[] | string;
  conversationHistory: string;
  carriedCourseContext: string;
  currentUserTurn: string;
};

export type CourseGenerator = {
  generateCourse(input: {
    session: BenchmarkSession;
    prompt: string;
    variant: "uncompressed" | "compressed";
  }): Promise<string>;
};

export type QualityJudge = {
  judgePair(input: {
    session: BenchmarkSession;
    outputA: string;
    outputB: string;
  }): Promise<BlindJudgeResult>;
};

export type BlindJudgeResult = {
  outputA: QualityScore;
  outputB: QualityScore;
};

export type QualityScore = {
  accuracy: number;
  coverage: number;
  questionQuality: number;
  overall: number;
  rationale: string;
};

export type SessionBenchmarkResult = {
  sessionId: string;
  topic: string;
  compressorMode: CompressorMode;
  aggressiveness: number;
  stats: CompressionStats[];
  tokenTotals: {
    originalTokens: number;
    compressedTokens: number;
    tokensSaved: number;
    pctSaved: number;
  };
  uncompressedCourse: string;
  compressedCourse: string;
  quality: {
    uncompressed: QualityScore;
    compressed: QualityScore;
    delta: number;
    held: boolean;
  };
};

export type AggressivenessBenchmarkResult = {
  compressorMode: CompressorMode;
  aggressiveness: number;
  sessions: SessionBenchmarkResult[];
  summary: {
    originalTokens: number;
    compressedTokens: number;
    tokensSaved: number;
    pctSaved: number;
    averageUncompressedQuality: number;
    averageCompressedQuality: number;
    averageQualityDelta: number;
    qualityHeldRate: number;
  };
};

export type BenchmarkRunResult = {
  generatedAt: string;
  qualityHoldTolerance: number;
  compressorModes: CompressorMode[];
  levels: AggressivenessBenchmarkResult[];
  recommendation: {
    compressorMode: CompressorMode;
    aggressiveness: number;
    pctSaved: number;
    averageQualityDelta: number;
    qualityHeldRate: number;
  } | null;
};

