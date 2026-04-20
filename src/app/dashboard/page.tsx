"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import type {
  DomainAggregate,
  ParsedMessage,
  SearchFilters,
  SearchResponse,
} from "@/types";
import SearchBar from "@/components/SearchBar";
import FilterPanel from "@/components/FilterPanel";
import ResultsTable from "@/components/ResultsTable";
import EmailPreview from "@/components/EmailPreview";
import SavedFilters from "@/components/SavedFilters";
import QuickChips from "@/components/QuickChips";
import Analytics from "@/components/Analytics";
import ExportButtons from "@/components/ExportButtons";
import Pagination from "@/components/Pagination";
import ThemeToggle from "@/components/ThemeToggle";

interface SearchAPIResponse extends SearchResponse {
  domains: DomainAggregate[];
}

const INITIAL_FILTERS: SearchFilters = {
  keywords: "",
  datePreset: "any",
  viewMode: "messages",
};

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [filters, setFilters] = useState<SearchFilters>(INITIAL_FILTERS);
  const [messages, setMessages] = useState<ParsedMessage[]>([]);
  const [domains, setDomains] = useState<DomainAggregate[]>([]);
  const [query, setQuery] = useState("");
  const [resultSize, setResultSize] = useState<number>(0);

  const [pageSize, setPageSize] = useState<number>(25);
  const [page, setPage] = useState<number>(1);
  // Stack of page tokens: tokenStack[i] is the token to fetch page i+1.
  // tokenStack[0] = undefined (page 1), tokenStack[1] = token from page-1 response, etc.
  const [tokenStack, setTokenStack] = useState<(string | undefined)[]>([undefined]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);

  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [selected, setSelected] = useState<ParsedMessage | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showRightPanel, setShowRightPanel] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedRefresh, setSavedRefresh] = useState(0);
  const [savedKeywords, setSavedKeywords] = useState<string[]>([]);

  // Redirect to login if unauthenticated.
  useEffect(() => {
    if (status === "unauthenticated") router.replace("/");
    if (session?.error === "RefreshAccessTokenError") {
      signOut({ callbackUrl: "/" });
    }
  }, [status, session, router]);

  // Load saved searches (for keyword analytics).
  useEffect(() => {
    fetch("/api/saved-searches")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: Array<{ filters: SearchFilters }>) => {
        const kws = rows
          .map((r) => r.filters?.keywords?.trim())
          .filter((k): k is string => !!k);
        setSavedKeywords(Array.from(new Set(kws)));
      })
      .catch(() => {});
  }, [savedRefresh]);

  const latestReq = useRef(0);

  const runSearchWith = useCallback(
    async (
      effectiveFilters: SearchFilters,
      effectivePageSize: number,
      opts?: { pageToken?: string; resetPage?: boolean; saveToHistory?: boolean }
    ) => {
      const { pageToken, resetPage, saveToHistory = true } = opts ?? {};
      const reqId = ++latestReq.current;
      setLoading(true);
      setError(null);
      try {
        const r = await fetch("/api/gmail/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filters: effectiveFilters,
            pageToken,
            pageSize: effectivePageSize,
            saveToHistory,
          }),
        });
        if (!r.ok) {
          const contentType = r.headers.get("content-type") ?? "";
          const detail = contentType.includes("application/json")
            ? (await r.json().catch(() => ({}))).error
            : await r.text().catch(() => "");
          throw new Error(
            `Search failed (${r.status})${detail ? `: ${detail}` : r.statusText ? `: ${r.statusText}` : ""}`
          );
        }
        const data: SearchAPIResponse = await r.json();
        if (reqId !== latestReq.current) return; // race: a newer request is in flight
        setMessages(data.messages);
        setDomains(data.domains);
        setNextPageToken(data.nextPageToken ?? null);
        setQuery(data.query);
        setResultSize(data.resultSizeEstimate ?? data.messages.length);
        if (resetPage) {
          setPage(1);
          setTokenStack([undefined]);
        }
        setSavedRefresh((n) => n + 1);
      } catch (e) {
        if (reqId !== latestReq.current) return;
        setError(String((e as Error).message || e));
      } finally {
        if (reqId === latestReq.current) setLoading(false);
      }
    },
    []
  );

  const runSearch = useCallback(
    (opts?: { pageToken?: string; resetPage?: boolean; saveToHistory?: boolean }) =>
      runSearchWith(filters, pageSize, opts),
    [filters, pageSize, runSearchWith]
  );

  // When filters or pageSize change from the UI, we do NOT auto-search. The user
  // explicitly submits via the search bar, chips, or presets. However, if the
  // user changes pageSize we reset pagination so a subsequent search starts fresh.
  useEffect(() => {
    setPage(1);
    setTokenStack([undefined]);
    setNextPageToken(null);
  }, [pageSize]);

  const onSubmitSearch = () => runSearch({ resetPage: true });

  const onNext = async () => {
    if (!nextPageToken) return;
    const newStack = [...tokenStack, nextPageToken];
    setTokenStack(newStack);
    setPage(page + 1);
    await runSearch({ pageToken: nextPageToken, saveToHistory: false });
  };

  const onPrev = async () => {
    if (page <= 1) return;
    const newStack = tokenStack.slice(0, -1);
    const token = newStack[newStack.length - 1];
    setTokenStack(newStack);
    setPage(page - 1);
    await runSearch({ pageToken: token, saveToHistory: false });
  };

  const applyFiltersAndSearch = (f: SearchFilters) => {
    const merged = { ...INITIAL_FILTERS, ...f };
    setFilters(merged);
    setPage(1);
    setTokenStack([undefined]);
    // Kick off a search with the new filters immediately.
    runSearchWith(merged, pageSize, { resetPage: true });
  };

  const currentKeywords = filters.keywords ?? "";
  const isEmpty = !loading && messages.length === 0;

  const signOutNow = () => signOut({ callbackUrl: "/" });

  const pageHint = useMemo(() => {
    if (!query.trim()) return "Run a search to see messages.";
    if (resultSize === 0) return "No matching messages.";
    return `About ${resultSize.toLocaleString()} estimated matches`;
  }, [query, resultSize]);

  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg text-ink">
        <p className="card-sm px-4 py-3 text-sm font-semibold text-ink-mute">Loading your session...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-bg text-ink">
      <header className="sticky top-0 z-20 border-b-cartoon-thin border-ink bg-bg">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-[8px] border-cartoon-thin border-ink bg-accent-red text-sm font-bold text-white shadow-cartoon-sm dark:text-bg">
              M
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold">MailBoard</div>
              <div className="max-w-[14rem] truncate text-[10px] font-semibold text-ink-mute">
                {session?.user?.email}
              </div>
            </div>
          </div>

          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setShowRightPanel((v) => !v)}
            className="btn hidden px-2.5 py-1.5 text-xs lg:inline-flex"
            title="Toggle side panel"
          >
            {showRightPanel ? "Hide panel" : "Show panel"}
          </button>
          <ThemeToggle />
          <button type="button" onClick={signOutNow} className="btn px-2.5 py-1.5 text-xs">
            Sign out
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-4">
          <section className="card space-y-4 p-4">
            <SearchBar
              value={currentKeywords}
              onChange={(v) => setFilters({ ...filters, keywords: v })}
              onSubmit={onSubmitSearch}
              onClear={() => setFilters({ ...filters, keywords: "" })}
              loading={loading}
            />

            <div className="flex flex-wrap items-center gap-3">
              <QuickChips
                activeKeyword={filters.keywords}
                onPick={(kw) => {
                  const nf = { ...filters, keywords: kw };
                  setFilters(nf);
                  runSearchWith(nf, pageSize, { resetPage: true });
                }}
              />
              <div className="ml-auto">
                <button type="button" onClick={() => setShowAdvanced((v) => !v)} className="chip">
                  {showAdvanced ? "Hide advanced filters" : "Show advanced filters"}
                </button>
              </div>
            </div>

            {showAdvanced && <FilterPanel filters={filters} onChange={setFilters} />}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t-cartoon-thin border-ink pt-2">
              <div className="panel max-w-full truncate px-3 py-2 text-xs text-ink-mute">
                <span className="font-mono font-semibold text-ink">q:</span>{" "}
                <span className="font-mono">{query || "(none)"}</span>
              </div>
              <ExportButtons filters={filters} disabled={!query.trim()} />
            </div>
          </section>

          {error && (
            <div className="card-sm border-accent-red bg-[#ffecec] p-3 text-sm font-semibold text-accent-red dark:bg-[#3a1f1f]">
              {error}
            </div>
          )}

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-xs font-medium text-ink-mute">
              <span>{pageHint}</span>
              <Pagination
                page={page}
                hasPrev={page > 1}
                hasNext={!!nextPageToken}
                onPrev={onPrev}
                onNext={onNext}
                pageSize={pageSize}
                onPageSizeChange={setPageSize}
                disabled={loading}
              />
            </div>

            <ResultsTable
              messages={messages}
              sortOrder={sortOrder}
              onSortChange={setSortOrder}
              onSelect={setSelected}
              selectedId={selected?.id}
              loading={loading}
            />

            {!isEmpty && messages.length > 0 && (
              <Pagination
                page={page}
                hasPrev={page > 1}
                hasNext={!!nextPageToken}
                onPrev={onPrev}
                onNext={onNext}
                pageSize={pageSize}
                onPageSizeChange={setPageSize}
                disabled={loading}
              />
            )}
          </section>
        </div>

        {showRightPanel && (
          <aside className="min-w-0 space-y-4">
            <SavedFilters
              currentFilters={filters}
              currentQuery={query}
              onApply={applyFiltersAndSearch}
              refreshToken={savedRefresh}
            />
            <Analytics messages={messages} domains={domains} savedKeywords={savedKeywords} />
          </aside>
        )}
      </div>

      <footer className="py-8 text-center text-xs text-ink-mute">
        MailBoard · read-only · your data stays in your account
      </footer>

      <EmailPreview message={selected} onClose={() => setSelected(null)} />
    </main>
  );
}
