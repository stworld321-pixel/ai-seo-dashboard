"use client";

import Link from "next/link";
import {
  Sparkles,
  ShieldCheck,
  FileSearch,
  Layers,
  Network,
  Search,
  Bot,
  ArrowRight,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

type SeoOverviewCardProps = {
  healthScore: number;
  pageCount: number;
  healthyPages: number;
  optimizePages: number;
  totalInternalLinks: number;
  hasSchema: boolean;
  industry: string;
  websiteName: string;
  websiteDomain: string;
  topTopics: string[];
};

export function SeoOverviewCard({
  healthScore,
  pageCount,
  healthyPages,
  optimizePages,
  totalInternalLinks,
  hasSchema,
  industry,
  websiteName,
  websiteDomain,
  topTopics,
}: SeoOverviewCardProps) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface-muted)]/40 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-[var(--color-foreground)] tracking-tight">
              SEO &amp; AI Search Overview
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-3 w-3" /> Autonomous Audit Active
            </span>
          </div>
          <p className="mt-0.5 text-xs text-[var(--color-muted)]">
            Comprehensive audit health, crawled URL index, internal link density, and keyword coverage for {websiteName}.
          </p>
        </div>

        <Link
          href="/seo/technical"
          className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)] transition-colors shadow-2xs"
        >
          <FileSearch className="h-3.5 w-3.5 text-[var(--color-primary)]" />
          Technical Audit Details
          <ArrowRight className="h-3 w-3 opacity-60" />
        </Link>
      </div>

      {/* Grid Metrics */}
      <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4 border-b border-[var(--color-border)]">
        {/* Metric 1: Health Score */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
              SEO Health Score
            </span>
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-[var(--color-foreground)]">{healthScore}</span>
            <span className="text-xs text-[var(--color-muted)]">/ 100</span>
          </div>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            Solid architectural foundation
          </p>
        </div>

        {/* Metric 2: Audited Pages */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
              Audited URL Index
            </span>
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Layers className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-[var(--color-foreground)]">{pageCount}</span>
            <span className="text-xs text-[var(--color-muted)]">live URLs</span>
          </div>
          <p className="text-[11px] text-[var(--color-muted)]">
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{healthyPages} healthy</span> &middot; {optimizePages} to optimize
          </p>
        </div>

        {/* Metric 3: Internal Link Graph */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
              Internal Link Graph
            </span>
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Network className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-[var(--color-foreground)]">{totalInternalLinks.toLocaleString()}</span>
            <span className="text-xs text-[var(--color-muted)]">connections</span>
          </div>
          <p className="text-[11px] text-[var(--color-muted)]">
            Contextual link graph active
          </p>
        </div>

        {/* Metric 4: AEO & Schema Readiness */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
              AEO &amp; Schema
            </span>
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Bot className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-[var(--color-foreground)]">
              {hasSchema ? "JSON-LD Active" : "Standard HTML"}
            </span>
          </div>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            {hasSchema ? "Optimized for AI Overviews" : "Ready for Schema Injection"}
          </p>
        </div>
      </div>

      {/* Bottom Insights: Targeted Keywords & AI Engine Coverage */}
      <div className="grid gap-6 p-5 lg:grid-cols-2">
        {/* Left: Primary Topic & Keyword Clusters */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)] flex items-center gap-1.5">
              <Search className="h-3.5 w-3.5 text-[var(--color-primary)]" />
              Audited Keyword Clusters &amp; Topic Pillars
            </span>
            <Link
              href="/seo/keywords"
              className="text-xs text-[var(--color-primary)] hover:underline font-medium flex items-center gap-0.5"
            >
              Keyword Explorer <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="flex flex-wrap gap-2">
            {topTopics.slice(0, 6).map((topic, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/30 px-3 py-1.5 text-xs text-[var(--color-foreground)]"
              >
                <div className="h-1.5 w-1.5 rounded-full bg-[var(--color-primary)]" />
                <span className="font-medium">{topic}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: AI Search Engine Presence (AEO & GEO) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)] flex items-center gap-1.5">
              <Bot className="h-3.5 w-3.5 text-purple-500" />
              AI Citation &amp; LLM Visibility (AEO / GEO)
            </span>
            <Link
              href="/geo-agent"
              className="text-xs text-[var(--color-primary)] hover:underline font-medium flex items-center gap-0.5"
            >
              GEO Agent <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5">
              <span className="font-medium text-[var(--color-foreground)]">ChatGPT Search</span>
              <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                Monitored
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5">
              <span className="font-medium text-[var(--color-foreground)]">Perplexity AI</span>
              <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                Monitored
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5">
              <span className="font-medium text-[var(--color-foreground)]">Claude 3.7</span>
              <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                Monitored
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5">
              <span className="font-medium text-[var(--color-foreground)]">Google AI Overviews</span>
              <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                Monitored
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
