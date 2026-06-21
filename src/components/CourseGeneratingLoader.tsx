export default function CourseGeneratingLoader() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-16 pt-24">
      <div className="relative flex h-24 w-24 items-center justify-center" aria-hidden>
        <span className="course-gen-ring absolute inset-0 rounded-full border-2 border-gemini-accent/30" />
        <span className="course-gen-ring course-gen-ring-delay absolute inset-2 rounded-full border-2 border-gemini-accent/50" />
        <span className="auth-float text-4xl">✨</span>
      </div>
      <h2 className="mt-8 text-xl font-semibold text-notion-text">Generating your course</h2>
      <p className="mt-2 max-w-sm text-center text-sm leading-relaxed text-notion-muted">
        Building lessons, knowledge checks, and video picks — this usually takes a minute.
      </p>
      <div className="mt-8 flex gap-1.5" aria-hidden>
        <span className="gemini-dot h-2 w-2 rounded-full bg-gemini-accent" />
        <span className="gemini-dot h-2 w-2 rounded-full bg-gemini-accent" />
        <span className="gemini-dot h-2 w-2 rounded-full bg-gemini-accent" />
      </div>
    </div>
  );
}
