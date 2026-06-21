# Friend Integration Handoff

This document is for the agent/RAG side of the course-generator project. It explains exactly what the agent side needs to do so the RAG system, course generation flow, compression layer, and dashboard work together.

## Current Status

The compression side is ready to integrate.

Already built:

- TypeScript compression layer using The Token Company API.
- Real Token Company API verification.
- Safe normal/fallback/empty behavior.
- In-memory compression cache.
- Token stats object for UI and benchmarking.
- Compression dashboard.
- Research-inspired local extractive compressor.
- Three-way benchmark modes: `none`, `local`, and `token-company`.
- Aggressiveness sweep from `0.1` to `0.9` for finding the quality cliff.
- Mock benchmark harness that writes `public/latest-benchmark.json`.
- Optional benchmark interfaces for plugging in the real downstream generator and judge.

What is still needed from the agent/RAG side:

- Pass real retrieved RAG chunks into `compressContext`.
- Use `result.compressed` in the final LLM/ASI prompt.
- Pass `result.stats` back to the UI/dashboard.
- Provide the ASI generation call shape so the benchmark can run with the same model used in the real app.
- Decide whether ASI will also be the blind judge, or whether a separate judge model will be used.

Important: the dashboard can show token numbers now, but final "quality held" evidence is only real after the benchmark uses the actual downstream generator/judge. Since the app uses ASI, the real benchmark should use ASI for course generation.

## Big Picture

The full course-generation pipeline should look like this:

```text
User topic / uploaded source
-> RAG ingestion and retrieval
-> Compression layer compresses retrieved chunks, old history, and carried context
-> Agent assembles final prompt
-> LLM generates the course
-> UI shows course + compression telemetry
```

The agent/RAG side owns:

- Source upload or source selection.
- Document ingestion.
- Chunking.
- Embeddings.
- Vector DB storage.
- Retrieval.
- Course-generation orchestration.
- Final prompt assembly.
- Main user-facing course UI.

The compression side owns:

- Compressing retrieved source chunks after retrieval.
- Compressing old Q&A conversation history.
- Compressing carried course-step context.
- Returning compressed content plus stats.
- Safe fallback behavior.
- Token telemetry for the dashboard.

## The Most Important Rule

Compression happens **after retrieval and before generation**.

RAG decides **what source chunks are relevant**. Compression decides **how cheaply those chunks are represented in the prompt**.

Do not compress before retrieval. The vector DB should embed and retrieve from the original source chunks, not compressed chunks.

## What Your Friend Should Pass To Compression

### 1. Retrieved Source Chunks

This is the most important target.

After RAG retrieves chunks for the current course topic/query, pass those chunks into `compressContext`.

Recommended shape:

```ts
const retrievedChunks = [
  {
    id: "chunk-1",
    content: "Long retrieved textbook/source passage...",
    sourceTitle: "Biology Chapter 4",
    page: 18,
  },
  {
    id: "chunk-2",
    content: "Another relevant source passage...",
    sourceTitle: "Biology Chapter 4",
    page: 21,
  },
];
```

The compression layer preserves extra metadata like `id`, `sourceTitle`, and `page`. It only changes `content` or `text`.

Call:

```ts
import { CompressionTarget, compressContext } from "./src/compressionPipeline.js";

const compressedSources = await compressContext(retrievedChunks, {
  target: CompressionTarget.RETRIEVED_SOURCES,
  aggressiveness: 0.4,
});
```

Then use:

```ts
compressedSources.compressed
compressedSources.stats
```

### 2. Old Q&A Conversation History

Compress old conversation history, not the current user turn.

Good:

```ts
const oldHistoryText = previousTurns
  .map((turn) => `${turn.role}: ${turn.content}`)
  .join("\n\n");

const compressedHistory = await compressContext(oldHistoryText, {
  target: CompressionTarget.CONVERSATION_HISTORY,
  aggressiveness: 0.35,
});
```

Bad:

```ts
// Do not compress the live user message.
const compressedCurrentTurn = await compressContext(currentUserMessage);
```

The current user turn should go into the final prompt untouched.

### 3. Carried Course-Step Context

If the agent carries a "what has been covered so far" summary/module context between course steps, pass that through compression too.

```ts
const compressedCarriedContext = await compressContext(carriedCourseContext, {
  target: CompressionTarget.CARRIED_COURSE_CONTEXT,
  aggressiveness: 0.25,
});
```

This usually compresses less aggressively than retrieved source material.

## What Your Friend Must Not Compress

Never pass these into the compression layer:

- System prompt.
- Course schema.
- JSON that the agent parses.
- Tool/function call payloads that need exact structure.
- The current user turn.
- Any stable instruction text that must remain exact.

The final prompt should look like:

```text
[system prompt - untouched]
[course schema - untouched]
[compressed retrieved sources]
[compressed old Q&A history]
[compressed carried course context]
[current user turn - untouched]
```

