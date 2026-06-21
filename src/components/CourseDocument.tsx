"use client";

import { useState } from "react";
import CourseGeneratingLoader from "@/components/CourseGeneratingLoader";
import type {
  CourseDocument,
  DocumentModule,
  KnowledgeCheck,
  ModuleStatus,
  RecommendedVideo,
} from "@/types/course-document";

const SUGGESTIONS = [
  "Machine learning basics",
  "The French Revolution",
  "Neural networks explained",
  "AP Biology genetics",
];

function StatusBadge({ status }: { status: ModuleStatus }) {
  const styles: Record<ModuleStatus, string> = {
    not_started: "bg-notion-border text-notion-muted",
    in_progress: "bg-[var(--notion-callout-yellow)] text-[#9a6700]",
    mastered: "bg-[var(--notion-callout-green)] text-[#448361]",
  };
  const labels: Record<ModuleStatus, string> = {
    not_started: "Not started",
    in_progress: "In progress",
    mastered: "Complete",
  };
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function Callout({
  variant,
  title,
  children,
  id,
}: {
  variant: "blue" | "yellow" | "green" | "purple";
  title?: string;
  children: React.ReactNode;
  id?: string;
}) {
  const cls =
    variant === "blue"
      ? "notion-callout-blue"
      : variant === "yellow"
        ? "notion-callout-yellow"
        : variant === "green"
          ? "notion-callout-green"
          : "notion-callout-purple";
  return (
    <aside id={id} className={`rounded-md px-4 py-3 ${cls}`} role="note">
      {title && <p className="mb-1 text-sm font-semibold">{title}</p>}
      <div className="text-sm leading-relaxed text-notion-text">{children}</div>
    </aside>
  );
}

function KnowledgeCheckBlock({ check }: { check: KnowledgeCheck }) {
  const [revealed, setRevealed] = useState(false);

  if (check.type === "reflection") {
    return (
      <Callout variant="purple" title="Think about it">
        <p className="font-medium">{check.question}</p>
        {check.reflectionPrompt && (
          <p className="mt-2 text-notion-muted">{check.reflectionPrompt}</p>
        )}
      </Callout>
    );
  }

  return (
    <Callout variant="blue" title="Knowledge check">
      <p className="mb-3 font-medium">{check.question}</p>
      {check.options && check.options.length > 0 && (
        <ul className="mb-3 space-y-2" role="list">
          {check.options.map((option) => (
            <li key={option} className="flex gap-2 rounded bg-notion-page/60 px-3 py-2">
              <span aria-hidden>○</span>
              <span>{option}</span>
            </li>
          ))}
        </ul>
      )}
      {check.answer && (
        <button
          type="button"
          onClick={() => setRevealed(!revealed)}
          className="text-sm font-medium text-[var(--notion-callout-blue-border)] underline-offset-2 hover:underline"
        >
          {revealed ? "Hide answer" : "Reveal answer"}
        </button>
      )}
      {revealed && check.answer && (
        <p className="mt-2 rounded bg-notion-page px-3 py-2 text-sm">
          <span className="font-semibold">Answer: </span>
          {check.answer}
        </p>
      )}
    </Callout>
  );
}

function youtubeEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) {
      const id = parsed.pathname.slice(1);
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
  } catch {
    return null;
  }
  return null;
}

