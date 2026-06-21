"use client";

import type { CompressionRunResult, CompressionSnapshot } from "@/types/compression";

export type { CompressionSnapshot };

type TokenCompressionPanelProps = {
  latest: CompressionSnapshot | null;
  history: CompressionSnapshot[];
};

function formatTokens(value: number): string {
  return value.toLocaleString();
}

function runTone(mode: CompressionRunResult["mode"], active: boolean): string {
  if (active) {
    if (mode === "token-company") return "border-sky-300 bg-sky-50 ring-1 ring-sky-200";
    if (mode === "local") return "border-violet-300 bg-violet-50 ring-1 ring-violet-200";
  }
  if (mode === "none") return "border-neutral-200 bg-neutral-50";
  if (mode === "token-company") return "border-sky-200 bg-white";
  return "border-violet-200 bg-white";
}

function barColor(mode: CompressionRunResult["mode"]): string {
  if (mode === "none") return "bg-neutral-400";
  if (mode === "token-company") return "bg-sky-500";
  return "bg-violet-500";
}

function ComparisonCard({ run }: { run: CompressionRunResult }) {
  const width = Math.max(
    8,
    Math.round((run.compressedTokens / Math.max(run.originalTokens, 1)) * 100),
  );

  return (
    <div className={`rounded-xl border p-3 ${runTone(run.mode, run.active)}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-neutral-900">{run.label}</p>
          {run.active && (
            <p className="mt-0.5 text-[11px] font-medium text-emerald-700">Used for coach call</p>
          )}
        </div>
        <p className="text-sm font-semibold text-neutral-900">{run.pctSaved}%</p>
      </div>

      <div className="mt-3 space-y-1">
        <div className="flex justify-between text-[11px] text-neutral-500">
          <span>Before</span>
          <span>{formatTokens(run.originalTokens)}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
          <div className="h-full w-full rounded-full bg-neutral-300" />
        </div>
        <div className="flex justify-between text-[11px] text-neutral-500">
          <span>After</span>
          <span>{formatTokens(run.compressedTokens)}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
          <div
            className={`h-full rounded-full transition-all duration-700 ${barColor(run.mode)}`}
            style={{ width: `${width}%` }}
          />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-neutral-600">
        <span>{formatTokens(run.tokensSaved)} saved</span>
        <span>{run.latencyMs}ms</span>
      </div>
      {run.fallback && run.mode === "token-company" && (
        <p className="mt-2 text-[11px] text-amber-700">Token API fell back to original text.</p>
      )}
    </div>
  );
}

export default function TokenCompressionPanel({ latest, history }: TokenCompressionPanelProps) {
  const comparison = latest?.comparison ?? [];
  const baseline = comparison.find((run) => run.mode === "none");

  return (
    <aside className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
          Token compression
        </p>
        <h2 className="mt-1 text-lg font-semibold text-neutral-900">Three-way comparison</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Each coach check runs downstream, Token API, and our custom algorithm on the same growing
          context.
        </p>
      </div>

      {comparison.length > 0 ? (
        <>
          <div className="mt-4 grid gap-3">
            {comparison.map((run) => (
              <ComparisonCard key={run.mode} run={run} />
            ))}
          </div>

          {baseline && (
            <div className="mt-4 rounded-xl bg-neutral-50 px-3 py-3 text-xs text-neutral-600">
              <span className="font-medium text-neutral-800">Downstream baseline:</span>{" "}
              {formatTokens(baseline.originalTokens)} compressible tokens before any compression.
            </div>
          )}

          {latest && (
            <p className="mt-3 text-xs text-neutral-500">
              Last check: {new Date(latest.at).toLocaleTimeString()}
            </p>
          )}
        </>
      ) : (
        <p className="mt-4 text-sm text-neutral-500">
          Run <span className="font-medium">Check my drawing</span> to compare all three compression
          runs live.
        </p>
      )}

      {history.length > 1 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Session trend
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] uppercase tracking-wide text-neutral-500">
            <span>Downstream</span>
            <span>Token API</span>
            <span>Ours</span>
          </div>
          <div className="mt-1 space-y-2">
            {history.slice(-6).map((entry) => (
              <div key={entry.at} className="grid grid-cols-3 gap-2">
                {entry.comparison.map((run) => (
                  <div
                    key={`${entry.at}-${run.mode}`}
                    className="rounded-md bg-neutral-100 px-2 py-1 text-center text-[11px] font-medium text-neutral-700"
                    title={`${run.label}: ${run.pctSaved}% saved`}
                  >
                    {run.pctSaved}%
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 rounded-xl border border-dashed border-neutral-200 px-3 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Protected (never compressed)
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[
            "System prompt",
            "JSON schema",
            "Reference + canvas images",
          ].map((section) => (
            <span
              key={section}
              className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700"
            >
              {section}
            </span>
          ))}
        </div>
      </div>
    </aside>
  );
}
