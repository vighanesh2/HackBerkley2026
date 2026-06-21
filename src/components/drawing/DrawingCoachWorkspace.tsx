"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import CoachDock from "@/components/drawing/CoachDock";
import DrawingCanvas from "@/components/drawing/DrawingCanvas";
import TokenCompressionPanel from "@/components/drawing/TokenCompressionPanel";
import { useDrawingCoachLoop } from "@/hooks/useDrawingCoachLoop";
import type { DrawingSessionPublicView } from "@/types/drawing";

type DrawingCoachWorkspaceProps = {
  sessionId: string;
  initialSession: DrawingSessionPublicView | null;
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function DrawingCoachWorkspace({
  sessionId,
  initialSession,
}: DrawingCoachWorkspaceProps) {
  const searchParams = useSearchParams();
  const topicFromUrl = searchParams.get("topic")?.trim() || "Drawing practice";

  const [topic, setTopic] = useState(initialSession?.topic ?? topicFromUrl);
  const [hasReference, setHasReference] = useState(initialSession?.hasReference ?? false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const coach = useDrawingCoachLoop({
    sessionId,
    topic,
    hasReference,
    enabled: hasReference,
  });

  useEffect(() => {
    const query = new URLSearchParams({ topic: topicFromUrl });
    void fetch(`/api/drawing/session/${encodeURIComponent(sessionId)}?${query}`)
      .then((response) => response.json())
      .then((data: { session?: DrawingSessionPublicView }) => {
        if (!data.session) return;
        setTopic(data.session.topic);
        if (data.session.hasReference) setHasReference(true);
      })
      .catch(() => undefined);
  }, [sessionId, topicFromUrl]);

  const handleReferenceUpload = useCallback(
    async (file: File) => {
      setUploading(true);
      setUploadError(null);

      try {
        const imageBase64 = await fileToBase64(file);
        const response = await fetch("/api/drawing/reference", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            topic,
            imageBase64,
            contentType: file.type || "image/png",
          }),
        });

        const data = (await response.json()) as { error?: string; hasReference?: boolean };
        if (!response.ok) {
          throw new Error(data.error || "Upload failed");
        }

        setHasReference(Boolean(data.hasReference));
      } catch (uploadErr) {
        setUploadError(uploadErr instanceof Error ? uploadErr.message : "Upload failed");
        setHasReference(false);
      } finally {
        setUploading(false);
      }
    },
    [sessionId, topic],
  );

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--notion-canvas,#fafafa)]">
      <div className="border-b border-neutral-200 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="mb-0.5 text-lg font-bold tracking-tight text-neutral-900">
              DiagramEasy
            </p>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              Drawing Coach — Learn mode
            </p>
            <h1 className="text-xl font-semibold text-neutral-900">{topic}</h1>
            <p className="text-sm text-neutral-600">
              Upload a reference diagram, then click{" "}
              <span className="font-medium">Check my drawing</span>. The coach will show a shadow
              guide and explain each part as you draw.
            </p>
          </div>
          <label className="cursor-pointer rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white">
            {uploading ? "Uploading…" : hasReference ? "Replace reference" : "Upload reference"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleReferenceUpload(file);
              }}
            />
          </label>
        </div>
        {uploadError && (
          <p className="mx-auto mt-2 max-w-6xl text-sm text-red-600">{uploadError}</p>
        )}
      </div>

      <div className="mx-auto w-full max-w-6xl flex-1 p-4">
        {hasReference ? (
          <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Reference loaded. Click <span className="font-medium">Check my drawing</span> to see
            the shadow guide and learn what to draw next.
          </div>
        ) : (
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <span className="font-medium">Step 1:</span> click{" "}
            <span className="font-medium">Upload reference</span> (top right) with the diagram you
            want to learn. The coach sees it — you draw on the blank canvas below. You do not need
            a reference to use the canvas; coaching starts after upload.
          </div>
        )}

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-neutral-800">Your canvas</h2>
            <div className="relative h-[min(60vh,640px)] min-h-[420px]">
              <DrawingCanvas
                ghostImageUrl={coach.ghostImageUrl}
                showGhostOverlay={coach.showGhost}
                guiding={Boolean(coach.lastTip)}
                onEditorReady={coach.onEditorReady}
              />
            </div>
          </div>

          <TokenCompressionPanel
            latest={coach.compressionLatest}
            history={coach.compressionHistory}
          />
        </section>
      </div>

      <CoachDock
        topic={topic}
        listening={coach.listening}
        muted={coach.muted}
        showGhost={coach.showGhost}
        coachActive={coach.coachActive}
        transcript={coach.transcript}
        lastTip={coach.lastTip}
        lastSpoken={coach.lastSpoken}
        error={coach.error}
        voiceProvider={coach.voiceProvider}
        onToggleMute={coach.toggleMute}
        onToggleListening={coach.toggleListening}
        onToggleGhost={coach.toggleGhost}
        onRequestHint={coach.requestHint}
        onClearHints={coach.clearHints}
        onCheckDrawing={coach.checkDrawing}
      />
    </div>
  );
}
