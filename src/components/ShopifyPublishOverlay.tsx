"use client";

import { useEffect, useState } from "react";

const STEPS = [
  "Preparing your listing...",
  "Formatting product details...",
  "Creating your listing...",
  "Setting price & publishing...",
  "Your listing is live!",
];

export default function ShopifyPublishOverlay({
  active,
}: {
  active: boolean;
}) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setStepIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setStepIndex((current) => Math.min(current + 1, STEPS.length - 1));
    }, 650);

    return () => clearInterval(interval);
  }, [active]);

  if (!active) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl dark:bg-zinc-900">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-900 text-lg font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
            S
          </div>
          <div>
            <p className="font-semibold text-zinc-900 dark:text-zinc-100">SellAnything</p>
            <p className="text-sm text-zinc-500">Publishing your listing...</p>
          </div>
        </div>

        <div className="space-y-3">
          {STEPS.map((step, index) => {
            const done = index < stepIndex;
            const current = index === stepIndex;

            return (
              <div
                key={step}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                  current
                    ? "bg-[#F4F8EC] text-[#435A2B] dark:bg-[#1a2410] dark:text-[#b8d88a]"
                    : done
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-zinc-400"
                }`}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full border text-xs font-bold">
                  {done ? "✓" : current ? "●" : index + 1}
                </span>
                <span>{step}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
