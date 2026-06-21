"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import AuthSuccessOverlay from "@/components/AuthSuccessOverlay";
import AuthGate from "@/components/AuthGate";
import WorkspaceSkeleton from "@/components/WorkspaceSkeleton";
import { useAuth } from "@/components/AuthProvider";
import ChatMarkdown from "@/components/ChatMarkdown";
import CourseDocumentView from "@/components/CourseDocument";
import CourseSaveButton from "@/components/CourseSaveButton";
import type { CourseDocument } from "@/types/course-document";
import type { CoursePhase } from "@/types/course";
import type { ChatMessage } from "@/types/chat";
import type { SavedCourseRow } from "@/types/saved-course";

type CompressionStats = {
  original_tokens: number;
  compressed_tokens: number;
  tokens_saved: number;
  pct_saved: number;
  latency_ms: number;
  fallback: boolean;
  cache_hit: boolean;
  empty_input: boolean;
  error?: string;
};

function CompressionBadge({ stats }: { stats: CompressionStats }) {
  if (stats.empty_input || stats.tokens_saved === 0) return null;

  const label = stats.fallback
    ? "RAG (no compression)"
    : `${stats.pct_saved.toFixed(1)}% compressed · ${stats.tokens_saved} tokens saved`;

  const color = stats.fallback
    ? "bg-yellow-50 border-yellow-200 text-yellow-700"
    : "bg-emerald-50 border-emerald-200 text-emerald-700";

  return (
    <div
      className={`fixed bottom-6 left-4 z-50 flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm ${color}`}
      title={`Token Company compression · ${stats.latency_ms}ms · original: ${stats.original_tokens} → ${stats.compressed_tokens} tokens`}
    >
      <span aria-hidden className="text-sm">&#x2728;</span>
      <span>{label}</span>
    </div>
  );
}

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3.4 20.6 21 12 3.4 3.4l2.8 7.2L17 12l-10.8 1.4-2.8 7.2z" />
    </svg>
  );
}

type FloatingChatProps = {
  open: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  loading: boolean;
  onSend: (text: string) => void;
  hasDocument: boolean;
};

