"use client";

import { useState } from "react";
import {
  Search,
  ExternalLink,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Eye,
  ArrowUpDown,
  FileText,
  RefreshCw,
  Clock,
  X,
  Code,
} from "lucide-react";
import { Card, CardHeader } from "@/components/card";
import { DataTable } from "@/components/data-table";
import { MetricCard } from "@/components/metric-card";
import { StatusBadge } from "@/components/badges";
import { formatNumber, formatPercent, formatPosition, shortenUrl } from "@/lib/format";
import { PageDiagnosticModal, type PageDiagnosticRow } from "./page-diagnostic-modal";
import { SchemaGeneratorModal } from "./schema-generator-modal";

interface PagesClientViewProps {
  websiteId: string;
  websiteUrl: string;
  initialPages: PageDiagnosticRow[];
}

export function PagesClientView({
  websiteId,
  websiteUrl,
  initialPages,
}: PagesClientViewProps) {
  const [pages, setPages] = useState<PageDiagnosticRow[]>(initialPages);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "optimize" | "healthy" | "page1" | "zero-click" | "pending-audit" | "dismissed">("all");
  const [selectedPage, setSelectedPage] = useState<PageDiagnosticRow | null>(null);
  const [isScanningBatch, setIsScanningBatch] = useState(false);
  const [isGlobalSchemaModalOpen, setIsGlobalSchemaModalOpen] = useState(false);

  async function handleUpdatePageStatus(pageUrl: string, newStatus: "HEALTHY" | "OPTIMIZE" | "DISMISSED") {
    try {
      const res = await fetch("/api/seo/pages/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId, pageUrl, status: newStatus }),
      });
      if (res.ok) {
        setPages((prev) =>
          prev.map((p) => {
            if (p.page !== pageUrl) return p;
            const isDismissed = newStatus === "DISMISSED";
            return {
              ...p,
              status: {
                label: isDismissed ? "Dismissed" : newStatus === "HEALTHY" ? "Healthy" : "Optimize",
                tone: isDismissed ? "neutral" : newStatus === "HEALTHY" ? "success" : "warning",
              },
              contentScoreDetail: {
                ...(typeof p.contentScoreDetail === "object" ? p.contentScoreDetail : {}),
                isDismissed,
              },
            };
          }),
        );
      }
    } catch (err) {
      console.error("Failed to update page status", err);
    }
  }

  // Filter logic
  const filteredPages = pages.filter((p) => {
    // Search match
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchUrl = p.page.toLowerCase().includes(term);
      const matchTitle = (p.seoTitle || "").toLowerCase().includes(term);
      const matchMeta = (p.metaDescription || "").toLowerCase().includes(term);
      if (!matchUrl && !matchTitle && !matchMeta) return false;
    }

    const isDismissed = p.status.label === "Dismissed" || p.contentScoreDetail?.isDismissed === true;

    // Status / Category filter
    if (statusFilter === "dismissed") {
      return isDismissed;
    }
    if (statusFilter === "optimize") {
      return !isDismissed && (p.status.label === "Optimize" || p.status.label === "Investigate" || (p.isCrawled && !p.metaDescription));
    }
    if (statusFilter === "healthy") {
      return !isDismissed && p.status.label === "Healthy";
    }
    if (statusFilter === "page1") {
      return p.position <= 10.5;
    }
    if (statusFilter === "zero-click") {
      return p.clicks === 0 && p.impressions > 0;
    }
    if (statusFilter === "pending-audit") {
      return !p.isCrawled;
    }

    return true;
  });

  const counts = {
    total: pages.length,
    optimize: pages.filter((p) => p.status.label !== "Dismissed" && !p.contentScoreDetail?.isDismissed && (p.status.label === "Optimize" || p.status.label === "Investigate" || (p.isCrawled && !p.metaDescription))).length,
    healthy: pages.filter((p) => p.status.label !== "Dismissed" && !p.contentScoreDetail?.isDismissed && p.status.label === "Healthy").length,
    dismissed: pages.filter((p) => p.status.label === "Dismissed" || p.contentScoreDetail?.isDismissed === true).length,
    page1: pages.filter((p) => p.position <= 10.5).length,
    zeroClick: pages.filter((p) => p.clicks === 0 && p.impressions > 0).length,
    pendingAudit: pages.filter((p) => !p.isCrawled).length,
    withMeta: pages.filter((p) => Boolean(p.metaDescription)).length,
  };

  async function handleBatchScan() {
    setIsScanningBatch(true);
    try {
      const res = await fetch("/api/seo/pages/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId, batch: true, limit: 30 }),
      });
      const json = await res.json();
      if (json.data?.pageRecords && json.data.pageRecords.length > 0) {
        const updatedMap = new Map<string, any>(
          json.data.pageRecords.map((pr: any) => [pr.url.replace(/\/+$/, ""), pr]),
        );
        setPages((prev) =>
          prev.map((p) => {
            const clean = p.page.replace(/\/+$/, "");
            const match = updatedMap.get(clean);
            if (match) {
              return {
                ...p,
                isCrawled: true,
                seoTitle: match.title,
                metaDescription: match.metaDescription,
                h1: match.h1,
                wordCount: match.wordCount,
                lastCrawledAt: match.lastCrawledAt,
                status: {
                  label: match.status === "HEALTHY" ? "Healthy" : "Optimize",
                  tone: match.status === "HEALTHY" ? "success" : "warning",
                },
              };
            }
            return p;
          }),
        );
      }
    } catch (err) {
      console.error("Batch crawl failed", err);
    } finally {
      setIsScanningBatch(false);
    }
  }

  function handlePageUpdated(updated: PageDiagnosticRow) {
    setPages((prev) =>
      prev.map((p) => (p.page === updated.page ? updated : p)),
    );
    if (selectedPage && selectedPage.page === updated.page) {
      setSelectedPage(updated);
    }
  }

  return (
    <>
      {/* Metric summary cards */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          label="Total Ranking Pages"
          value={formatNumber(counts.total)}
          deltaLabel="in Search Console window"
        />
        <MetricCard
          label="Needs Optimization"
          value={formatNumber(counts.optimize)}
          deltaLabel="CTR gaps or missing meta"
        />
        <MetricCard
          label="Ranking Page 1 (Top 10)"
          value={formatNumber(counts.page1)}
          deltaLabel="avg position ≤ 10"
        />
        <MetricCard
          label="Zero-Click Pages"
          value={formatNumber(counts.zeroClick)}
          deltaLabel="impressions, 0 clicks"
        />
      </section>

      {/* Main Pages Table Card */}
      <Card className="mt-6">
        <div className="border-b border-[var(--color-border)] p-4 sm:flex sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold text-sm text-[var(--color-foreground)]">
              Pages & SEO Metadata Catalog
            </h3>
            <p className="text-xs text-[var(--color-muted)]">
              Click any page row or status badge to inspect issues, see ranking queries, and generate 1-click AI fixes.
            </p>
          </div>

          <div className="mt-3 sm:mt-0 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsGlobalSchemaModalOpen(true)}
              className="flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)] transition-colors shadow-2xs"
              title="Open Structured Data (JSON-LD) Generator"
            >
              <Code size={13} className="text-[var(--color-primary)]" />
              <span>Generate Schema</span>
            </button>

            {counts.pendingAudit > 0 && (
              <button
                type="button"
                onClick={handleBatchScan}
                disabled={isScanningBatch}
                className="flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)] disabled:opacity-50 transition-colors shadow-xs"
                title="Automatically fetch live titles and meta tags for uncrawled ranking pages"
              >
                <RefreshCw size={13} className={isScanningBatch ? "animate-spin text-[var(--color-primary)]" : "text-[var(--color-primary)]"} />
                <span>{isScanningBatch ? "Auditing Pages…" : `Audit Unchecked Pages (${counts.pendingAudit})`}</span>
              </button>
            )}

            {/* Search */}
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]"
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search URL or title…"
                className="h-8 w-48 sm:w-64 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] pl-9 pr-3 text-xs text-[var(--color-foreground)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)] focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex border-b border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 text-xs font-medium overflow-x-auto">
          <button
            onClick={() => setStatusFilter("all")}
            className={`border-b-2 px-3 py-2 transition-colors whitespace-nowrap ${
              statusFilter === "all"
                ? "border-[var(--color-primary)] text-[var(--color-primary)] font-semibold"
                : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            }`}
          >
            All Pages ({counts.total})
          </button>
          <button
            onClick={() => setStatusFilter("optimize")}
            className={`border-b-2 px-3 py-2 transition-colors whitespace-nowrap ${
              statusFilter === "optimize"
                ? "border-[var(--color-primary)] text-[var(--color-primary)] font-semibold"
                : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            }`}
          >
            Needs Optimization ({counts.optimize})
          </button>
          <button
            onClick={() => setStatusFilter("healthy")}
            className={`border-b-2 px-3 py-2 transition-colors whitespace-nowrap ${
              statusFilter === "healthy"
                ? "border-[var(--color-primary)] text-[var(--color-primary)] font-semibold"
                : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            }`}
          >
            Healthy ({counts.healthy})
          </button>
          <button
            onClick={() => setStatusFilter("page1")}
            className={`border-b-2 px-3 py-2 transition-colors whitespace-nowrap ${
              statusFilter === "page1"
                ? "border-[var(--color-primary)] text-[var(--color-primary)] font-semibold"
                : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            }`}
          >
            Page 1 Top 10 ({counts.page1})
          </button>
          <button
            onClick={() => setStatusFilter("zero-click")}
            className={`border-b-2 px-3 py-2 transition-colors whitespace-nowrap ${
              statusFilter === "zero-click"
                ? "border-[var(--color-primary)] text-[var(--color-primary)] font-semibold"
                : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            }`}
          >
            Zero Clicks ({counts.zeroClick})
          </button>
          <button
            onClick={() => setStatusFilter("dismissed")}
            className={`border-b-2 px-3 py-2 transition-colors whitespace-nowrap ${
              statusFilter === "dismissed"
                ? "border-[var(--color-primary)] text-[var(--color-primary)] font-semibold"
                : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            }`}
          >
            Dismissed ({counts.dismissed})
          </button>
          {counts.pendingAudit > 0 && (
            <button
              onClick={() => setStatusFilter("pending-audit")}
              className={`border-b-2 px-3 py-2 transition-colors whitespace-nowrap ${
                statusFilter === "pending-audit"
                  ? "border-[var(--color-primary)] text-[var(--color-primary)] font-semibold"
                  : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              }`}
            >
              Pending Audit ({counts.pendingAudit})
            </button>
          )}
        </div>

        {/* Interactive Data Table */}
        <DataTable
          rows={filteredPages}
          getKey={(r) => r.page}
          empty="No matching pages found."
          columns={[
            {
              key: "page",
              header: "Page URL & SEO Title",
              render: (r) => (
                <div
                  onClick={() => setSelectedPage(r)}
                  className="max-w-md cursor-pointer group"
                  title="Click to inspect page issues & AI recommendations"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs text-[var(--color-info)] group-hover:underline font-medium truncate">
                      {shortenUrl(r.page)}
                    </span>
                    <a
                      href={r.page}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                    >
                      <ExternalLink size={11} />
                    </a>
                  </div>
                  {r.isCrawled ? (
                    r.seoTitle ? (
                      <p className="mt-0.5 truncate text-xs font-medium text-[var(--color-foreground)] group-hover:text-[var(--color-primary)]">
                        {r.seoTitle}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-[11px] text-[var(--color-danger)] font-medium">
                        ⚠ Missing Title Tag — Click to fix
                      </p>
                    )
                  ) : (
                    <p className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] text-[var(--color-muted)] font-normal italic">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                      <span>Live title pending audit — Click to scan</span>
                    </p>
                  )}
                  {r.isCrawled ? (
                    r.metaDescription ? (
                      <p className="mt-0.5 line-clamp-1 text-[11px] text-[var(--color-muted)]">
                        {r.metaDescription}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-[11px] text-amber-600 dark:text-amber-400">
                        ⚠ Missing Meta Description
                      </p>
                    )
                  ) : (
                    <p className="mt-0.5 text-[11px] text-[var(--color-muted)]/70">
                      Click row or &quot;Scan&quot; to fetch live HTML
                    </p>
                  )}
                </div>
              ),
            },
            {
              key: "status",
              header: "Status",
              render: (r) => (
                <button
                  type="button"
                  onClick={() => setSelectedPage(r)}
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                  title="Click to view issue diagnostic & recommendations"
                >
                  <StatusBadge status={r.status.label} tone={r.status.tone} />
                </button>
              ),
            },
            {
              key: "score",
              header: "Score",
              render: (r) => {
                const score = r.contentScore ?? (r.status.label === "Healthy" ? 90 : 65);
                return (
                  <span
                    className={`text-xs font-semibold tabular ${
                      score >= 80
                        ? "text-emerald-600 dark:text-emerald-400"
                        : score >= 60
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {score}/100
                  </span>
                );
              },
            },
            {
              key: "impr",
              header: "Impr.",
              align: "right",
              render: (r) => <span className="text-xs tabular">{formatNumber(r.impressions)}</span>,
            },
            {
              key: "clicks",
              header: "Clicks",
              align: "right",
              render: (r) => <span className="text-xs tabular">{formatNumber(r.clicks)}</span>,
            },
            {
              key: "ctr",
              header: "CTR",
              align: "right",
              render: (r) => <span className="text-xs tabular">{formatPercent(r.ctr)}</span>,
            },
            {
              key: "pos",
              header: "Position",
              align: "right",
              render: (r) => (
                <span
                  className={`text-xs tabular font-semibold ${
                    r.position <= 10
                      ? "text-[var(--color-success)]"
                      : r.position <= 20
                        ? "text-[var(--color-warning)]"
                        : "text-[var(--color-muted)]"
                  }`}
                >
                  {formatPosition(r.position)}
                </span>
              ),
            },
            {
              key: "action",
              header: "Action",
              align: "right",
              render: (r) => {
                const isDismissed = r.status.label === "Dismissed" || r.contentScoreDetail?.isDismissed === true;
                const isHealthy = r.status.label === "Healthy" && !isDismissed;

                return (
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedPage(r)}
                      className="flex items-center gap-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs font-medium text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)] transition-colors"
                      title={r.isCrawled ? "Open page diagnostic & fix modal" : "Scan live page metadata & inspect"}
                    >
                      <Sparkles size={12} className={r.isCrawled ? "text-[var(--color-primary)]" : "text-amber-500"} />
                      <span>{r.isCrawled ? "Inspect" : "Scan"}</span>
                    </button>

                    {!isHealthy && !isDismissed && (
                      <button
                        type="button"
                        onClick={() => handleUpdatePageStatus(r.page, "HEALTHY")}
                        className="flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                        title="Mark as Done / Healthy"
                      >
                        <CheckCircle2 size={12} />
                        <span>Done</span>
                      </button>
                    )}

                    {!isDismissed ? (
                      <button
                        type="button"
                        onClick={() => handleUpdatePageStatus(r.page, "DISMISSED")}
                        className="flex items-center gap-1 rounded border border-gray-500/20 bg-gray-500/5 px-2 py-1 text-xs font-medium text-gray-500 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                        title="Dismiss page warnings"
                      >
                        <X size={12} />
                        <span>Dismiss</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleUpdatePageStatus(r.page, "OPTIMIZE")}
                        className="flex items-center gap-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-foreground)] transition-colors"
                        title="Restore page"
                      >
                        <Clock size={12} />
                        <span>Restore</span>
                      </button>
                    )}
                  </div>
                );
              },
            },
          ]}
        />
      </Card>

      {/* Page Diagnostic Modal */}
      {selectedPage && (
        <PageDiagnosticModal
          page={selectedPage}
          websiteId={websiteId}
          websiteUrl={websiteUrl}
          isOpen={Boolean(selectedPage)}
          onClose={() => setSelectedPage(null)}
          onPageUpdated={handlePageUpdated}
        />
      )}

      {/* Structured Data (JSON-LD) Generator Modal */}
      <SchemaGeneratorModal
        isOpen={isGlobalSchemaModalOpen}
        onClose={() => setIsGlobalSchemaModalOpen(false)}
        initialType="FAQPage"
      />
    </>
  );
}