## Server-Side Only

The Token Company API key must stay server-side.

Do not call `compressContext` directly from a browser component if it creates the real Token Company client. That would risk exposing the API key.

Correct options:

- Call compression inside the backend/serverless route that performs generation.
- Or expose a small internal API endpoint like `/api/compress-context`.
- Or keep compression inside the same server action/function that calls the LLM.

Do not put `TTC_API_KEY` in client-side code.

## Environment Variable

The compression layer supports these env var names:

```env
TTC_API_KEY=...
TOKEN_COMPANY_API_KEY=...
THE_TOKEN_COMPANY_API_KEY=...
```

Recommended:

```env
TTC_API_KEY=your_key_here
```

The `.env` file is intentionally ignored by git. Do not commit it.

## Fallback Behavior

The compression layer is designed to never break the live course-generation path.

Your friend should know these three branches:

### Normal Case

Input has content and Token Company API succeeds.

Result:

```ts
{
  compressed: compressedChunksOrText,
  stats: {
    fallback: false,
    empty_input: false,
    original_tokens: 1200,
    compressed_tokens: 700,
    pct_saved: 41.67
  }
}
```

Use `compressed` in the final prompt.

### Compression Failure

Input has content, but the Token Company API is down, slow, rate-limited, or errors.

Result:

```ts
{
  compressed: originalUncompressedInput,
  stats: {
    fallback: true,
    empty_input: false,
    pct_saved: 0
  }
}
```

Still use `compressed` in the final prompt. In this branch, `compressed` is just the original input.

Do not crash the course-generation flow.

### Empty Input

Retrieval returned nothing, or there is no history/context to compress.

Result:

```ts
{
  compressed: [],
  stats: {
    original_tokens: 0,
    compressed_tokens: 0,
    pct_saved: 0,
    fallback: false,
    empty_input: true
  }
}
```

The compression layer does not call the API for empty input.

The agent side must decide what "no sources found" means:

- Retry retrieval with a broader query.
- Ask the user for better source material.
- Generate from model knowledge.
- Tell the user no sources were found.

That decision belongs to the RAG/agent side, not the compression layer.

## Prompt Assembly Example

Example server-side flow:

```ts
import {
  CompressionTarget,
  compressContext,
  createCompressionCache,
} from "./src/compressionPipeline.js";

const compressionCache = createCompressionCache();

export async function generateCourse({
  topic,
  currentUserTurn,
  previousTurns,
  carriedCourseContext,
}: {
  topic: string;
  currentUserTurn: string;
  previousTurns: Array<{ role: string; content: string }>;
  carriedCourseContext: string;
}) {
  const retrievedChunks = await retrieveRelevantChunks(topic);

  const sourcesResult = await compressContext(retrievedChunks, {
    cache: compressionCache,
    target: CompressionTarget.RETRIEVED_SOURCES,
    aggressiveness: 0.4,
  });

  const historyText = previousTurns
    .map((turn) => `${turn.role}: ${turn.content}`)
    .join("\n\n");

  const historyResult = await compressContext(historyText, {
    cache: compressionCache,
    target: CompressionTarget.CONVERSATION_HISTORY,
    aggressiveness: 0.35,
  });

  const carriedResult = await compressContext(carriedCourseContext, {
    cache: compressionCache,
    target: CompressionTarget.CARRIED_COURSE_CONTEXT,
    aggressiveness: 0.25,
  });

  const prompt = assemblePrompt({
    systemPrompt,
    courseSchema,
    retrievedSources: sourcesResult.compressed,
    oldHistory: historyResult.compressed,
    carriedCourseContext: carriedResult.compressed,
    currentUserTurn,
  });

  const course = await callGenerationLLM(prompt);

  return {
    course,
    compressionStats: [
      sourcesResult.stats,
      historyResult.stats,
      carriedResult.stats,
    ],
  };
}
```

## Paired Demo Mode

For judging, the demo should be able to show the same input run in two branches:

```text
Branch A: uncompressed context
Branch B: compressed context
```

Everything except compression should stay the same:

- Same topic.
- Same retrieved chunks.
- Same conversation history.
- Same carried course context.
- Same current user turn.
- Same ASI model.
- Same generation settings.
- Temperature `0`, if ASI supports it.

The only variable should be whether the old/bulky context was compressed.

Recommended function:

```ts
async function runPairedDemo(input) {
  const retrievedChunks = await retrieveRelevantChunks(input.topic);
  const historyText = formatOldHistory(input.previousTurns);

  // Branch A: full context, no compression.
  const uncompressedPrompt = assemblePrompt({
    systemPrompt,
    courseSchema,
    retrievedSources: retrievedChunks,
    oldHistory: historyText,
    carriedCourseContext: input.carriedCourseContext,
    currentUserTurn: input.currentUserTurn,
  });

  // Branch B: same input, but compress old/bulky context first.
  const compressedSources = await compressContext(retrievedChunks, {
    target: CompressionTarget.RETRIEVED_SOURCES,
    aggressiveness: 0.4,
  });

  const compressedHistory = await compressContext(historyText, {
    target: CompressionTarget.CONVERSATION_HISTORY,
    aggressiveness: 0.35,
  });

  const compressedCarriedContext = await compressContext(input.carriedCourseContext, {
    target: CompressionTarget.CARRIED_COURSE_CONTEXT,
    aggressiveness: 0.25,
  });

  const compressedPrompt = assemblePrompt({
    systemPrompt,
    courseSchema,
    retrievedSources: compressedSources.compressed,
    oldHistory: compressedHistory.compressed,
    carriedCourseContext: compressedCarriedContext.compressed,
    currentUserTurn: input.currentUserTurn,
  });

  const uncompressedCourse = await asiGenerate(uncompressedPrompt, {
    temperature: 0,
  });

  const compressedCourse = await asiGenerate(compressedPrompt, {
    temperature: 0,
  });

  return {
    uncompressedCourse,
    compressedCourse,
    compressionStats: [
      compressedSources.stats,
      compressedHistory.stats,
      compressedCarriedContext.stats,
    ],
  };
}
```

In the UI, label the two outputs clearly:

```text
Run A: Full context
Run B: Compressed context
```

The dashboard should then show:

```text
Tokens before -> tokens after
Quality uncompressed / quality compressed
```

This paired mode is the cleanest way to prove that token reduction did not hurt downstream course quality.

## Dashboard Wiring

The dashboard is now benchmark-aware.

It first tries to read:

```text
public/latest-benchmark.json
```

That file is produced by:

```bash
npm run benchmark
```

or, once ASI is wired:

```bash
npm run benchmark:<asi-mode>
```

If that file is missing, the dashboard falls back to demo placeholder numbers. Do not present fallback/demo numbers as final evidence.

There are two separate dashboard data sources:

1. Token cards and source breakdown come from `compressContext(...).stats`.
2. The "Quality held" card comes from the paired benchmark result.

For live app integration, the agent side should return compression stats from the generation endpoint:

```ts
const compressionStats = [
  sourcesResult.stats,
  historyResult.stats,
  carriedResult.stats,
];
```

The helper already exists:

```ts
import { buildCompressionTelemetry } from "./src/compressionTelemetry.js";
```

Build telemetry:

```ts
const telemetry = buildCompressionTelemetry({
  stats: compressionStats,
  quality: {
    compressed: benchmarkQuality.compressed,
    uncompressed: benchmarkQuality.uncompressed,
  },
});
```

Then the dashboard can show:

- Tokens before.
- Tokens after.
- Percent saved.
- Quality held.
- Source-by-source token reduction.
- Protected sections.
- API healthy/fallback state.
- Normal/fallback/empty resilience state.

## How Quality Score Should Be Supplied

The dashboard has a `quality` field:

```ts
quality: {
  compressed: 9.1,
  uncompressed: 9.2,
}
```

For the live hackathon demo, this should come from the benchmark harness.

Because the real course agent uses ASI, the real benchmark should use:

- ASI for course generation with uncompressed context.
- ASI for course generation with compressed context.
- ASI in judge mode, or another agreed judge model, to score the pair blindly.

The benchmark harness already has provider-agnostic interfaces:

```ts
type CourseGenerator = {
  generateCourse(...): Promise<string>;
};

type QualityJudge = {
  judgePair(...): Promise<BlindJudgeResult>;
};
```

Your friend needs to provide the ASI call shape so an `ASI` implementation can be plugged into those interfaces.

Do not claim quality improved unless the benchmark proves it. The safe claim is:

> Tokens dropped and quality held.

## What The Main Course UI Should Show

The main course UI should focus on the generated course.

The compression dashboard should be a separate panel or route that reveals what happened underneath.

Recommended UI split:

- Course page: user sees the generated course.
- Compression dashboard: judges see token savings and fallback behavior.

Possible route names:

```text
/course
/compression-dashboard
```

Or a tab layout:

```text
[Generated Course] [Compression Telemetry]
```

## Data To Return From The Agent Endpoint

If the course generation runs through an endpoint, return both the course and compression telemetry.

Example:

```ts
return Response.json({
  course,
  compression: {
    stats: compressionStats,
    telemetry,
  },
});
```

Frontend shape:

```ts
type GenerateCourseResponse = {
  course: unknown;
  compression: {
    stats: CompressionStats[];
    telemetry: CompressionDashboardTelemetry;
  };
};
```

## Source Chunk Shape Requirements

The compression layer can handle chunks with `content` or `text`.

Preferred:

