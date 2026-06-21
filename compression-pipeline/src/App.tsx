import { useEffect, useState } from "react";

import {
  buildBenchmarkComparisonRows,
  buildCompressionTelemetry,
  buildCompressionTelemetryFromBenchmark,
  buildQualityCurve,
  type BenchmarkComparisonRow,
  type CompressionDashboardTelemetry,
  type QualityCurvePoint,
} from "./compressionTelemetry.js";
import type { BenchmarkRunResult } from "./benchmark/types.js";
import { CompressionTarget, type CompressionStats } from "./compressionTypes.js";
import "./styles.css";

const demoStats: CompressionStats[] = [
  {
    original_tokens: 12_100,
    compressed_tokens: 6_300,
    tokens_saved: 5_800,
    pct_saved: 47.93,
    fallback: false,
    empty_input: false,
    cache_hit: false,
    latency_ms: 86,
    target: CompressionTarget.RETRIEVED_SOURCES,
  },
  {
    original_tokens: 4_800,
    compressed_tokens: 3_200,
    tokens_saved: 1_600,
    pct_saved: 33.33,
    fallback: false,
    empty_input: false,
    cache_hit: true,
    latency_ms: 0,
    target: CompressionTarget.CONVERSATION_HISTORY,
  },
  {
    original_tokens: 1_540,
    compressed_tokens: 1_290,
    tokens_saved: 250,
    pct_saved: 16.23,
    fallback: false,
    empty_input: false,
    cache_hit: false,
    latency_ms: 42,
    target: CompressionTarget.CARRIED_COURSE_CONTEXT,
  },
];

const fallbackTelemetry = buildCompressionTelemetry({
  stats: demoStats,
  quality: {
    compressed: 9.1,
    uncompressed: 9.2,
  },
});

