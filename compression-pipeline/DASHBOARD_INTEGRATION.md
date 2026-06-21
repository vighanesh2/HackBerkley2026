# Compression Dashboard Integration

The dashboard makes the compression layer visible during the demo.

## Run Locally

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Wiring Live Stats

The UI currently uses demo stats in `src/App.tsx`. To make it live, replace `demoStats` with the `stats` objects returned from the compression layer.

Example:

```ts
const retrieved = await compressContext(retrievedChunks, {
  target: CompressionTarget.RETRIEVED_SOURCES,
});

const history = await compressContext(historyText, {
  target: CompressionTarget.CONVERSATION_HISTORY,
});

const carried = await compressContext(carriedContext, {
  target: CompressionTarget.CARRIED_COURSE_CONTEXT,
});

const telemetry = buildCompressionTelemetry({
  stats: [retrieved.stats, history.stats, carried.stats],
  quality: { compressed: 9.1, uncompressed: 9.2 },
});
```

The dashboard should show:

- Tokens before.
- Tokens after.
- Percent saved.
- Quality held.
- Token reduction by source.
- Protected sections.
- Normal/fallback/empty resilience state.