```ts
type RetrievedChunk = {
  id: string;
  content: string;
  sourceTitle?: string;
  page?: number;
  score?: number;
};
```

Also accepted:

```ts
type RetrievedChunk = {
  id: string;
  text: string;
};
```

Avoid:

```ts
// Bad: compression layer does not know where the compressible text is.
{
  id: "chunk-1",
  body: "..."
}
```

If the RAG system uses `body`, `markdown`, or another field, map it before calling compression:

```ts
const compressibleChunks = retrievedChunks.map((chunk) => ({
  ...chunk,
  content: chunk.body,
}));
```

## Caching Recommendation

Create one cache per server process/request context where it makes sense:

```ts
const compressionCache = createCompressionCache();
```

Pass it into repeated compression calls:

```ts
await compressContext(retrievedChunks, {
  cache: compressionCache,
  target: CompressionTarget.RETRIEVED_SOURCES,
});
```

This helps avoid recompressing repeated history prefixes or unchanged retrieved chunks.

For a hackathon, the in-memory cache is enough.

For production, consider a shared cache such as Redis if needed.

## ASI Benchmark Integration Needed

The mock benchmark already proves the harness works structurally, but the final downstream evidence should use ASI because the course agent uses ASI.

Your friend should provide:

- ASI package name or HTTP endpoint.
- Required API key env var name.
- Request shape for a normal course-generation call.
- Response shape for generated text.
- How to set deterministic behavior, such as temperature `0`.
- Model name being used in the course agent.
- Whether ASI supports JSON output for judge mode.
- Any rate limits or timeout concerns.

Needed implementation:

```ts
createASICourseGenerator() satisfies CourseGenerator
```

This should call ASI with the benchmark prompt and return the generated course text.

Needed judge implementation:

```ts
createASIQualityJudge() satisfies QualityJudge
```

This should call ASI with the blind judge prompt and return:

```ts
{
  outputA: {
    accuracy: number,
    coverage: number,
    questionQuality: number,
    overall: number,
    rationale: string
  },
  outputB: {
    accuracy: number,
    coverage: number,
    questionQuality: number,
    overall: number,
    rationale: string
  }
}
```

Once those are added, run the real ASI benchmark and write:

```text
public/latest-benchmark.json
```

Then the dashboard's quality-held card becomes real evidence instead of mock/demo evidence.

## Integration Checklist

Before demo, confirm:

- RAG retrieval returns chunks with `content` or `text`.
- Compression is called after retrieval and before prompt assembly.
- Current user turn is never compressed.
- System prompt and course schema are never compressed.
- `TTC_API_KEY` is present server-side.
- `.env` is not committed.
- If compression fails, generation still continues.
- If retrieval returns empty chunks, compression returns empty cleanly.
- The final LLM prompt uses `result.compressed`, not the original chunks.
- The UI receives `result.stats`.
- The dashboard uses real stats instead of demo stats.
- The benchmark uses ASI for real downstream course generation.
- The dashboard reads a real `public/latest-benchmark.json` generated by the ASI benchmark.
- The API healthy badge flips when `fallback: true`.
- The protected panel lists system prompt, course schema, and current user turn.
- The demo story says "tokens saved while quality held," not "quality improved."

## Commands

Run tests:

```bash
npm test
```

Typecheck:

```bash
npm run typecheck
```

Build:

```bash
npm run build
```

Verify Token Company API:

```bash
npm run verify:ttc
```

Run mock benchmark:

```bash
npm run benchmark
```

This confirms the harness and dashboard wiring work, but it is not final downstream evidence.

Run real downstream benchmark:

```bash
npm run benchmark:<asi-mode>
```

This command should be added once the ASI generator/judge clients are implemented. The output should overwrite:

```text
public/latest-benchmark.json
```

Run dashboard:

```bash
npm run dev
```

## Final Contract

Your friend should treat the compression layer as this contract:

```ts
const result = await compressContext(input, {
  target: CompressionTarget.RETRIEVED_SOURCES,
  aggressiveness: 0.4,
});

// Always safe to use:
result.compressed;
result.stats;
```

The compression layer should never block the course-generation path. The agent side can always use `result.compressed`, because on failure it is the original input and on empty input it is empty output.

## After This Branch Is Pushed

Your friend's concrete next steps are:

1. Pull this branch.
2. Run `npm install`.
3. Run `npm test` and `npm run typecheck`.
4. Confirm their retrieved chunks have `content` or `text`.
5. Call `compressContext` immediately after RAG retrieval.
6. Put `result.compressed` into the ASI generation prompt.
7. Return `result.stats` from the generation endpoint.
8. Wire those stats into the compression dashboard.
9. Provide the ASI API/call details needed to implement `createASICourseGenerator` and `createASIQualityJudge`.
10. Run the real ASI benchmark so `public/latest-benchmark.json` contains real downstream quality evidence.

