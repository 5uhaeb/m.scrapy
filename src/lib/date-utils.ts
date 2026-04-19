import type { DateRangePreset } from "@/types";

/** Format a Date as YYYY/MM/DD for Gmail's after:/before: operators. */
export function gmailDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

/**
 * Convert a preset + optional custom range to Gmail operator fragments.
 * Returns an array of tokens to join with spaces, e.g. ["newer_than:7d"]
 * or ["after:2024/01/01", "before:2024/02/01"].
 */
export function datePresetToOperators(
  preset: DateRangePreset | undefined,
  customAfter?: string,
  customBefore?: string
): string[] {
  if (!preset || preset === "any") return [];

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case "today": {
      const tomorrow = new Date(startOfToday);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return [`after:${gmailDateStr(startOfToday)}`, `before:${gmailDateStr(tomorrow)}`];
    }
    case "yesterday": {
      const y = new Date(startOfToday);
      y.setDate(y.getDate() - 1);
      return [`after:${gmailDateStr(y)}`, `before:${gmailDateStr(startOfToday)}`];
    }
    case "last_7_days":
      return ["newer_than:7d"];
    case "last_30_days":
      return ["newer_than:30d"];
    case "this_month": {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return [`after:${gmailDateStr(first)}`, `before:${gmailDateStr(nextMonth)}`];
    }
    case "last_month": {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const thisFirst = new Date(now.getFullYear(), now.getMonth(), 1);
      return [`after:${gmailDateStr(first)}`, `before:${gmailDateStr(thisFirst)}`];
    }
    case "custom": {
      const parts: string[] = [];
      if (customAfter) {
        const d = new Date(customAfter);
        if (!isNaN(d.getTime())) parts.push(`after:${gmailDateStr(d)}`);
      }
      if (customBefore) {
        const d = new Date(customBefore);
        if (!isNaN(d.getTime())) {
          // Gmail "before:" is exclusive of that day — add one day to make the
          // range user-intuitive (inclusive of the end date).
          d.setDate(d.getDate() + 1);
          parts.push(`before:${gmailDateStr(d)}`);
        }
      }
      return parts;
    }
    default:
      return [];
  }
}

export function formatDateShort(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameYear = d.getFullYear() === now.getFullYear();
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      ...(sameYear ? {} : { year: "numeric" }),
    });
  } catch {
    return iso;
  }
}
