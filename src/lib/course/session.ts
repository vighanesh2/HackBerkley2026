import type { CourseDocument, DocumentModule, ModuleStatus } from "@/types/course-document";
import type { CourseModule, CoursePhase, CourseSession } from "@/types/course";

const sessions = new Map<string, CourseSession>();

export function defaultSession(): CourseSession {
  return {
    topic: "",
    modules: [],
    currentModuleIndex: 0,
    phase: "idle",
    lastLesson: "",
    attemptCount: 0,
    gaps: [],
    document: null,
    userNotes: "",
  };
}

export function getCourseSession(sessionId: string): CourseSession {
  return sessions.get(sessionId) ?? defaultSession();
}

export function saveCourseSession(sessionId: string, session: CourseSession): void {
  sessions.set(sessionId, session);
}

export function clearCourseSession(sessionId: string): void {
  sessions.delete(sessionId);
}

export function modulesFromDocument(document: CourseDocument): CourseModule[] {
  return document.modules.map((module) => ({
    title: module.title,
    objective: module.objective,
  }));
}

export function currentModule(session: CourseSession): CourseModule | null {
  return session.modules[session.currentModuleIndex] ?? null;
}

export function currentDocumentModule(session: CourseSession): DocumentModule | null {
  return session.document?.modules[session.currentModuleIndex] ?? null;
}

export function formatOutline(session: CourseSession): string {
  const lines = session.modules.map(
    (module, index) => `${index + 1}. **${module.title}** — ${module.objective}`,
  );
  return lines.join("\n");
}

export function isAffirmative(text: string): boolean {
  const lower = text.trim().toLowerCase();
  return ["yes", "y", "start", "go", "begin", "continue", "ok", "okay", "sure"].includes(
    lower,
  );
}

export function isNegative(text: string): boolean {
  const lower = text.trim().toLowerCase();
  return ["no", "n", "cancel", "stop", "quit", "exit"].includes(lower);
}

export function advancePhase(session: CourseSession, phase: CoursePhase): CourseSession {
  return { ...session, phase };
}

export function setModuleStatus(
  document: CourseDocument,
  moduleIndex: number,
  status: ModuleStatus,
): CourseDocument {
  const modules = document.modules.map((module, index) =>
    index === moduleIndex ? { ...module, status } : module,
  );
  return { ...document, modules };
}

export function appendGapNotes(
  document: CourseDocument,
  moduleIndex: number,
  gaps: string[],
): CourseDocument {
  const modules = document.modules.map((module, index) => {
    if (index !== moduleIndex) return module;
    const merged = [...module.gapNotes];
    for (const gap of gaps) {
      if (!merged.includes(gap)) merged.push(gap);
    }
    return { ...module, status: "in_progress" as ModuleStatus, gapNotes: merged };
  });
  return { ...document, modules };
}

export function syncSessionFromDocument(
  session: CourseSession,
  document: CourseDocument,
): CourseSession {
  return {
    ...session,
    topic: document.title,
    modules: modulesFromDocument(document),
    document,
  };
}
