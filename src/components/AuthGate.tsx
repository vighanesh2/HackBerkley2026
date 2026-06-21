import Link from "next/link";

type AuthGateProps = {
  nextPath?: string;
};

export default function AuthGate({ nextPath = "/" }: AuthGateProps) {
  const loginHref =
    nextPath === "/"
      ? "/login?next=%2F"
      : `/login?next=${encodeURIComponent(nextPath)}`;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-16 pt-24">
      <div className="w-full max-w-md text-center">
        <p className="auth-float text-5xl" aria-hidden>
          🔐
        </p>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-notion-text">
          Sign in to build your course
        </h1>
        <p className="mt-3 text-base leading-relaxed text-notion-muted">
          Create personalized courses, save progress to your library, and continue on any device.
        </p>
        <Link
          href={loginHref}
          className="doc-save-btn mt-8 inline-flex w-full items-center justify-center rounded-full px-6 py-3.5 text-sm font-medium"
        >
          Sign in to continue
        </Link>
        <p className="mt-4 text-xs text-notion-muted">
          Email & password or Google — avoids Supabase email rate limits.
        </p>
      </div>
    </div>
  );
}
