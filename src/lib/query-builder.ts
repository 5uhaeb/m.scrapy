import type { SearchFilters } from "@/types";
import { datePresetToOperators } from "./date-utils";

/** Wrap a value in quotes if it contains whitespace, otherwise return as-is. */
function quoteIfNeeded(v: string): string {
  const trimmed = v.trim();
  if (!trimmed) return "";
  if (/\s/.test(trimmed) && !/^".*"$/.test(trimmed)) return `"${trimmed}"`;
  return trimmed;
}

/**
 * Convert a SearchFilters object into a valid Gmail query string.
 * Mirrors Gmail's advanced search operators:
 *   https://support.google.com/mail/answer/7190
 */
export function buildGmailQuery(f: SearchFilters): string {
  const parts: string[] = [];

  if (f.keywords?.trim()) {
    // Keywords go as-is; users can already type "foo OR bar" if they want.
    parts.push(f.keywords.trim());
  }
  if (f.from?.trim()) parts.push(`from:${quoteIfNeeded(f.from)}`);
  if (f.to?.trim()) parts.push(`to:${quoteIfNeeded(f.to)}`);
  if (f.subject?.trim()) parts.push(`subject:${quoteIfNeeded(f.subject)}`);
  if (f.label?.trim()) parts.push(`label:${quoteIfNeeded(f.label)}`);

  if (f.hasAttachment) parts.push("has:attachment");
  if (f.isStarred) parts.push("is:starred");
  // "is:read" and "is:unread" are mutually exclusive — prefer unread if both set.
  if (f.isUnread) parts.push("is:unread");
  else if (f.isRead) parts.push("is:read");

  parts.push(...datePresetToOperators(f.datePreset, f.customAfter, f.customBefore));

  if (f.rawQuery?.trim()) parts.push(f.rawQuery.trim());

  return parts.join(" ").trim();
}

/** Quick-chip presets — keyword shortcuts. */
export const QUICK_CHIPS: Array<{ label: string; keywords: string }> = [
  { label: "Invoices", keywords: "{invoice bill payment}" },
  { label: "Jobs", keywords: "{job application hiring recruiter}" },
  { label: "Receipts", keywords: "{receipt order purchase}" },
  { label: "Interview", keywords: "{interview onsite \"phone screen\"}" },
  { label: "Bank", keywords: "{bank statement transaction account}" },
  { label: "University", keywords: "{university college admission student}" },
];
