import { Box, type Editor } from "@tldraw/editor";

/** Fixed page region used for exports, ghost overlays, and hint coordinates. */
export const DRAWING_FRAME = new Box(0, 0, 800, 600);

export function setupDrawingFrame(editor: Editor): void {
  editor.setCurrentTool("draw");
  editor.zoomToBounds(DRAWING_FRAME, { inset: 24, targetZoom: 1 });
}

export function normalizedToPage(
  x: number,
  y: number,
): { x: number; y: number } {
  return {
    x: DRAWING_FRAME.x + x * DRAWING_FRAME.w,
    y: DRAWING_FRAME.y + y * DRAWING_FRAME.h,
  };
}
