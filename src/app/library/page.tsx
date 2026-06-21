"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import type { SavedCourseSummary } from "@/types/saved-course";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function LibraryPage() {
  const { user, loading: authLoading, configured } = useAuth();
  const [courses, setCourses] = useState<SavedCourseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setLoading(false);
      return;
    }

    fetch("/api/library")
      .then(async (response) => {
        const data = (await response.json()) as {
          courses?: SavedCourseSummary[];
          error?: string;
        };
        if (!response.ok) throw new Error(data.error ?? "Failed to load library");
        setCourses(data.courses ?? []);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load library");
      })
      .finally(() => setLoading(false));
  }, [user, authLoading]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this course from your library?")) return;

    const response = await fetch(`/api/library/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      alert(data.error ?? "Could not delete course");
      return;
    }

    setCourses((current) => current.filter((course) => course.id !== id));
  }

  if (!configured) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="text-3xl font-semibold text-notion-text">Library</h1>
        <p className="mt-3 text-notion-muted">Configure Supabase to enable cloud saves.</p>
        <Link href="/" className="mt-6 inline-block text-gemini-accent hover:underline">
          Back home
        </Link>
      </div>
    );
  }

  if (authLoading || loading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-24 text-center text-notion-muted">
        Loading your library…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <h1 className="text-3xl font-semibold text-notion-text">Your course library</h1>
        <p className="mt-3 text-notion-muted">
          Sign in to save courses, track progress, and resume on any device.
        </p>
        <Link
          href="/login"
          className="doc-save-btn mt-8 inline-flex rounded-full px-6 py-3 text-sm font-medium"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 pb-16 pt-24 sm:py-20">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-notion-text">Your library</h1>
          <p className="mt-2 text-notion-muted">
            {courses.length === 0
              ? "No saved courses yet — generate one and hit Save."
              : `${courses.length} saved course${courses.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <Link
          href="/"
          className="rounded-full border border-notion-border bg-notion-page px-4 py-2 text-sm font-medium text-notion-text transition hover:bg-[var(--notion-hover)]"
        >
          New course
        </Link>
      </div>

      {error && <p className="mt-6 text-sm text-red-600">{error}</p>}

      {courses.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-notion-border bg-notion-page p-12 text-center">
          <p className="text-5xl" aria-hidden>
            📚
          </p>
          <p className="mt-4 text-notion-muted">Courses you save will appear here.</p>
        </div>
      ) : (
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <li
              key={course.id}
              className="group flex flex-col rounded-2xl border border-notion-border bg-notion-page p-5 shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-3xl" aria-hidden>
                  {course.emoji ?? "📘"}
                </span>
                {course.completed && (
                  <span className="rounded-full bg-[var(--notion-callout-green)] px-2 py-0.5 text-xs font-medium text-[#448361]">
                    Complete
                  </span>
                )}
              </div>
              <h2 className="mt-3 text-lg font-semibold leading-snug text-notion-text">
                {course.title}
              </h2>
              {course.topic && course.topic !== course.title && (
                <p className="mt-1 line-clamp-2 text-sm text-notion-muted">{course.topic}</p>
              )}
              <p className="mt-3 text-xs text-notion-muted">
                {course.masteredCount}/{course.moduleCount} lessons · Updated{" "}
                {formatDate(course.updated_at)}
              </p>
              <div className="mt-5 flex gap-2">
                <Link
                  href={`/?course=${course.id}`}
                  className="doc-save-btn flex-1 rounded-full px-3 py-2 text-center text-sm font-medium"
                >
                  Open
                </Link>
                <button
                  type="button"
                  onClick={() => void handleDelete(course.id)}
                  className="rounded-full border border-notion-border px-3 py-2 text-sm text-notion-muted transition hover:bg-[var(--notion-hover)] hover:text-notion-text"
                  aria-label={`Delete ${course.title}`}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
