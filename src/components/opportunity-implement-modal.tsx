"use client";

import { useState } from "react";
import {
  X,
  Sparkles,
  CheckCircle2,
  FileText,
  Link as LinkIcon,
  Tag,
  ArrowRight,
  ExternalLink,
  Loader2,
  AlertCircle,
  Copy,
  Check,
} from "lucide-react";
import { PriorityBadge, TypeBadge } from "./badges";
import { formatNumber, shortenUrl } from "@/lib/format";
import type { ActionItem } from "./today-panel";

interface OpportunityImplementModalProps {
  action: ActionItem;
  isOpen: boolean;
  onClose: () => void;
  onImplemented?: (actionId: string, newStatus: string, resultData?: unknown) => void;
}

export function OpportunityImplementModal({
  action,
  isOpen,
  onClose,
  onImplemented,
}: OpportunityImplementModalProps) {
  const defaultTab =
    action.type === "QUICK_WIN" || action.type === "CTR_GAP"
      ? "meta"
      : action.type === "INTERNAL_LINK"
        ? "links"
        : "content";

  const [activeTab, setActiveTab] = useState<"meta" | "content" | "links">(defaultTab);
  const [keyword, setKeyword] = useState(action.keyword ?? "organic skincare");
  const [customTitle, setCustomTitle] = useState("");
  const [customMeta, setCustomMeta] = useState("");
  const [secondaryKws, setSecondaryKws] = useState("");
  const [selectedModel, setSelectedModel] = useState("gemini-2.5-pro");
  const [publishLive, setPublishLive] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [executionStep, setExecutionStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    action: string;
    approvalId?: string;
    contentId?: string;
    title?: string;
    body?: string;
    meta?: string;
    qaReport?: { score: number; seoScore: number; aeoScore: number; geoScore: number };
    htmlPreview?: string;
    suggestions?: Array<{ sourceUrl: string; targetUrl: string; anchor: string; reason: string }>;
    publishedLive?: { ok: boolean; url?: string; id?: string };
  } | null>(null);

  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  async function handleExecute(actionType: "optimize_meta" | "generate_draft" | "suggest_links") {
    setIsSubmitting(true);
    setError(null);
    setResult(null);

    try {
      if (actionType === "optimize_meta") {
        setExecutionStep("Analyzing SERP snippet and scoring SEO metadata...");
      } else if (actionType === "generate_draft") {
        setExecutionStep("Synthesizing 1,500+ word SEO+AEO+GEO article draft...");
      } else {
        setExecutionStep("Scanning internal link graph for contextual anchors...");
      }

      const oppId = action.id || "direct";
      const res = await fetch(`/api/seo/opportunities/${oppId}/implement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: actionType,
          customKeyword: keyword,
          customTitle: customTitle || undefined,
          customMeta: customMeta || undefined,
          secondaryKeywords: secondaryKws
            ? secondaryKws.split(",").map((s) => s.trim()).filter(Boolean)
            : undefined,
          model: selectedModel,
          publishLive,
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      let json: { data?: any; error?: { message?: string } } = {};
      if (contentType.includes("application/json")) {
        json = await res.json();
      } else {
        const text = await res.text();
        throw new Error(
          res.ok
            ? "Unexpected server response"
            : `Server returned error (${res.status}): ${text.slice(0, 120)}`,
        );
      }

      if (!res.ok || json.error) {
        throw new Error(json.error?.message || "Failed to execute opportunity implementation");
      }

      const d = json.data;
      setResult({
        action: actionType,
        approvalId: d.approvalId,
        contentId: d.content?.id,
        title: d.optimizedTitle || d.draft?.title,
        body: d.draft?.body,
        meta: d.optimizedMeta || d.draft?.metaDescription,
        qaReport: d.qaReport || d.draft?.qaReport,
        htmlPreview: d.htmlPreview,
        suggestions: d.suggestions,
        publishedLive: d.publishedLive,
      });

      if (onImplemented) {
        onImplemented(
          action.id,
          d.publishedLive?.ok ? "DONE" : "IN_PROGRESS",
          d,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
      setExecutionStep(null);
    }
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs text-left text-start font-normal">
      <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl text-left text-start font-normal">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-[var(--color-foreground)]">Implement Opportunity</h3>
                <PriorityBadge priority={action.priority} />
                <TypeBadge type={action.type} />
              </div>
              <p className="text-xs text-[var(--color-muted)]">
                Direct AI execution with automatic QA scoring & CMS approval queue
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-foreground)]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Opportunity Context Banner */}
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 text-xs space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-sm text-[var(--color-foreground)]">
                Keyword: <span className="text-[var(--color-primary)]">{action.keyword ?? "Sitewide"}</span>
              </span>
              {action.targetUrl && (
                <a
                  href={action.targetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-[var(--color-info)] hover:underline"
                >
                  {shortenUrl(action.targetUrl)}
                  <ExternalLink size={12} />
                </a>
              )}
            </div>

            <p className="text-[var(--color-foreground)]/90 leading-relaxed">{action.why}</p>

            <div className="flex flex-wrap items-center gap-4 pt-1 border-t border-[var(--color-border)]/60 text-[var(--color-muted)]">
              <span>
                Impressions: <strong className="text-[var(--color-foreground)]">{formatNumber(Number(action.evidence?.impressions ?? 0))}</strong>
              </span>
              <span>
                Clicks: <strong className="text-[var(--color-foreground)]">{formatNumber(Number(action.evidence?.clicks ?? 0))}</strong>
              </span>
              <span>
                Avg Position: <strong className="text-[var(--color-foreground)]">{Number(action.evidence?.position ?? 0).toFixed(1)}</strong>
              </span>
              {action.estimatedClicks !== null && (
                <span className="text-[var(--color-success)] font-medium">
                  Expected Gain: ~{formatNumber(action.estimatedClicks)} clicks/mo
                </span>
              )}
            </div>
          </div>

          {/* Action Tabs */}
          <div className="flex border-b border-[var(--color-border)] text-xs font-medium">
            <button
              onClick={() => setActiveTab("meta")}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 transition-colors ${
                activeTab === "meta"
                  ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                  : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              }`}
            >
              <Tag size={14} />
              Optimize Title & Meta
            </button>
            <button
              onClick={() => setActiveTab("content")}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 transition-colors ${
                activeTab === "content"
                  ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                  : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              }`}
            >
              <FileText size={14} />
              Generate Full Article / Guide
            </button>
            <button
              onClick={() => setActiveTab("links")}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 transition-colors ${
                activeTab === "links"
                  ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                  : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              }`}
            >
              <LinkIcon size={14} />
              Internal Link Graph
            </button>
          </div>

          {/* Tab 1: Meta Optimization */}
          {activeTab === "meta" && (
            <div className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-medium text-[var(--color-foreground)]">Target Focus Keyword</label>
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="e.g. natural skin care"
                  className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs focus:border-[var(--color-primary)] focus:outline-hidden"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <label className="font-medium text-[var(--color-foreground)]">Custom SEO Title (optional)</label>
                    <span className="text-[var(--color-muted)]">{customTitle.length}/60</span>
                  </div>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="Leave empty for AI auto-generation"
                    className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs focus:border-[var(--color-primary)] focus:outline-hidden"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <label className="font-medium text-[var(--color-foreground)]">Custom Meta Description (optional)</label>
                    <span className="text-[var(--color-muted)]">{customMeta.length}/160</span>
                  </div>
                  <input
                    type="text"
                    value={customMeta}
                    onChange={(e) => setCustomMeta(e.target.value)}
                    placeholder="Leave empty for AI auto-generation"
                    className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs focus:border-[var(--color-primary)] focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="rounded-md border border-[var(--color-info)]/30 bg-[var(--color-info)]/5 p-3 text-[var(--color-muted)]">
                💡 <strong className="text-[var(--color-foreground)]">What happens next:</strong> Antigravity AI
                analyzes search intent, scores keyword density, crafts click-maximizing titles & meta descriptions, and
                queues the change in your Approval Gate for 1-click deployment to WordPress / Shopify / CMS.
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => handleExecute("optimize_meta")}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-[var(--color-primary-fg)] hover:opacity-90 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Optimizing...
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      Generate & Queue for Approval
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Tab 2: Full Article Generation */}
          {activeTab === "content" && (
            <div className="space-y-4 text-xs">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="font-medium text-[var(--color-foreground)]">Primary Focus Keyword</label>
                  <input
                    type="text"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs focus:border-[var(--color-primary)] focus:outline-hidden"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-medium text-[var(--color-foreground)]">AI Intelligence Model</label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs focus:border-[var(--color-primary)] focus:outline-hidden"
                  >
                    <option value="gemini-2.5-pro">Gemini 2.5 Pro (Recommended for Deep SEO+AEO)</option>
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash (Fast turnaround)</option>
                    <option value="gpt-4o">OpenAI GPT-4o</option>
                    <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-medium text-[var(--color-foreground)]">Secondary Keywords (comma-separated)</label>
                <input
                  type="text"
                  value={secondaryKws}
                  onChange={(e) => setSecondaryKws(e.target.value)}
                  placeholder="e.g. cold-processed botanical soaps, natural skin benefits, best soap in India"
                  className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs focus:border-[var(--color-primary)] focus:outline-hidden"
                />
              </div>

              <div className="flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
                <input
                  type="checkbox"
                  id="publishLive"
                  checked={publishLive}
                  onChange={(e) => setPublishLive(e.target.checked)}
                  className="h-4 w-4 rounded-sm border-[var(--color-border)] text-[var(--color-primary)]"
                />
                <label htmlFor="publishLive" className="cursor-pointer text-[var(--color-foreground)] font-medium">
                  Publish directly to connected CMS (WordPress / Shopify) upon QA pass
                </label>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => handleExecute("generate_draft")}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-[var(--color-primary-fg)] hover:opacity-90 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Synthesizing Draft...
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      Generate 1,500+ Word SEO+AEO+GEO Article
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Tab 3: Internal Links */}
          {activeTab === "links" && (
            <div className="space-y-4 text-xs">
              <p className="text-[var(--color-muted)]">
                The internal linking agent will evaluate your page catalog and recommend contextual in-content anchor
                insertions to channel PageRank to this target URL.
              </p>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => handleExecute("suggest_links")}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-[var(--color-primary-fg)] hover:opacity-90 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Scanning Graph...
                    </>
                  ) : (
                    <>
                      <LinkIcon size={14} />
                      Generate Internal Link Suggestions
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Execution Progress Banner */}
          {isSubmitting && (
            <div className="flex items-center gap-3 rounded-lg border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10 p-4 text-xs">
              <Loader2 size={18} className="animate-spin text-[var(--color-primary)]" />
              <div>
                <p className="font-semibold text-[var(--color-foreground)]">AI Engine at Work</p>
                <p className="text-[var(--color-muted)]">{executionStep}</p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2.5 rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 p-3.5 text-xs text-[var(--color-danger)]">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Implementation Failed</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Result Presentation */}
          {result && (
            <div className="space-y-3.5 rounded-lg border border-[var(--color-success)]/40 bg-[var(--color-success)]/10 p-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-semibold text-[var(--color-success)]">
                  <CheckCircle2 size={16} />
                  Opportunity Successfully Implemented!
                </span>
                {result.approvalId && (
                  <a
                    href="/automation/activity"
                    className="inline-flex items-center gap-1 font-medium text-[var(--color-primary)] hover:underline"
                  >
                    View in Approvals Gate
                    <ArrowRight size={12} />
                  </a>
                )}
                {result.contentId && (
                  <a
                    href="/content/library"
                    className="inline-flex items-center gap-1 font-medium text-[var(--color-primary)] hover:underline"
                  >
                    View in Content Library
                    <ArrowRight size={12} />
                  </a>
                )}
              </div>

              {result.body && (
                <div className="space-y-2 rounded-md bg-[var(--color-surface)] p-3 border border-[var(--color-border)]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-[var(--color-foreground)]">Generated Article Content (1,500+ Words)</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleCopy(result.body!)}
                        className="flex items-center gap-1 rounded bg-[var(--color-primary)] px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
                      >
                        {copied ? <Check size={12} /> : <Copy size={12} />}
                        <span>Copy Markdown</span>
                      </button>

                      {result.htmlPreview && (
                        <button
                          onClick={() => handleCopy(result.htmlPreview!)}
                          className="flex items-center gap-1 rounded border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)]"
                        >
                          <Copy size={12} />
                          <span>Copy HTML for CMS</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] text-[var(--color-muted)]">
                    Ready to paste directly into your website (React, Next.js, Webflow, Shopify, Ghost, custom CMS).
                  </p>
                </div>
              )}

              {result.title && (
                <div className="space-y-1 rounded-md bg-[var(--color-surface)] p-3 border border-[var(--color-border)]">
                  <div className="flex justify-between items-center text-[var(--color-muted)] font-medium">
                    <span>Generated Title</span>
                    <button
                      onClick={() => handleCopy(result.title!)}
                      className="inline-flex items-center gap-1 text-[var(--color-primary)] hover:underline"
                    >
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                      Copy
                    </button>
                  </div>
                  <p className="font-semibold text-sm text-[var(--color-foreground)]">{result.title}</p>
                </div>
              )}

              {result.meta && (
                <div className="space-y-1 rounded-md bg-[var(--color-surface)] p-3 border border-[var(--color-border)]">
                  <div className="flex justify-between items-center text-[var(--color-muted)] font-medium">
                    <span>Generated Meta Description</span>
                    <button
                      onClick={() => handleCopy(result.meta!)}
                      className="inline-flex items-center gap-1 text-[var(--color-primary)] hover:underline"
                    >
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                      Copy
                    </button>
                  </div>
                  <p className="text-[var(--color-foreground)]">{result.meta}</p>
                </div>
              )}

              {result.qaReport && (
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="rounded-md bg-[var(--color-surface)] p-2 border border-[var(--color-border)]">
                    <span className="text-[var(--color-muted)] block text-[10px]">Overall QA</span>
                    <strong className="text-sm font-semibold text-[var(--color-foreground)]">
                      {result.qaReport.score}/100
                    </strong>
                  </div>
                  <div className="rounded-md bg-[var(--color-surface)] p-2 border border-[var(--color-border)]">
                    <span className="text-[var(--color-muted)] block text-[10px]">SEO Score</span>
                    <strong className="text-sm font-semibold text-[var(--color-foreground)]">
                      {result.qaReport.seoScore}%
                    </strong>
                  </div>
                  <div className="rounded-md bg-[var(--color-surface)] p-2 border border-[var(--color-border)]">
                    <span className="text-[var(--color-muted)] block text-[10px]">AEO Score</span>
                    <strong className="text-sm font-semibold text-[var(--color-foreground)]">
                      {result.qaReport.aeoScore}%
                    </strong>
                  </div>
                  <div className="rounded-md bg-[var(--color-surface)] p-2 border border-[var(--color-border)]">
                    <span className="text-[var(--color-muted)] block text-[10px]">GEO Score</span>
                    <strong className="text-sm font-semibold text-[var(--color-foreground)]">
                      {result.qaReport.geoScore}%
                    </strong>
                  </div>
                </div>
              )}

              {result.publishedLive?.ok && (
                <div className="rounded-md bg-[var(--color-success)]/20 p-3 text-[var(--color-foreground)]">
                  🎉 Published Live to CMS:{" "}
                  <a
                    href={result.publishedLive.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono underline text-[var(--color-info)]"
                  >
                    {result.publishedLive.url}
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[var(--color-border)] px-6 py-3.5 bg-[var(--color-surface-muted)]">
          <button
            onClick={onClose}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-xs font-medium text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)]"
          >
            Close
          </button>
          {result && (
            <span className="text-xs text-[var(--color-success)] font-medium flex items-center gap-1.5">
              <CheckCircle2 size={14} />
              Status updated to In-Progress / Approvals
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
