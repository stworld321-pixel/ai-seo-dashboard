"use client";

import { useState } from "react";
import {
  Plus,
  Search,
  Sparkles,
  ExternalLink,
  Trash2,
  RefreshCw,
  Globe,
  Tag,
  ArrowUpRight,
  Loader2,
  TrendingUp,
} from "lucide-react";
import { Card, CardHeader } from "@/components/card";
import { DataTable } from "@/components/data-table";
import { MetricCard } from "@/components/metric-card";
import { formatNumber, formatPercent, formatPosition, shortenUrl } from "@/lib/format";
import { BAND_LABELS, positionBand } from "@/server/intelligence/intent";
import { AddKeywordModal } from "./add-keyword-modal";
import { KeywordSerpModal } from "./keyword-serp-modal";
import type { GoogleSerpData } from "@/server/services/google-serp";

export interface KeywordRow {
  id: string;
  query: string;
  intent: string;
  intentConfidence: number;
  isCustom?: boolean;
  tags?: string[];
  targetUrl?: string | null;
  targetPosition?: number | null;
  liveRank?: number | null;
  liveRankUrl?: string | null;
  lastCheckedAt?: Date | string | null;
  serpData?: GoogleSerpData | null;
  clicks28: number;
  impressions28: number;
  ctr28: number;
  position28: number | null;
  opportunityScore?: number;
  band: "top3" | "page1" | "page2" | "deep";
}

const INTENT_STYLES: Record<string, string> = {
  TRANSACTIONAL: "bg-[var(--color-success-bg)] text-[var(--color-success)]",
  COMMERCIAL: "bg-amber-50 text-amber-700",
  INFORMATIONAL: "bg-blue-50 text-blue-700",
  NAVIGATIONAL: "bg-[var(--color-surface-muted)] text-[var(--color-muted)]",
  LOCAL: "bg-purple-50 text-purple-700",
};

