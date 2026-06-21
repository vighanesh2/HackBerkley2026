import type { ChatMessage } from "@/types/chat";
import type { CourseDocument } from "@/types/course-document";
import type { CoursePhase } from "@/types/course";

export const COURSE_LIBRARY_KEY = "feynman_course_library";

export type LocalSavedCourse = {
  id: string;
  savedAt: string;
  updatedAt: string;
  title: string;
  emoji: string | null;
  topic: string | null;
  document: CourseDocument;
  userNotes: string;
  chatMessages: ChatMessage[];
  phase: CoursePhase;
  moduleIndex: number;
};

export type LocalCourseSummary = {
  id: string;
  title: string;
  emoji: string | null;
  topic: string | null;
  completed: boolean;
  moduleCount: number;
  masteredCount: number;
  updatedAt: string;
  createdAt: string;
};

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "course";
}

function readLibrary(): LocalSavedCourse[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(COURSE_LIBRARY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LocalSavedCourse[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLibrary(courses: LocalSavedCourse[]): void {
  localStorage.setItem(COURSE_LIBRARY_KEY, JSON.stringify(courses));
}

function toSummary(course: LocalSavedCourse): LocalCourseSummary {
  const modules = course.document?.modules ?? [];
  return {
    id: course.id,
    title: course.title,
    emoji: course.emoji,
    topic: course.topic,
    completed: Boolean(course.document?.completed),
    moduleCount: modules.length,
    masteredCount: modules.filter((module) => module.status === "mastered").length,
    updatedAt: course.updatedAt,
    createdAt: course.savedAt,
  };
}

export function listLocalCourses(): LocalCourseSummary[] {
  return readLibrary()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(toSummary);
}

export function getLocalCourse(id: string): LocalSavedCourse | null {
  return readLibrary().find((course) => course.id === id) ?? null;
}

export function saveLocalCourse(input: {
  id?: string | null;
  document: CourseDocument;
  userNotes?: string;
  chatMessages?: ChatMessage[];
  phase?: CoursePhase;
  moduleIndex?: number;
}): LocalSavedCourse {
  const now = new Date().toISOString();
  const library = readLibrary();
  const existingIndex = input.id ? library.findIndex((course) => course.id === input.id) : -1;

  const record: LocalSavedCourse = {
    id: input.id && existingIndex >= 0 ? input.id : crypto.randomUUID(),
    savedAt: existingIndex >= 0 ? library[existingIndex].savedAt : now,
    updatedAt: now,
    title: input.document.title,
    emoji: input.document.emoji ?? null,
    topic: input.document.title,
    document: input.document,
    userNotes: input.userNotes ?? "",
    chatMessages: input.chatMessages ?? [],
    phase: input.phase ?? "outline_ready",
    moduleIndex: input.moduleIndex ?? 0,
  };

  if (existingIndex >= 0) {
    library[existingIndex] = record;
  } else {
    library.unshift(record);
  }

  writeLibrary(library);
  return record;
}

export function deleteLocalCourse(id: string): void {
  writeLibrary(readLibrary().filter((course) => course.id !== id));
}

export function downloadCourseJson(document: CourseDocument, savedAt: string): void {
  const payload = { savedAt, document };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = `${slugify(document.title)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
