import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import type { ChatMessage } from "@/types/chat";
import { attachVideosToSession, runFeynmanCourseStep } from "@/lib/course/feynman-graph";
import { isLlmConfigured } from "@/lib/course/llm";
import { getCourseSession, saveCourseSession } from "@/lib/course/session";
import { normalizeUserNotes } from "@/lib/course/notes";
import { getAuthUser } from "@/lib/supabase/server";
import {
  createSavedCourseForSession,
  syncSavedCourse,
} from "@/lib/supabase/sync-course";
import { formatSupabaseError } from "@/lib/supabase/errors";
import { isAgentCourseRequest } from "@/lib/agent-auth";

export const maxDuration = 120;

type CourseRequestBody = {
  message?: string;
  sessionId?: string;
  action?: string;
  agentVideos?: unknown[];
  userNotes?: string;
  savedCourseId?: string;
  chatMessages?: ChatMessage[];
};

export async function POST(request: NextRequest) {
  const fromAgent = isAgentCourseRequest(request);
  const user = fromAgent ? null : await getAuthUser();

  if (!fromAgent && !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isLlmConfigured()) {
    return NextResponse.json(
      { error: "ASI_API_KEY is not configured on the server" },
      { status: 503 },
    );
  }

  let body: CourseRequestBody = {};
  try {
    body = (await request.json()) as CourseRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const message = body.message?.trim() ?? "";
  const bodySessionId = body.sessionId?.trim() ?? "";
  const action = body.action?.trim() ?? "";
  const savedCourseIdInput = body.savedCourseId?.trim() ?? "";
  const chatMessages = Array.isArray(body.chatMessages) ? body.chatMessages : [];

  const cookieStore = await cookies();
  let sessionId = bodySessionId || cookieStore.get("course_session")?.value;
  if (!sessionId) {
    sessionId = randomUUID();
  }

  let session = getCourseSession(sessionId);

  if (body.userNotes !== undefined) {
    session.userNotes = normalizeUserNotes(body.userNotes);
    saveCourseSession(sessionId, session);
  }

  if (action === "attachVideos") {
    const updated = await attachVideosToSession(session, body.agentVideos ?? []);
    saveCourseSession(sessionId, updated);

    let savedCourseId = savedCourseIdInput;
    if (savedCourseId && user) {
      await syncSavedCourse(user.id, savedCourseId, updated, chatMessages);
    }

    const response = NextResponse.json({
      reply: "",
      phase: updated.phase,
      topic: updated.topic,
      moduleIndex: updated.currentModuleIndex,
      moduleCount: updated.modules.length,
      courseDocument: updated.document,
      savedCourseId: savedCourseId || undefined,
    });

    response.cookies.set("course_session", sessionId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });

    return response;
  }

  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const result = await runFeynmanCourseStep(
    session,
    message,
    body.agentVideos,
    sessionId,
    { skipVideoDiscovery: fromAgent },
  );
  saveCourseSession(sessionId, result.session);

  let savedCourseId = savedCourseIdInput;
  if (user) {
    try {
      if (savedCourseId) {
        await syncSavedCourse(user.id, savedCourseId, result.session, [
          ...chatMessages,
          { role: "assistant", text: result.reply },
        ]);
      } else if (result.session.document) {
        savedCourseId = await createSavedCourseForSession(user.id, result.session, [
          ...chatMessages,
          { role: "assistant", text: result.reply },
        ]);
      }
    } catch (error) {
      console.error("Failed to sync course to Supabase:", formatSupabaseError(error));
    }
  }

  const response = NextResponse.json({
    reply: result.reply,
    phase: result.session.phase,
    topic: result.session.topic,
    moduleIndex: result.session.currentModuleIndex,
    moduleCount: result.session.modules.length,
    courseDocument: result.session.document,
    savedCourseId: savedCourseId || undefined,
  });

  response.cookies.set("course_session", sessionId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  return response;
}
