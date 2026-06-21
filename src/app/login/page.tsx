"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import WorkspaceSkeleton from "@/components/WorkspaceSkeleton";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  EMAIL_RATE_LIMIT_HINT,
  formatAuthError,
  isEmailRateLimitError,
} from "@/lib/supabase/auth-errors";
import { supabaseConfigHint } from "@/lib/supabase/env";

type AuthMode = "signin" | "signup";
type Status = "idle" | "loading" | "sent" | "error";

function destinationWithSignedIn(nextPath: string): string {
  return nextPath.includes("?") ? `${nextPath}&signedIn=1` : `${nextPath}?signedIn=1`;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackError = searchParams.get("error");
  const nextPath = searchParams.get("next") ?? "/";

  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<Status>(callbackError ? "error" : "idle");
  const [message, setMessage] = useState(
    callbackError ? formatAuthError(callbackError) : "",
  );

  if (!isSupabaseConfigured()) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-6">
        <div className="max-w-md rounded-2xl border border-notion-border bg-notion-page p-8 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-notion-text">Sign in unavailable</h1>
          <p className="mt-3 text-sm text-notion-muted">
            Add your Supabase URL and anon/publishable key to <code className="text-xs">.env.local</code>,
            save the file, then restart the dev server.
          </p>
          <p className="mt-2 text-xs text-notion-muted">{supabaseConfigHint()}</p>
          <Link href="/" className="mt-6 inline-block text-sm text-gemini-accent hover:underline">
            Back home
          </Link>
        </div>
      </div>
    );
  }

  const showKeyHint = message.toLowerCase().includes("invalid api key");
  const showRateLimitHint = isEmailRateLimitError(message);
  const loading = status === "loading";

  function authRedirectTo() {
    return `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
  }

  function switchMode(next: AuthMode) {
    setMode(next);
    setStatus("idle");
    setMessage("");
    setPassword("");
    setConfirmPassword("");
  }

  function setAuthError(rawMessage: string) {
    setStatus("error");
    setMessage(formatAuthError(rawMessage));
  }

  function goAfterAuth() {
    router.push(destinationWithSignedIn(nextPath));
    router.refresh();
  }

  async function handlePasswordAuth(event: React.FormEvent) {
    event.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) return;

    if (mode === "signup" && password !== confirmPassword) {
      setAuthError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setAuthError("Password must be at least 6 characters.");
      return;
    }

    setStatus("loading");
    setMessage("");

    const supabase = createClient();

    if (mode === "signup") {
      const signupResponse = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, password }),
      });

      const signupData = (await signupResponse.json()) as {
        ok?: boolean;
        error?: string;
        fallback?: boolean;
      };

      if (signupResponse.ok) {
        goAfterAuth();
        return;
      }

      if (signupResponse.status === 409) {
        setAuthError(signupData.error ?? "Account already exists. Sign in instead.");
        setMode("signin");
        return;
      }

      if (!signupData.fallback) {
        setAuthError(signupData.error ?? "Sign up failed.");
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: { emailRedirectTo: authRedirectTo() },
      });

      if (error) {
        setAuthError(error.message);
        return;
      }

      if (data.session) {
        goAfterAuth();
        return;
      }

      setStatus("sent");
      setMessage(
        "Account created. Check your email to confirm, then sign in with your password.",
      );
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });

    if (error) {
      setAuthError(error.message);
      return;
    }

    goAfterAuth();
  }

  async function handleGoogle() {
    setStatus("loading");
    setMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: authRedirectTo() },
    });

    if (error) {
      setAuthError(error.message);
    }
  }

  if (status === "sent") {
    return (
      <div className="flex min-h-dvh items-center justify-center px-6 py-16">
        <div className="w-full max-w-md rounded-2xl border border-notion-border bg-notion-page p-8 text-center shadow-sm">
          <div className="login-sent-icon mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--notion-callout-green)]">
            <svg
              className="h-8 w-8 text-[#448361]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              aria-hidden
            >
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="mt-6 text-2xl font-semibold text-notion-text">Confirm your email</h1>
          <p className="mt-3 text-sm leading-relaxed text-notion-muted">{message}</p>
          <p className="mt-2 text-xs text-notion-muted">
            Sent to <span className="font-medium text-notion-text">{email}</span>
          </p>
          <p className="mt-4 text-xs leading-relaxed text-notion-muted">
            To skip confirmation emails in dev: Supabase → Authentication → Providers → Email →
            disable <strong>Confirm email</strong>, then sign up again with password.
          </p>
          <button
            type="button"
            onClick={() => switchMode("signin")}
            className="mt-8 text-sm text-gemini-accent hover:underline"
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center px-6 py-16">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-notion-canvas/70 backdrop-blur-[2px]">
          <WorkspaceSkeleton />
        </div>
      )}

      <div className="w-full max-w-md rounded-2xl border border-notion-border bg-notion-page p-8 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-notion-text">
          {mode === "signup" ? "Create account" : "Sign in"}
        </h1>
        <p className="mt-2 text-sm text-notion-muted">
          Use email and password — no magic link required.
        </p>

        <div className="mt-6 flex rounded-full border border-notion-border bg-[var(--notion-hover)] p-1">
          <button
            type="button"
            onClick={() => switchMode("signin")}
            className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition ${
              mode === "signin"
                ? "bg-notion-page text-notion-text shadow-sm"
                : "text-notion-muted hover:text-notion-text"
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => switchMode("signup")}
            className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition ${
              mode === "signup"
                ? "bg-notion-page text-notion-text shadow-sm"
                : "text-notion-muted hover:text-notion-text"
            }`}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={handlePasswordAuth} className="mt-8 space-y-3">
          <label htmlFor="email" className="block text-sm font-medium text-notion-text">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
            disabled={loading}
            className="w-full rounded-lg border border-notion-border bg-notion-page px-4 py-3 text-sm text-notion-text outline-none focus:border-[var(--notion-callout-blue-border)] disabled:opacity-60"
          />

          <label htmlFor="password" className="block text-sm font-medium text-notion-text">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
            required
            minLength={6}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            disabled={loading}
            className="w-full rounded-lg border border-notion-border bg-notion-page px-4 py-3 text-sm text-notion-text outline-none focus:border-[var(--notion-callout-blue-border)] disabled:opacity-60"
          />

          {mode === "signup" && (
            <>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-notion-text">
                Confirm password
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                required
                minLength={6}
                autoComplete="new-password"
                disabled={loading}
                className="w-full rounded-lg border border-notion-border bg-notion-page px-4 py-3 text-sm text-notion-text outline-none focus:border-[var(--notion-callout-blue-border)] disabled:opacity-60"
              />
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="doc-save-btn w-full rounded-full px-4 py-3 text-sm font-medium disabled:opacity-60"
          >
            {loading ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-notion-border" />
          <span className="text-xs text-notion-muted">or</span>
          <div className="h-px flex-1 bg-notion-border" />
        </div>

        <button
          type="button"
          onClick={() => void handleGoogle()}
          disabled={loading}
          className="w-full rounded-full border border-notion-border px-4 py-3 text-sm font-medium text-notion-text transition hover:bg-[var(--notion-hover)] disabled:opacity-60"
        >
          Continue with Google
        </button>

        {message && status === "error" && (
          <div className="mt-4 space-y-2 rounded-lg border border-red-200 bg-red-50 px-3 py-3 dark:border-red-900/40 dark:bg-red-950/30">
            <p className="text-sm text-red-600">{message}</p>
            {showRateLimitHint && (
              <p className="text-xs leading-relaxed text-notion-muted">{EMAIL_RATE_LIMIT_HINT}</p>
            )}
            {showKeyHint && (
              <p className="text-xs leading-relaxed text-notion-muted">{supabaseConfigHint()}</p>
            )}
          </div>
        )}

        {mode === "signup" && status !== "error" && (
          <p className="mt-4 text-xs leading-relaxed text-notion-muted">
            Sign-up uses the server when <code className="text-[11px]">SUPABASE_SERVICE_ROLE_KEY</code>{" "}
            is set — no confirmation email, no rate limit.
          </p>
        )}

        <Link href="/" className="mt-6 block text-center text-sm text-gemini-accent hover:underline">
          Back home
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <LoginForm />
    </Suspense>
  );
}
