import { NextResponse } from "next/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import {
  deleteSavedCourse,
  getSavedCourse,
  updateSavedCourse,
} from "@/lib/supabase/library";
import type { SaveCoursePayload } from "@/types/saved-course";
import {
  formatSupabaseError,
  supabaseErrorStatus,
} from "@/lib/supabase/errors";
import { getCourseSession, saveCourseSession } from "@/lib/course/session";
import type { CourseSession } from "@/types/course";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const supabase = await createClient();
    const course = await getSavedCourse(supabase, user.id, id);
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    saveCourseSession(id, course.session_state as CourseSession);

    return NextResponse.json({ course });
  } catch (error) {
    return NextResponse.json(
      { error: formatSupabaseError(error, "Failed to load course") },
      { status: supabaseErrorStatus(error) },
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  let body: Partial<SaveCoursePayload>;
  try {
    body = (await request.json()) as Partial<SaveCoursePayload>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const course = await updateSavedCourse(supabase, user.id, id, body);

    if (body.session_state) {
      saveCourseSession(id, body.session_state);
    } else {
      saveCourseSession(id, course.session_state as CourseSession);
    }

    return NextResponse.json({ course });
  } catch (error) {
    return NextResponse.json(
      { error: formatSupabaseError(error, "Failed to update course") },
      { status: supabaseErrorStatus(error) },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const supabase = await createClient();
    await deleteSavedCourse(supabase, user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: formatSupabaseError(error, "Failed to delete course") },
      { status: supabaseErrorStatus(error) },
    );
  }
}
