import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

/**
 * Minimum scopes required:
 *   openid, email, profile           — basic identity
 *   gmail.readonly                   — list + read messages/threads
 *
 * We do NOT request send, modify, or compose scopes.
 */
const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
].join(" ");

/**
 * Refreshes a Google access token using the stored refresh token.
 * Docs: https://developers.google.com/identity/protocols/oauth2/web-server#offline
 */
async function refreshGoogleAccessToken(token: {
  refreshToken?: string;
  accessToken?: string;
  accessTokenExpires?: number;
}) {
  try {
    if (!token.refreshToken) throw new Error("Missing refresh token");

    const url = "https://oauth2.googleapis.com/token";
    const body = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: token.refreshToken,
    });

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const refreshed = await res.json();
    if (!res.ok) throw refreshed;

    return {
      ...token,
      accessToken: refreshed.access_token as string,
      // Google returns seconds; convert to ms epoch, subtract 60s of safety margin.
      accessTokenExpires: Date.now() + (refreshed.expires_in - 60) * 1000,
      // Google may or may not return a new refresh token; fall back to the old one.
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
      error: undefined,
    };
  } catch (err) {
    console.error("Error refreshing Google access token", err);
    return {
      ...token,
      error: "RefreshAccessTokenError" as const,
    };
  }
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: GOOGLE_SCOPES,
          access_type: "offline",   // ensures we get a refresh_token
          prompt: "consent",        // force consent so refresh_token is issued even after first login
        },
      },
    }),
  ],
  callbacks: {
    /**
     * Personal-use allow-list.
     * If ALLOWED_EMAIL is set in env, only that address can sign in.
     */
    async signIn({ user }) {
      const allowed = process.env.ALLOWED_EMAIL?.trim();
      if (!allowed) return true;
      return user.email?.toLowerCase() === allowed.toLowerCase();
    },

    async jwt({ token, account, user }) {
      // Initial sign-in: `account` is present.
      if (account && user) {
        // Persist / upsert user row in our DB.
        const dbUser = await prisma.user.upsert({
          where: { email: user.email! },
          update: {
            name: user.name ?? undefined,
            image: user.image ?? undefined,
          },
          create: {
            email: user.email!,
            name: user.name ?? undefined,
            image: user.image ?? undefined,
          },
        });

        return {
          ...token,
          userId: dbUser.id,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          accessTokenExpires: account.expires_at
            ? account.expires_at * 1000
            : Date.now() + 55 * 60 * 1000,
        };
      }

      // Still valid? Pass through.
      if (
        token.accessTokenExpires &&
        Date.now() < token.accessTokenExpires
      ) {
        return token;
      }

      // Expired — try to refresh.
      return await refreshGoogleAccessToken(token);
    },

    async session({ session, token }) {
      if (token) {
        session.user.id = token.userId;
        session.accessToken = token.accessToken;
        session.error = token.error;
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
    error: "/",
  },
};
