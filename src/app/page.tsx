"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LandingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard");
  }, [status, router]);

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12 bg-gradient-to-br from-slate-50 via-white to-brand-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="max-w-md w-full">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center text-white font-bold text-lg">G</div>
            <div>
              <h1 className="text-lg font-semibold">Gmail Search Dashboard</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Personal, read-only</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold tracking-tight mb-2">Sign in to your Gmail</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
            Search, filter, and analyze your own inbox with advanced operators, saved views, and CSV/JSON export.
          </p>

          <div className="mb-6 space-y-2 text-sm text-slate-600 dark:text-slate-400">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-brand-600">✓</span>
              <span>
                Requests <strong className="text-slate-900 dark:text-slate-100">read-only</strong> Gmail access
                (<code className="text-xs">gmail.readonly</code>).
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-brand-600">✓</span>
              <span>Nothing is sent, modified, or deleted on your behalf.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-brand-600">✓</span>
              <span>Tokens stay on the server; only your search results reach the browser.</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
            disabled={status === "loading"}
            className="w-full flex items-center justify-center gap-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 transition disabled:opacity-60"
          >
            <GoogleIcon />
            <span>Continue with Google</span>
          </button>

          {session?.error && (
            <p className="mt-4 text-xs text-red-600 dark:text-red-400">
              {session.error === "RefreshAccessTokenError"
                ? "Your session expired. Please sign in again."
                : String(session.error)}
            </p>
          )}

          <p className="mt-6 text-xs text-slate-500 dark:text-slate-400">
            By signing in you authorize this app (running on your machine) to call the Gmail API with your account.
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
          Run locally. Your data never leaves your computer.
        </p>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.5 6.1 29.5 4 24 4 16.1 4 9.3 8.6 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.4 0 10.3-2 14-5.3l-6.5-5.3C29.3 35 26.8 36 24 36c-5.3 0-9.7-3.4-11.3-8l-6.6 5.1C9.3 39.4 16.1 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.3 5.6l.1-.1 6.5 5.3C37.3 39.4 44 32 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
