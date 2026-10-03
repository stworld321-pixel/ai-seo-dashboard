"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Target,
  Sparkles,
  Loader2,
  CheckCircle2,
  Search,
  Zap,
  Bot,
  Layers,
  Code2,
  ArrowRight,
  ExternalLink,
  Check,
  X,
  RotateCcw,
  RefreshCw,
  TrendingUp,
  Sliders,
  FileText,
} from "lucide-react";
import { Card, CardHeader } from "@/components/card";
import { MetricCard } from "@/components/metric-card";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/badges";
import { formatNumber, shortenUrl } from "@/lib/format";
import type { UnifiedBridgeItem } from "@/server/services/seo-agent";

const CATEGORY_STYLES: Record<string, { label: string; icon: any; tone: "info" | "warning" | "success" | "neutral" }> = {
  AEO_SNIPPET: { label: "AEO Snippet Target", icon: Zap, tone: "info" },
  CITATION_GAP: { label: "AI Citation Gap", icon: Bot, tone: "warning" },
  TOPICAL_AUTHORITY: { label: "Topical Authority", icon: Layers, tone: "neutral" },
  PAGE_ONE_LEVERAGE: { label: "Page-1 Leverage", icon: TrendingUp, tone: "success" },
  SCHEMA_BRIDGE: { label: "Schema Bridge", icon: Code2, tone: "info" },
};

const AI_STATUS_STYLES: Record<string, { tone: "success" | "warning" | "danger" | "info" }> = {
  "Cited in AI": { tone: "success" },
  "Snippet Candidate": { tone: "info" },
  "Mentioned without link": { tone: "warning" },
  "Not mentioned in AI": { tone: "danger" },
};

