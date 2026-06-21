"use client";

import type { CoachTip } from "@/types/drawing";

type CoachDockProps = {
  topic: string;
  listening: boolean;
  muted: boolean;
  showGhost: boolean;
  coachActive: boolean;
  transcript: string;
  lastTip: CoachTip | null;
  lastSpoken: string;
  error: string | null;
  onToggleMute: () => void;
  onToggleListening: () => void;
  onToggleGhost: () => void;
  onRequestHint: () => void;
  onClearHints: () => void;
  onCheckDrawing: () => void;
};

export default function CoachDock({
  topic,
  listening,
  muted,
  showGhost,
  coachActive,
  transcript,
  lastTip,
  lastSpoken,
  error,
  onToggleMute,
  onToggleListening,
  onToggleGhost,
  onRequestHint,
  onClearHints,
  onCheckDrawing,
}: CoachDockProps) {
  return (
    <div className="border-t border-neutral-200 bg-white px-4 py-3">
      <div className="mx-auto flex max-w-6xl flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              Drawing coach
            </p>
            <p className="text-sm font-semibold text-neutral-900">{topic}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onToggleListening}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                listening
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-neutral-100 text-neutral-700"
              }`}
            >
              {listening ? "Mic on" : "Mic off"}
            </button>
            <button
              type="button"
              onClick={onToggleMute}
              className="rounded-full bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-700"
            >
              {muted ? "Unmute coach" : "Mute coach"}
            </button>
            <button
              type="button"
              onClick={onToggleGhost}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                showGhost
                  ? "bg-sky-100 text-sky-800"
                  : "bg-neutral-100 text-neutral-700"
              }`}
            >
              {showGhost ? "Hide shadow" : "Show shadow"}
            </button>
            <button
              type="button"
              onClick={onRequestHint}
              disabled={coachActive}
              className="rounded-full bg-sky-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Draw hint
            </button>
            <button
              type="button"
              onClick={onClearHints}
              className="rounded-full bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-700"
            >
              Clear hints
            </button>
            <button
              type="button"
              onClick={onCheckDrawing}
              disabled={coachActive}
              className="rounded-full bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {coachActive ? "Checking…" : "Check my drawing"}
            </button>
          </div>
        </div>

        {transcript && (
          <p className="text-sm text-neutral-600">
            <span className="font-medium text-neutral-800">You said:</span> {transcript}
          </p>
        )}

        {lastTip && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Coach</p>
              {showGhost && (
                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800">
                  Shadow reference visible
                </span>
              )}
            </div>

            <p className="mt-2 text-base font-semibold text-emerald-950">
              Now drawing: {lastTip.currentPart}
            </p>

            {lastTip.explanation && (
              <p className="mt-2 text-sm text-emerald-900">{lastTip.explanation}</p>
            )}

            {lastTip.tip && (
              <p className="mt-2 text-sm font-medium text-emerald-950">{lastTip.tip}</p>
            )}

            {lastTip.nextStep && lastTip.nextStep !== lastTip.tip && (
              <p className="mt-2 text-xs text-emerald-800">Next: {lastTip.nextStep}</p>
            )}

            {lastTip.hintShapes && lastTip.hintShapes.length > 0 && (
              <p className="mt-2 text-xs text-sky-800">
                Dashed blue guides mark where to draw on the canvas.
              </p>
            )}
          </div>
        )}

        {lastSpoken && !lastTip && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Coach</p>
            <p className="mt-1 text-sm text-emerald-950">{lastSpoken}</p>
          </div>
        )}

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
