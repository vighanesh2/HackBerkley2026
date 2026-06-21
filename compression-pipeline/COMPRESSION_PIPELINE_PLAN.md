# Token Compression Pipeline Build Plan

## Project Context

This project is a course-generator app. The agent side, including the ASI agent, Fetch.ai integration, and RAG retrieval flow, is owned by the agent-side teammate.

This component is the compression pipeline that sits between the course agent and the LLM. Every time the agent is about to call the LLM, old and bulky natural-language context should pass through this layer first so fewer tokens are sent while course quality stays the same.

The goal is aligned with The Token Company track: reduce prompt tokens while maintaining downstream performance.

## Core Idea

The compression layer should compress only growing natural-language material. It should not touch exact instructions, schemas, system prompts, the current user turn, or structured data the agent depends on.

The stable head and live tail of the prompt pass through untouched. The old, bulky middle gets compressed.

## What Gets Compressed

### 1. Retrieved RAG Source Material

This is now the primary compression target.

RAG retrieves source chunks before they are placed into the generation prompt. Those chunks are often bulky, redundant, and natural-language-heavy, which makes them a strong fit for deletion-based compression.

Compression should happen after retrieval and before prompt assembly.

```text
user topic / uploaded source
-> RAG retrieves relevant chunks
-> compression layer compresses retrieved chunks
-> prompt is assembled
-> LLM generates the course
```

RAG selects what source material matters. Compression makes that selected material cheaper to represent in the prompt.

### 2. User Q&A / Conversation History

The course flow uses the Feynman technique, so the user and agent produce a lot of question-heavy back-and-forth over time. Prior turns get resent in future LLM calls, so older conversation history should be compressed.

The current live user turn should not be compressed.

### 3. Carried Course-Step Context

As the course is generated module by module, the agent carries forward a "what has been covered so far" context block. This grows over time and should be compressed before being included in later generation prompts.

## What Does Not Get Compressed

Do not compress:

- System prompts.
- Course schemas.
- Exact instructions the agent depends on.
- Structured JSON the agent parses.
- The current user turn.
- Any stable prompt sections that need exact wording.

Retrieved docs can be compressed, but the system should be careful when exact facts, numbers, or quotes matter. Deletion-based compression is preferred because it drops low-value tokens without rewriting facts.

## Compressor Choice

Use The Token Company's hosted compression API.

Reasons:

- The app deploys on Vercel, so self-hosting a Python ML model like LLMLingua-2 is a real architecture blocker.
- Compression happens live and per turn, so a hosted API call before the LLM call fits the product flow cleanly.
- It is aligned with the sponsor track.

Before coding against it, verify the real package name, import, API key handling, parameters, rate limits, latency, and call shape from The Token Company's official docs. Do not hardcode a guessed SDK import.

## Interface Contract

The agent-side teammate retrieves source chunks and owns the main course-agent orchestration.

This compression layer receives retrieved chunks, conversation history, and/or carried course context, then returns compressed content plus stats.

Suggested function shape:

```ts
compressContext(input, options) -> {
  compressed,
  stats
}
```

The exact input shape should match the agreed app contract. It may be either:

- A list of message or chunk objects.
- A plain string.

The output should preserve the same general shape so the agent can pass it into prompt assembly without knowing the internal compression details.

## Runtime Flow

```text
user topic / uploaded source
-> RAG retrieves relevant chunks
-> compression layer compresses retrieved chunks
-> compression layer compresses old conversation history
-> compression layer compresses carried course context
-> prompt assembled:
   [system/schema]
   + [compressed sources]
   + [compressed old history]
   + [compressed carried context]
   + [current user turn]
-> LLM generates course
```

## Fallback Contract

The compression layer should never throw into the live path and should never block generation. The worst case should be that no compression happened.

There are three branches:

### 1. Normal

Input contains chunks/history/context and the compression API succeeds.

Return compressed content and real stats.

### 2. Compression Fails

