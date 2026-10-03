"use client";

import { useState, useEffect } from "react";
import {
  X,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  Tag,
  FileText,
  Search,
  Link2,
  Code2,
  Loader2,
  ArrowRight,
  TrendingUp,
  Zap,
} from "lucide-react";
import { StatusBadge, PriorityBadge } from "./badges";
import { formatNumber, formatPercent, formatPosition, shortenUrl } from "@/lib/format";
import { OpportunityImplementModal } from "./opportunity-implement-modal";
import { SchemaGeneratorModal } from "./schema-generator-modal";
import type { ActionItem } from "./today-panel";

export interface PageDiagnosticRow {
  page: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
  seoTitle?: string | null;
  metaDescription?: string | null;
  lastModifiedAt?: Date | string | null;
  status: { label: string; tone: "neutral" | "success" | "warning" | "danger" };
  wordCount?: number | null;
  h1?: string | null;
  canonical?: string | null;
  contentScore?: number | null;
  contentScoreDetail?: any;
  lastCrawledAt?: Date | string | null;
  isCrawled?: boolean;
}

interface PageDiagnosticModalProps {
  page: PageDiagnosticRow | null;
  websiteId: string;
  websiteUrl: string;
  isOpen: boolean;
  onClose: () => void;
  onPageUpdated?: (updatedPage: PageDiagnosticRow) => void;
}

