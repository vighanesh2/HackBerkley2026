import { NextResponse } from "next/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import {
  formatSupabaseError,
  isMissingTableError,
  supabaseErrorStatus,
} from "@/lib/supabase/errors";

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.from("saved_courses").select("id").limit(1);
    if (error) throw error;

    return NextResponse.json({ ok: true, tableReady: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        tableReady: false,
        error: formatSupabaseError(error, "Library health check failed"),
        needsSchema: isMissingTableError(error),
      },
      { status: supabaseErrorStatus(error) },
    );
  }
}
