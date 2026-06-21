import { NextResponse } from "next/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import {
  createSavedCourse,
  listSavedCourses,
} from "@/lib/supabase/library";
import type { SaveCoursePayload } from "@/types/saved-course";
import {
  formatSupabaseError,
  supabaseErrorStatus,
} from "@/lib/supabase/errors";

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = await createClient();
    const courses = await listSavedCourses(supabase, user.id);
    return NextResponse.json({ courses });
  } catch (error) {
    return NextResponse.json(
      { error: formatSupabaseError(error, "Failed to load library") },
      { status: supabaseErrorStatus(error) },
    );
  }
}

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: SaveCoursePayload;
  try {
    body = (await request.json()) as SaveCoursePayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.title?.trim() || !body.session_state) {
    return NextResponse.json({ error: "title and session_state are required" }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const course = await createSavedCourse(supabase, user.id, body);
    return NextResponse.json({ course });
  } catch (error) {
    return NextResponse.json(
      { error: formatSupabaseError(error, "Failed to save course") },
      { status: supabaseErrorStatus(error) },
    );
  }
}
