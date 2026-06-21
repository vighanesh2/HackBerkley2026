# Compression Pipeline Loop Plan

## Purpose

Use bounded agent loops so the compression pipeline can be built, verified, benchmarked, and integrated without repeatedly prompting by hand.

Each loop must have:

- A concrete verifier.
- A hard stopping condition.
- A small scope.
- A clear failure report if it cannot finish.

Do not run open-ended loops like "make compression better." Every loop should terminate on a gate such as tests passing, a benchmark sweep finishing, or an interface contract check succeeding.

## Loop 1: Test-Pass Foundation

### Goal

Build the compression layer against a concrete contract and keep iterating until tests pass.

### Why This Comes First

The compression layer has important fallback behavior that is easy to get subtly wrong. The three-branch contract is perfect for automated tests because each branch has a clear expected output.

### Tests To Write Before Implementation

Write tests for these cases:

1. Normal input:
   - Given retrieved chunks, conversation history, or carried context.
   - When the compression API succeeds.
   - Then the function returns compressed output in the expected shape.
   - Stats include original tokens, compressed tokens, percent saved, latency, and `fallback: false`.

2. Compression failure:
   - Given non-empty input.
   - When the compression API errors, times out, or returns an invalid response.
   - Then the function returns the original uncompressed input.
   - Stats include `fallback: true`.
   - `pct_saved` is `0`.
   - The function does not throw into the live path.

3. Empty input:
   - Given an empty chunk list, empty history, or empty context.
   - Then the function returns empty output.
   - Stats are zeroed.
   - The compression API is not called.
   - `fallback` is false because this is not an API failure.

### Loop Prompt

```text
Implement the compression layer using the existing contract tests as the verifier.

Loop:
1. Run the compression tests.
2. Read the failures.
3. Make the smallest implementation change needed.
4. Repeat until the compression tests pass.

Hard stop:
- Stop when tests pass.
- Stop after 8 iterations and report the remaining failing tests.
- Do not call the real Token Company API in this loop. Use a mock/stub.
```

### Stop Conditions

- Success: all compression contract tests pass.
- Failure: 8 iterations reached, test runner cannot execute, or the implementation requires unknown Token Company API details.

### Output

The loop should report:

- Whether tests passed.
- Files changed.
- Any unresolved failures.
- Whether the real API is still mocked.

## Loop 2: Manual API Verification

### Goal

Confirm The Token Company API details once before automating against it.

### Important Rule

Do not run an agent loop against the real Token Company API until one manual call works.

If the SDK import, package name, API key, or parameter shape is wrong, a loop will thrash, waste calls, and risk rate limits.

### Manual Checklist

Verify:

- Official package name.
- Official import syntax.
- API key environment variable.
- Basic compression call.
- Aggressiveness parameter, if available.
- Rate limits.
- Typical latency.
- Error response shape.

### Stop Conditions

- Success: one hand-made compression call works.
- Failure: API docs are unclear, key is missing, package cannot install, or the API is unavailable.

### Output

Record the confirmed API usage in code comments or project docs before wiring it into the live implementation.

## Loop 3: Integration Contract Loop

### Goal

Ensure the compression layer matches the agent-side contract before integrating with the teammate's course agent.

### Scope

Mock the agent-side calls. Do not require the full ASI agent, Fetch.ai integration, or real RAG stack.

### Inputs To Mock

- Retrieved source chunks.
- Conversation history.
- Carried course-step context.
- Empty retrieved chunks.
- Malformed or missing optional fields if the interface allows them.

### Assertions

Check that:

- Response shape matches the agreed contract.
- Compressed content preserves the expected shape.
- Stats are always present and well-formed.
- Empty input returns cleanly.
- API failure returns original input with fallback stats.
- The function never throws into the live path for expected runtime failures.

### Loop Prompt

