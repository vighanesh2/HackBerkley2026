import { NextRequest, NextResponse } from "next/server";
import {
  getDrawingSessionPublicView,
  getOrCreateDrawingSession,
} from "@/lib/drawing/session-store";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const topic = request.nextUrl.searchParams.get("topic")?.trim() || "Drawing practice";
  const session = getOrCreateDrawingSession(id, topic);

  return NextResponse.json({
    session: getDrawingSessionPublicView(session),
  });
}
