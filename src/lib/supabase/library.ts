import type { SavedCourseRow, SavedCourseSummary, SaveCoursePayload } from "@/types/saved-course";
import type { SupabaseClient } from "@supabase/supabase-js";

function toSummary(row: SavedCourseRow): SavedCourseSummary {
  const modules = row.document?.modules ?? [];
  return {
    id: row.id,
    title: row.title,
    emoji: row.emoji,
    topic: row.topic,
    completed: Boolean(row.document?.completed),
    moduleCount: modules.length,
    masteredCount: modules.filter((module) => module.status === "mastered").length,
    updated_at: row.updated_at,
    created_at: row.created_at,
  };
}

export async function listSavedCourses(
  supabase: SupabaseClient,
  userId: string,
): Promise<SavedCourseSummary[]> {
  const { data, error } = await supabase
    .from("saved_courses")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data as SavedCourseRow[]).map(toSummary);
}

export async function getSavedCourse(
  supabase: SupabaseClient,
  userId: string,
  courseId: string,
): Promise<SavedCourseRow | null> {
  const { data, error } = await supabase
    .from("saved_courses")
    .select("*")
    .eq("user_id", userId)
    .eq("id", courseId)
    .maybeSingle();

  if (error) throw error;
  return (data as SavedCourseRow | null) ?? null;
}

export async function createSavedCourse(
  supabase: SupabaseClient,
  userId: string,
  payload: SaveCoursePayload,
): Promise<SavedCourseRow> {
  const { data, error } = await supabase
    .from("saved_courses")
    .insert({
      user_id: userId,
      title: payload.title,
      emoji: payload.emoji ?? null,
      topic: payload.topic ?? null,
      document: payload.document ?? null,
      session_state: payload.session_state,
      user_notes: payload.user_notes ?? null,
      chat_messages: payload.chat_messages ?? [],
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as SavedCourseRow;
}

export async function updateSavedCourse(
  supabase: SupabaseClient,
  userId: string,
  courseId: string,
  payload: Partial<SaveCoursePayload>,
): Promise<SavedCourseRow> {
  const { data, error } = await supabase
    .from("saved_courses")
    .update({
      ...(payload.title !== undefined ? { title: payload.title } : {}),
      ...(payload.emoji !== undefined ? { emoji: payload.emoji } : {}),
      ...(payload.topic !== undefined ? { topic: payload.topic } : {}),
      ...(payload.document !== undefined ? { document: payload.document } : {}),
      ...(payload.session_state !== undefined ? { session_state: payload.session_state } : {}),
      ...(payload.user_notes !== undefined ? { user_notes: payload.user_notes } : {}),
      ...(payload.chat_messages !== undefined ? { chat_messages: payload.chat_messages } : {}),
    })
    .eq("user_id", userId)
    .eq("id", courseId)
    .select("*")
    .single();

  if (error) throw error;
  return data as SavedCourseRow;
}

export async function deleteSavedCourse(
  supabase: SupabaseClient,
  userId: string,
  courseId: string,
): Promise<void> {
  const { error } = await supabase
    .from("saved_courses")
    .delete()
    .eq("user_id", userId)
    .eq("id", courseId);

  if (error) throw error;
}

export { toSummary };
