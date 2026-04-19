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
  const [showAdvanced, setShowAdvanced] = useState(true);
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
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error ?? r.statusText);
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
    // Kick off a search with the *new* filters immediately — don't wait for
    // React to re-render, which would otherwise capture the stale closure.
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
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading your session…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Top nav */}
      <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-950/80 backdrop-blur border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold text-sm">G</div>
            <div className="leading-tight">
              <div className="text-sm font-semibold">Gmail Search Dashboard</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[14rem]">
                {session?.user?.email}
              </div>
            </div>
          </div>

          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setShowRightPanel((v) => !v)}
            className="hidden lg:inline-flex px-2.5 py-1.5 rounded-md text-xs font-medium border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800"
            title="Toggle side panel"
          >
            {showRightPanel ? "Hide panel" : "Show panel"}
          </button>
          <ThemeToggle />
          <button
            type="button"
            onClick={signOutNow}
            className="px-2.5 py-1.5 rounded-md text-xs font-medium border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-4 py-4 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
        {/* Main column */}
        <div className="space-y-4 min-w-0">
          <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
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
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                >
                  {showAdvanced ? "▾ Hide advanced filters" : "▸ Show advanced filters"}
                </button>
              </div>
            </div>

            {showAdvanced && (
              <FilterPanel filters={filters} onChange={setFilters} />
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate max-w-full">
                <span className="opacity-60">q:</span> {query || "(none)"}
              </div>
              <ExportButtons filters={filters} disabled={!query.trim()} />
            </div>
          </section>

          {error && (
            <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <section className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
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

        {/* Right panel */}
        {showRightPanel && (
          <aside className="space-y-4">
            <SavedFilters
              currentFilters={filters}
              currentQuery={query}
              onApply={applyFiltersAndSearch}
              refreshToken={savedRefresh}
            />
            <Analytics
              messages={messages}
              domains={domains}
              savedKeywords={savedKeywords}
            />
          </aside>
        )}
      </div>

      <EmailPreview message={selected} onClose={() => setSelected(null)} />
    </main>
  );
}