Input contains chunks/history/context, but the compression API is slow, down, rate-limited, or errors.

Return the original uncompressed input. Mark the stats as fallback/uncompressed.

Example stats:

```json
{
  "original_tokens": 1200,
  "compressed_tokens": 1200,
  "pct_saved": 0,
  "fallback": true
}
```

The course generation should continue with full material.

### 3. Empty Input

Retrieval returned nothing or there is no history/context to compress.

Do not call the compression API. Return empty output immediately with zeroed stats.

Example stats:

```json
{
  "original_tokens": 0,
  "compressed_tokens": 0,
  "pct_saved": 0,
  "fallback": false
}
```

This is not a compression failure. The agent decides what to do next, such as retry retrieval, generate from model knowledge, or tell the user no sources were found.

## Stats To Log

For each compression call, log:

- Original tokens.
- Compressed tokens.
- Percent saved.
- Latency.
- Whether fallback was used.
- Whether input was empty.
- Compression target type, such as `retrieved_sources`, `conversation_history`, or `carried_course_context`.

## Caching

Cache compressed results for repeated inputs, especially repeated history prefixes or unchanged retrieved chunks.

This reduces API calls, latency, and demo-day dependency risk.

## Demo-Day Risk Mitigation

The hosted API can be slow, rate-limited, or down during judging. Mitigations:

- Wrap every API call in try/catch.
- Fall back to uncompressed input on failure.
- Return empty cleanly on empty input.
- Cache repeated compression results.
- Pre-record a backup demo run in case the API is unavailable during the live demo.

## Benchmark Plan

The claim is not that quality improves. The claim is that token usage drops while quality holds.

Use a paired offline benchmark:

- Define 15-25 fixed test sessions.
- Each session includes a topic, retrieved source material, and a fixed sequence of user turns/questions.
- Run each session twice: once with uncompressed context, once with compressed context.
- Keep generation deterministic with temperature 0 and a fixed seed if available.
- Make compression the only variable.

Measure:

- Original tokens.
- Compressed tokens.
- Percent saved.
- Quality score for uncompressed output.
- Quality score for compressed output.

Quality can be measured with LLM-as-judge:

- Generate both outputs blind to which one used compression.
- Have a separate LLM score accuracy, coverage, and Feynman question quality.
- Compare scores and identify the highest compression level with no meaningful quality drop.

The strongest benchmark claim should focus on retrieved source material:

> We cut X% of retrieved course material tokens with no drop in course quality.

## Research Backing

Useful references for explaining why deletion-based compression works:

- LLMLingua: small-model token deletion with large compression ratios and little quality loss.
- LongLLMLingua: compression can help with long-context "lost in the middle" issues.
- LLMLingua-2: token-classification compression, similar in spirit to modern deletion-based compressors.
- Deletion-based compression vs generative rewriting: deletion is safer because it does not rewrite facts, only removes lower-value tokens.

Use these as justification, not as the design itself.

## Build Order

1. Get The Token Company API key.
2. Verify the real SDK/import/API call from official docs.
3. Build the compression wrapper with empty-input handling, try/catch fallback, caching, and stats.
4. Support compression targets for retrieved source chunks, conversation history, and carried course context.
5. Wire the function into the agent's pre-LLM step after RAG retrieval.
6. Build the paired benchmark harness.
7. Run benchmark sessions and produce the token-saved-vs-quality-held curve.
8. Pick the safest aggressiveness level for the demo.

## Ownership Split

Agent-side teammate owns:

- ASI agent integration.
- Fetch.ai integration.
- RAG ingestion, embeddings, vector DB, chunking, and retrieval.
- Course-agent orchestration and final prompt assembly.

Compression pipeline owns:

- Compressing retrieved chunks after retrieval.
- Compressing old Q&A history.
- Compressing carried course-step context.
- Returning compressed output and stats.
- Fallback behavior.
- Caching.
- Compression benchmark and reporting.

