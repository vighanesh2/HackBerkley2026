export const MAX_USER_NOTES_CHARS = 15_000;

export function normalizeUserNotes(raw: string): string {
  return raw.replace(/\r\n/g, "\n").trim().slice(0, MAX_USER_NOTES_CHARS);
}

export function notesPromptSection(notes: string | undefined): string {
  const trimmed = notes?.trim();
  if (!trimmed) return "";

  return [
    "LEARNER UPLOADED NOTES — prioritize this material when teaching.",
    "Build lessons around their notes, connect ideas, and fill gaps they have not covered yet.",
    "---",
    trimmed,
    "---",
  ].join("\n");
}

export function hasUserNotes(notes: string | undefined): boolean {
  return Boolean(notes?.trim());
}
