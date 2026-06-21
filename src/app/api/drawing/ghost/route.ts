import { NextRequest, NextResponse } from "next/server";
import {
  getDrawingSession,
  getReferenceImageForCoach,
} from "@/lib/drawing/session-store";

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId")?.trim();
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  const session = getDrawingSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const image = getReferenceImageForCoach(session);
  if (!image) {
    return NextResponse.json({ error: "No reference uploaded yet" }, { status: 404 });
  }

  return NextResponse.json({ imageDataUrl: image });
}
