import type { CourseDocument } from "@/types/course-document";
import type { CourseSession } from "@/types/course";
import type { ChatMessage } from "@/types/chat";

export type SavedCourseRow = {
  id: string;
  user_id: string;
  title: string;
  emoji: string | null;
  topic: string | null;
  document: CourseDocument | null;
  session_state: CourseSession;
  user_notes: string | null;
  chat_messages: ChatMessage[];
  created_at: string;
  updated_at: string;
};

export type SavedCourseSummary = {
  id: string;
  title: string;
  emoji: string | null;
  topic: string | null;
  completed: boolean;
  moduleCount: number;
  masteredCount: number;
  updated_at: string;
  created_at: string;
};

export type SaveCoursePayload = {
  title: string;
  emoji?: string | null;
  topic?: string | null;
  document?: CourseDocument | null;
  session_state: CourseSession;
  user_notes?: string | null;
  chat_messages?: ChatMessage[];
};
