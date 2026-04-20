"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

export default function LandingPage() {
  return (
    <Suspense fallback={null}>
      <LandingContent />
    </Suspense>
  );
}

function LandingContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const authError = searchParams.get("error");

  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard");
  }, [status, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-6 py-12 text-ink">
      <div className="w-full max-w-md">
        <div className="card p-8">
          <div className="mb-7 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[10px] border-cartoon-thin border-ink bg-accent-red text-2xl font-bold text-white shadow-cartoon-md dark:text-bg">
              M
            </div>
            <div>
              <h1 className="text-[28px] leading-none">MailBoard</h1>
              <p className="mt-1 text-xs font-medium text-ink-mute">Personal, read-only inbox tools</p>
            </div>
          </div>

          <p className="mb-6 text-sm leading-6 text-ink-mute">
            Search, filter, and analyze your own Gmail inbox. Read-only. Your data stays in your account.
          </p>

          <div className="mb-7 space-y-3 text-sm text-ink">
            <FeatureCheck tone="green">
              Requests <strong>read-only</strong> Gmail access (<code className="text-xs">gmail.readonly</code>).
            </FeatureCheck>
            <FeatureCheck tone="blue">Nothing is sent, modified, or deleted on your behalf.</FeatureCheck>
            <FeatureCheck tone="yellow">Tokens stay on the server; only your search results reach the browser.</FeatureCheck>
          </div>

          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
            disabled={status === "loading"}
            className="btn w-full py-3"
          >
            <GoogleIcon />
            <span>Continue with Google</span>
          </button>

          {session?.error && (
            <p className="mt-4 text-xs font-semibold text-accent-red">
              {session.error === "RefreshAccessTokenError"
                ? "Your session expired. Please sign in again."
                : String(session.error)}
            </p>
          )}

          {authError && (
            <p className="mt-4 text-xs font-semibold text-accent-red">
              {authErrorMessage(authError)}
            </p>
          )}

          <p className="mt-6 text-xs leading-5 text-ink-mute">
            By signing in you authorize this app running on your machine to call the Gmail API with your account.
          </p>
        </div>

        <p className="mt-6 text-center text-xs font-medium text-ink-mute">
          Run locally. Your data never leaves your computer.
        </p>
      </div>
    </main>
  );
}

function authErrorMessage(error: string) {
  if (error === "AccessDenied") {
    return "Sign-in was denied. Check ALLOWED_EMAIL in Vercel, or leave it blank for testing.";
  }
  if (error === "Callback" || error === "OAuthCallback") {
    return "Google sign-in reached MailBoard, but the callback failed. Check Vercel env vars and logs.";
  }
  if (error === "Configuration") {
    return "Authentication is not configured correctly. Check NEXTAUTH_URL, NEXTAUTH_SECRET, and Google OAuth credentials.";
  }
  return `Sign-in failed: ${error}`;
}

function FeatureCheck({
  tone,
  children,
}: {
  tone: "green" | "blue" | "yellow";
  children: React.ReactNode;
}) {
  const fill =
    tone === "green" ? "bg-accent-green text-white dark:text-bg" : tone === "blue" ? "bg-accent-blue text-white dark:text-bg" : "bg-accent-yellow text-[#0b0f1a]";
  return (
    <div className="flex items-start gap-3">
      <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-cartoon-thin border-ink ${fill}`}>
        <CheckIcon />
      </span>
      <span className="leading-6">{children}</span>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3.5 8.5 6.5 11 12.5 4.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.5 6.1 29.5 4 24 4 16.1 4 9.3 8.6 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.4 0 10.3-2 14-5.3l-6.5-5.3C29.3 35 26.8 36 24 36c-5.3 0-9.7-3.4-11.3-8l-6.6 5.1C9.3 39.4 16.1 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.3 5.6l6.5 5.3C37.3 39.4 44 32 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