export function SeoAgentClientView({
  websiteId,
  websiteName,
  websiteUrl,
  initialBridges,
}: {
  websiteId: string;
  websiteName: string;
  websiteUrl: string;
  initialBridges: UnifiedBridgeItem[];
}) {
  const router = useRouter();
  const [bridges, setBridges] = useState<UnifiedBridgeItem[]>(initialBridges);
  const [activeTab, setActiveTab] = useState<"active" | "aeo_snippets" | "citation_gaps" | "topical" | "done" | "dismissed" | "all">("active");
  const [searchTerm, setSearchTerm] = useState("");
  const [isRunningScan, setIsRunningScan] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  async function handleUpdateStatus(item: UnifiedBridgeItem, newStatus: "OPEN" | "DONE" | "DISMISSED") {
    try {
      const res = await fetch("/api/seo-agent/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteId,
          bridgeId: item.id,
          keyword: item.keyword,
          status: newStatus,
        }),
      });
      if (res.ok) {
        setBridges((prev) =>
          prev.map((b) => (b.id === item.id ? { ...b, status: newStatus } : b)),
        );
      }
    } catch (err) {
      console.error("Failed to update bridge status", err);
    }
  }

  async function handleRunScan() {
    setIsRunningScan(true);
    setStatusMessage("Analyzing Search Console rankings vs AI citation visibility...");
    try {
      const res = await fetch("/api/seo-agent/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId }),
      });
      const json = await res.json();
      if (json.data?.bridges) {
        setBridges(json.data.bridges);
        setStatusMessage(`Scan complete: ${json.data.totalCount} Unified Search & AI bridges mapped!`);
        router.refresh();
      }
    } catch {
      setStatusMessage("Scan encountered an issue. Please try again.");
    } finally {
      setIsRunningScan(false);
      setTimeout(() => setStatusMessage(null), 5000);
    }
  }

  // Filtered rows
  const visible = bridges.filter((b) => {
    // Search filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const match =
        b.keyword.toLowerCase().includes(q) ||
        b.recommendedAction.toLowerCase().includes(q) ||
        (b.targetUrl && b.targetUrl.toLowerCase().includes(q));
      if (!match) return false;
    }

    // Tab filter
    if (activeTab === "active" && b.status !== "OPEN") return false;
    if (activeTab === "done" && b.status !== "DONE") return false;
    if (activeTab === "dismissed" && b.status !== "DISMISSED") return false;
    if (activeTab === "aeo_snippets") {
      if (b.status === "DISMISSED") return false;
      if (b.category !== "AEO_SNIPPET" && b.category !== "PAGE_ONE_LEVERAGE") return false;
    }
    if (activeTab === "citation_gaps") {
      if (b.status === "DISMISSED") return false;
      if (b.category !== "CITATION_GAP") return false;
    }
    if (activeTab === "topical") {
      if (b.status === "DISMISSED") return false;
      if (b.category !== "TOPICAL_AUTHORITY") return false;
    }

    return true;
  });

  const counts = {
    total: bridges.length,
    active: bridges.filter((b) => b.status === "OPEN").length,
    aeoSnippets: bridges.filter((b) => b.status !== "DISMISSED" && (b.category === "AEO_SNIPPET" || b.category === "PAGE_ONE_LEVERAGE")).length,
    citationGaps: bridges.filter((b) => b.status !== "DISMISSED" && b.category === "CITATION_GAP").length,
    topical: bridges.filter((b) => b.status !== "DISMISSED" && b.category === "TOPICAL_AUTHORITY").length,
    done: bridges.filter((b) => b.status === "DONE").length,
    dismissed: bridges.filter((b) => b.status === "DISMISSED").length,
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Diagnostics Action Bar */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-primary)] text-white shadow-xs">
            <Target size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-[var(--color-foreground)]">
                SEO Agent (Unified Search &amp; AI Bridge)
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Active Bridge Engine
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[var(--color-muted)]">
              Leverages your proven Google Search rankings and traffic to capture top citations in ChatGPT, Perplexity &amp; Google AI Overviews.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {statusMessage && (
            <div className="flex items-center gap-1.5 rounded-lg border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10 px-3 py-1.5 text-xs font-medium text-[var(--color-primary)]">
              {isRunningScan ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} className="text-emerald-600" />}
              <span>{statusMessage}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleRunScan}
            disabled={isRunningScan}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-primary)] px-4 py-2 text-xs font-bold text-[var(--color-primary-fg)] shadow-xs transition-all hover:opacity-90 disabled:opacity-50"
          >
            <RefreshCw size={13} className={isRunningScan ? "animate-spin" : ""} />
            <span>{isRunningScan ? "Scanning Bridges..." : "Run Unified Bridge Scan"}</span>
          </button>
        </div>
      </div>

      {/* Top 4 Metrics Cards */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          label="Active Bridges"
          value={formatNumber(counts.active)}
          deltaLabel="high CTR potential"
          hint="Search queries ready for AI citations"
        />
        <MetricCard
          label="AEO Snippet Targets"
          value={formatNumber(counts.aeoSnippets)}
          deltaLabel="Top 1-5 rank positions"
          hint="45-word direct answer box targets"
        />
        <MetricCard
          label="AI Citation Gaps"
          value={formatNumber(counts.citationGaps)}
          deltaLabel="Page 2 growth targets"
          hint="High impression queries without citations"
        />
        <MetricCard
          label="Resolved Bridges"
          value={formatNumber(counts.done)}
          deltaLabel={`${counts.dismissed} dismissed`}
          hint="Implemented & content published"
        />
      </section>

      {/* Main Bridge Table Card */}
      <Card>
        <CardHeader
          title="Search-to-AI Visibility Bridges"
          subtitle={`${visible.length} queries shown — Bridge high-ranking search traffic into direct LLM answers & featured snippets`}
          action={
            <div className="flex items-center gap-2">
              <div className="relative min-w-[220px]">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filter bridge queries..."
                  className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] py-1.5 pl-8 pr-3 text-xs focus:border-[var(--color-primary)] focus:outline-hidden"
                />
              </div>
            </div>
          }
        />

        {/* Status / Category Tabs Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface-muted)]/40 px-5 py-2 text-xs">
          <div className="flex flex-wrap items-center gap-1">
            {[
              { id: "active", label: "Active Bridges", count: counts.active },
              { id: "aeo_snippets", label: "AEO Snippets", count: counts.aeoSnippets },
              { id: "citation_gaps", label: "Citation Gaps", count: counts.citationGaps },
              { id: "topical", label: "Topical Authority", count: counts.topical },
              { id: "done", label: "Done", count: counts.done },
              { id: "dismissed", label: "Dismissed", count: counts.dismissed },
              { id: "all", label: "All", count: counts.total },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-medium transition-all ${
                    isActive
                      ? "bg-[var(--color-primary)] text-[var(--color-primary-fg)] font-bold shadow-2xs"
                      : "text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-foreground)]"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[9px] ${
                      isActive ? "bg-white/20 text-white" : "bg-[var(--color-surface-muted)] text-[var(--color-muted)]"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Data Table */}
        <DataTable
          rows={visible}
          getKey={(r) => r.id}
          empty="No bridge opportunities found matching your filters. Click 'Run Unified Bridge Scan' above."
          columns={[
            {
              key: "keyword",
              header: "GSC Keyword & URL",
              render: (r) => (
                <div className="space-y-1 max-w-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-xs text-[var(--color-foreground)]">{r.keyword}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-[var(--color-muted)]">
                    <span className="tabular font-medium">
                      Pos: <strong className="text-[var(--color-foreground)]">{r.gscPosition ? `#${r.gscPosition}` : "—"}</strong>
                    </span>
                    <span>·</span>
                    <span className="tabular">{formatNumber(r.gscImpressions)} Impr</span>
                    <span>·</span>
                    <span className="tabular">{r.gscClicks} Clicks</span>
                  </div>
                  {r.targetUrl && (
                    <a
                      href={r.targetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] text-[var(--color-info)] hover:underline truncate max-w-[240px]"
                    >
                      <ExternalLink size={10} />
                      {shortenUrl(r.targetUrl)}
                    </a>
                  )}
                </div>
              ),
            },
            {
              key: "category",
              header: "Bridge Type",
              render: (r) => {
                const conf = CATEGORY_STYLES[r.category] ?? { label: r.category, tone: "neutral" };
                return <StatusBadge status={conf.label} tone={conf.tone} />;
              },
            },
            {
              key: "aiStatus",
              header: "AI Citation Status",
              render: (r) => {
                const conf = AI_STATUS_STYLES[r.aiVisibilityStatus] ?? { tone: "neutral" };
                return <StatusBadge status={r.aiVisibilityStatus} tone={conf.tone} />;
              },
            },
            {
              key: "recommendation",
              header: "Recommended Action to Capture Citations",
              render: (r) => (
                <div className="space-y-1 max-w-md">
                  <p className="text-xs text-[var(--color-foreground)] font-medium leading-relaxed">
                    {r.recommendedAction}
                  </p>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    Impact: {r.expectedImpact}
                  </p>
                </div>
              ),
            },
            {
              key: "actions",
              header: "Actions",
              align: "right",
              render: (r) => {
                const isDone = r.status === "DONE";
                const isDismissed = r.status === "DISMISSED";

                return (
                  <div className="flex items-center justify-end gap-1.5">
                    {isDone && (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 size={11} /> Resolved
                      </span>
                    )}

                    {isDismissed && (
                      <span className="inline-flex items-center gap-1 rounded bg-gray-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">
                        <X size={11} /> Dismissed
                      </span>
                    )}

                    {/* 1-Click Bridge Launch (Content Generator) */}
                    <a
                      href={`/content/generator?keyword=${encodeURIComponent(r.keyword)}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10 px-2.5 py-1 text-[11px] font-bold text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20 transition-all shadow-2xs"
                      title="Launch AI Generator to write article or AEO FAQ block"
                    >
                      <Sparkles size={11} />
                      Bridge Fix
                    </a>

                    {/* Mark as Done / Reopen */}
                    {!isDone ? (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(r, "DONE")}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                        title="Mark bridge as completed"
                      >
                        <Check size={11} />
                        Done
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(r, "OPEN")}
                        className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[11px] font-medium text-[var(--color-muted)] hover:text-[var(--color-foreground)] transition-colors"
                        title="Reopen bridge"
                      >
                        <RotateCcw size={11} />
                        Reopen
                      </button>
                    )}

                    {/* Dismiss / Restore */}
                    {!isDismissed ? (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(r, "DISMISSED")}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-500/20 bg-gray-500/5 px-2 py-1 text-[11px] font-medium text-gray-500 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                        title="Dismiss bridge"
                      >
                        <X size={11} />
                        Dismiss
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(r, "OPEN")}
                        className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[11px] font-medium text-[var(--color-muted)] hover:text-[var(--color-foreground)] transition-colors"
                        title="Restore bridge"
                      >
                        <RotateCcw size={11} />
                        Restore
                      </button>
                    )}
                  </div>
                );
              },
            },
          ]}
        />
      </Card>
    </div>
  );
}
