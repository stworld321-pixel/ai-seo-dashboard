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
} from "lucide-react";
import { Card, CardHeader } from "@/components/card";
import { DataTable } from "@/components/data-table";
import { MetricCard } from "@/components/metric-card";
import { StatusBadge } from "@/components/badges";
import { formatNumber, formatPercent, formatPosition, shortenUrl } from "@/lib/format";
import { PageDiagnosticModal, type PageDiagnosticRow } from "./page-diagnostic-modal";

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
  const [statusFilter, setStatusFilter] = useState<"all" | "optimize" | "healthy" | "page1" | "zero-click">("all");
  const [selectedPage, setSelectedPage] = useState<PageDiagnosticRow | null>(null);

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

    // Status / Category filter
    if (statusFilter === "optimize") {
      return p.status.label === "Optimize" || p.status.label === "Investigate" || !p.metaDescription;
    }
    if (statusFilter === "healthy") {
      return p.status.label === "Healthy";
    }
    if (statusFilter === "page1") {
      return p.position <= 10.5;
    }
    if (statusFilter === "zero-click") {
      return p.clicks === 0 && p.impressions > 0;
    }

    return true;
  });

  const counts = {
    total: pages.length,
    optimize: pages.filter((p) => p.status.label === "Optimize" || p.status.label === "Investigate" || !p.metaDescription).length,
    healthy: pages.filter((p) => p.status.label === "Healthy").length,
    page1: pages.filter((p) => p.position <= 10.5).length,
    zeroClick: pages.filter((p) => p.clicks === 0 && p.impressions > 0).length,
    withMeta: pages.filter((p) => Boolean(p.metaDescription)).length,
  };

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
                  {r.seoTitle ? (
                    <p className="mt-0.5 truncate text-xs font-medium text-[var(--color-foreground)] group-hover:text-[var(--color-primary)]">
                      {r.seoTitle}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-[11px] text-[var(--color-danger)] font-medium">
                      ⚠ Missing Title Tag — Click to fix
                    </p>
                  )}
                  {r.metaDescription ? (
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-[var(--color-muted)]">
                      {r.metaDescription}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-[11px] text-amber-600 dark:text-amber-400">
                      ⚠ Missing Meta Description
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
              render: (r) => (
                <button
                  type="button"
                  onClick={() => setSelectedPage(r)}
                  className="flex items-center gap-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-xs font-medium text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)] transition-colors"
                  title="Open page diagnostic & fix modal"
                >
                  <Sparkles size={12} className="text-[var(--color-primary)]" />
                  <span>Inspect / Fix</span>
                </button>
              ),
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
    </>
  );
}
