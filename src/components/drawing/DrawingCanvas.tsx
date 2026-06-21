"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useRef } from "react";
import type { Editor, TLComponents } from "tldraw";
import ReferenceShadowLayer from "@/components/drawing/ReferenceShadowLayer";
import {
  DrawingGhostProvider,
  type DrawingGhostState,
} from "@/components/drawing/drawing-ghost-context";
import { DRAWING_FRAME, setupDrawingFrame } from "@/lib/drawing/canvas-bounds";

const Tldraw = dynamic(async () => (await import("tldraw")).Tldraw, {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-neutral-500">
      Loading canvas…
    </div>
  ),
});

const TLDRAW_COMPONENTS: TLComponents = {
  OnTheCanvas: ReferenceShadowLayer,
};

type DrawingCanvasProps = {
  ghostImageUrl?: string | null;
  showGhostOverlay?: boolean;
  guiding?: boolean;
  onActivity?: () => void;
  onEditorReady?: (editor: Editor) => void;
};

export default function DrawingCanvas({
  ghostImageUrl,
  showGhostOverlay = false,
  guiding = false,
  onActivity,
  onEditorReady,
}: DrawingCanvasProps) {
  const editorRef = useRef<Editor | null>(null);

  const ghostState = useMemo<DrawingGhostState>(
    () => ({
      ghostImageUrl: ghostImageUrl ?? null,
      showGhost: showGhostOverlay,
      guiding,
    }),
    [ghostImageUrl, showGhostOverlay, guiding],
  );

  const handleMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor;
      setupDrawingFrame(editor);
      onEditorReady?.(editor);

      const notify = () => onActivity?.();
      editor.on("change", notify);
    },
    [onActivity, onEditorReady],
  );

  return (
    <DrawingGhostProvider value={ghostState}>
      <div className="absolute inset-0 overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <div className="relative h-full w-full">
          <Tldraw
            colorScheme="light"
            components={TLDRAW_COMPONENTS}
            onMount={handleMount}
            autoFocus
          />
        </div>
      </div>
    </DrawingGhostProvider>
  );
}

export async function exportCanvasPng(editor: Editor): Promise<string> {
  const shapeIds = editor.getCurrentPageShapeIds();
  const drawableIds = [...shapeIds].filter((id) => {
    const shape = editor.getShape(id);
    const meta = shape?.meta as Record<string, unknown> | undefined;
    return meta?.coachHint !== true && meta?.coachGhost !== true;
  });

  if (drawableIds.length === 0) {
    const blank = document.createElement("canvas");
    blank.width = DRAWING_FRAME.w;
    blank.height = DRAWING_FRAME.h;
    const ctx = blank.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, blank.width, blank.height);
    }
    return blank.toDataURL("image/jpeg", 0.85);
  }

  const { blob } = await editor.toImage(drawableIds, {
    bounds: DRAWING_FRAME,
    format: "jpeg",
    quality: 0.85,
    background: true,
    scale: 1,
  });

  return blobToDataUrl(await downscaleBlob(blob, 768));
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function downscaleBlob(blob: Blob, maxWidth: number): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return blob;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("Failed to encode canvas"))),
      "image/jpeg",
      0.85,
    );
  });
}
