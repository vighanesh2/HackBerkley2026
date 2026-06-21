"use client";

import { useState } from "react";
import type { CourseDocument } from "@/types/course-document";
import type { CoursePhase } from "@/types/course";
import type { ChatMessage } from "@/types/chat";
import { useAuth } from "@/components/AuthProvider";
import { downloadCourseJson, saveLocalCourse } from "@/lib/course/save-course";

function SaveIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4zm-5 16a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm3-10H5V5h10v4z" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" />
    </svg>
  );
}

type CourseSaveButtonProps = {
  document: CourseDocument;
  savedCourseId: string | null;
  userNotes: string;
  messages: ChatMessage[];
  phase: CoursePhase;
  moduleIndex: number;
  onSaved: (id: string) => void;
};

export default function CourseSaveButton({
  document,
  savedCourseId,
  userNotes,
  messages,
  phase,
  moduleIndex,
  onSaved,
}: CourseSaveButtonProps) {
  const { user, configured } = useAuth();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setError("");

    const sessionState = {
      topic: document.title,
      modules: document.modules.map((module) => ({
        title: module.title,
        objective: module.objective,
      })),
      currentModuleIndex: moduleIndex,
      phase,
      lastLesson: "",
      attemptCount: 0,
      gaps: [] as string[],
      document,
      userNotes,
    };

    try {
      if (user && configured) {
        const payload = {
          title: document.title,
          emoji: document.emoji,
          topic: document.title,
          document,
          session_state: sessionState,
          user_notes: userNotes || null,
          chat_messages: messages,
        };

        const response = savedCourseId
          ? await fetch(`/api/library/${savedCourseId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
          : await fetch("/api/library", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });

        const data = (await response.json()) as { course?: { id: string }; error?: string };
        if (!response.ok) throw new Error(data.error ?? "Save failed");

        const id = data.course?.id ?? savedCourseId;
        if (id) onSaved(id);
      } else {
        const record = saveLocalCourse({
          id: savedCourseId,
          document,
          userNotes,
          chatMessages: messages,
          phase,
          moduleIndex,
        });
        onSaved(record.id);
        downloadCourseJson(document, record.savedAt);
      }

      setSaved(true);
      window.setTimeout(() => setSaved(false), 2200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed right-4 top-[4.25rem] z-40 flex flex-col items-end gap-2 sm:right-6">
      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={saving}
        aria-label={saved ? "Course saved" : "Save course"}
        className="doc-save-btn flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-white shadow-md transition hover:shadow-lg disabled:opacity-80"
      >
        {saved ? (
          <>
            <CheckIcon className="h-4 w-4" />
            <span>Saved</span>
          </>
        ) : (
          <>
            <SaveIcon className="h-4 w-4" />
            <span>{saving ? "Saving…" : "Save"}</span>
          </>
        )}
      </button>
      {error && (
        <p className="max-w-xs text-right text-xs leading-relaxed text-red-600 sm:max-w-sm">
          {error}
        </p>
      )}
    </div>
  );
}
