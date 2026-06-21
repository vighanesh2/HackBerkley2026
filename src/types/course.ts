import type { CourseDocument } from "@/types/course-document";

export type CoursePhase =
  | "idle"
  | "outline_ready"
  | "challenge"
  | "remediating"
  | "complete";

export type CourseModule = {
  title: string;
  objective: string;
};

export type CourseSession = {
  topic: string;
  modules: CourseModule[];
  currentModuleIndex: number;
  phase: CoursePhase;
  lastLesson: string;
  attemptCount: number;
  gaps: string[];
  document: CourseDocument | null;
  userNotes: string;
};

export type CourseGraphState = {
  session: CourseSession;
  userMessage: string;
  reply: string;
};