function VideoCard({ video, compact = false }: { video: RecommendedVideo; compact?: boolean }) {
  const embedUrl = youtubeEmbedUrl(video.url);

  return (
    <div className={`rounded-lg border border-notion-border bg-[var(--notion-hover)] ${compact ? "p-4" : "p-5"}`}>
      {!compact && embedUrl && (
        <div className="mb-4 aspect-video overflow-hidden rounded-md bg-black/5">
          <iframe
            src={embedUrl}
            title={video.title}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}
      <p className="text-base font-semibold text-notion-text">
        <a href={video.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
          {video.title}
        </a>
      </p>
      <p className="mt-2 text-sm leading-relaxed text-notion-muted">{video.reason}</p>
      {video.source && (
        <p className="mt-2 text-xs text-notion-muted">Found via {video.source}</p>
      )}
    </div>
  );
}

function VisualBlock({
  visual,
}: {
  visual: DocumentModule["visual"];
}) {
  return (
    <figure
      className="rounded-lg border border-notion-border bg-[var(--notion-hover)] p-5"
      aria-label={visual.altText}
    >
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-notion-muted">
        <span aria-hidden>
          {visual.type === "diagram" ? "📊" : visual.type === "chart" ? "📈" : "🗂️"}
        </span>
        {visual.type}
      </div>
      <figcaption className="text-base font-semibold text-notion-text">{visual.title}</figcaption>
      <p className="mt-2 text-sm leading-relaxed text-notion-muted">{visual.description}</p>
      <p className="sr-only">{visual.altText}</p>
    </figure>
  );
}

function LessonSection({
  module,
  index,
}: {
  module: DocumentModule;
  index: number;
}) {
  const sectionId = `lesson-${index + 1}`;

  return (
    <section
      id={sectionId}
      aria-labelledby={`${sectionId}-title`}
      className="scroll-mt-24 border-b border-notion-border pb-12 pt-4"
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-notion-muted">Lesson {index + 1}</span>
        <StatusBadge status={module.status} />
      </div>

      <h2 id={`${sectionId}-title`} className="text-2xl font-bold tracking-tight text-notion-text">
        {module.title}
      </h2>

      <Callout variant="yellow" title="This lesson's objective">
        {module.objective}
      </Callout>

      <p className="lesson-prose mt-6 text-lg font-medium leading-relaxed text-notion-text">
        {module.summary}
      </p>

      <div className="lesson-prose mt-6 space-y-4">
        {module.paragraphs.map((paragraph) => (
          <p key={paragraph.slice(0, 40)} className="text-base leading-7 text-notion-text">
            {paragraph}
          </p>
        ))}
      </div>

      {module.bulletPoints.length > 0 && (
        <ul className="mt-6 list-disc space-y-2 pl-6 text-base leading-7" role="list">
          {module.bulletPoints.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      )}

      {module.keyTerms.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-notion-muted">
            Key terms
          </h3>
          <dl className="mt-3 space-y-3">
            {module.keyTerms.map(({ term, definition }) => (
              <div key={term} className="rounded-md border border-notion-border px-4 py-3">
                <dt className="font-semibold text-notion-text">{term}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-notion-muted">{definition}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <div className="mt-8">
        <VisualBlock visual={module.visual} />
      </div>

      {module.recommendedVideo && (
        <div className="mt-8">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-notion-muted">
            Watch this lesson
          </h3>
          <div className="mt-3">
            <VideoCard video={module.recommendedVideo} />
          </div>
        </div>
      )}

      {module.keyTakeaways.length > 0 && (
        <Callout variant="green" title="Remember this">
          <ul className="list-none space-y-1">
            {module.keyTakeaways.map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden>✓</span>
                <span className="font-medium">{item}</span>
              </li>
            ))}
          </ul>
        </Callout>
      )}

      <div className="mt-6">
        <KnowledgeCheckBlock check={module.knowledgeCheck} />
      </div>

      <Callout variant="blue" title="Your turn — practical task">
        {module.practicalTask}
      </Callout>

      <Callout variant="yellow" title="Feynman practice (use chat tutor)">
        {module.feynmanPrompt}
      </Callout>

      {module.gapNotes.length > 0 && (
        <Callout variant="purple" title="Review these gaps">
          <ul className="list-disc space-y-1 pl-5">
            {module.gapNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </Callout>
      )}
    </section>
  );
}

function TableOfContents({
  document,
  activeIndex,
}: {
  document: CourseDocument;
  activeIndex?: number;
}) {
  return (
    <nav aria-label="Table of contents" className="sticky top-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-notion-muted">
        Contents
      </p>
      <ul className="mt-3 space-y-1 text-sm">
        <li>
          <a href="#intro" className="toc-link block rounded px-2 py-1 text-notion-muted hover:bg-[var(--notion-hover)]">
            Introduction
          </a>
        </li>
        <li>
          <a href="#objectives" className="toc-link block rounded px-2 py-1 text-notion-muted hover:bg-[var(--notion-hover)]">
            Learning objectives
          </a>
        </li>
        {document.modules.map((module, index) => (
          <li key={module.title}>
            <a
              href={`#lesson-${index + 1}`}
              className={`toc-link flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-[var(--notion-hover)] ${
                activeIndex === index ? "bg-[var(--notion-hover)] font-medium text-notion-text" : "text-notion-muted"
              }`}
            >
              <span className="truncate">Lesson {index + 1}</span>
              {module.status === "mastered" && (
                <span className="shrink-0 text-[#448361]" aria-label="Complete">
                  ✓
                </span>
              )}
            </a>
          </li>
        ))}
        <li>
          <a href="#resources" className="toc-link block rounded px-2 py-1 text-notion-muted hover:bg-[var(--notion-hover)]">
            Resources
          </a>
        </li>
      </ul>
    </nav>
  );
}

type CourseDocumentViewProps = {
  document: CourseDocument | null;
  loading: boolean;
  activeModuleIndex?: number;
  onStartTopic: (topic: string, userNotes?: string) => void;
};

const ACCEPTED_NOTE_TYPES =
  ".pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.markdown,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation";
const MAX_NOTE_FILE_BYTES = 5 * 1024 * 1024;

async function extractFileText(file: File): Promise<string> {
  if (file.size > MAX_NOTE_FILE_BYTES) {
    throw new Error(`${file.name} is too large (max 5 MB).`);
  }

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/notes/extract", {
    method: "POST",
    body: formData,
  });

  const data = (await response.json()) as { text?: string; error?: string; fileName?: string };
  if (!response.ok) {
    throw new Error(data.error ?? `Could not read ${file.name}`);
  }

  const text = data.text?.trim();
  if (!text) {
    throw new Error(`No text found in ${file.name}`);
  }

  return `## ${data.fileName ?? file.name}\n${text}`;
}

async function readNoteFiles(files: FileList | File[]): Promise<string> {
  const parts: string[] = [];

  for (const file of Array.from(files)) {
    parts.push(await extractFileText(file));
  }

  return parts.join("\n\n");
}

export default function CourseDocumentView({
  document,
  loading,
  activeModuleIndex,
  onStartTopic,
}: CourseDocumentViewProps) {
  const [topicInput, setTopicInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [uploadLabel, setUploadLabel] = useState<string | null>(null);
  const [extractingNotes, setExtractingNotes] = useState(false);

  async function handleNotesFiles(files: FileList | null) {
    if (!files?.length || extractingNotes) return;

    setExtractingNotes(true);
    setUploadLabel("Extracting text from your files…");

    try {
      const imported = await readNoteFiles(files);
      setNotesInput((current) => {
        const merged = current.trim() ? `${current.trim()}\n\n${imported}` : imported;
        return merged.slice(0, 15000);
      });
      setUploadLabel(`${files.length} file${files.length > 1 ? "s" : ""} imported`);
    } catch (error) {
      setUploadLabel(
        error instanceof Error ? error.message : "Could not read one or more files.",
      );
    } finally {
      setExtractingNotes(false);
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const text = topicInput.trim();
    if (!text || loading) return;
    onStartTopic(text, notesInput.trim() || undefined);
    setTopicInput("");
    setNotesInput("");
    setUploadLabel(null);
  }

  if (!document) {
    if (loading) {
      return <CourseGeneratingLoader />;
    }

    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-16 pt-24">
        <div className="w-full max-w-lg text-center">
          <p className="text-5xl" aria-hidden>
            {loading ? "✨" : "📚"}
          </p>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-notion-text">
            Build your course
          </h1>
          <p className="mt-3 text-base leading-relaxed text-notion-muted">
            Get a scannable, engaging online text course — short lessons, knowledge checks,
            visual guides, and Feynman practice via the chat tutor. Upload notes or a textbook
            and we&apos;ll use RAG to retrieve, compress, and ground every lesson in your material.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 text-left">
            <label htmlFor="topic-input" className="mb-1.5 block text-sm font-medium text-notion-text">
              What do you want to learn?
            </label>
            <input
              id="topic-input"
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              placeholder="e.g. linear algebra for beginners"
              disabled={loading}
              className="w-full rounded-lg border border-notion-border bg-notion-page px-4 py-3 text-base text-notion-text outline-none focus:border-[var(--notion-callout-blue-border)] disabled:opacity-60"
            />

            <div className="mt-5">
              <label htmlFor="notes-input" className="mb-1.5 block text-sm font-medium text-notion-text">
                Your notes <span className="font-normal text-notion-muted">(optional)</span>
              </label>
              <textarea
                id="notes-input"
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value.slice(0, 15000))}
                placeholder="Paste notes, or upload PDF / Word / PowerPoint below…"
                disabled={loading || extractingNotes}
                rows={5}
                className="w-full resize-y rounded-lg border border-notion-border bg-notion-page px-4 py-3 text-sm leading-relaxed text-notion-text outline-none focus:border-[var(--notion-callout-blue-border)] disabled:opacity-60"
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <label
                  className={`cursor-pointer rounded-lg border border-notion-border bg-notion-page px-3 py-1.5 text-sm text-notion-muted transition hover:bg-[var(--notion-hover)] ${loading || extractingNotes ? "pointer-events-none opacity-50" : ""}`}
                >
                  Upload PDF, Word, or PowerPoint
                  <input
                    type="file"
                    accept={ACCEPTED_NOTE_TYPES}
                    multiple
                    disabled={loading || extractingNotes}
                    className="sr-only"
                    onChange={(e) => {
                      void handleNotesFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
                <span className="text-xs text-notion-muted">
                  {extractingNotes
                    ? "Extracting…"
                    : uploadLabel
                      ? uploadLabel
                      : `${notesInput.length.toLocaleString()} / 15,000 chars · max 5 MB per file`}
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || extractingNotes || !topicInput.trim()}
              className="mt-4 w-full rounded-lg bg-notion-text px-4 py-3 text-sm font-medium text-notion-page transition hover:opacity-90 disabled:opacity-40"
            >
              {loading ? "Generating course…" : "Generate course"}
            </button>
          </form>

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                disabled={loading}
                onClick={() => onStartTopic(suggestion, notesInput.trim() || undefined)}
                className="rounded-full border border-notion-border bg-notion-page px-3 py-1.5 text-sm text-notion-muted transition hover:bg-[var(--notion-hover)] disabled:opacity-50"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-notion-canvas pt-16">
      <div className="mx-auto flex max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <aside className="hidden w-52 shrink-0 lg:block">
          <TableOfContents document={document} activeIndex={activeModuleIndex} />
        </aside>

        <article className="min-w-0 flex-1 rounded-sm bg-notion-page px-6 py-10 shadow-sm sm:px-10 sm:py-12 lg:max-w-3xl">
          {document.completed && (
            <Callout variant="green" title="Course complete">
              You finished every lesson. Nicely done!
            </Callout>
          )}

          <header id="intro" className="scroll-mt-24">
            <p className="text-5xl" aria-hidden>
              {document.emoji}
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-notion-text">
              {document.title}
            </h1>
            <p className="lesson-prose mt-4 text-lg leading-relaxed text-notion-text">
              {document.welcomeMessage}
            </p>
            <p className="mt-4 text-base leading-7 text-notion-muted">{document.overview}</p>
            {document.personalNotesUsed && (
              <Callout variant="purple" title="Personalized with RAG from your source material">
                Your upload was chunked, embedded, and retrieved at generation time — lessons and
                the Feynman tutor are grounded in the most relevant excerpts from your notes.
              </Callout>
            )}
          </header>

          <section className="mt-8">
            <h2 className="text-lg font-semibold">How to use this course</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6 text-base leading-7" role="list">
              {document.howToUse.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          </section>

          {document.featuredVideo && (
            <section className="mt-8">
              <h2 className="text-lg font-semibold">Start here — best video</h2>
              <p className="mt-2 text-sm text-notion-muted">
                {document.featuredVideo.source === "YouTube"
                  ? "Verified on YouTube — playable and embeddable."
                  : `Curated via ${document.featuredVideo.source ?? "Agentverse agents"}.`}
              </p>
              <div className="mt-4">
                <VideoCard video={document.featuredVideo} />
              </div>
            </section>
          )}

          <div className="my-10 h-px bg-notion-border" role="separator" />

          <section id="objectives" className="scroll-mt-24 space-y-3">
            <h2 className="text-xl font-semibold">What you&apos;ll learn</h2>
            <Callout variant="blue" title="Learning objectives">
              <ul className="space-y-3" role="list">
                {document.learningObjectives.map((obj) => (
                  <li key={obj.statement} className="flex gap-3">
                    <span className="text-notion-muted" aria-hidden>
                      ☐
                    </span>
                    <span>
                      {obj.statement}
                      <span className="ml-2 text-xs text-notion-muted">({obj.bloomLevel})</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Callout>
          </section>

          <div className="my-10 h-px bg-notion-border" role="separator" />

          <div>
            <h2 className="mb-2 text-xl font-semibold">Lessons</h2>
            <p className="mb-6 text-sm text-notion-muted">
              Micro-lessons designed to be read in minutes. Complete the knowledge check and
              practical task, then use the chat tutor for Feynman practice.
            </p>
            {document.modules.map((module, index) => (
              <LessonSection key={module.title + index} module={module} index={index} />
            ))}
          </div>

          <section id="resources" className="scroll-mt-24 pt-4">
            <h2 className="text-xl font-semibold">Resources</h2>
            <ul className="mt-4 space-y-3 text-base leading-7" role="list">
              {document.resources.map((resource) => (
                <li key={resource.title + (resource.url ?? "")} className="flex gap-2">
                  <span className="text-notion-muted" aria-hidden>
                    •
                  </span>
                  <span>
                    {resource.url ? (
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium hover:underline"
                      >
                        {resource.title}
                      </a>
                    ) : (
                      <span className="font-medium">{resource.title}</span>
                    )}
                    <span className="text-notion-muted"> — {resource.type}</span>
                    {resource.note && (
                      <span className="block text-sm text-notion-muted">{resource.note}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </article>
      </div>
    </div>
  );
}
