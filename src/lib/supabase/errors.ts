export const SCHEMA_SETUP_MESSAGE =
  "Course library not set up yet. Open Supabase Dashboard → SQL Editor, paste the contents of supabase/schema.sql from this repo, and click Run.";

export function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: string; message?: string };
  return (
    record.code === "PGRST205" ||
    Boolean(record.message?.includes("saved_courses") && record.message.includes("schema cache"))
  );
}

export function formatSupabaseError(error: unknown, fallback = "Database request failed"): string {
  if (isMissingTableError(error)) {
    return SCHEMA_SETUP_MESSAGE;
  }

  if (error && typeof error === "object") {
    const record = error as { message?: string };
    if (typeof record.message === "string" && record.message.trim()) {
      return record.message;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export function supabaseErrorStatus(error: unknown): number {
  return isMissingTableError(error) ? 503 : 500;
}
