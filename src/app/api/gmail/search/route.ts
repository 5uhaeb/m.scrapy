import { NextRequest, NextResponse } from "next/server";
import { searchMessages, aggregateDomains } from "@/lib/gmail";
import { buildGmailQuery } from "@/lib/query-builder";
import { rateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import type { SearchFilters } from "@/types";
import { ensureSessionUser, handleGmailError, requireSession } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    // 30 searches / minute per user is a reasonable personal-use limit.
    const rl = rateLimit(`search:${auth.userId}`, 30, 60_000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many searches. Please wait a moment." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfter / 1000)) } }
      );
    }

    let body: {
      filters?: SearchFilters;
      pageToken?: string;
      pageSize?: number;
      saveToHistory?: boolean;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const filters = body.filters ?? {};
    const pageSize = Math.min(Math.max(Number(body.pageSize) || 25, 1), 100);
    const viewMode = filters.viewMode ?? "messages";
    const q = buildGmailQuery(filters);

    const result = await searchMessages(auth.accessToken, {
      q,
      pageToken: body.pageToken,
      maxResults: pageSize,
      viewMode,
    });

    const domains = aggregateDomains(result.messages);

    // Save to search history on the first page only, and only if a real query
    // was executed (don't pollute history with empty queries).
    if (body.saveToHistory !== false && !body.pageToken && q.trim().length > 0) {
      try {
        await ensureSessionUser(auth);
        await prisma.searchHistory.create({
          data: {
            userId: auth.userId,
            query: q,
            filters: JSON.stringify(filters),
            resultCnt: result.resultSizeEstimate ?? result.messages.length,
          },
        });
        // Cap history at 50 rows per user.
        const extras = await prisma.searchHistory.findMany({
          where: { userId: auth.userId },
          orderBy: { createdAt: "desc" },
          skip: 50,
          select: { id: true },
        });
        if (extras.length > 0) {
          await prisma.searchHistory.deleteMany({
            where: { id: { in: extras.map((e) => e.id) } },
          });
        }
      } catch (e) {
        console.error("history write failed", e);
      }
    }

    return NextResponse.json({
      messages: result.messages,
      nextPageToken: result.nextPageToken,
      resultSizeEstimate: result.resultSizeEstimate,
      query: q,
      viewMode,
      domains,
    });
  } catch (err) {
    return handleGmailError(err);
  }
}
