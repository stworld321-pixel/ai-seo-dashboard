"use client";

import { useState } from "react";
import {
  Radar,
  Send,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { shortenUrl } from "@/lib/format";
import type { IndexCandidate, IndexStatus } from "@/server/integrations/google/indexing";

type Row = IndexCandidate & { status?: IndexStatus; submission?: { ok: boolean; error?: string } };

/** URL Inspection allows 2,000 checks/day; we check a page at a time, 20 per click. */
const INSPECT_BATCH = 20;

export function IndexingPanel({
  websiteId,
  candidates,
}: {
  websiteId: string;
  candidates: IndexCandidate[];
}) {
  const [rows, setRows] = useState<Row[]>(candidates.map((c) => ({ ...c })));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  if (rows.length === 0) return null;

  function toggle(url: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }

  async function checkStatus() {
    if (checking) return;
    setChecking(true);
    setNotice(null);
    try {
      const batch = rows.slice(0, INSPECT_BATCH).map((r) => r.url);
      const params = new URLSearchParams({ website: websiteId });
      for (const url of batch) params.append("url", url);

      const res = await fetch(`/api/indexing?${params}`);
      const json = (await res.json()) as
        | { data: { results: IndexStatus[] } }
        | { error: { message: string } };

      if ("error" in json) {
        setNotice({ kind: "error", text: json.error.message });
        return;
      }

      const byUrl = new Map(json.data.results.map((r) => [r.url, r]));
      setRows((prev) => prev.map((r) => (byUrl.has(r.url) ? { ...r, status: byUrl.get(r.url) } : r)));

      // Pre-select everything Google says is not indexed — that is the actionable set.
      setSelected(new Set(json.data.results.filter((r) => !r.indexed).map((r) => r.url)));

      const notIndexed = json.data.results.filter((r) => !r.indexed).length;
      setNotice({
        kind: "ok",
        text: `Checked ${json.data.results.length} URL(s): ${notIndexed} not indexed.`,
      });
    } catch (err) {
      setNotice({ kind: "error", text: err instanceof Error ? err.message : "Status check failed." });
    } finally {
      setChecking(false);
    }
  }

  async function submitSelected() {
    if (submitting || selected.size === 0) return;
    setSubmitting(true);
    setNotice(null);
    try {
      const res = await fetch("/api/indexing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ websiteId, urls: [...selected] }),
      });
      const json = (await res.json()) as
        | { data: { results: Array<{ url: string; ok: boolean; error?: string }> }; message: string }
        | { error: { message: string } };

      if ("error" in json) {
        setNotice({ kind: "error", text: json.error.message });
        return;
      }

      const byUrl = new Map(json.data.results.map((r) => [r.url, r]));
      setRows((prev) =>
        prev.map((r) => (byUrl.has(r.url) ? { ...r, submission: byUrl.get(r.url) } : r)),
      );

      const firstError = json.data.results.find((r) => !r.ok)?.error;
      setNotice({
        kind: firstError ? "error" : "ok",
        text: firstError ? `${json.message} ${firstError}` : json.message,
      });
    } catch (err) {
      setNotice({ kind: "error", text: err instanceof Error ? err.message : "Submission failed." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs overflow-hidden">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface-muted)]/40 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold tracking-tight text-[var(--color-foreground)]">
              Google Indexing
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-primary)]/10 px-2 py-0.5 text-[11px] font-semibold text-[var(--color-primary)]">
              <Radar className="h-3 w-3" /> {rows.length} URLs tracked
            </span>
          </div>
          <p className="mt-0.5 text-xs text-[var(--color-muted)]">
            Live coverage from the Search Console URL Inspection API. Pick the URLs Google has missed
            and submit them for crawling.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={checkStatus}
            disabled={checking}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)] transition-colors disabled:opacity-50"
          >
            {checking ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Radar className="h-3.5 w-3.5 text-[var(--color-primary)]" />
            )}
            {checking ? "Checking..." : "Check Index Status"}
          </button>

          <button
            type="button"
            onClick={submitSelected}
            disabled={submitting || selected.size === 0}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-primary)] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {submitting ? "Submitting..." : `Request Indexing${selected.size ? ` (${selected.size})` : ""}`}
          </button>
        </div>
      </div>

      {notice && (
        <div
          className={`px-5 py-3 text-xs font-medium leading-relaxed ${
            notice.kind === "ok"
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "bg-amber-500/10 text-amber-800 dark:text-amber-200"
          }`}
        >
          {renderNoticeWithLinks(notice.text)}
        </div>
      )}

      <ul className="divide-y divide-[var(--color-border)]">
        {rows.map((row) => (
          <li key={row.url} className="flex items-start gap-3 px-5 py-3">
            <input
              type="checkbox"
              checked={selected.has(row.url)}
              onChange={() => toggle(row.url)}
              aria-label={`Select ${row.url} for indexing`}
              className="mt-1 h-3.5 w-3.5 shrink-0 accent-[var(--color-primary)]"
            />

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <a
                  href={row.url}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-xs font-medium text-[var(--color-foreground)] hover:underline"
                >
                  {shortenUrl(row.url)}
                </a>
                <ExternalLink className="h-3 w-3 shrink-0 opacity-40" />
              </div>

              <p className="mt-0.5 truncate text-[11px] text-[var(--color-muted)]">
                {row.status?.issue ?? row.status?.coverageState ?? describeUnchecked(row)}
                {row.submission &&
                  (row.submission.ok
                    ? " · Submitted to Google."
                    : ` · Submission failed: ${row.submission.error}`)}
              </p>
            </div>

            <StatusPill row={row} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * What to say about a URL we have not inspected this session. A stored indexState of
 * "PASS" is not evidence — the crawler and the WordPress sync hardcode it without ever
 * asking Google — so only a real cached coverage string is worth showing.
 */
function describeUnchecked(row: Row): string {
  if (row.indexState && row.indexState !== "PASS") return row.indexState;
  if (row.source === "crawl") return "Crawled by us, never reported by Search Console.";
  return "Not checked yet.";
}

function StatusPill({ row }: { row: Row }) {
  const base = "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold";

  if (!row.status) {
    return (
      <span className={`${base} bg-[var(--color-surface-muted)] text-[var(--color-muted)]`}>
        <HelpCircle className="h-3 w-3" />
        {row.hasPageIssue ? "Page issue" : "Unknown"}
      </span>
    );
  }

  if (row.status.indexed) {
    return (
      <span className={`${base} bg-emerald-500/10 text-emerald-600 dark:text-emerald-400`}>
        <CheckCircle2 className="h-3 w-3" /> Indexed
      </span>
    );
  }

  return (
    <span className={`${base} bg-amber-500/10 text-amber-600 dark:text-amber-400`}>
      <AlertTriangle className="h-3 w-3" /> Not indexed
    </span>
  );
}

function renderNoticeWithLinks(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (urlRegex.test(part)) {
      const cleanUrl = part.replace(/[.,;)]+$/, "");
      const trailing = part.slice(cleanUrl.length);
      return (
        <span key={i}>
          <a
            href={cleanUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-semibold hover:opacity-80 inline-flex items-center gap-0.5 break-all text-blue-600 dark:text-blue-400"
          >
            {cleanUrl}
            <ExternalLink className="h-3 w-3 inline shrink-0 ml-0.5" />
          </a>
          {trailing}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

