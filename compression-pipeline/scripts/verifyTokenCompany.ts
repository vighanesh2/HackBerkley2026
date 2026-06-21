import { CompressionTarget, compressContext, createTokenCompanyClient } from "../src/compressionPipeline.js";
import { loadDotEnv } from "./loadDotEnv.js";

loadDotEnv();

const client = createTokenCompanyClient();

const result = await compressContext(
  "Photosynthesis is the process plants use to convert light energy into chemical energy. This extra sentence adds removable context for compression verification.",
  {
    client,
    target: CompressionTarget.RETRIEVED_SOURCES,
    aggressiveness: 0.4,
  },
);

console.log("Token Company verification succeeded.");
console.log({
  original_tokens: result.stats.original_tokens,
  compressed_tokens: result.stats.compressed_tokens,
  tokens_saved: result.stats.tokens_saved,
  pct_saved: result.stats.pct_saved,
  fallback: result.stats.fallback,
});

