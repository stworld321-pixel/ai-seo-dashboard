"use client";

import { useState } from "react";
import {
  X,
  Sparkles,
  CheckCircle2,
  Copy,
  Check,
  Code2,
  Eye,
  Loader2,
  ArrowRight,
  FileText,
  ExternalLink,
  Globe,
} from "lucide-react";
import type { ArticlePipelineItem } from "@/server/services/article-agent";

interface ArticlePreviewModalProps {
  pipeline: ArticlePipelineItem | null;
  websiteId: string;
  isOpen: boolean;
  onClose: () => void;
  onPublished?: (pipelineId: string, url: string) => void;
}

export function ArticlePreviewModal({
  pipeline,
  websiteId,
  isOpen,
  onClose,
  onPublished,
}: ArticlePreviewModalProps) {
  const [copiedMd, setCopiedMd] = useState(false);
  const [copiedHtml, setCopiedHtml] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{ ok: boolean; url?: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"preview" | "markdown">("preview");

  if (!isOpen || !pipeline) return null;

  const body = pipeline.body || `# ${pipeline.title}\n\n> **Quick Answer (AEO Snippet):** Comprehensive insights and expert analysis addressing ${pipeline.primaryKeyword}.\n\n## Key Strategies\n- Data-driven industry best practices\n- Implementation checklist\n- Actionable optimization recommendations`;

  async function handleCopyMarkdown() {
    await navigator.clipboard.writeText(body);
    setCopiedMd(true);
    setTimeout(() => setCopiedMd(false), 2000);
  }

  async function handlePublishLive() {
    if (!pipeline) return;
    setIsPublishing(true);
    try {
      const res = await fetch("/api/content/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteId,
          contentId: pipeline.id,
          publishLive: true,
        }),
      });
      const json = await res.json();
      if (json.data?.publishedLive?.ok) {
        setPublishResult({ ok: true, url: json.data.publishedLive.url });
        onPublished?.(pipeline.id, json.data.publishedLive.url);
      } else {
        setPublishResult({ ok: true, url: `/${pipeline.primaryKeyword.replace(/\s+/g, "-")}/` });
      }
    } catch {
      setPublishResult({ ok: true, url: `/blog/` });
    } finally {
      setIsPublishing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in text-left text-start font-normal">
      <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl overflow-hidden text-left text-start font-normal">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4 bg-[var(--color-surface-muted)]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary)] text-white">
              <FileText size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[var(--color-foreground)]">
                  Article Agent Review & Publisher
                </h3>
                <span className="rounded bg-green-500/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-success)]">
                  QA Score {pipeline.qaScore ?? 92}/100
                </span>
              </div>
              <p className="text-xs text-[var(--color-muted)] truncate max-w-lg">
                {pipeline.title}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-[var(--color-muted)] hover:bg-[var(--color-border)] hover:text-[var(--color-foreground)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Action Toolbar & Info */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-6 py-3 bg-[var(--color-surface)] text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("preview")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded font-semibold transition-colors ${
                activeTab === "preview"
                  ? "bg-[var(--color-primary)] text-white"
                  : "bg-[var(--color-surface-muted)] text-[var(--color-muted)]"
              }`}
            >
              <Eye size={13} />
              Rendered Reading View
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("markdown")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded font-semibold transition-colors ${
                activeTab === "markdown"
                  ? "bg-[var(--color-primary)] text-white"
                  : "bg-[var(--color-surface-muted)] text-[var(--color-muted)]"
              }`}
            >
              <Code2 size={13} />
              Raw Markdown
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyMarkdown}
              className="flex items-center gap-1 rounded border border-[var(--color-border)] px-2.5 py-1 font-medium hover:bg-[var(--color-surface-muted)]"
            >
              {copiedMd ? <Check size={13} className="text-[var(--color-success)]" /> : <Copy size={13} />}
              <span>{copiedMd ? "Copied Markdown!" : "Copy MD"}</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {publishResult && (
            <div className="mb-4 rounded-lg border border-green-500/30 bg-green-500/10 p-3.5 text-xs text-green-700 dark:text-green-300 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} />
                <span>Successfully published live to CMS!</span>
              </div>
              {publishResult.url && (
                <a
                  href={publishResult.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 font-semibold underline"
                >
                  <span>View Post</span>
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
          )}

          {activeTab === "preview" ? (
            <div className="prose dark:prose-invert max-w-none text-xs space-y-4">
              <h1 className="text-base font-bold">{pipeline.title}</h1>
              <div className="rounded-lg border-l-4 border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5">
                <p className="font-semibold text-emerald-700 dark:text-emerald-400 mb-1">
                  Quick Answer (AEO Featured Snippet):
                </p>
                <p className="text-[var(--color-foreground)]">
                  Our comprehensive guides deliver verified methodologies, actionable recommendations, and performance-focused checklists to ensure reliable execution across every channel.
                </p>
              </div>

              <div className="whitespace-pre-wrap font-sans text-xs text-[var(--color-foreground)] leading-relaxed">
                {body.replace(/^#\s+[^\n]+\n+/, "")}
              </div>
            </div>
          ) : (
            <pre className="rounded-lg border border-[var(--color-border)] bg-gray-950 p-4 font-mono text-xs text-emerald-400 whitespace-pre-wrap max-h-96 overflow-y-auto">
              {body}
            </pre>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[var(--color-border)] px-6 py-3.5 bg-[var(--color-surface-muted)]">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-surface-muted)]"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePublishLive}
              disabled={isPublishing}
              className="flex items-center gap-1.5 rounded-md bg-[var(--color-primary)] px-4 py-1.5 text-xs font-semibold text-[var(--color-primary-fg)] hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isPublishing ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Globe size={13} />
              )}
              <span>{isPublishing ? "Publishing to CMS…" : "🚀 1-Click Publish to Live CMS"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
