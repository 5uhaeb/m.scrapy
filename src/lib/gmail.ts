import { google, gmail_v1 } from "googleapis";
import type { ParsedMessage, MessageDetail, DomainAggregate } from "@/types";
import { sanitizeEmailHtml, htmlToText } from "./sanitize";

/** Build an authenticated Gmail client from a bearer access token. */
export function gmailClient(accessToken: string): gmail_v1.Gmail {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.gmail({ version: "v1", auth });
}

// ---------- Header helpers ----------

function getHeader(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string
): string {
  if (!headers) return "";
  const h = headers.find((x) => x.name?.toLowerCase() === name.toLowerCase());
  return h?.value ?? "";
}

/** Parse an RFC 5322 address like `"Jane Doe" <jane@x.com>` into {name,email}. */
function parseAddress(raw: string): { name: string; email: string; raw: string } {
  if (!raw) return { name: "", email: "", raw: "" };
  const match = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim().toLowerCase(), raw };
  }
  return { name: "", email: raw.trim().toLowerCase(), raw };
}

function parseAddressList(raw: string): Array<{ name: string; email: string; raw: string }> {
  if (!raw) return [];
  // naive comma split — fine for display purposes
  return raw.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((s) => parseAddress(s.trim())).filter((a) => a.email);
}

function extractDomain(email: string): string {
  const at = email.lastIndexOf("@");
  return at >= 0 ? email.slice(at + 1).toLowerCase() : "";
}

// ---------- Body extraction ----------

/** Recursively find the first part with a given MIME type. */
function findPart(
  part: gmail_v1.Schema$MessagePart | undefined,
  mimeType: string
): gmail_v1.Schema$MessagePart | undefined {
  if (!part) return undefined;
  if (part.mimeType === mimeType && part.body?.data) return part;
  if (part.parts) {
    for (const p of part.parts) {
      const hit = findPart(p, mimeType);
      if (hit) return hit;
    }
  }
  return undefined;
}

function decodeBase64Url(data: string): string {
  const padded = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64").toString("utf8");
}

interface Attachment {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
}

function collectAttachments(
  part: gmail_v1.Schema$MessagePart | undefined,
  acc: Attachment[] = []
): Attachment[] {
  if (!part) return acc;
  if (part.filename && part.filename.length > 0 && part.body?.attachmentId) {
    acc.push({
      filename: part.filename,
      mimeType: part.mimeType ?? "application/octet-stream",
      size: Number(part.body.size ?? 0),
      attachmentId: part.body.attachmentId,
    });
  }
  if (part.parts) part.parts.forEach((p) => collectAttachments(p, acc));
  return acc;
}

// ---------- Parsing ----------

/**
 * Turn a raw Gmail message into our compact ParsedMessage shape.
 * Works for both metadata-only and full-format messages.
 */
export function parseMessage(msg: gmail_v1.Schema$Message): ParsedMessage {
  const headers = msg.payload?.headers ?? [];
  const labelIds = msg.labelIds ?? [];
  const fromRaw = getHeader(headers, "From");
  const toRaw = getHeader(headers, "To");
  const ccRaw = getHeader(headers, "Cc");
  const subject = getHeader(headers, "Subject");
  const dateHeader = getHeader(headers, "Date");
  const internalDate = msg.internalDate ?? undefined;
  const date = internalDate
    ? new Date(Number(internalDate)).toISOString()
    : dateHeader
    ? new Date(dateHeader).toISOString()
    : new Date().toISOString();

  const attachments = collectAttachments(msg.payload);

  return {
    id: msg.id ?? "",
    threadId: msg.threadId ?? "",
    historyId: msg.historyId ?? undefined,
    internalDate,
    snippet: msg.snippet ?? "",
    labelIds,
    from: parseAddress(fromRaw),
    to: parseAddressList(toRaw),
    cc: parseAddressList(ccRaw),
    subject,
    date,
    hasAttachment: attachments.length > 0 || labelIds.includes("HAS_ATTACHMENT"),
    attachmentCount: attachments.length,
    isUnread: labelIds.includes("UNREAD"),
    isStarred: labelIds.includes("STARRED"),
    gmailUrl: `https://mail.google.com/mail/u/0/#inbox/${msg.threadId ?? ""}`,
  };
}

