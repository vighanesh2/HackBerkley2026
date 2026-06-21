import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { isAgentRequest } from "@/lib/agent-auth";
import {
  createDrawingSession,
  getDrawingSessionPublicView,
} from "@/lib/drawing/session-store";
import { drawingSessionUrl } from "@/lib/drawing/utils";

export const maxDuration = 30;

type CreateSessionBody = {
  sessionId?: string;
  topic?: string;
};

export async function POST(request: NextRequest) {
  const fromAgent = isAgentRequest(request);
  const user = fromAgent ? null : await getAuthUser();

  let body: CreateSessionBody = {};
  try {
    body = (await request.json()) as CreateSessionBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const topic = body.topic?.trim() || "Drawing practice";

  const session = createDrawingSession({
    sessionId: body.sessionId?.trim(),
    topic,
    userId: user?.id ?? null,
  });

  return NextResponse.json({
    session: getDrawingSessionPublicView(session),
    url: drawingSessionUrl(session.id),
  });
}
