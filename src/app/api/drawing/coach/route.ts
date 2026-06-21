import { NextRequest, NextResponse } from "next/server";
import {
  appendCoachHistory,
  getOrCreateDrawingSession,
  getReferenceImageForCoach,
} from "@/lib/drawing/session-store";
import { analyzeDrawingCoach, isVisionConfigured } from "@/lib/drawing/vision-coach";
import { buildCoachSpoken } from "@/lib/drawing/coach-prompt";

export const maxDuration = 60;

type CoachBody = {
  sessionId?: string;
  topic?: string;
  canvasImageBase64?: string;
  transcript?: string;
  trigger?: string;
};

export async function POST(request: NextRequest) {
  if (!isVisionConfigured()) {
    return NextResponse.json(
      { error: "VISION_API_KEY (or OPENAI_API_KEY) is not configured" },
      { status: 503 },
    );
  }

  let body: CoachBody = {};
  try {
    body = (await request.json()) as CoachBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const sessionId = body.sessionId?.trim();
  const canvasImageBase64 = body.canvasImageBase64?.trim();
  const trigger = body.trigger?.trim() || "manual";

  if (!sessionId || !canvasImageBase64) {
    return NextResponse.json(
      { error: "sessionId and canvasImageBase64 are required" },
      { status: 400 },
    );
  }

  const session = getOrCreateDrawingSession(
    sessionId,
    body.topic?.trim() || "Drawing practice",
  );

  const referenceImage = getReferenceImageForCoach(session);
  if (!referenceImage) {
    return NextResponse.json(
      { error: "Upload a reference diagram before coaching" },
      { status: 400 },
    );
  }

  try {
    const recentTips = session.coachHistory
      .slice(-4)
      .map((entry) => entry.tip.tip)
      .filter(Boolean);

    const tip = await analyzeDrawingCoach({
      topic: session.topic,
      referenceImage,
      canvasImage: canvasImageBase64,
      transcript: body.transcript,
      trigger,
      recentTips,
    });

    appendCoachHistory(sessionId, {
      at: new Date().toISOString(),
      tip,
      trigger:
        trigger === "idle" ||
        trigger === "heartbeat" ||
        trigger === "voice" ||
        trigger === "hint"
          ? trigger
          : "manual",
    });

    const spoken = buildCoachSpoken(tip);

    return NextResponse.json({
      tip,
      spoken,
    });
  } catch (error) {
    console.error("[drawing-coach] failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Drawing coach request failed",
      },
      { status: 500 },
    );
  }
}