function FloatingChat({
  open,
  onClose,
  messages,
  loading,
  onSend,
  hasDocument,
}: FloatingChatProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, loading, open]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    onSend(text);
    setInput("");
  }

  if (!open) return null;

  return (
    <div className="chat-panel-enter fixed bottom-24 right-4 z-50 flex h-[min(520px,calc(100dvh-7rem))] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-gemini-border bg-gemini-bg shadow-2xl">
      <div className="flex items-center justify-between border-b border-gemini-border px-4 py-3">
        <div>
          <p className="text-sm font-medium text-gemini-text">Feynman tutor</p>
          <p className="text-xs text-gemini-muted">Teach it back · close gaps</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1.5 text-gemini-muted hover:bg-gemini-surface"
          aria-label="Close chat"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-sm text-gemini-muted">
            {hasDocument
              ? "Reply yes to start Lesson 1, or ask me to revise the course."
              : "Generate a course first, then use chat for the Feynman loop."}
          </p>
        )}
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                message.role === "user"
                  ? "whitespace-pre-wrap rounded-br-md bg-gemini-user-bubble text-gemini-text"
                  : "text-gemini-text"
              }`}
            >
              {message.role === "assistant" ? (
                <ChatMarkdown text={message.text} />
              ) : (
                message.text
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-1 py-1">
            <span className="gemini-dot h-2 w-2 rounded-full bg-gemini-muted" />
            <span className="gemini-dot h-2 w-2 rounded-full bg-gemini-muted" />
            <span className="gemini-dot h-2 w-2 rounded-full bg-gemini-muted" />
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-gemini-border p-3">
        <div className="flex items-end gap-2 rounded-2xl bg-gemini-input-bg px-3 py-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                const text = input.trim();
                if (text && !loading) {
                  onSend(text);
                  setInput("");
                }
              }
            }}
            placeholder="Message your tutor…"
            rows={1}
            disabled={loading || !hasDocument}
            className="max-h-28 min-h-6 flex-1 resize-none bg-transparent text-sm text-gemini-text outline-none placeholder:text-gemini-muted disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim() || !hasDocument}
            className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gemini-text text-gemini-bg disabled:opacity-40"
            aria-label="Send"
          >
            <SendIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
}

type CourseWorkspaceProps = {
  initialCourseId?: string;
};

export default function CourseWorkspace({ initialCourseId }: CourseWorkspaceProps) {
  const { user, loading: authLoading, configured } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [showLoginSuccess, setShowLoginSuccess] = useState(false);

  const [courseDocument, setCourseDocument] = useState<CourseDocument | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(Boolean(initialCourseId));
  const [chatOpen, setChatOpen] = useState(false);
  const [activeModuleIndex, setActiveModuleIndex] = useState(0);
  const [phase, setPhase] = useState<CoursePhase>("idle");
  const [userNotes, setUserNotes] = useState("");
  const [compressionStats, setCompressionStats] = useState<CompressionStats | null>(null);
  const [savedCourseId, setSavedCourseId] = useState<string | null>(initialCourseId ?? null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const signInHandled = useRef(false);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (signInHandled.current) return;
    if (searchParams.get("signedIn") !== "1") return;

    signInHandled.current = true;
    setShowLoginSuccess(true);

    const params = new URLSearchParams(searchParams.toString());
    params.delete("signedIn");
    const query = params.toString();
    const path = initialCourseId ? `/?course=${initialCourseId}` : query ? `/?${query}` : "/";
    router.replace(path, { scroll: false });
  }, [searchParams, router, initialCourseId]);

  useEffect(() => {
    if (!initialCourseId) return;

    setLoading(true);
    fetch(`/api/library/${initialCourseId}`)
      .then(async (response) => {
        const data = (await response.json()) as { course?: SavedCourseRow; error?: string };
        if (!response.ok) throw new Error(data.error ?? "Could not load course");

        const course = data.course;
        if (!course) throw new Error("Course not found");

        setSavedCourseId(course.id);
        setCourseDocument(course.document);
        setUserNotes(course.user_notes ?? course.session_state.userNotes ?? "");
        setMessages(course.chat_messages ?? []);
        setActiveModuleIndex(course.session_state.currentModuleIndex ?? 0);
        setPhase(course.session_state.phase ?? "outline_ready");
        if (course.document) setChatOpen(true);
      })
      .catch((error) => {
        setMessages([
          {
            role: "assistant",
            text: error instanceof Error ? error.message : "Could not load saved course.",
          },
        ]);
      })
      .finally(() => setLoading(false));
  }, [initialCourseId]);

  async function sendToApi(
    text: string,
    notes?: string,
    options?: { hideUserMessage?: boolean },
  ) {
    setLoading(true);
    const userMsg: ChatMessage = { role: "user", text };
    const pending = options?.hideUserMessage ? messagesRef.current : [...messagesRef.current, userMsg];
    if (!options?.hideUserMessage) {
      setMessages(pending);
    }

    const notesPayload = notes ?? userNotes;
    if (notes?.trim()) {
      setUserNotes(notes.trim());
    }

    try {
      const response = await fetch("/api/course", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          userNotes: notesPayload?.trim() ? notesPayload : undefined,
          savedCourseId: savedCourseId ?? undefined,
          chatMessages: pending,
        }),
      });

      const data = (await response.json()) as {
        reply?: string;
        error?: string;
        courseDocument?: CourseDocument | null;
        moduleIndex?: number;
        phase?: CoursePhase;
        savedCourseId?: string;
        compressionStats?: CompressionStats;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Request failed");
      }

      if (data.courseDocument) {
        setCourseDocument(data.courseDocument);
      }
      if (typeof data.moduleIndex === "number") {
        setActiveModuleIndex(data.moduleIndex);
      }
      if (data.phase) {
        setPhase(data.phase);
      }
      if (data.savedCourseId) {
        setSavedCourseId(data.savedCourseId);
      }
      if (data.compressionStats) {
        setCompressionStats(data.compressionStats);
      }

      const nextMessages = [...pending, { role: "assistant" as const, text: data.reply ?? "" }];
      setMessages(nextMessages);
      if (data.courseDocument) {
        setChatOpen(true);
      }
    } catch (error) {
      setMessages([
        ...pending,
        {
          role: "assistant",
          text: error instanceof Error ? error.message : "Something went wrong.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleStartTopic(topic: string, notes?: string) {
    sendToApi(`I want to learn ${topic}`, notes, { hideUserMessage: true });
  }

  const dismissLoginSuccess = useCallback(() => setShowLoginSuccess(false), []);

  if (!configured) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold text-notion-text">Sign in unavailable</h1>
        <p className="mt-3 max-w-md text-sm text-notion-muted">
          Configure Supabase in <code className="text-xs">.env.local</code> to enable sign-in and
          course saves.
        </p>
      </div>
    );
  }

  if (authLoading) {
    return <WorkspaceSkeleton />;
  }

  if (!user) {
    const nextPath = initialCourseId ? `/?course=${initialCourseId}` : "/";
    return <AuthGate nextPath={nextPath} />;
  }

  return (
    <>
      {compressionStats && <CompressionBadge stats={compressionStats} />}

      {showLoginSuccess && (
        <AuthSuccessOverlay message="Welcome back!" onDone={dismissLoginSuccess} />
      )}

      {showLoginSuccess ? (
        <WorkspaceSkeleton />
      ) : (
        <>
          {courseDocument && (
            <CourseSaveButton
              document={courseDocument}
              savedCourseId={savedCourseId}
              userNotes={userNotes}
              messages={messages}
              phase={phase}
              moduleIndex={activeModuleIndex}
              onSaved={setSavedCourseId}
            />
          )}

          <CourseDocumentView
            document={courseDocument}
            loading={loading && !courseDocument}
            activeModuleIndex={activeModuleIndex}
            onStartTopic={handleStartTopic}
          />

          {courseDocument && (
            <>
              <FloatingChat
                open={chatOpen}
                onClose={() => setChatOpen(false)}
                messages={messages}
                loading={loading}
                onSend={sendToApi}
                hasDocument={Boolean(courseDocument)}
              />

              {!chatOpen && (
                <button
                  type="button"
                  onClick={() => setChatOpen(true)}
                  className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gemini-accent text-white shadow-lg transition hover:scale-105 hover:shadow-xl"
                  aria-label="Open Feynman tutor"
                >
                  <ChatIcon className="h-6 w-6" />
                </button>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
