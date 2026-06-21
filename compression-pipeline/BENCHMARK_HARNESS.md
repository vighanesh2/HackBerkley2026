# Benchmark Harness

This harness proves the downstream claim:

> We reduce tokens while course quality holds.

It runs paired sessions:

```text
same retrieved chunks + same history + same prompt
-> generate course with uncompressed context
-> generate course with compressed context
-> judge both outputs blindly
-> report tokens saved vs quality held
```

## Compressor Modes

The benchmark now compares three modes:

```text
none
local
token-company
```

- `none`: baseline with full context and no compression.
- `local`: our research-inspired query-aware extractive compressor.
- `token-company`: The Token Company hosted compressor.

The local compressor is inspired by LongLLMLingua and LLMLingua-2:

- Split context into sentences.
- Score sentences by query/focus relevance.
- Boost definitions, entities, and numeric facts.
- Use position only as a small tiebreaker.
- Greedily dedupe near-identical kept sentences.
- Fill to a token budget based on aggressiveness.
- Move the highest-value sentences to the front.
- Never rewrite facts; only delete lower-value text.

## Mock Run

Use this for local development and dashboard wiring:

```bash
npm run benchmark
```

This uses deterministic mock compression/generation/judging and writes:

```text
public/latest-benchmark.json
```

The dashboard reads that file automatically.

## Real OpenAI Run

Use this for actual downstream quality evidence:

```bash
npm run benchmark:openai
```

Required `.env` values:

```env
TTC_API_KEY=your_token_company_key
OPENAI_API_KEY=your_openai_key
BENCHMARK_LLM_MODEL=gpt-4.1-mini
BENCHMARK_JUDGE_MODEL=gpt-4.1-mini
```

The real run uses:

- Token Company API for compression.
- OpenAI for deterministic course generation at temperature 0.
- OpenAI for blind JSON judging.

## Aggressiveness Sweep

Default:

```text
0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9
```

Custom:

```bash
npm run benchmark -- --levels=0.2,0.4,0.6
```

Real mode:

```bash
npm run benchmark:openai -- --levels=0.2,0.4,0.6
```

## Session Count

Run fewer sessions while debugging:

```bash
npm run benchmark -- --sessions=2
```

Real mode:

```bash
npm run benchmark:openai -- --sessions=2
```

## Output

The result includes:

- Compressor mode.
- Per-aggressiveness token savings.
- Per-session uncompressed and compressed course outputs.
- Blind judge scores for accuracy, coverage, question quality, and overall.
- Quality delta.
- Quality-held boolean.
- Recommended aggressiveness level.
- Quality curve data for finding the compression cliff.

The dashboard uses the recommended level from `public/latest-benchmark.json`.

## Current Status

The harness is built and mock-runnable now.

To produce real downstream evidence, add `OPENAI_API_KEY` to `.env` and run:

```bash
npm run benchmark:openai
```

