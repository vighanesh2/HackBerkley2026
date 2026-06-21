import { createShapeId, type Editor, type TLGeoShapeGeoStyle } from "tldraw";
import type { IndexKey } from "@tldraw/utils";
import { DRAWING_FRAME, normalizedToPage } from "@/lib/drawing/canvas-bounds";
import type { CoachHintShape } from "@/types/drawing";

const HINT_META = "coachHint";

export function clearCoachHints(editor: Editor): void {
  const toRemove = editor.getCurrentPageShapes().filter((shape) => {
    const meta = shape.meta as Record<string, unknown> | undefined;
    return meta?.[HINT_META] === true;
  });

  if (toRemove.length > 0) {
    editor.deleteShapes(toRemove.map((shape) => shape.id));
  }
}

function pageEndPoint(hint: CoachHintShape): { x: number; y: number } {
  if (hint.x2 !== undefined && hint.y2 !== undefined) {
    return normalizedToPage(hint.x2, hint.y2);
  }

  const endX = hint.x + (hint.w ?? 0.12);
  const endY = hint.y + (hint.h ?? 0);
  return normalizedToPage(endX, endY);
}

export function drawCoachHints(editor: Editor, hints: CoachHintShape[]): void {
  clearCoachHints(editor);

  const width = DRAWING_FRAME.w;
  const height = DRAWING_FRAME.h;

  for (const hint of hints.slice(0, 3)) {
    const start = normalizedToPage(hint.x, hint.y);

    if (hint.type === "line") {
      const end = pageEndPoint(hint);
      editor.createShape({
        id: createShapeId(),
        type: "line",
        x: start.x,
        y: start.y,
        opacity: 0.45,
        isLocked: true,
        props: {
          color: "light-blue",
          size: "m",
          dash: "dashed",
          spline: "line",
          scale: 1,
          points: {
            start: { id: "start", index: "a1" as IndexKey, x: 0, y: 0 },
            end: {
              id: "end",
              index: "a2" as IndexKey,
              x: end.x - start.x,
              y: end.y - start.y,
            },
          },
        },
        meta: { [HINT_META]: true },
      });
      continue;
    }

    if (hint.type === "arrow") {
      const end = pageEndPoint(hint);
      const w = Math.max(24, end.x - start.x);
      const h = Math.max(8, end.y - start.y);
      editor.createShape({
        id: createShapeId(),
        type: "arrow",
        x: start.x,
        y: start.y,
        opacity: 0.4,
        isLocked: true,
        props: {
          start: { x: 0, y: 0 },
          end: { x: w, y: h },
          color: "light-blue",
          size: "m",
          dash: "dashed",
          arrowheadStart: "none",
          arrowheadEnd: "arrow",
          bend: 0,
        },
        meta: { [HINT_META]: true },
      });
      continue;
    }

    const w = Math.max(24, (hint.w ?? 0.12) * width);
    const h = Math.max(24, (hint.h ?? 0.12) * height);
    const geo = (hint.type === "ellipse" ? "ellipse" : "rectangle") as TLGeoShapeGeoStyle;

    editor.createShape({
      id: createShapeId(),
      type: "geo",
      x: start.x,
      y: start.y,
      opacity: 0.35,
      isLocked: true,
      props: {
        geo,
        w,
        h,
        color: "light-blue",
        fill: "none",
        dash: "dashed",
        size: "m",
      },
      meta: { [HINT_META]: true },
    });
  }
}
