import { NextRequest, NextResponse } from "next/server";
import { searchMessages } from "@/lib/gmail";
import { buildGmailQuery } from "@/lib/query-builder";
import { handleGmailError, requireSession } from "@/lib/api-helpers";
import { rateLimit } from "@/lib/rate-limit";
import type { SearchFilters, ParsedMessage } from "@/types";

export const dynamic = "force-dynamic";

const MAX_EXPORT_PAGES = 8;      // pages of 100 = up to 800 messages per export
const EXPORT_PAGE_SIZE = 100;

function csvEscape(v: string | number | boolean | undefined | null): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(",") || s.includes("\"") || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(rows: ParsedMessage[]): string {
  const header = [
    "id",
    "threadId",
    "date",
    "from_name",
    "from_email",
    "to",
    "subject",
    "snippet",
    "labels",
    "has_attachment",
    "attachment_count",
    "is_unread",
    "is_starred",
    "gmail_url",
  ].join(",");

  const lines = rows.map((m) =>
    [
      csvEscape(m.id),
      csvEscape(m.threadId),
      csvEscape(m.date),
      csvEscape(m.from.name),
      csvEscape(m.from.email),
      csvEscape(m.to.map((x) => x.email).join("; ")),
      csvEscape(m.subject),
      csvEscape(m.snippet),
      csvEscape(m.labelIds.join("|")),
      csvEscape(m.hasAttachment),
      csvEscape(m.attachmentCount),
      csvEscape(m.isUnread),
      csvEscape(m.isStarred),
      csvEscape(m.gmailUrl),
    ].join(",")
  );
  return [header, ...lines].join("\n");
}

export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const rl = rateLimit(`export:${auth.userId}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many exports. Please wait a moment." },
      { status: 429 }
    );
  }

  let body: { filters?: SearchFilters; format?: "csv" | "json" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const filters = body.filters ?? {};
  const format = body.format === "json" ? "json" : "csv";
  const q = buildGmailQuery(filters);
  const viewMode = filters.viewMode ?? "messages";

  try {
    const collected: ParsedMessage[] = [];
    let pageToken: string | undefined;

    for (let i = 0; i < MAX_EXPORT_PAGES; i++) {
      const res = await searchMessages(auth.accessToken, {
        q,
        maxResults: EXPORT_PAGE_SIZE,
        pageToken,
        viewMode,
      });
      collected.push(...res.messages);
      if (!res.nextPageToken) break;
      pageToken = res.nextPageToken;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    if (format === "csv") {
      const csv = toCsv(collected);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="gmail-export-${timestamp}.csv"`,
        },
      });
    }

    const json = JSON.stringify(
      { query: q, exportedAt: new Date().toISOString(), count: collected.length, messages: collected },
      null,
      2
    );
    return new NextResponse(json, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="gmail-export-${timestamp}.json"`,
      },
    });
  } catch (err) {
    return handleGmailError(err);
  }
}
