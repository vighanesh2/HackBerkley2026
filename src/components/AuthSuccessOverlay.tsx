"use client";

import { useEffect, useState } from "react";

type AuthSuccessOverlayProps = {
  message?: string;
  onDone?: () => void;
};

export default function AuthSuccessOverlay({
  message = "You're signed in!",
  onDone,
}: AuthSuccessOverlayProps) {
  const [phase, setPhase] = useState<"in" | "out" | "done">("in");

  useEffect(() => {
    const fadeTimer = window.setTimeout(() => setPhase("out"), 850);
    const doneTimer = window.setTimeout(() => {
      setPhase("done");
      onDone?.();
    }, 1200);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(doneTimer);
    };
  }, [onDone]);

  if (phase === "done") {
    return null;
  }

  return (
    <div
      className={`auth-success-overlay fixed inset-0 z-50 flex items-center justify-center bg-notion-canvas/80 px-6 backdrop-blur-sm ${
        phase === "in" ? "auth-success-overlay-visible" : "auth-success-overlay-out"
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="auth-success-card flex flex-col items-center rounded-2xl border border-notion-border bg-notion-page px-10 py-12 shadow-lg">
        <div className="auth-success-check relative flex h-20 w-20 items-center justify-center">
          <span className="auth-success-ring absolute inset-0 rounded-full" aria-hidden />
          <svg
            className="auth-success-icon h-10 w-10 text-[#448361]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            aria-hidden
          >
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="mt-6 text-xl font-semibold text-notion-text">{message}</p>
        <p className="mt-2 text-sm text-notion-muted">Loading your workspace…</p>
      </div>
    </div>
  );
}