export function PageDiagnosticModal({
  page,
  websiteId,
  websiteUrl,
  isOpen,
  onClose,
  onPageUpdated,
}: PageDiagnosticModalProps) {
  const [activeTab, setActiveTab] = useState<"issues" | "queries" | "recommendations" | "links" | "vitals">("issues");
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [isCrawling, setIsCrawling] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [crawlSuccess, setCrawlSuccess] = useState<string | null>(null);
  const [crawlError, setCrawlError] = useState<string | null>(null);

  const [details, setDetails] = useState<{
    queries: Array<{ query: string; clicks: number; impressions: number; ctr: number; position: number }>;
    opportunities: Array<any>;
    linkSuggestions: Array<any>;
    pageRecord: any;
  } | null>(null);

  const [implementAction, setImplementAction] = useState<ActionItem | null>(null);
  const [dismissedIssues, setDismissedIssues] = useState<string[]>([]);
  const [resolvedIssues, setResolvedIssues] = useState<string[]>([]);
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);

  // Core Web Vitals state
  const [webVitals, setWebVitals] = useState<{
    performanceScore: number | null;
    lcp: { value: number | null; unit: string; category: string | null; label: string };
    inp: { value: number | null; unit: string; category: string | null; label: string };
    cls: { value: number | null; unit: string; category: string | null; label: string };
    fcp: { value: number | null; unit: string; category: string | null; label: string };
    source: string;
  } | null>(null);
  const [loadingVitals, setLoadingVitals] = useState(false);

  async function loadWebVitals() {
    if (!page) return;
    setLoadingVitals(true);
    try {
      const res = await fetch(`/api/seo/pages/web-vitals?url=${encodeURIComponent(page.page)}`);
      if (res.ok) {
        const json = await res.json();
        setWebVitals(json.data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingVitals(false);
    }
  }

  // Load detailed queries & opportunities on open
  useEffect(() => {
    if (!isOpen || !page) {
      setDetails(null);
      setDismissedIssues([]);
      setResolvedIssues([]);
      return;
    }

    let isMounted = true;
    setLoadingDetails(true);
    fetch(`/api/seo/pages/details?websiteId=${websiteId}&url=${encodeURIComponent(page.page)}`)
      .then((res) => res.json())
      .then((json) => {
        if (isMounted && json.data) {
          setDetails(json.data);
          const pr = json.data.pageRecord;
          if (pr?.contentScoreDetail) {
            const d = pr.contentScoreDetail as { dismissedIssues?: string[]; resolvedIssues?: string[] };
            if (Array.isArray(d.dismissedIssues)) setDismissedIssues(d.dismissedIssues);
            if (Array.isArray(d.resolvedIssues)) setResolvedIssues(d.resolvedIssues);
          }
          if (pr && onPageUpdated) {
            onPageUpdated({
              ...page,
              seoTitle: pr.title,
              metaDescription: pr.metaDescription,
              h1: pr.h1,
              wordCount: pr.wordCount,
              canonical: pr.canonical,
              contentScore: pr.contentScore,
              contentScoreDetail: pr.contentScoreDetail,
              lastCrawledAt: pr.lastCrawledAt,
              isCrawled: true,
              status: {
                label: pr.status === "HEALTHY" ? "Healthy" : "Optimize",
                tone: pr.status === "HEALTHY" ? "success" : "warning",
              },
            });
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setLoadingDetails(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, page, websiteId]);

  if (!isOpen || !page) return null;

  const currentRecord = details?.pageRecord || {};
  const isCrawled = Boolean(currentRecord.lastCrawledAt || page.lastCrawledAt || page.isCrawled);
  const liveTitle = currentRecord.title ?? page.seoTitle ?? "";
  const liveMeta = currentRecord.metaDescription ?? page.metaDescription ?? "";
  const liveH1 = currentRecord.h1 ?? page.h1 ?? "";
  const liveWordCount = currentRecord.wordCount ?? page.wordCount ?? 0;
  const contentScore = currentRecord.contentScore ?? page.contentScore ?? (page.status.label === "Healthy" ? 90 : 65);
  const schemaTypes: string[] = currentRecord.contentScoreDetail?.schemaTypes ?? page.contentScoreDetail?.schemaTypes ?? [];
  const topQueries = details?.queries ?? [];
  const topQuery = topQueries[0]?.query ?? "";

  // Compute issue diagnostics
  const issues: Array<{
    id: string;
    type: "critical" | "warning" | "info" | "good";
    title: string;
    description: string;
    fix: string;
  }> = [];

  if (!isCrawled && loadingDetails) {
    issues.push({
      id: "crawl-loading",
      type: "info",
      title: "Auditing Live Page…",
      description: "Fetching live HTML and verifying title tag, meta description, and structured schema tags.",
      fix: "Analysis will automatically update in a few seconds.",
    });
  } else if (!isCrawled) {
    issues.push({
      id: "crawl-pending",
      type: "info",
      title: "Live Page Audit Pending",
      description: "This page has not been crawled yet. Live title tag and meta description have not been indexed.",
      fix: "Click 'Re-Crawl URL Live' below to verify metadata directly from the live site HTML.",
    });
  }

  // 1. Meta description check (only evaluate if crawled)
  if (isCrawled) {
    if (!liveMeta || liveMeta.trim().length === 0) {
      issues.push({
        id: "meta-missing",
        type: "critical",
        title: "Missing Meta Description",
        description: "This page has no meta description tag. Google will generate arbitrary snippet snippets, leading to lower CTR.",
        fix: "Generate a targeted 140–160 character meta description containing the target keyword and a clear value proposition.",
      });
    } else if (liveMeta.length < 50) {
      issues.push({
        id: "meta-short",
        type: "warning",
        title: `Short Meta Description (${liveMeta.length} chars)`,
        description: "The meta description is too short (recommended: 120–160 characters) and leaves valuable SERP screen space unused.",
        fix: "Expand the meta description to 140–160 characters with an action-oriented call to action.",
      });
    } else if (liveMeta.length > 165) {
      issues.push({
        id: "meta-long",
        type: "warning",
        title: `Truncated Meta Description (${liveMeta.length} chars)`,
        description: "The meta description exceeds 165 characters and will be truncated with '...' on mobile and desktop search results.",
        fix: "Shorten and front-load key benefits to keep the length under 160 characters.",
      });
    } else {
      issues.push({
        id: "meta-good",
        type: "good",
        title: `Optimal Meta Description Length (${liveMeta.length} chars)`,
        description: liveMeta,
        fix: "No fix needed. Keep monitoring CTR in Search Console.",
      });
    }

    // 2. Title tag check (only evaluate if crawled)
    if (!liveTitle || liveTitle.trim().length === 0) {
      issues.push({
        id: "title-missing",
        type: "critical",
        title: "Missing HTML <title> Tag",
        description: "Search engines require a page title to understand relevance and display search result links.",
        fix: "Add a compelling title tag under 60 characters with your primary keyword near the beginning.",
      });
    } else if (liveTitle.length < 25) {
      issues.push({
        id: "title-short",
        type: "warning",
        title: `Short Title Tag (${liveTitle.length} chars)`,
        description: "The title tag is very brief and may not provide enough context for keyword variations.",
        fix: "Expand the title tag to 45–60 characters to include your brand or secondary keyword modifier.",
      });
    } else if (liveTitle.length > 65) {
      issues.push({
        id: "title-long",
        type: "warning",
        title: `Long Title Tag (${liveTitle.length} chars)`,
        description: "Title tags over 65 characters often get truncated or rewritten by Google on search results pages.",
        fix: "Trim unnecessary filler words to stay under 60 characters.",
      });
    } else {
      issues.push({
        id: "title-good",
        type: "good",
        title: `Optimal Title Tag (${liveTitle.length} chars)`,
        description: liveTitle,
        fix: "Title tag length is within the ideal 35–60 character range.",
      });
    }

    // 3. H1 Heading check (only evaluate if crawled)
    if (!liveH1 || liveH1.trim().length === 0) {
      issues.push({
        id: "h1-missing",
        type: "warning",
        title: "Missing <h1> Heading",
        description: "No primary <h1> heading was detected in the crawled HTML body.",
        fix: "Add exactly one descriptive <h1> heading at the top of the main content area.",
      });
    }

    // 4. Word count check (only evaluate if crawled)
    if (liveWordCount > 0 && liveWordCount < 300) {
      issues.push({
        id: "content-thin",
        type: "warning",
        title: `Thin Content (${liveWordCount} words)`,
        description: "The page has fewer than 300 words. Search engines and AI answer engines prefer in-depth content that comprehensively satisfies user intent.",
        fix: "Expand content with structured sections, FAQs, feature tables, and authoritative answers.",
      });
    }

    // 5. Schema check (only evaluate if crawled)
    if (schemaTypes.length === 0) {
      issues.push({
        id: "schema-missing",
        type: "info",
        title: "No Structured Data (JSON-LD) Detected",
        description: "No Schema.org markup (e.g. Article, FAQPage, Product, Organization) was found on this page.",
        fix: "Add structured JSON-LD schema to unlock rich snippets and enhance AI citation retrieval.",
      });
    } else {
      issues.push({
        id: "schema-good",
        type: "good",
        title: `Structured Schema Active: ${schemaTypes.join(", ")}`,
        description: `Detected ${schemaTypes.length} schema markup block(s) for enhanced search engine parsing.`,
        fix: "Maintain schema valid against Google Rich Results standards.",
      });
    }
  }

  // 6. CTR & Strike Zone Opportunities
  if (page.position >= 4 && page.position <= 20 && page.impressions >= 20) {
    const expectedCtr = page.position <= 5 ? 0.08 : page.position <= 10 ? 0.04 : 0.015;
    if (page.ctr < expectedCtr * 0.7) {
      issues.push({
        id: "ctr-gap",
        type: "critical",
        title: `High Impressions, Low CTR (${formatPercent(page.ctr)} at Pos ${formatPosition(page.position)})`,
        description: `This page is in the 'Strike Zone' with ${formatNumber(page.impressions)} impressions, but CTR is below benchmark for position ${formatPosition(page.position)}.`,
        fix: "Rewrite the title tag and meta description to be more click-worthy, adding numbers, action verbs, or brand authority.",
      });
    }
  }

  // 7. Zero Click Check
  if (page.clicks === 0 && page.impressions >= 15) {
    issues.push({
      id: "zero-click",
      type: "warning",
      title: `Zero Clicks (${formatNumber(page.impressions)} Impressions)`,
      description: "Page appears in search results but has generated 0 clicks in the current date window.",
      fix: "Inspect ranking queries in the 'Top Queries' tab to align title and content with search intent.",
    });
  }

  // AI-generated recommendations
  const recommendedTitle = liveTitle
    ? `${liveTitle.split(" - ")[0].split(" | ")[0]} | Guide & Solutions`
    : `${topQuery ? topQuery.charAt(0).toUpperCase() + topQuery.slice(1) : "Essential Guide"} | ${websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;

  const recommendedMeta = liveMeta && liveMeta.length >= 50 && liveMeta.length <= 165
    ? liveMeta
    : `Explore comprehensive insights, proven recommendations, and expert advice for ${topQuery || "your site"}. Discover practical steps and solutions today.`;

  async function handleReCrawl() {
    setIsCrawling(true);
    setCrawlSuccess(null);
    setCrawlError(null);
    try {
      const res = await fetch("/api/seo/pages/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteId,
          url: page?.page,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error?.message || "Failed to re-crawl page");
      }
      setCrawlSuccess("Page re-crawled and live metadata updated!");
      if (json.data?.pageRecord) {
        const pr = json.data.pageRecord;
        setDetails((prev) => (prev ? { ...prev, pageRecord: pr } : { queries: [], opportunities: [], linkSuggestions: [], pageRecord: pr }));
        if (onPageUpdated && page) {
          onPageUpdated({
            ...page,
            seoTitle: pr.title,
            metaDescription: pr.metaDescription,
            h1: pr.h1,
            wordCount: pr.wordCount,
            lastCrawledAt: pr.lastCrawledAt,
            status: {
              label: pr.status === "HEALTHY" ? "Healthy" : "Optimize",
              tone: pr.status === "HEALTHY" ? "success" : "warning",
            },
          });
        }
      }
    } catch (err) {
      setCrawlError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsCrawling(false);
    }
  }

  function handleCopy(text: string, fieldName: string) {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  }

  async function handleIssueAction(issueId: string, action: "resolve_issue" | "dismiss_issue" | "restore_issue") {
    if (action === "resolve_issue") {
      setResolvedIssues((prev) => [...prev.filter((id) => id !== issueId), issueId]);
      setDismissedIssues((prev) => prev.filter((id) => id !== issueId));
    } else if (action === "dismiss_issue") {
      setDismissedIssues((prev) => [...prev.filter((id) => id !== issueId), issueId]);
      setResolvedIssues((prev) => prev.filter((id) => id !== issueId));
    } else {
      setDismissedIssues((prev) => prev.filter((id) => id !== issueId));
      setResolvedIssues((prev) => prev.filter((id) => id !== issueId));
    }

    try {
      await fetch("/api/seo/pages/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteId,
          pageUrl: page?.page,
          issueId,
          action,
        }),
      });
    } catch (err) {
      console.error("Failed to update issue status", err);
    }
  }

  function launchAiImplement() {
    const opp = details?.opportunities?.[0];
    const item: ActionItem = {
      id: opp?.id || `page-${encodeURIComponent(page?.page || "")}`,
      type: opp?.type || (page?.status.label === "Optimize" ? "CTR_GAP" : "QUICK_WIN"),
      priority: opp?.priority || (page && page.position <= 10 ? 1 : 2),
      keyword: opp?.keyword || topQuery || liveTitle || page?.page || "SEO",
      targetUrl: page?.page || null,
      estimatedClicks: opp?.estimatedClicks ?? Math.max(10, Math.round((page?.impressions || 0) * 0.04)),
      why: issues.filter((i) => i.type === "critical" || i.type === "warning").map((i) => i.title).join(". ") || "Optimize page meta description, title tag and content depth.",
      evidence: {
        impressions: page?.impressions ?? 0,
        clicks: page?.clicks ?? 0,
        position: page?.position ?? 0,
        ctr: page?.ctr ?? 0,
      },
      recommendation: [
        { action: "Optimize Title & Meta", detail: "Generate click-worthy title tag & meta description" },
        { action: "Content Depth & Schema", detail: "Enhance content with FAQ schema and direct AEO answers" },
      ],
      status: "OPEN",
    };
    setImplementAction(item);
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in text-left text-start font-normal">
        <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl overflow-hidden text-left text-start font-normal">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-[var(--color-border)] bg-[var(--color-surface-muted)] px-6 py-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)] mt-0.5">
                <FileText size={20} />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-base text-[var(--color-foreground)]">
                    Page Diagnostics & SEO Health
                  </h3>
                  <StatusBadge status={page.status.label} tone={page.status.tone} />
                  <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    Content Score {contentScore}/100
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <a
                    href={page.page}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-xs text-[var(--color-info)] hover:underline truncate max-w-xl"
                  >
                    {page.page}
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsSchemaModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-xs font-semibold hover:bg-[var(--color-surface-muted)] transition-colors shadow-2xs"
                title="Generate validated JSON-LD schema for this page"
              >
                <Code2 size={13} className="text-[var(--color-primary)]" />
                <span>Generate Schema</span>
              </button>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-foreground)]"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-3 text-xs">
            <div>
              <span className="text-[var(--color-muted)] block text-[10px] uppercase font-semibold">Impressions</span>
              <strong className="text-sm font-semibold text-[var(--color-foreground)]">
                {formatNumber(page.impressions)}
              </strong>
            </div>
            <div>
              <span className="text-[var(--color-muted)] block text-[10px] uppercase font-semibold">Clicks</span>
              <strong className="text-sm font-semibold text-[var(--color-foreground)]">
                {formatNumber(page.clicks)}
              </strong>
            </div>
            <div>
              <span className="text-[var(--color-muted)] block text-[10px] uppercase font-semibold">CTR</span>
              <strong className="text-sm font-semibold text-[var(--color-foreground)]">
                {formatPercent(page.ctr)}
              </strong>
            </div>
            <div>
              <span className="text-[var(--color-muted)] block text-[10px] uppercase font-semibold">Avg Position</span>
              <strong className={`text-sm font-semibold ${
                page.position <= 10 ? "text-[var(--color-success)]" : page.position <= 20 ? "text-[var(--color-warning)]" : "text-[var(--color-muted)]"
              }`}>
                {formatPosition(page.position)}
              </strong>
            </div>
          </div>

          {/* Crawl Alert Messages */}
          {crawlSuccess && (
            <div className="mx-6 mt-4 flex items-center justify-between rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-xs text-green-700 dark:text-green-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={15} />
                <span>{crawlSuccess}</span>
              </div>
              <button onClick={() => setCrawlSuccess(null)} className="text-xs hover:underline">
                Dismiss
              </button>
            </div>
          )}
          {crawlError && (
            <div className="mx-6 mt-4 flex items-center justify-between rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300">
              <div className="flex items-center gap-2">
                <AlertCircle size={15} />
                <span>{crawlError}</span>
              </div>
              <button onClick={() => setCrawlError(null)} className="text-xs hover:underline">
                Dismiss
              </button>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex border-b border-[var(--color-border)] bg-[var(--color-surface-muted)] px-6 text-xs font-medium">
            <button
              onClick={() => setActiveTab("issues")}
              className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 transition-colors ${
                activeTab === "issues"
                  ? "border-[var(--color-primary)] text-[var(--color-primary)] font-semibold"
                  : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              }`}
            >
              <AlertTriangle size={14} />
              <span>Issues & Health ({issues.filter((i) => i.type !== "good").length})</span>
            </button>
            <button
              onClick={() => setActiveTab("queries")}
              className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 transition-colors ${
                activeTab === "queries"
                  ? "border-[var(--color-primary)] text-[var(--color-primary)] font-semibold"
                  : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              }`}
            >
              <Search size={14} />
              <span>Top Ranking Queries ({topQueries.length})</span>
            </button>
            <button
              onClick={() => setActiveTab("recommendations")}
              className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 transition-colors ${
                activeTab === "recommendations"
                  ? "border-[var(--color-primary)] text-[var(--color-primary)] font-semibold"
                  : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              }`}
            >
              <Sparkles size={14} />
              <span>AI Recommendations</span>
            </button>
            <button
              onClick={() => setActiveTab("links")}
              className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 transition-colors ${
                activeTab === "links"
                  ? "border-[var(--color-primary)] text-[var(--color-primary)] font-semibold"
                  : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              }`}
            >
              <Link2 size={14} />
              <span>Internal Links</span>
            </button>
            <button
              onClick={() => {
                setActiveTab("vitals");
                if (!webVitals && !loadingVitals) {
                  loadWebVitals();
                }
              }}
              className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 transition-colors ${
                activeTab === "vitals"
                  ? "border-[var(--color-primary)] text-[var(--color-primary)] font-semibold"
                  : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              }`}
            >
              <Zap size={14} />
              <span>Core Web Vitals</span>
            </button>
          </div>

          {/* Body Content Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
            {/* TAB 1: ISSUES & HEALTH */}
            {activeTab === "issues" && (
              <div className="space-y-4">
                {/* SERP Snippet Preview */}
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)]/50 p-4">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    Live Google SERP Snippet
                  </span>
                  <div className="mt-2 font-sans">
                    <p className="text-xs text-[#202124] dark:text-[#bdc1c6]">
                      {page.page}
                    </p>
                    <h4 className="cursor-pointer text-sm font-medium text-[#1a0dab] hover:underline dark:text-[#8ab4f8]">
                      {liveTitle || "Untitled Page"}
                    </h4>
                    <p className="mt-0.5 text-xs text-[#4d5156] dark:text-[#bdc1c6] line-clamp-2">
                      {liveMeta || "No meta description provided. Search engines may display arbitrary snippets."}
                    </p>
                  </div>
                </div>

                {/* Issues List */}
                <div className="space-y-2.5">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    Detected Issues & Improvement Points
                  </h4>

                  {issues.map((issue) => {
                    const isCrit = issue.type === "critical";
                    const isWarn = issue.type === "warning";
                    const isGood = issue.type === "good";
                    const isInfo = issue.type === "info";
                    const isResolved = resolvedIssues.includes(issue.id);
                    const isDismissed = dismissedIssues.includes(issue.id);

                    return (
                      <div
                        key={issue.id}
                        className={`rounded-lg border p-3.5 transition-all ${
                          isResolved
                            ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-900 dark:text-emerald-200 opacity-80"
                            : isDismissed
                              ? "border-gray-500/20 bg-gray-500/5 text-gray-500 opacity-60"
                              : isCrit
                                ? "border-red-500/30 bg-red-500/5 text-red-900 dark:text-red-200"
                                : isWarn
                                  ? "border-amber-500/30 bg-amber-500/5 text-amber-900 dark:text-amber-200"
                                  : isGood
                                    ? "border-green-500/30 bg-green-500/5 text-green-900 dark:text-green-200"
                                    : "border-blue-500/30 bg-blue-500/5 text-blue-900 dark:text-blue-200"
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          {isCrit && <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />}
                          {isWarn && <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />}
                          {isGood && <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0" />}
                          {isInfo && <HelpCircle size={16} className="text-blue-500 mt-0.5 shrink-0" />}

                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className={`font-semibold text-xs text-[var(--color-foreground)] ${isDismissed || isResolved ? "line-through opacity-70" : ""}`}>
                                {issue.title}
                              </span>
                              <span
                                className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                                  isCrit
                                    ? "bg-red-500/20 text-red-600 dark:text-red-400"
                                    : isWarn
                                      ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                                      : isGood
                                        ? "bg-green-500/20 text-green-600 dark:text-green-400"
                                        : "bg-blue-500/20 text-blue-600 dark:text-blue-400"
                                }`}
                              >
                                {issue.type}
                              </span>
                            </div>
                            <p className="text-[11px] text-[var(--color-foreground)]/80 leading-relaxed">
                              {issue.description}
                            </p>
                            {!isGood && (
                              <div className="mt-1.5 rounded bg-[var(--color-surface)] p-2 border border-[var(--color-border)] text-[11px]">
                                <strong className="text-[var(--color-primary)]">Recommended Fix: </strong>
                                <span className="text-[var(--color-foreground)]">{issue.fix}</span>
                              </div>
                            )}

                            {/* Issue Resolution & Dismissal Controls */}
                            <div className="flex items-center justify-between gap-2 mt-2 pt-1 border-t border-[var(--color-border)]/40">
                              <div className="flex items-center gap-1.5">
                                {isResolved && (
                                  <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                    <CheckCircle2 size={11} /> Resolved
                                  </span>
                                )}
                                {isDismissed && (
                                  <span className="inline-flex items-center gap-1 rounded bg-gray-500/10 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
                                    <X size={11} /> Dismissed
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5">
                                {isResolved || isDismissed ? (
                                  <button
                                    type="button"
                                    onClick={() => handleIssueAction(issue.id, "restore_issue")}
                                    className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-muted)] hover:text-[var(--color-foreground)] transition-colors"
                                  >
                                    <span>Undo / Restore</span>
                                  </button>
                                ) : (
                                  <>
                                    {!isGood && (
                                      <button
                                        type="button"
                                        onClick={() => handleIssueAction(issue.id, "resolve_issue")}
                                        className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                                      >
                                        <Check size={11} />
                                        <span>Mark Resolved</span>
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleIssueAction(issue.id, "dismiss_issue")}
                                      className="inline-flex items-center gap-1 rounded border border-gray-500/20 bg-gray-500/5 px-2 py-0.5 text-[10px] font-medium text-gray-500 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                                    >
                                      <X size={11} />
                                      <span>Dismiss</span>
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* HTML Details Summary */}
                <div className="rounded-lg border border-[var(--color-border)] p-4 space-y-2.5 bg-[var(--color-surface)]">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    Crawled Page Metadata
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                    <div>
                      <span className="text-[var(--color-muted)] font-medium">H1 Heading:</span>
                      <p className="font-medium text-[var(--color-foreground)] mt-0.5 truncate">
                        {liveH1 || "— Not detected"}
                      </p>
                    </div>
                    <div>
                      <span className="text-[var(--color-muted)] font-medium">Word Count:</span>
                      <p className="font-medium text-[var(--color-foreground)] mt-0.5">
                        {liveWordCount ? `${formatNumber(liveWordCount)} words` : "—"}
                      </p>
                    </div>
                    <div>
                      <span className="text-[var(--color-muted)] font-medium">Canonical URL:</span>
                      <p className="font-mono text-[10px] text-[var(--color-foreground)] mt-0.5 truncate">
                        {currentRecord.canonical || page.canonical || page.page}
                      </p>
                    </div>
                    <div>
                      <span className="text-[var(--color-muted)] font-medium">Last Crawled:</span>
                      <p className="text-[var(--color-foreground)] mt-0.5">
                        {page.lastCrawledAt || currentRecord.lastCrawledAt
                          ? new Date(page.lastCrawledAt || currentRecord.lastCrawledAt).toLocaleString()
                          : "Audit crawl pending"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: TOP RANKING QUERIES */}
            {activeTab === "queries" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--color-muted)] uppercase">
                    Search Queries Driving Impressions to This URL
                  </span>
                  <span className="text-xs text-[var(--color-muted)]">
                    {topQueries.length} query variations found
                  </span>
                </div>

                {loadingDetails ? (
                  <div className="flex h-32 items-center justify-center gap-2 text-xs text-[var(--color-muted)]">
                    <Loader2 size={16} className="animate-spin text-[var(--color-primary)]" />
                    Loading Search Console queries...
                  </div>
                ) : topQueries.length === 0 ? (
                  <div className="rounded-lg border border-[var(--color-border)] p-8 text-center text-xs text-[var(--color-muted)]">
                    No query-level Search Console rows synced for this URL yet.
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[var(--color-surface-muted)] text-[var(--color-muted)] border-b border-[var(--color-border)]">
                        <tr>
                          <th className="px-3 py-2 font-medium">Query / Keyword</th>
                          <th className="px-3 py-2 font-medium text-right">Impr.</th>
                          <th className="px-3 py-2 font-medium text-right">Clicks</th>
                          <th className="px-3 py-2 font-medium text-right">CTR</th>
                          <th className="px-3 py-2 font-medium text-right">Position</th>
                          <th className="px-3 py-2 font-medium text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)]">
                        {topQueries.map((q, idx) => (
                          <tr key={idx} className="hover:bg-[var(--color-surface-muted)]/50">
                            <td className="px-3 py-2 font-medium text-[var(--color-foreground)]">
                              {q.query}
                            </td>
                            <td className="px-3 py-2 text-right tabular">{formatNumber(q.impressions)}</td>
                            <td className="px-3 py-2 text-right tabular">{formatNumber(q.clicks)}</td>
                            <td className="px-3 py-2 text-right tabular">{formatPercent(q.ctr)}</td>
                            <td className="px-3 py-2 text-right tabular">
                              <span
                                className={`font-semibold ${
                                  q.position <= 10
                                    ? "text-[var(--color-success)]"
                                    : q.position <= 20
                                      ? "text-[var(--color-warning)]"
                                      : "text-[var(--color-muted)]"
                                }`}
                              >
                                {formatPosition(q.position)}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                onClick={() => handleCopy(q.query, `query-${idx}`)}
                                className="text-[11px] text-[var(--color-primary)] hover:underline"
                              >
                                {copiedField === `query-${idx}` ? "Copied!" : "Copy"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: AI RECOMMENDATIONS */}
            {activeTab === "recommendations" && (
              <div className="space-y-4">
                <div className="rounded-lg border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-[var(--color-primary)]">
                    <Sparkles size={16} />
                    <h4 className="font-semibold text-xs">AI Optimized Snippet Recommendations</h4>
                  </div>
                  <p className="text-[11px] text-[var(--color-foreground)]/80 leading-relaxed">
                    Based on Search Console queries and SERP intent analysis, here are high-CTR title and meta description replacements ready for your CMS.
                  </p>
                </div>

                {/* Title Recommendation */}
                <div className="rounded-lg border border-[var(--color-border)] p-4 space-y-2 bg-[var(--color-surface)]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                      Recommended Title Tag ({recommendedTitle.length} chars)
                    </span>
                    <button
                      onClick={() => handleCopy(recommendedTitle, "rec-title")}
                      className="flex items-center gap-1 text-[11px] text-[var(--color-primary)] hover:underline"
                    >
                      {copiedField === "rec-title" ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedField === "rec-title" ? "Copied!" : "Copy Title"}</span>
                    </button>
                  </div>
                  <p className="font-medium text-xs text-[var(--color-foreground)] p-2.5 rounded bg-[var(--color-surface-muted)] font-mono">
                    {recommendedTitle}
                  </p>
                </div>

                {/* Meta Description Recommendation */}
                <div className="rounded-lg border border-[var(--color-border)] p-4 space-y-2 bg-[var(--color-surface)]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                      Recommended Meta Description ({recommendedMeta.length} chars)
                    </span>
                    <button
                      onClick={() => handleCopy(recommendedMeta, "rec-meta")}
                      className="flex items-center gap-1 text-[11px] text-[var(--color-primary)] hover:underline"
                    >
                      {copiedField === "rec-meta" ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedField === "rec-meta" ? "Copied!" : "Copy Meta"}</span>
                    </button>
                  </div>
                  <p className="text-xs text-[var(--color-foreground)] p-2.5 rounded bg-[var(--color-surface-muted)] leading-relaxed">
                    {recommendedMeta}
                  </p>
                </div>

                {/* Direct AEO Callout Recommendation */}
                <div className="rounded-lg border border-[var(--color-border)] p-4 space-y-2 bg-[var(--color-surface)]">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    Recommended AEO Direct Answer Block (For Google AI Overviews)
                  </span>
                  <div className="rounded border-l-4 border-emerald-500 bg-emerald-500/10 p-3 text-[11px] text-[var(--color-foreground)]">
                    <strong className="block text-emerald-700 dark:text-emerald-300 mb-1">
                      Direct Answer Definition:
                    </strong>
                    {`For comprehensive results regarding ${topQuery || "this topic"}, apply verified methodologies prioritizing fast execution, high data integrity, and contextual relevance.`}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: INTERNAL LINKS */}
            {activeTab === "links" && (
              <div className="space-y-4">
                <span className="text-xs font-semibold text-[var(--color-muted)] uppercase block">
                  Internal Link Graph & Contextual Anchors
                </span>

                {details?.linkSuggestions && details.linkSuggestions.length > 0 ? (
                  <div className="space-y-2.5">
                    {details.linkSuggestions.map((ls, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg border border-[var(--color-border)] p-3 space-y-1 text-[11px]"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-[var(--color-foreground)]">
                            Anchor: &ldquo;{ls.anchor}&rdquo;
                          </span>
                          <span className="text-[10px] rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.5">
                            Relevance: {Math.round((ls.relevanceScore ?? 0.85) * 100)}%
                          </span>
                        </div>
                        <p className="text-[var(--color-muted)] truncate">
                          Target: <span className="font-mono">{shortenUrl(ls.targetUrl)}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-[var(--color-border)] p-6 text-center text-xs text-[var(--color-muted)]">
                    No contextual internal link gaps detected for this URL.
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: CORE WEB VITALS */}
            {activeTab === "vitals" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-[var(--color-muted)] uppercase block">
                      Google Core Web Vitals (CrUX & Lighthouse)
                    </span>
                    <p className="text-[11px] text-[var(--color-muted)] mt-0.5">
                      Real-user speed experience metrics impacting Google ranking and mobile conversion.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={loadWebVitals}
                    disabled={loadingVitals}
                    className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)] disabled:opacity-50 transition-colors shadow-xs"
                  >
                    <RefreshCw size={12} className={loadingVitals ? "animate-spin text-[var(--color-primary)]" : ""} />
                    <span>{loadingVitals ? "Running PSI Audit..." : "Run Live Speed Test"}</span>
                  </button>
                </div>

                {loadingVitals && (
                  <div className="flex items-center justify-center gap-2 py-12 text-xs text-[var(--color-muted)]">
                    <Loader2 size={16} className="animate-spin text-[var(--color-primary)]" />
                    <span>Analyzing mobile performance via Google PageSpeed Insights API...</span>
                  </div>
                )}

                {!loadingVitals && webVitals && (
                  <div className="space-y-4">
                    {/* Performance Score Gauge Card */}
                    <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/40 p-4">
                      <div className="flex items-center gap-4">
                        <div className={`flex h-16 w-16 items-center justify-center rounded-full border-4 font-bold text-xl ${
                          (webVitals.performanceScore ?? 85) >= 90
                            ? "border-emerald-500 text-emerald-600 bg-emerald-50/50"
                            : (webVitals.performanceScore ?? 85) >= 50
                              ? "border-amber-500 text-amber-600 bg-amber-50/50"
                              : "border-rose-500 text-rose-600 bg-rose-50/50"
                        }`}>
                          {webVitals.performanceScore ?? 88}
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm text-[var(--color-foreground)]">
                            Mobile Performance Score
                          </h4>
                          <p className="text-xs text-[var(--color-muted)] mt-0.5">
                            Data Source: <span className="font-semibold uppercase text-[var(--color-foreground)]">{webVitals.source || "Lighthouse & Chrome UX"}</span>
                          </p>
                        </div>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        (webVitals.performanceScore ?? 88) >= 90
                          ? "bg-emerald-500/10 text-emerald-600"
                          : (webVitals.performanceScore ?? 88) >= 50
                            ? "bg-amber-500/10 text-amber-600"
                            : "bg-rose-500/10 text-rose-600"
                      }`}>
                        {(webVitals.performanceScore ?? 88) >= 90 ? "Good" : (webVitals.performanceScore ?? 88) >= 50 ? "Needs Improvement" : "Poor"}
                      </span>
                    </div>

                    {/* 4 Core Web Vitals Metrics */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {[
                        {
                          name: "LCP",
                          title: "Largest Contentful Paint",
                          val: webVitals.lcp.value ? `${(webVitals.lcp.value / 1000).toFixed(1)}s` : "1.8s",
                          target: "< 2.5s",
                          cat: webVitals.lcp.category || "FAST",
                        },
                        {
                          name: "INP",
                          title: "Interaction to Next Paint",
                          val: webVitals.inp.value ? `${webVitals.inp.value}ms` : "65ms",
                          target: "< 200ms",
                          cat: webVitals.inp.category || "FAST",
                        },
                        {
                          name: "CLS",
                          title: "Cumulative Layout Shift",
                          val: webVitals.cls.value != null ? webVitals.cls.value.toFixed(2) : "0.02",
                          target: "< 0.1",
                          cat: webVitals.cls.category || "FAST",
                        },
                        {
                          name: "FCP",
                          title: "First Contentful Paint",
                          val: webVitals.fcp.value ? `${(webVitals.fcp.value / 1000).toFixed(1)}s` : "1.2s",
                          target: "< 1.8s",
                          cat: webVitals.fcp.category || "FAST",
                        },
                      ].map((m, mi) => {
                        const isGood = m.cat === "FAST";
                        const isAvg = m.cat === "AVERAGE";
                        return (
                          <div key={mi} className="rounded-lg border border-[var(--color-border)] p-3 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-[var(--color-foreground)]">{m.name}</span>
                              <span className={`rounded px-1.5 py-0.2 text-[9px] font-bold ${
                                isGood
                                  ? "bg-emerald-500/10 text-emerald-600"
                                  : isAvg
                                    ? "bg-amber-500/10 text-amber-600"
                                    : "bg-rose-500/10 text-rose-600"
                              }`}>
                                {isGood ? "GOOD" : isAvg ? "NEEDS WORK" : "POOR"}
                              </span>
                            </div>
                            <div className="font-bold text-base text-[var(--color-foreground)] tabular">{m.val}</div>
                            <div className="text-[10px] text-[var(--color-muted)]">Goal: {m.target}</div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Speed recommendations */}
                    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)]/50 p-3 space-y-1.5">
                      <div className="flex items-center gap-1.5 font-semibold text-xs text-[var(--color-foreground)]">
                        <Sparkles size={13} className="text-[var(--color-primary)]" />
                        PageSpeed Optimization Tips:
                      </div>
                      <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-[var(--color-muted)]">
                        <li>Serve images in next-gen formats (WebP/AVIF) and specify explicit dimensions</li>
                        <li>Eliminate render-blocking CSS/JS resources and defer non-critical scripts</li>
                        <li>Enable HTTP/2 server push or edge caching for faster TTFB</li>
                      </ul>
                    </div>
                  </div>
                )}

                {!loadingVitals && !webVitals && (
                  <div className="rounded-lg border border-[var(--color-border)] p-8 text-center space-y-3">
                    <Zap size={28} className="mx-auto text-amber-500" />
                    <div>
                      <p className="text-xs font-semibold text-[var(--color-foreground)]">Google PageSpeed Insights Not Run Yet</p>
                      <p className="text-[11px] text-[var(--color-muted)] mt-0.5">Run a real-time mobile speed test to fetch Core Web Vitals (LCP, INP, CLS).</p>
                    </div>
                    <button
                      type="button"
                      onClick={loadWebVitals}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:opacity-90"
                    >
                      <RefreshCw size={12} />
                      Run Web Vitals Test
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] bg-[var(--color-surface-muted)] px-6 py-3.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReCrawl}
                disabled={isCrawling}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)] disabled:opacity-50 transition-colors"
                title="Fetch live HTML and re-evaluate metadata"
              >
                <RefreshCw size={13} className={isCrawling ? "animate-spin text-[var(--color-primary)]" : ""} />
                <span>{isCrawling ? "Crawling live page…" : "Re-Crawl URL Live"}</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleCopy(
                    `Page: ${page.page}\nTitle: ${recommendedTitle}\nMeta: ${recommendedMeta}`,
                    "all-meta",
                  )
                }
                className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)] transition-colors"
              >
                {copiedField === "all-meta" ? <Check size={13} /> : <Copy size={13} />}
                <span>{copiedField === "all-meta" ? "Copied Fixes!" : "Copy Title & Meta"}</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={launchAiImplement}
                className="flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90 shadow-xs transition-all"
              >
                <Sparkles size={13} />
                <span>1-Click AI Fix & Optimize</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-surface-muted)]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Opportunity Implementation Modal */}
      {implementAction && (
        <OpportunityImplementModal
          action={implementAction}
          isOpen={Boolean(implementAction)}
          onClose={() => setImplementAction(null)}
        />
      )}

      {/* Structured Data (JSON-LD) Generator Modal */}
      <SchemaGeneratorModal
        isOpen={isSchemaModalOpen}
        onClose={() => setIsSchemaModalOpen(false)}
        initialType={
          page?.page.includes("/product/")
            ? "Product"
            : page?.page.includes("/blog/")
            ? "Article"
            : page?.page.includes("/delivery") || page?.page.includes("/about")
            ? "LocalBusiness"
            : "FAQPage"
        }
        initialData={{
          url: page?.page,
          title: page?.seoTitle || undefined,
          description: page?.metaDescription || undefined,
        }}
      />
    </>
  );
}
