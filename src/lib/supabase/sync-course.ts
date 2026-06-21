import type { ChatMessage } from "@/types/chat";
import type { CourseSession } from "@/types/course";
import { createClient } from "@/lib/supabase/server";
import { createSavedCourse, updateSavedCourse } from "@/lib/supabase/library";

export async function syncSavedCourse(
  userId: string,
  savedCourseId: string,
  session: CourseSession,
  chatMessages: ChatMessage[] = [],
): Promise<void> {
  const supabase = await createClient();
  await updateSavedCourse(supabase, userId, savedCourseId, {
    title: session.document?.title ?? session.topic ?? "Untitled course",
    emoji: session.document?.emoji ?? null,
    topic: session.topic || session.document?.title || null,
    document: session.document,
    session_state: session,
    user_notes: session.userNotes || null,
    chat_messages: chatMessages,
  });
}

export async function createSavedCourseForSession(
  userId: string,
  session: CourseSession,
  chatMessages: ChatMessage[] = [],
): Promise<string> {
  const supabase = await createClient();
  const course = await createSavedCourse(supabase, userId, {
    title: session.document?.title ?? session.topic ?? "Untitled course",
    emoji: session.document?.emoji ?? null,
    topic: session.topic || session.document?.title || null,
    document: session.document,
    session_state: session,
    user_notes: session.userNotes || null,
    chat_messages: chatMessages,
  });
  return course.id;
}