export default function App() {
  const [telemetryState, setTelemetryState] = useState<{
    telemetry: CompressionDashboardTelemetry;
    source: "benchmark" | "demo";
    comparisonRows: BenchmarkComparisonRow[];
    curve: QualityCurvePoint[];
  }>({
    telemetry: fallbackTelemetry,
    source: "demo",
    comparisonRows: [],
    curve: [],
  });

  useEffect(() => {
    let isMounted = true;

    async function loadBenchmark() {
      try {
        const response = await fetch("/latest-benchmark.json", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const result = (await response.json()) as BenchmarkRunResult;
        if (isMounted) {
          setTelemetryState({
            telemetry: buildCompressionTelemetryFromBenchmark(result),
            source: "benchmark",
            comparisonRows: buildBenchmarkComparisonRows(result),
            curve: buildQualityCurve(result),
          });
        }
      } catch {
        // The dashboard remains usable with demo telemetry until the benchmark is generated.
      }
    }

    void loadBenchmark();

    return () => {
      isMounted = false;
    };
  }, []);

  const { telemetry, source, comparisonRows, curve } = telemetryState;

  return (
    <main className="dashboard-shell">
      <section className="intro">
        <div>
          <p className="eyebrow">Compression layer</p>
          <h1>Live token telemetry</h1>
          <p className="subhead">Retrieved sources, Q&A history, and carried course context before they hit the LLM.</p>
          <p className="data-source">
            Data source: {source === "benchmark" ? "latest benchmark output" : "demo fallback; run npm run benchmark"}
          </p>
        </div>
        <StatusBadge status={telemetry.apiStatus} />
      </section>

      <section className="hero-grid" aria-label="Compression summary">
        <MetricCard label="Tokens before" value={formatNumber(telemetry.totals.originalTokens)} />
        <MetricCard label="Tokens after" value={formatNumber(telemetry.totals.compressedTokens)} />
        <MetricCard label="Saved" value={`${Math.round(telemetry.totals.pctSaved)}%`} accent />
        <MetricCard
          label="Quality held"
          value={`${telemetry.quality.compressed.toFixed(1)} / ${telemetry.quality.uncompressed.toFixed(1)}`}
        />
      </section>

      <section className="content-grid">
        <section className="panel source-panel">
          <div className="panel-heading">
            <h2>Token reduction by source</h2>
            <p>Shows the RAG-aware split instead of compressing one blind prompt blob.</p>
          </div>
          <div className="source-list">
            {telemetry.sources.map((source) => (
              <div className="source-row" key={source.target}>
                <div className="source-row-header">
                  <span>{source.label}</span>
                  <span>
                    {formatNumber(source.originalTokens)} → {formatNumber(source.compressedTokens)} · −
                    {Math.round(source.pctSaved)}%
                  </span>
                </div>
                <div className="bar-track" aria-label={`${source.label} saved ${Math.round(source.pctSaved)} percent`}>
                  <div className="bar-fill" style={{ width: `${Math.min(100, source.pctSaved)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="side-stack">
          <section className="panel">
            <div className="panel-heading">
              <h2>Protected</h2>
              <p>Never compressed.</p>
            </div>
            <ul className="plain-list">
              {telemetry.protectedSections.map((section) => (
                <li key={section}>{section}</li>
              ))}
            </ul>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <h2>Resilience</h2>
              <p>The live path continues even when compression does not.</p>
            </div>
            <ul className="state-list">
              <StateItem active={telemetry.resilience.normal} label="Normal: compressed" />
              <StateItem active={telemetry.resilience.fallback} label="API down: full fallback" />
              <StateItem active={telemetry.resilience.empty} label="Empty: clean skip" />
            </ul>
          </section>
        </aside>
      </section>

      {comparisonRows.length > 0 ? (
        <section className="panel comparison-panel">
          <div className="panel-heading">
            <h2>Compressor comparison</h2>
            <p>Same sessions, same prompts, different compression mode.</p>
          </div>
          <div className="comparison-grid">
            {comparisonRows.map((row) => (
              <article className="comparison-card" key={row.compressorMode}>
                <p>{row.label}</p>
                <strong>{Math.round(row.pctSaved)}% saved</strong>
                <span>
                  quality {row.averageQuality.toFixed(1)} · Δ {formatSigned(row.qualityDelta)} · held{" "}
                  {Math.round(row.qualityHeldRate)}%
                </span>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {curve.length > 0 ? (
        <section className="panel curve-panel">
          <div className="panel-heading">
            <h2>Quality cliff sweep</h2>
            <p>Maps where savings stop being safe instead of showing one lucky point.</p>
          </div>
          <div className="curve-list">
            {curve.map((point) => (
              <div className="curve-row" key={`${point.compressorMode}-${point.aggressiveness}`}>
                <span>{modeLabel(point.compressorMode)}</span>
                <span>α {point.aggressiveness.toFixed(1)}</span>
                <div className="curve-track">
                  <div className="curve-save" style={{ width: `${Math.min(100, point.pctSaved)}%` }} />
                  <div className="curve-quality" style={{ left: `${Math.min(100, point.averageQuality * 10)}%` }} />
                </div>
                <span>
                  {Math.round(point.pctSaved)}% saved · quality {point.averageQuality.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function MetricCard({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <article className={accent ? "metric-card metric-card-accent" : "metric-card"}>
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  );
}

function StatusBadge({ status }: { status: "healthy" | "fallback" | "idle" }) {
  const label = status === "healthy" ? "API healthy" : status === "fallback" ? "Fallback active" : "Waiting for input";
  return <span className={`status-badge status-${status}`}>{label}</span>;
}

function StateItem({ active, label }: { active: boolean; label: string }) {
  return (
    <li className={active ? "state-item state-item-active" : "state-item"}>
      <span className="state-dot" />
      {label}
    </li>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatSigned(value: number) {
  return value > 0 ? `+${value.toFixed(2)}` : value.toFixed(2);
}

function modeLabel(mode: string) {
  if (mode === "none") {
    return "No compression";
  }

  if (mode === "local") {
    return "Local";
  }

  return "Token Company";
}