```text
Run the integration contract checks for the compression layer.

Loop:
1. Run the mocked integration tests.
2. Read failures.
3. Fix the contract mismatch or stats shape.
4. Repeat until the integration contract tests pass.

Hard stop:
- Stop when mocked integration tests pass.
- Stop after 6 iterations and report remaining mismatches.
- Do not modify the agent-side project unless explicitly requested.
```

### Stop Conditions

- Success: mocked agent calls pass.
- Failure: contract ambiguity remains or 6 iterations are reached.

### Output

The loop should report:

- Final agreed input and output shape.
- Any assumptions made about the agent-side handoff.
- Whether the layer is ready to wire into the real agent.

## Loop 4: Benchmark-As-Verifier

### Goal

Measure whether compression saves tokens while course quality holds.

This loop should not blindly optimize. It should run a bounded sweep and report the curve.

### Benchmark Design

Use paired runs:

- Same topic.
- Same retrieved source material.
- Same user turns.
- Same generation model.
- Temperature 0.
- Fixed seed if available.
- Compression is the only variable.

For each session, generate:

- Uncompressed output.
- Compressed output.

Then use LLM-as-judge to score both outputs blindly on:

- Accuracy.
- Coverage.
- Feynman question quality.

### Aggressiveness Sweep

Run a small bounded sweep such as:

- `0.2`
- `0.4`
- `0.6`
- `0.8`

For each level, log:

- Original tokens.
- Compressed tokens.
- Percent saved.
- Quality score for uncompressed output.
- Quality score for compressed output.
- Quality delta.

### Loop Prompt

```text
Run the paired compression benchmark sweep.

Loop:
1. Run the benchmark at the next aggressiveness level.
2. Record token savings and blind LLM-as-judge quality scores.
3. Continue until all configured aggressiveness levels are complete.
4. Summarize the safest operating point: maximum token savings with no meaningful quality drop.

Hard stop:
- Stop after the configured aggressiveness levels are complete.
- Stop after 4 aggressiveness levels unless explicitly expanded.
- Stop if judge/model/API calls fail repeatedly and report partial results.
```

### Stop Conditions

- Success: all configured benchmark levels finish.
- Failure: benchmark runner cannot execute, API failures prevent scoring, or cost/rate-limit threshold is reached.

### Output

The loop should report:

- Token-saved-vs-quality-held curve.
- Recommended aggressiveness setting.
- Any sessions where quality dropped.
- Whether retrieved source compression or history compression produced the larger savings.

## Loop 5: Demo Safety Loop

### Goal

Verify the live path cannot break because of compression.

### Checks

Run scenarios where:

- Token Company API succeeds.
- Token Company API errors.
- Token Company API times out.
- Retrieved chunks are empty.
- Cache hit occurs.
- Cache miss occurs.

### Assertions

Check that:

- Course generation can continue in all scenarios.
- Failed compression returns original input.
- Empty input returns empty output without calling the API.
- Cache hits avoid extra API calls.
- Stats are still emitted.

### Loop Prompt

```text
Run demo safety checks for the compression layer.

Loop:
1. Run the safety tests.
2. Fix any case where compression can throw, block, or return malformed stats.
3. Repeat until the safety tests pass.

Hard stop:
- Stop when safety tests pass.
- Stop after 6 iterations and report remaining live-path risks.
```

### Stop Conditions

- Success: safety tests pass.
- Failure: 6 iterations reached or a live-path risk cannot be fixed without changing the agent contract.

## Global Loop Rules

- Always use mocks for the real compression API until one manual API call has been verified.
- Never loop on a vague goal.
- Never loop without a verifier.
- Never loop without a maximum iteration count.
- Prefer small fixes over broad rewrites.
- Report partial results when a loop hits its stop condition.
- The compression layer should never throw into the live course-generation path.

## Recommended Order

1. Test-pass foundation loop.
2. Manual Token Company API verification.
3. Integration contract loop.
4. Demo safety loop.
5. Benchmark-as-verifier loop.

