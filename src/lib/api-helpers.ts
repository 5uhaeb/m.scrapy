import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

/**
 * Returns { session, accessToken, userId } for an authenticated request,
 * or a NextResponse with the appropriate error status.
 */
export async function requireSession() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    } as const;
  }

  if (session.error === "RefreshAccessTokenError") {
    return {
      error: NextResponse.json(
        { error: "Session expired. Please sign in again." },
        { status: 401 }
      ),
    } as const;
  }

  if (!session.accessToken) {
    return {
      error: NextResponse.json(
        { error: "Missing Gmail access token" },
        { status: 401 }
      ),
    } as const;
  }

  if (!session.user?.id) {
    return {
      error: NextResponse.json(
        { error: "Session missing user id" },
        { status: 401 }
      ),
    } as const;
  }

  return {
    session,
    accessToken: session.accessToken,
    userId: session.user.id,
  } as const;
}

export async function ensureSessionUser(auth: {
  userId: string;
  session: {
    user?: {
      email?: string | null;
      name?: string | null;
      image?: string | null;
    };
  };
}) {
  const email = auth.session.user?.email;
  if (!email) throw new Error("Session missing user email");

  const { prisma } = await import("@/lib/prisma");
  await prisma.user.upsert({
    where: { id: auth.userId },
    update: {
      email,
      name: auth.session.user?.name ?? undefined,
      image: auth.session.user?.image ?? undefined,
    },
    create: {
      id: auth.userId,
      email,
      name: auth.session.user?.name ?? undefined,
      image: auth.session.user?.image ?? undefined,
    },
  });
}

/** Translate a Google API error into a friendly HTTP response. */
export function handleGmailError(err: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const e = err as any;
  const status = e?.code ?? e?.response?.status ?? 500;
  const message =
    e?.errors?.[0]?.message ||
    e?.response?.data?.error?.message ||
    e?.message ||
    "Gmail API error";

  console.error("[gmail-api-error]", status, message);

  if (status === 401) {
    return NextResponse.json(
      { error: "Gmail authorization expired. Please sign in again." },
      { status: 401 }
    );
  }
  if (status === 403) {
    return NextResponse.json(
      { error: "Gmail permission denied. Check OAuth scopes." },
      { status: 403 }
    );
  }
  if (status === 429) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again in a moment." },
      { status: 429 }
    );
  }
  return NextResponse.json({ error: message }, { status: typeof status === "number" ? status : 500 });
}