export function KeywordsClientView({
  websiteId,
  websiteUrl,
  initialKeywords,
}: {
  websiteId: string;
  websiteUrl: string;
  initialKeywords: KeywordRow[];
}) {
  const [keywords, setKeywords] = useState<KeywordRow[]>(initialKeywords);
  const [searchTerm, setSearchTerm] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "custom" | "gsc">("all");
  const [bandFilter, setBandFilter] = useState<string | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [serpModalKeyword, setSerpModalKeyword] = useState<KeywordRow | null>(null);

  const [checkingSerpId, setCheckingSerpId] = useState<string | null>(null);
  const [isBulkChecking, setIsBulkChecking] = useState(false);

  // Filtered rows
  const visible = keywords.filter((k) => {
    if (searchTerm && !k.query.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (sourceFilter === "custom" && !k.isCustom) return false;
    if (sourceFilter === "gsc" && k.isCustom) return false;
    if (bandFilter && k.band !== bandFilter) return false;
    return true;
  });

  const counts = {
    total: keywords.length,
    custom: keywords.filter((k) => k.isCustom).length,
    gsc: keywords.filter((k) => !k.isCustom).length,
    top3: keywords.filter((k) => k.band === "top3").length,
    page1: keywords.filter((k) => k.band === "page1").length,
    page2: keywords.filter((k) => k.band === "page2").length,
    deep: keywords.filter((k) => k.band === "deep").length,
  };

  async function reloadKeywords() {
    try {
      const res = await fetch(`/api/seo/keywords?websiteId=${websiteId}`);
      if (res.ok) {
        const json = await res.json();
        setKeywords(json.data ?? []);
      }
    } catch {
      // ignore
    }
  }

  async function handleCheckSerp(row: KeywordRow) {
    setCheckingSerpId(row.id);
    try {
      const res = await fetch("/api/seo/keywords/serp-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteId,
          keywordId: row.id,
          keyword: row.query,
        }),
      });
      const json = await res.json();
      if (res.ok && json.data) {
        setKeywords((prev) =>
          prev.map((k) =>
            k.id === row.id
              ? {
                  ...k,
                  liveRank: json.data.serp.rank,
                  liveRankUrl: json.data.serp.rankingUrl,
                  lastCheckedAt: json.data.serp.checkedAt,
                  serpData: json.data.serp,
                  band: positionBand(json.data.serp.rank ?? k.position28 ?? 999),
                }
              : k,
          ),
        );
        setSerpModalKeyword({
          ...row,
          liveRank: json.data.serp.rank,
          liveRankUrl: json.data.serp.rankingUrl,
          serpData: json.data.serp,
        });
      }
    } catch {
      // ignore
    } finally {
      setCheckingSerpId(null);
    }
  }

  async function handleBulkCheck() {
    setIsBulkChecking(true);
    for (const kw of keywords.slice(0, 5)) {
      try {
        await fetch("/api/seo/keywords/serp-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            websiteId,
            keywordId: kw.id,
            keyword: kw.query,
          }),
        });
      } catch {
        // ignore
      }
    }
    await reloadKeywords();
    setIsBulkChecking(false);
  }

  async function handleDeleteKeyword(id: string) {
    if (!confirm("Remove this keyword from tracking?")) return;
    try {
      const res = await fetch(`/api/seo/keywords/${id}`, { method: "DELETE" });
      if (res.ok) {
        setKeywords((prev) => prev.filter((k) => k.id !== id));
      }
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Metrics Cards */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Top 3 Positions" value={formatNumber(counts.top3)} deltaLabel="positions 1-3" />
        <MetricCard label="Page 1 (4-10)" value={formatNumber(counts.page1)} deltaLabel="high CTR potential" />
        <MetricCard label="Page 2 (11-20)" value={formatNumber(counts.page2)} deltaLabel="growth headroom" />
        <MetricCard
          label="Custom Tracked"
          value={formatNumber(counts.custom)}
          deltaLabel={`${counts.gsc} from GSC`}
          hint="monitored keywords"
        />
      </section>

      {/* Main Keywords Table Card */}
      <Card>
        <CardHeader
          title="Monitored & Custom Keywords"
          subtitle={`${visible.length} queries shown — Track live Google rankings, SERP intent, and competitor pages`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleBulkCheck}
                disabled={isBulkChecking}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)] disabled:opacity-50"
              >
                <RefreshCw size={13} className={isBulkChecking ? "animate-spin" : ""} />
                {isBulkChecking ? "Checking Google SERPs..." : "Bulk Rank Check"}
              </button>

              <button
                onClick={() => setIsAddModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3.5 py-1.5 text-xs font-semibold text-[var(--color-primary-fg)] hover:opacity-90 shadow-xs"
              >
                <Plus size={14} />
                Add Custom Keyword
              </button>
            </div>
          }
        />

        {/* Filter Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-5 py-3 bg-[var(--color-surface-muted)]/40 text-xs">
          {/* Source Tabs */}
          <div className="flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5">
            <button
              onClick={() => setSourceFilter("all")}
              className={`rounded px-2.5 py-1 font-medium transition-colors ${
                sourceFilter === "all"
                  ? "bg-[var(--color-primary)] text-[var(--color-primary-fg)]"
                  : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              }`}
            >
              All ({counts.total})
            </button>
            <button
              onClick={() => setSourceFilter("custom")}
              className={`rounded px-2.5 py-1 font-medium transition-colors ${
                sourceFilter === "custom"
                  ? "bg-[var(--color-primary)] text-[var(--color-primary-fg)]"
                  : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              }`}
            >
              Custom Tracked ({counts.custom})
            </button>
            <button
              onClick={() => setSourceFilter("gsc")}
              className={`rounded px-2.5 py-1 font-medium transition-colors ${
                sourceFilter === "gsc"
                  ? "bg-[var(--color-primary)] text-[var(--color-primary-fg)]"
                  : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              }`}
            >
              Search Console ({counts.gsc})
            </button>
          </div>

          {/* Position Band Sub-chips */}
          <div className="flex flex-wrap items-center gap-1">
            <button
              onClick={() => setBandFilter(null)}
              className={`rounded px-2 py-1 ${
                !bandFilter ? "bg-[var(--color-primary)]/20 text-[var(--color-primary)] font-semibold" : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              }`}
            >
              All Bands
            </button>
            {(["top3", "page1", "page2", "deep"] as const).map((b) => (
              <button
                key={b}
                onClick={() => setBandFilter(b)}
                className={`rounded px-2 py-1 ${
                  bandFilter === b ? "bg-[var(--color-primary)]/20 text-[var(--color-primary)] font-semibold" : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                }`}
              >
                {BAND_LABELS[b]}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[200px]">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter keywords..."
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] py-1.5 pl-8 pr-3 text-xs focus:border-[var(--color-primary)] focus:outline-hidden"
            />
          </div>
        </div>

        {/* Keywords Table */}
        <DataTable
          rows={visible}
          getKey={(r) => r.id}
          empty="No keywords found matching this filter."
          columns={[
            {
              key: "q",
              header: "Keyword & Tags",
              render: (r) => (
                <div className="space-y-1 max-w-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-xs text-[var(--color-foreground)]">{r.query}</span>
                    {r.isCustom && (
                      <span className="rounded bg-[var(--color-primary)]/10 px-1.5 py-0.2 text-[10px] font-semibold text-[var(--color-primary)]">
                        Custom
                      </span>
                    )}
                  </div>
                  {r.tags && r.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {r.tags.map((t, i) => (
                        <span key={i} className="rounded bg-[var(--color-surface-muted)] px-1.5 py-0.2 text-[9px] text-[var(--color-muted)]">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: "intent",
              header: "Intent",
              render: (r) => (
                <span
                  className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium capitalize ${
                    INTENT_STYLES[r.intent.toUpperCase()] ?? "bg-[var(--color-surface-muted)] text-[var(--color-muted)]"
                  }`}
                  title={`Intent confidence: ${(r.intentConfidence * 100).toFixed(0)}%`}
                >
                  {r.intent.toLowerCase()}
                </span>
              ),
            },
            {
              key: "liveRank",
              header: "Google Live Rank",
              align: "center",
              render: (r) => (
                <div className="flex items-center justify-center gap-1.5">
                  {r.liveRank ? (
                    <span
                      className={`font-semibold tabular ${
                        r.liveRank <= 3
                          ? "text-[var(--color-success)]"
                          : r.liveRank <= 10
                            ? "text-[var(--color-primary)]"
                            : "text-[var(--color-warning)]"
                      }`}
                    >
                      #{r.liveRank}
                    </span>
                  ) : (
                    <span className="text-[11px] text-[var(--color-muted)] italic">—</span>
                  )}
                  <button
                    onClick={() => handleCheckSerp(r)}
                    disabled={checkingSerpId === r.id}
                    className="rounded p-1 text-[var(--color-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-primary)] disabled:opacity-50"
                    title="Run live Google SERP check"
                  >
                    <RefreshCw size={11} className={checkingSerpId === r.id ? "animate-spin text-[var(--color-primary)]" : ""} />
                  </button>
                </div>
              ),
            },
            {
              key: "i",
              header: "GSC Impr.",
              align: "right",
              render: (r) => (r.impressions28 > 0 ? formatNumber(r.impressions28) : "—"),
            },
            {
              key: "c",
              header: "Clicks",
              align: "right",
              render: (r) => (r.clicks28 > 0 ? formatNumber(r.clicks28) : "—"),
            },
            {
              key: "t",
              header: "CTR",
              align: "right",
              render: (r) => (r.impressions28 > 0 ? formatPercent(r.ctr28) : "—"),
            },
            {
              key: "p",
              header: "GSC Pos.",
              align: "right",
              render: (r) =>
                r.position28 ? (
                  <span
                    className={
                      r.position28 <= 10
                        ? "font-semibold text-[var(--color-success)]"
                        : r.position28 <= 20
                          ? "text-[var(--color-warning)]"
                          : "text-[var(--color-muted)]"
                    }
                  >
                    {formatPosition(r.position28)}
                  </span>
                ) : (
                  "—"
                ),
            },
            {
              key: "actions",
              header: "Actions",
              align: "right",
              render: (r) => (
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={() => setSerpModalKeyword(r)}
                    className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[11px] font-medium text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)]"
                    title="View live Google SERP competitor data & People Also Ask"
                  >
                    <Search size={11} className="text-[var(--color-primary)]" />
                    SERP Data
                  </button>

                  <a
                    href={`/content/generator?keyword=${encodeURIComponent(r.query)}`}
                    className="inline-flex items-center gap-1 rounded border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10 px-2 py-1 text-[11px] font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20"
                    title="Generate AI article targeting this keyword"
                  >
                    <Sparkles size={11} />
                    Write
                  </a>

                  {r.isCustom && (
                    <button
                      onClick={() => handleDeleteKeyword(r.id)}
                      className="rounded p-1 text-[var(--color-muted)] hover:text-[var(--color-danger)]"
                      title="Untrack keyword"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* Add Keyword Modal */}
      {isAddModalOpen && (
        <AddKeywordModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onKeywordsAdded={reloadKeywords}
        />
      )}

      {/* Google SERP Details Modal */}
      {serpModalKeyword && (
        <KeywordSerpModal
          keyword={serpModalKeyword.query}
          websiteId={websiteId}
          initialSerp={serpModalKeyword.serpData}
          isOpen={Boolean(serpModalKeyword)}
          onClose={() => setSerpModalKeyword(null)}
        />
      )}
    </div>
  );
}
