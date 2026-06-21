"use client";

import { useDrawingGhost } from "@/components/drawing/drawing-ghost-context";
import { DRAWING_FRAME } from "@/lib/drawing/canvas-bounds";

export default function ReferenceShadowLayer() {
  const { ghostImageUrl, showGhost, guiding } = useDrawingGhost();

  if (!showGhost || !ghostImageUrl) {
    return null;
  }

  return (
    <div
      className="pointer-events-none"
      style={{
        position: "absolute",
        left: DRAWING_FRAME.x,
        top: DRAWING_FRAME.y,
        width: DRAWING_FRAME.w,
        height: DRAWING_FRAME.h,
        opacity: guiding ? 0.42 : 0.3,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={ghostImageUrl}
        alt=""
        aria-hidden
        draggable={false}
        className="h-full w-full select-none object-contain"
      />
    </div>
  );
}