// ---------- High-level operations ----------

export interface SearchOptions {
  q: string;
  maxResults?: number;
  pageToken?: string;
  viewMode?: "messages" | "threads";
}

export async function searchMessages(
  accessToken: string,
  { q, maxResults = 25, pageToken, viewMode = "messages" }: SearchOptions
) {
  const gmail = gmailClient(accessToken);

  if (viewMode === "threads") {
    const list = await gmail.users.threads.list({
      userId: "me",
      q: q || undefined,
      maxResults,
      pageToken: pageToken || undefined,
    });

    const threads = list.data.threads ?? [];

    // For each thread, fetch metadata of the most recent message (last in the list).
    const results: ParsedMessage[] = await Promise.all(
      threads.map(async (t) => {
        const detail = await gmail.users.threads.get({
          userId: "me",
          id: t.id!,
          format: "metadata",
          metadataHeaders: ["From", "To", "Cc", "Subject", "Date"],
        });
        const msgs = detail.data.messages ?? [];
        const latest = msgs[msgs.length - 1] ?? msgs[0];
        const parsed = parseMessage(latest ?? { id: t.id!, threadId: t.id! });
        // Union labels across all messages in the thread for better filtering UX.
        const unionLabels = new Set<string>();
        msgs.forEach((m) => (m.labelIds ?? []).forEach((l) => unionLabels.add(l)));
        parsed.labelIds = Array.from(unionLabels);
        parsed.isUnread = parsed.labelIds.includes("UNREAD");
        parsed.isStarred = parsed.labelIds.includes("STARRED");
        return parsed;
      })
    );

    return {
      messages: results,
      nextPageToken: list.data.nextPageToken ?? null,
      resultSizeEstimate: list.data.resultSizeEstimate ?? results.length,
    };
  }

  // Message mode
  const list = await gmail.users.messages.list({
    userId: "me",
    q: q || undefined,
    maxResults,
    pageToken: pageToken || undefined,
  });

  const ids = list.data.messages ?? [];
  // Batch-fetch metadata for each message. Gmail's per-user quota easily handles
  // small pages in parallel. If you raise maxResults > 50, consider chunking.
  const results: ParsedMessage[] = await Promise.all(
    ids.map(async ({ id }) => {
      const detail = await gmail.users.messages.get({
        userId: "me",
        id: id!,
        format: "metadata",
        metadataHeaders: ["From", "To", "Cc", "Subject", "Date"],
      });
      return parseMessage(detail.data);
    })
  );

  return {
    messages: results,
    nextPageToken: list.data.nextPageToken ?? null,
    resultSizeEstimate: list.data.resultSizeEstimate ?? results.length,
  };
}

export async function getMessageDetail(
  accessToken: string,
  id: string
): Promise<MessageDetail> {
  const gmail = gmailClient(accessToken);
  const { data } = await gmail.users.messages.get({
    userId: "me",
    id,
    format: "full",
  });

  const base = parseMessage(data);
  const htmlPart = findPart(data.payload, "text/html");
  const textPart = findPart(data.payload, "text/plain");

  const rawHtml = htmlPart?.body?.data ? decodeBase64Url(htmlPart.body.data) : "";
  const rawText = textPart?.body?.data ? decodeBase64Url(textPart.body.data) : "";

  const safeHtml = rawHtml
    ? sanitizeEmailHtml(rawHtml, false)
    : rawText
    ? `<pre style="white-space:pre-wrap;word-break:break-word">${rawText
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")}</pre>`
    : "";

  const bodyText = rawText || (rawHtml ? htmlToText(rawHtml) : base.snippet);
  const attachments = collectAttachments(data.payload);

  return {
    ...base,
    bodyHtml: safeHtml,
    bodyText,
    attachments,
  };
}

// ---------- Aggregation ----------

export function aggregateDomains(messages: ParsedMessage[]): DomainAggregate[] {
  const counts = new Map<string, number>();
  for (const m of messages) {
    const d = extractDomain(m.from.email);
    if (!d) continue;
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count);
}
