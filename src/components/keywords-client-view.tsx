"use client";

import { useState, useEffect } from "react";
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
  Layers,
  HelpCircle,
  Bot,
  Lightbulb,
  FileText,
  CheckCircle2,
  ChevronRight,
  Check,
  X,
  XCircle,
  RotateCcw,
  AlertTriangle,
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
  clusterId?: string | null;
  bestPage?: string | null;
}

export type ClusterViewItem = {
  cluster_id: string;
  name: string;
  primary_keyword: string;
  secondary_keywords: string[];
  total_volume: number;
  avg_difficulty: number;
  mapped_url: string | null;
};

export type AiPromptViewItem = {
  id?: string;
  prompt: string;
  type: string;
  answer_format?: string;
};

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
  const [activeTab, setActiveTab] = useState<"opportunities" | "clusters" | "by_page" | "questions" | "geo_prompts" | "content_ideas" | "cannibalization">("opportunities");
  const [searchTerm, setSearchTerm] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "custom" | "gsc">("all");
  const [statusFilter, setStatusFilter] = useState<"active" | "done" | "dismissed" | "all">("active");
  const [bandFilter, setBandFilter] = useState<string | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [serpModalKeyword, setSerpModalKeyword] = useState<KeywordRow | null>(null);

  const [checkingSerpId, setCheckingSerpId] = useState<string | null>(null);
  const [isBulkChecking, setIsBulkChecking] = useState(false);
  const [isRunningFullResearch, setIsRunningFullResearch] = useState(false);
  const [researchSuccessMsg, setResearchSuccessMsg] = useState<string | null>(null);

  // Position delta tracking (Δpos)
  const [positionDeltas, setPositionDeltas] = useState<Record<string, { currentPosition: number; previousPosition: number | null; delta: number | null }>>({});

  // Cannibalization analysis
  const [cannibalizationData, setCannibalizationData] = useState<Array<{
    query: string;
    pages: Array<{ url: string; impressions: number; clicks: number; position: number; share: number }>;
    totalImpressions: number;
  }>>([]);
  const [loadingCannib, setLoadingCannib] = useState(false);

  // Load position deltas on mount
  useEffect(() => {
    fetch(`/api/seo/keywords/position-delta?websiteId=${websiteId}`)
      .then((res) => res.json())
      .then((json) => { if (json.data) setPositionDeltas(json.data); })
      .catch(() => {});
  }, [websiteId]);

  const isKwDone = (k: KeywordRow) => (k.tags || []).includes("status:done");
  const isKwDismissed = (k: KeywordRow) => (k.tags || []).includes("status:dismissed");

  async function handleKeywordStatus(row: KeywordRow, newStatus: "active" | "done" | "dismissed") {
    try {
      const res = await fetch("/api/seo/keywords/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteId,
          keywordId: row.id,
          query: row.query,
          status: newStatus,
        }),
      });
      const json = await res.json();
      if (res.ok && json.data) {
        const updatedTags = (json.data.tags as string[]) || [];
        setKeywords((prev) =>
          prev.map((k) =>
            k.query.toLowerCase() === row.query.toLowerCase()
              ? { ...k, tags: updatedTags }
              : k,
          ),
        );
      }
    } catch (err) {
      console.error("Failed to update keyword status", err);
    }
  }

  // Derived filtered rows
  const visible = keywords.filter((k) => {
    if (searchTerm && !k.query.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (sourceFilter === "custom" && !k.isCustom) return false;
    if (sourceFilter === "gsc" && k.isCustom) return false;
    if (bandFilter && k.band !== bandFilter) return false;

    const done = isKwDone(k);
    const dismissed = isKwDismissed(k);

    if (statusFilter === "active" && (done || dismissed)) return false;
    if (statusFilter === "done" && !done) return false;
    if (statusFilter === "dismissed" && !dismissed) return false;

    return true;
  });

  const counts = {
    total: keywords.length,
    active: keywords.filter((k) => !isKwDone(k) && !isKwDismissed(k)).length,
    done: keywords.filter((k) => isKwDone(k)).length,
    dismissed: keywords.filter((k) => isKwDismissed(k)).length,
    custom: keywords.filter((k) => k.isCustom).length,
    gsc: keywords.filter((k) => !k.isCustom).length,
    top3: keywords.filter((k) => k.band === "top3").length,
    page1: keywords.filter((k) => k.band === "page1").length,
    page2: keywords.filter((k) => k.band === "page2").length,
    deep: keywords.filter((k) => k.band === "deep").length,
  };

  // Derived Views for Tabs
  const questionKeywords = keywords.filter((k) => {
    const q = k.query.toLowerCase();
    return (
      q.startsWith("how") ||
      q.startsWith("what") ||
      q.startsWith("why") ||
      q.startsWith("which") ||
      q.startsWith("is") ||
      q.includes(" vs ") ||
      q.includes("price") ||
      q.includes("cost") ||
      q.includes("?")
    );
  });

  const contentIdeaKeywords = keywords.filter((k) => {
    const intent = (k.intent || "").toUpperCase();
    return intent === "INFORMATIONAL" || intent === "COMMERCIAL" || k.query.split(" ").length >= 4;
  });

  // Group by page URL
  const pageGroupsMap = new Map<string, KeywordRow[]>();
  for (const k of keywords) {
    const pUrl = k.bestPage || k.targetUrl || "Unassigned / New Page";
    if (!pageGroupsMap.has(pUrl)) pageGroupsMap.set(pUrl, []);
    pageGroupsMap.get(pUrl)!.push(k);
  }

  // Derive Topic Clusters from keywords
  const clusterGroupsMap = new Map<string, KeywordRow[]>();
  for (const k of keywords) {
    const headWord = k.clusterId || k.tags?.[0] || k.query.split(" ").slice(0, 2).join(" ");
    if (!clusterGroupsMap.has(headWord)) clusterGroupsMap.set(headWord, []);
    clusterGroupsMap.get(headWord)!.push(k);
  }

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

  async function loadCannibalization() {
    setLoadingCannib(true);
    try {
      const res = await fetch(`/api/seo/keywords/cannibalization?websiteId=${websiteId}`);
      if (res.ok) {
        const json = await res.json();
        setCannibalizationData(json.data ?? []);
      }
    } catch { /* ignore */ }
    finally { setLoadingCannib(false); }
  }

  const cannibalizationCount = cannibalizationData.length;

  async function handleRunFullResearch() {
    setIsRunningFullResearch(true);
    setResearchSuccessMsg(null);
    try {
      const res = await fetch("/api/seo/keywords/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId }),
      });
      const json = await res.json();
      if (res.ok && json.data) {
        setResearchSuccessMsg(
          `Generated ${json.data.keywords?.length ?? 0} authentic search keywords & ${json.data.ai_prompts?.length ?? 0} AI prompts across ${json.data.clusters?.length ?? 0} clusters!`,
        );
        await reloadKeywords();
        setTimeout(() => setResearchSuccessMsg(null), 6000);
      }
    } catch {
      // non-fatal
    } finally {
      setIsRunningFullResearch(false);
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
          label="Tracked Keywords"
          value={formatNumber(counts.total)}
          deltaLabel={`${counts.custom} AI generated / custom`}
          hint="real search queries"
        />
      </section>

      {/* Success Notification */}
      {researchSuccessMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-[var(--color-success)]/30 bg-[var(--color-success-bg)] p-3 text-xs font-medium text-[var(--color-success)]">
          <CheckCircle2 size={16} />
          <span>{researchSuccessMsg}</span>
        </div>
      )}

      {/* Main Tabs Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] pb-2">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {[
            { id: "opportunities", label: "Opportunities (Top Scored)", icon: TrendingUp, count: keywords.length },
            { id: "clusters", label: "Topic Clusters", icon: Layers, count: clusterGroupsMap.size },
            { id: "by_page", label: "By Page", icon: FileText, count: pageGroupsMap.size },
            { id: "questions", label: "Questions & PAA", icon: HelpCircle, count: questionKeywords.length },
            { id: "geo_prompts", label: "AI Prompts (GEO)", icon: Bot, count: 8 },
            { id: "content_ideas", label: "Content Ideas", icon: Lightbulb, count: contentIdeaKeywords.length },
            { id: "cannibalization", label: "Cannibalization", icon: AlertTriangle, count: cannibalizationCount },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 font-medium transition-all ${
                  isActive
                    ? "bg-[var(--color-primary)] text-[var(--color-primary-fg)] shadow-xs"
                    : "text-[var(--color-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-foreground)]"
                }`}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
                <span className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] ${isActive ? "bg-white/20 text-white" : "bg-[var(--color-surface-muted)] text-[var(--color-muted)]"}`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleRunFullResearch}
            disabled={isRunningFullResearch}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3.5 py-1.5 text-xs font-semibold text-[var(--color-primary-fg)] hover:opacity-90 shadow-xs disabled:opacity-50"
            title="Crawl website, build AI Business Profile, and generate real search queries & AI prompts"
          >
            {isRunningFullResearch ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Researching Real Keywords...
              </>
            ) : (
              <>
                <Sparkles size={14} />
                Run Keyword Research (AI + Real Search)
              </>
            )}
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)]"
          >
            <Plus size={14} />
            Add Custom
          </button>
        </div>
      </div>

      {/* TAB 1: OPPORTUNITIES (TOP SCORED) */}
      {activeTab === "opportunities" && (
        <Card>
          <CardHeader
            title="Search Query Opportunities"
            subtitle={`${visible.length} queries shown — Real customer search intent, opportunity scoring, and live Google SERP rankings`}
            action={
              <button
                onClick={handleBulkCheck}
                disabled={isBulkChecking}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)] disabled:opacity-50"
              >
                <RefreshCw size={13} className={isBulkChecking ? "animate-spin" : ""} />
                {isBulkChecking ? "Checking Google SERPs..." : "Bulk Rank Check"}
              </button>
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
                AI & Custom ({counts.custom})
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

            {/* Status Filter */}
            <div className="flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5">
              <button
                onClick={() => setStatusFilter("active")}
                className={`rounded px-2.5 py-1 font-medium transition-colors ${
                  statusFilter === "active"
                    ? "bg-[var(--color-primary)] text-[var(--color-primary-fg)] font-semibold"
                    : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                }`}
              >
                Active ({counts.active})
              </button>
              <button
                onClick={() => setStatusFilter("done")}
                className={`rounded px-2.5 py-1 font-medium transition-colors ${
                  statusFilter === "done"
                    ? "bg-emerald-600 text-white font-semibold"
                    : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                }`}
              >
                Done ({counts.done})
              </button>
              <button
                onClick={() => setStatusFilter("dismissed")}
                className={`rounded px-2.5 py-1 font-medium transition-colors ${
                  statusFilter === "dismissed"
                    ? "bg-gray-600 text-white font-semibold"
                    : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                }`}
              >
                Dismissed ({counts.dismissed})
              </button>
              <button
                onClick={() => setStatusFilter("all")}
                className={`rounded px-2.5 py-1 font-medium transition-colors ${
                  statusFilter === "all"
                    ? "bg-[var(--color-surface-muted)] text-[var(--color-foreground)] font-semibold"
                    : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                }`}
              >
                All
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
                placeholder="Filter search queries..."
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] py-1.5 pl-8 pr-3 text-xs focus:border-[var(--color-primary)] focus:outline-hidden"
              />
            </div>
          </div>

          {/* Keywords Table */}
          <DataTable
            rows={visible}
            getKey={(r) => r.id}
            empty="No keywords found. Click 'Run Keyword Research' above to generate real queries for your site."
            columns={[
              {
                key: "score",
                header: "Opp. Score",
                align: "center",
                render: (r) => (
                  <span className="inline-flex items-center rounded-full bg-[var(--color-primary)]/10 px-2 py-0.5 font-bold text-xs text-[var(--color-primary)]">
                    {r.opportunityScore ?? 75}
                  </span>
                ),
              },
              {
                key: "q",
                header: "Search Query",
                render: (r) => (
                  <div className="space-y-1 max-w-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-xs text-[var(--color-foreground)]">{r.query}</span>
                      {r.isCustom && (
                        <span className="rounded bg-[var(--color-primary)]/10 px-1.5 py-0.2 text-[9px] font-semibold text-[var(--color-primary)]">
                          Verified
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
                  >
                    {r.intent.toLowerCase()}
                  </span>
                ),
              },
              {
                key: "liveRank",
                header: "Live Rank",
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
                key: "delta",
                header: "Δ Position",
                align: "center",
                render: (r) => {
                  const d = positionDeltas[r.query];
                  if (!d || d.delta == null) return <span className="text-[10px] text-[var(--color-muted)] italic">—</span>;
                  const improved = d.delta > 0;
                  const declined = d.delta < 0;
                  return (
                    <span className={`inline-flex items-center gap-0.5 font-semibold text-xs tabular ${
                      improved ? "text-[var(--color-success)]" : declined ? "text-[var(--color-danger)]" : "text-[var(--color-muted)]"
                    }`}>
                      {improved ? "↑" : declined ? "↓" : "→"}
                      {Math.abs(d.delta)}
                    </span>
                  );
                },
              },
              {
                key: "i",
                header: "Volume / GSC",
                align: "right",
                render: (r) => (r.impressions28 > 0 ? formatNumber(r.impressions28) : <span className="text-[10px] text-[var(--color-muted)]">Low / no data</span>),
              },
              {
                key: "actions",
                header: "Actions",
                align: "right",
                render: (r) => {
                  const done = isKwDone(r);
                  const dismissed = isKwDismissed(r);

                  return (
                    <div className="flex items-center justify-end gap-1">
                      {done && (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 size={11} /> Done
                        </span>
                      )}
                      {dismissed && (
                        <span className="inline-flex items-center gap-1 rounded bg-gray-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">
                          <X size={11} /> Dismissed
                        </span>
                      )}

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

                      {!done ? (
                        <button
                          type="button"
                          onClick={() => handleKeywordStatus(r, "done")}
                          className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                          title="Mark keyword as Done / Content Published"
                        >
                          <Check size={11} />
                          Done
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleKeywordStatus(r, "active")}
                          className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[11px] font-medium text-[var(--color-muted)] hover:text-[var(--color-foreground)] transition-colors"
                          title="Reopen keyword"
                        >
                          <RotateCcw size={11} />
                          Reopen
                        </button>
                      )}

                      {!dismissed ? (
                        <button
                          type="button"
                          onClick={() => handleKeywordStatus(r, "dismissed")}
                          className="inline-flex items-center gap-1 rounded border border-gray-500/20 bg-gray-500/5 px-2 py-1 text-[11px] font-medium text-gray-500 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                          title="Dismiss keyword"
                        >
                          <X size={11} />
                          Dismiss
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleKeywordStatus(r, "active")}
                          className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[11px] font-medium text-[var(--color-muted)] hover:text-[var(--color-foreground)] transition-colors"
                          title="Restore keyword"
                        >
                          <RotateCcw size={11} />
                          Restore
                        </button>
                      )}

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
                  );
                },
              },
            ]}
          />
        </Card>
      )}

      {/* TAB 2: TOPIC CLUSTERS */}
      {activeTab === "clusters" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from(clusterGroupsMap.entries()).map(([clusterName, clusterKws], idx) => {
            const primaryKw = clusterKws[0]?.query || clusterName;
            return (
              <Card key={idx} className="flex flex-col justify-between p-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="rounded bg-[var(--color-primary)]/10 px-2 py-0.5 text-[11px] font-bold text-[var(--color-primary)] uppercase">
                      Cluster {idx + 1}
                    </span>
                    <span className="text-xs text-[var(--color-muted)]">{clusterKws.length} queries</span>
                  </div>
                  <h3 className="font-semibold text-sm capitalize">{clusterName.replace(/[-_]/g, " ")}</h3>
                  <p className="text-xs text-[var(--color-muted)]">
                    <strong className="text-[var(--color-foreground)]">Primary Target:</strong> {primaryKw}
                  </p>
                  <div className="space-y-1 pt-2">
                    <div className="text-[11px] font-medium text-[var(--color-muted)]">Secondary Keywords:</div>
                    <div className="flex flex-wrap gap-1">
                      {clusterKws.slice(1, 6).map((k, ki) => (
                        <span key={ki} className="rounded border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-1.5 py-0.5 text-[10px]">
                          {k.query}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-[var(--color-border)] pt-3">
                  <a
                    href={`/content/generator?keyword=${encodeURIComponent(primaryKw)}`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-primary)] hover:underline"
                  >
                    <Sparkles size={12} />
                    Create Pillar Article
                  </a>
                  <ChevronRight size={14} className="text-[var(--color-muted)]" />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* TAB 3: BY PAGE */}
      {activeTab === "by_page" && (
        <div className="space-y-4">
          {Array.from(pageGroupsMap.entries()).map(([pUrl, pKws], idx) => (
            <Card key={idx}>
              <CardHeader
                title={pUrl.startsWith("http") ? shortenUrl(pUrl) : pUrl}
                subtitle={`${pKws.length} search queries mapped to this page URL`}
                action={
                  pUrl.startsWith("http") ? (
                    <a
                      href={pUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-[var(--color-info)] hover:underline"
                    >
                      <ExternalLink size={12} />
                      View Page
                    </a>
                  ) : null
                }
              />
              <div className="px-5 pb-4">
                <div className="flex flex-wrap gap-2">
                  {pKws.map((k, ki) => (
                    <div key={ki} className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)]/50 px-2.5 py-1 text-xs">
                      <span className="font-medium text-[var(--color-foreground)]">{k.query}</span>
                      <span className="rounded bg-[var(--color-primary)]/10 px-1.5 py-0.2 text-[9px] font-bold text-[var(--color-primary)]">
                        {k.opportunityScore ?? 75}
                      </span>
                      <a
                        href={`/content/generator?keyword=${encodeURIComponent(k.query)}`}
                        className="text-[var(--color-primary)] hover:opacity-75"
                        title="Draft content"
                      >
                        <Sparkles size={11} />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* TAB 4: QUESTIONS & PAA */}
      {activeTab === "questions" && (
        <Card>
          <CardHeader
            title="People Also Ask & Informational Questions"
            subtitle={`${questionKeywords.length} question-based search queries found across Google SERP and search suggestions`}
          />
          <DataTable
            rows={questionKeywords}
            getKey={(r) => r.id}
            empty="No question queries found yet."
            columns={[
              {
                key: "q",
                header: "Question Query",
                render: (r) => (
                  <div className="font-semibold text-xs text-[var(--color-foreground)]">
                    {r.query}
                  </div>
                ),
              },
              {
                key: "intent",
                header: "Intent",
                render: (r) => (
                  <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-700">
                    Informational Question
                  </span>
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
                      className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[11px] font-medium"
                    >
                      <Search size={11} className="text-[var(--color-primary)]" />
                      View Answers
                    </button>
                    <a
                      href={`/content/generator?keyword=${encodeURIComponent(r.query)}`}
                      className="inline-flex items-center gap-1 rounded bg-[var(--color-primary)]/10 px-2 py-1 text-[11px] font-semibold text-[var(--color-primary)]"
                    >
                      <Sparkles size={11} />
                      Write FAQ / Post
                    </a>
                  </div>
                ),
              },
            ]}
          />
        </Card>
      )}

      {/* TAB 5: AI PROMPTS (GEO / AEO) */}
      {activeTab === "geo_prompts" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-4 text-xs text-purple-900">
            <div className="flex items-center gap-2 font-semibold text-sm">
              <Bot size={16} className="text-purple-700" />
              Generative Engine Optimization (GEO) & AEO Prompts
            </div>
            <p className="mt-1 text-purple-700">
              These are natural-language conversational queries that real users type into ChatGPT, Gemini, Perplexity, and Google AI Overviews where your business should be cited and recommended.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {[
              { prompt: `Which is the best ${keywords[0]?.query || "provider"} in Chennai for quality and value?`, type: "Recommendation", format: "List" },
              { prompt: `How does our service compare with other local options in quality and pricing?`, type: "Comparison", format: "Table" },
              { prompt: `What is the typical price range and service packages for ${keywords[1]?.query || "treatment"}?`, type: "Pricing", format: "Short Answer" },
              { prompt: `How to choose the right expert service for specific needs and requirements?`, type: "How-To Guide", format: "Step-by-Step" },
              { prompt: `Top rated ${keywords[2]?.query || "services"} near me with customer reviews and ratings`, type: "Local Discovery", format: "List" },
              { prompt: `What are the key benefits and advantages of choosing professional ${keywords[0]?.query || "services"}?`, type: "Problem Solving", format: "List" },
            ].map((p, i) => (
              <Card key={i} className="p-4 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="rounded bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800">
                      {p.type}
                    </span>
                    <span className="text-[10px] text-[var(--color-muted)]">Format: {p.format}</span>
                  </div>
                  <p className="font-medium text-xs text-[var(--color-foreground)]">
                    &ldquo;{p.prompt}&rdquo;
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-[var(--color-border)] pt-2">
                  <a
                    href={`/ai-visibility/prompts`}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-primary)] hover:underline"
                  >
                    <Bot size={11} />
                    Track in AI Visibility
                  </a>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: CONTENT IDEAS */}
      {activeTab === "content_ideas" && (
        <Card>
          <CardHeader
            title="High-Impact Content & Blog Ideas"
            subtitle={`${contentIdeaKeywords.length} educational & comparison topics to expand organic topical authority`}
          />
          <DataTable
            rows={contentIdeaKeywords}
            getKey={(r) => r.id}
            empty="No content ideas found."
            columns={[
              {
                key: "q",
                header: "Suggested Article Topic",
                render: (r) => (
                  <div className="space-y-0.5">
                    <div className="font-semibold text-xs text-[var(--color-foreground)] capitalize">
                      {r.query}
                    </div>
                    <div className="text-[10px] text-[var(--color-muted)]">
                      Target Funnel: {r.tags?.[0] || "TOFU / Educational"}
                    </div>
                  </div>
                ),
              },
              {
                key: "score",
                header: "Opp. Score",
                align: "center",
                render: (r) => (
                  <span className="rounded bg-[var(--color-primary)]/10 px-2 py-0.5 text-xs font-bold text-[var(--color-primary)]">
                    {r.opportunityScore ?? 75}
                  </span>
                ),
              },
              {
                key: "actions",
                header: "Actions",
                align: "right",
                render: (r) => (
                  <a
                    href={`/content/generator?keyword=${encodeURIComponent(r.query)}`}
                    className="inline-flex items-center gap-1.5 rounded bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--color-primary-fg)] hover:opacity-90 shadow-xs"
                  >
                    <Sparkles size={12} />
                    Write Article
                  </a>
                ),
              },
            ]}
          />
        </Card>
      )}

      {/* TAB 7: CANNIBALIZATION CONFLICTS */}
      {activeTab === "cannibalization" && (
        <div className="space-y-4">
          {/* Warning banner */}
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 text-xs text-amber-900">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <AlertTriangle size={16} className="text-amber-600" />
                Keyword Cannibalization Conflicts
              </div>
              <button
                onClick={loadCannibalization}
                disabled={loadingCannib}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50 transition-colors shadow-xs"
              >
                <RefreshCw size={13} className={loadingCannib ? "animate-spin" : ""} />
                {loadingCannib ? "Analyzing..." : "Analyze Cannibalization"}
              </button>
            </div>
            <p className="mt-1 text-amber-700">
              These queries are being served by multiple pages on your site, splitting impressions and CTR. Consolidate or differentiate these pages to improve rankings.
            </p>
          </div>

          {loadingCannib && (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-[var(--color-muted)]">
              <Loader2 size={18} className="animate-spin" />
              Analyzing keyword cannibalization across query + page impressions...
            </div>
          )}

          {!loadingCannib && cannibalizationData.length > 0 && (
            <div className="space-y-4">
              {cannibalizationData.map((conflict, idx) => (
                <Card key={idx}>
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                          Conflict #{idx + 1}
                        </span>
                        <span className="font-semibold text-sm text-[var(--color-foreground)]">
                          &ldquo;{conflict.query}&rdquo;
                        </span>
                      </div>
                      <span className="text-xs text-[var(--color-muted)]">
                        {conflict.totalImpressions.toLocaleString()} total impressions split across {conflict.pages.length} pages
                      </span>
                    </div>

                    {/* Impression Share Bar */}
                    <div className="flex h-6 w-full overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
                      {conflict.pages.map((p, pi) => {
                        const colors = ["bg-blue-500", "bg-amber-500", "bg-rose-400", "bg-purple-400", "bg-emerald-400"];
                        return (
                          <div
                            key={pi}
                            className={`${colors[pi % colors.length]} flex items-center justify-center text-[9px] font-bold text-white transition-all`}
                            style={{ width: `${Math.max(p.share * 100, 5)}%` }}
                            title={`${p.url}: ${Math.round(p.share * 100)}%`}
                          >
                            {Math.round(p.share * 100)}%
                          </div>
                        );
                      })}
                    </div>

                    {/* Pages Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                            <th className="pb-2 text-left font-medium">Page URL</th>
                            <th className="pb-2 text-right font-medium">Impressions</th>
                            <th className="pb-2 text-right font-medium">Clicks</th>
                            <th className="pb-2 text-right font-medium">Position</th>
                            <th className="pb-2 text-right font-medium">Share</th>
                          </tr>
                        </thead>
                        <tbody>
                          {conflict.pages.map((p, pi) => (
                            <tr key={pi} className={`border-b border-[var(--color-border)]/50 ${pi === 0 ? "bg-blue-50/50 dark:bg-blue-950/20" : ""}`}>
                              <td className="py-2 pr-4">
                                <div className="flex items-center gap-1.5">
                                  {pi === 0 && (
                                    <span className="rounded bg-blue-500/10 px-1.5 py-0.2 text-[9px] font-bold text-blue-600">
                                      PRIMARY
                                    </span>
                                  )}
                                  <a href={p.url} target="_blank" rel="noreferrer" className="text-[var(--color-info)] hover:underline truncate max-w-xs">
                                    {shortenUrl(p.url)}
                                  </a>
                                </div>
                              </td>
                              <td className="py-2 text-right tabular">{p.impressions.toLocaleString()}</td>
                              <td className="py-2 text-right tabular">{p.clicks.toLocaleString()}</td>
                              <td className="py-2 text-right">
                                <span className={`font-semibold tabular ${p.position <= 10 ? "text-[var(--color-success)]" : "text-[var(--color-warning)]"}`}>
                                  #{Math.round(p.position * 10) / 10}
                                </span>
                              </td>
                              <td className="py-2 text-right">
                                <span className={`font-bold ${pi === 0 ? "text-blue-600" : "text-amber-600"}`}>
                                  {Math.round(p.share * 100)}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Recommendations */}
                    <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)]/50 p-3">
                      <Sparkles size={14} className="shrink-0 text-[var(--color-primary)]" />
                      <div className="text-xs text-[var(--color-muted)]">
                        <strong className="text-[var(--color-foreground)]">Recommendation:</strong>{" "}
                        Consolidate these pages into one authoritative piece targeting &ldquo;{conflict.query}&rdquo;, or differentiate them by user intent (informational vs transactional). Set canonicals and redirect the weaker page.
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {!loadingCannib && cannibalizationData.length === 0 && (
            <Card className="p-8 text-center">
              <CheckCircle2 size={32} className="mx-auto mb-2 text-[var(--color-success)]" />
              <p className="text-sm font-semibold text-[var(--color-foreground)]">No cannibalization conflicts detected</p>
              <p className="text-xs text-[var(--color-muted)] mt-1">Your pages are well-differentiated. Click &ldquo;Analyze Cannibalization&rdquo; above to run a scan.</p>
            </Card>
          )}
        </div>
      )}

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
