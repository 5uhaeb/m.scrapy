export type DateRangePreset =
  | "today"
  | "yesterday"
  | "last_7_days"
  | "last_30_days"
  | "this_month"
  | "last_month"
  | "custom"
  | "any";

export interface SearchFilters {
  keywords?: string;
  from?: string;
  to?: string;
  subject?: string;
  label?: string;
  hasAttachment?: boolean;
  isRead?: boolean;      // true = only read
  isUnread?: boolean;    // true = only unread
  isStarred?: boolean;   // true = only starred
  datePreset?: DateRangePreset;
  customAfter?: string;  // ISO date string (YYYY-MM-DD)
  customBefore?: string; // ISO date string (YYYY-MM-DD)
  rawQuery?: string;     // advanced: raw Gmail query, merged with the above
  viewMode?: "messages" | "threads";
}

export interface ParsedMessage {
  id: string;
  threadId: string;
  historyId?: string;
  internalDate?: string;
  snippet: string;
  labelIds: string[];
  from: { name: string; email: string; raw: string };
  to: Array<{ name: string; email: string; raw: string }>;
  cc: Array<{ name: string; email: string; raw: string }>;
  subject: string;
  date: string;           // ISO
  hasAttachment: boolean;
  attachmentCount: number;
  isUnread: boolean;
  isStarred: boolean;
  gmailUrl: string;       // deep link into Gmail thread
}

export interface SearchResponse {
  messages: ParsedMessage[];
  nextPageToken?: string | null;
  resultSizeEstimate?: number;
  query: string;
  viewMode: "messages" | "threads";
}

export interface MessageDetail extends ParsedMessage {
  bodyHtml: string;  // sanitized
  bodyText: string;
  attachments: Array<{ filename: string; mimeType: string; size: number; attachmentId: string }>;
}

export interface DomainAggregate {
  domain: string;
  count: number;
}

export interface KeywordAggregate {
  keyword: string;
  count: number;
}
