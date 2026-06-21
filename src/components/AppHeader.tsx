"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function AppHeader() {
  const pathname = usePathname();
  const { user, loading, signOut, configured } = useAuth();
  const router = useRouter();

  if (pathname.startsWith("/draw")) {
    return null;
  }

  async function handleSignOut() {
    await signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="fixed inset-x-0 top-0 z-40 flex items-center justify-between gap-4 px-4 py-4 sm:px-6">
      <Link
        href="/"
        className="rounded-full border border-notion-border bg-notion-page/90 px-3 py-2 text-sm font-medium text-notion-text shadow-sm backdrop-blur transition hover:bg-[var(--notion-hover)]"
      >
        Diagram Coach
      </Link>

      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        {configured && !loading && user && (
          <>
            <span
              className="max-w-[7rem] truncate rounded-full border border-notion-border bg-notion-page/90 px-3 py-2 text-sm text-notion-muted shadow-sm backdrop-blur sm:max-w-[12rem] md:max-w-[16rem]"
              title={user.email ?? undefined}
            >
              {user.email}
            </span>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="shrink-0 rounded-full border border-notion-border bg-notion-page/90 px-3 py-2 text-sm text-notion-muted shadow-sm backdrop-blur transition hover:bg-[var(--notion-hover)] hover:text-notion-text"
            >
              Sign out
            </button>
          </>
        )}

        {configured && !loading && !user && (
          <Link
            href="/login"
            className="rounded-full border border-notion-border bg-notion-page/90 px-3 py-2 text-sm font-medium text-notion-text shadow-sm backdrop-blur transition hover:bg-[var(--notion-hover)]"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
