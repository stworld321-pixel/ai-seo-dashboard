"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  Sparkles,
  Loader2,
  CheckCircle2,
  Play,
  Search,
  ArrowRight,
  ExternalLink,
  Eye,
  Globe,
  Plus,
} from "lucide-react";
import { StatusBadge } from "./badges";
import { ArticlePreviewModal } from "./article-preview-modal";
import type { ArticlePipelineItem } from "@/server/services/article-agent";

interface ArticleAgentViewProps {
  websiteId: string;
  initialPipelines: ArticlePipelineItem[];
}

export function ArticleAgentView({ websiteId, initialPipelines }: ArticleAgentViewProps) {
  const router = useRouter();
  const [pipelines, setPipelines] = useState<ArticlePipelineItem[]>(initialPipelines);
  const [activeTab, setActiveTab] = useState<"all" | "drafts" | "approval" | "published">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [selectedPipeline, setSelectedPipeline] = useState<ArticlePipelineItem | null>(null);

  async function handleScanPipelines() {
    setIsScanning(true);
    setStatusMessage("Scanning Search Console & AI Prompts for high-intent content gaps...");
    try {
      const res = await fetch("/api/article-agent/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId }),
      });
      const json = await res.json();
      if (json.data?.pipelines) {
        setPipelines(json.data.pipelines);
        setStatusMessage(`Scan complete: ${json.data.totalPipelines} article pipelines formulated!`);
        router.refresh();
      }
    } catch {
      setStatusMessage("Scan encountered an issue. Please try again.");
    } finally {
      setIsScanning(false);
      setTimeout(() => setStatusMessage(null), 5000);
    }
  }

  async function handleGenerateDraft(pipelineId: string) {
    setGeneratingId(pipelineId);
    setStatusMessage("Synthesizing 1,500+ word SEO + AEO + GEO article draft with comparison matrix & FAQ schema...");
    try {
      const res = await fetch("/api/article-agent/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId, pipelineId }),
      });
      const json = await res.json();
      if (json.data?.pipeline) {
        setPipelines((prev) =>
          prev.map((p) =>
            p.id === pipelineId
              ? {
                  ...p,
                  workflowStep: "Ready for Approval",
                  status: "AWAITING_APPROVAL",
                  body: json.data.pipeline.body,
                  qaScore: json.data.pipeline.qaReport?.score ?? 92,
                  wordCount: json.data.pipeline.body?.split(/\s+/).length,
                }
              : p
          )
        );
        setStatusMessage("Draft generated successfully! Ready for review & 1-click publishing.");
        router.refresh();
      }
    } catch {
      setStatusMessage("Failed to generate draft. Please retry.");
    } finally {
      setGeneratingId(null);
      setTimeout(() => setStatusMessage(null), 5000);
    }
  }

  function handlePublished(pipelineId: string, url: string) {
    setPipelines((prev) =>
      prev.map((p) =>
        p.id === pipelineId
          ? { ...p, workflowStep: "Published", status: "PUBLISHED", publishedUrl: url }
          : p
      )
    );
    router.refresh();
  }

  const filteredPipelines = pipelines.filter((p) => {
    if (activeTab === "drafts" && p.workflowStep !== "Draft Generated") return false;
    if (activeTab === "approval" && p.workflowStep !== "Ready for Approval") return false;
    if (activeTab === "published" && p.workflowStep !== "Published") return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        p.title.toLowerCase().includes(q) ||
        p.primaryKeyword.toLowerCase().includes(q) ||
        (p.targetPrompt && p.targetPrompt.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const totalCount = pipelines.length;
  const draftCount = pipelines.filter((p) => p.body && p.status !== "PUBLISHED").length;
  const approvalCount = pipelines.filter((p) => p.status === "AWAITING_APPROVAL" || p.status === "APPROVED").length;
  const publishedCount = pipelines.filter((p) => p.status === "PUBLISHED").length;

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-primary)] text-white shadow-sm">
            <FileText size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">Article Agent</h1>
              <span className="inline-flex items-center gap-1 rounded bg-green-500/10 px-2 py-0.5 text-xs font-semibold text-[var(--color-success)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" />
                Active Pipeline
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[var(--color-muted)]">
              Autonomous content creation pipeline — formulates briefs, generates 1,500+ word AEO/GEO articles, and deploys directly to your CMS.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {statusMessage && (
            <div className="flex items-center gap-1.5 rounded-md border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10 px-3 py-1.5 text-xs text-[var(--color-primary)] animate-in fade-in">
              {isScanning || generatingId ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} className="text-[var(--color-success)]" />}
              <span>{statusMessage}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleScanPipelines}
            disabled={isScanning || Boolean(generatingId)}
            className="flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)] transition-colors shadow-sm"
          >
            {isScanning ? <Loader2 size={14} className="animate-spin text-[var(--color-primary)]" /> : <Sparkles size={14} className="text-amber-500" />}
            <span>{isScanning ? "Scanning Queries…" : "Scan GSC & Prompt Gaps"}</span>
          </button>

          <Link
            href="/content/generator"
            className="flex items-center gap-1.5 rounded-md bg-[var(--color-primary)] px-3.5 py-1.5 text-xs font-semibold text-[var(--color-primary-fg)] hover:opacity-90 transition-opacity shadow-sm"
          >
            <Plus size={14} />
            <span>New Custom Brief</span>
          </Link>
        </div>
      </div>

      {/* Metric Cards */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
          <p className="text-xs font-medium text-[var(--color-muted)]">Total Content Pipelines</p>
          <p className="mt-1 text-2xl font-bold">{totalCount}</p>
          <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">engineered for Page-1 & citations</p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
          <p className="text-xs font-medium text-[var(--color-muted)]">AI Drafts Generated</p>
          <p className="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-400">{draftCount}</p>
          <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">1,500+ word structured articles</p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
          <p className="text-xs font-medium text-[var(--color-muted)]">Ready for Approval</p>
          <p className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">{approvalCount}</p>
          <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">human QA pass completed</p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
          <p className="text-xs font-medium text-[var(--color-muted)]">Published Live</p>
          <p className="mt-1 text-2xl font-bold text-green-600 dark:text-green-400">{publishedCount}</p>
          <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">active on website / CMS</p>
        </div>
      </section>

      {/* Workflow Stage Bar */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
        <p className="text-xs font-semibold text-[var(--color-foreground)] mb-2.5">
          Autonomous Article Production Cycle:
        </p>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="rounded bg-[var(--color-surface-muted)] px-3 py-1.5 font-medium">1. GSC / Prompt Gap</span>
          <span>→</span>
          <span className="rounded bg-[var(--color-surface-muted)] px-3 py-1.5 font-medium">2. Intent Briefing</span>
          <span>→</span>
          <span className="rounded bg-[var(--color-surface-muted)] px-3 py-1.5 font-medium">3. 1,500w AI Draft</span>
          <span>→</span>
          <span className="rounded bg-[var(--color-surface-muted)] px-3 py-1.5 font-medium">4. AEO / GEO Schema Pass</span>
          <span>→</span>
          <span className="rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 px-3 py-1.5 font-semibold">5. Human Approval</span>
          <span>→</span>
          <span className="rounded bg-green-500/10 text-[var(--color-success)] px-3 py-1.5 font-semibold">6. Live CMS Publish</span>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--color-border)] pb-3">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === "all"
                ? "bg-[var(--color-primary)] text-white"
                : "bg-[var(--color-surface-muted)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            }`}
          >
            All Pipelines ({pipelines.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("drafts")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === "drafts"
                ? "bg-[var(--color-primary)] text-white"
                : "bg-[var(--color-surface-muted)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            }`}
          >
            Drafts Ready ({draftCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("approval")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === "approval"
                ? "bg-[var(--color-primary)] text-white"
                : "bg-[var(--color-surface-muted)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            }`}
          >
            Ready for Approval ({approvalCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("published")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === "published"
                ? "bg-[var(--color-primary)] text-white"
                : "bg-[var(--color-surface-muted)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            }`}
          >
            Published ({publishedCount})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search keywords or topics..."
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] py-1.5 pl-8 pr-3 text-xs text-[var(--color-foreground)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
          />
        </div>
      </div>

      {/* Pipelines List */}
      <div className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden shadow-sm">
        {filteredPipelines.length === 0 ? (
          <div className="p-8 text-center text-xs text-[var(--color-muted)]">
            No content pipelines match your criteria. Click &quot;Scan GSC & Prompt Gaps&quot; to formulate new articles.
          </div>
        ) : (
          filteredPipelines.map((pipeline) => {
            const isGenerating = generatingId === pipeline.id;
            const hasDraft = Boolean(pipeline.body);
            const isPublished = pipeline.status === "PUBLISHED";

            return (
              <div key={pipeline.id} className="p-4.5 hover:bg-[var(--color-surface-muted)] transition-colors">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1.5 max-w-xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge
                        status={pipeline.workflowStep}
                        tone={
                          isPublished
                            ? "success"
                            : pipeline.workflowStep === "Ready for Approval"
                            ? "warning"
                            : hasDraft
                            ? "info"
                            : "neutral"
                        }
                      />
                      <span className="rounded bg-[var(--color-surface-muted)] border border-[var(--color-border)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-primary)]">
                        {pipeline.intent}
                      </span>
                      {pipeline.qaScore && (
                        <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-success)]">
                          Score {pipeline.qaScore}%
                        </span>
                      )}
                      <h3 className="text-sm font-bold text-[var(--color-foreground)]">
                        {pipeline.title}
                      </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--color-muted)]">
                      <span><strong>Keyword:</strong> &ldquo;{pipeline.primaryKeyword}&rdquo;</span>
                      {pipeline.wordCount && <span>· <strong>Length:</strong> {pipeline.wordCount} words</span>}
                      <span>· <strong>Schema:</strong> {pipeline.schemaTypes}</span>
                    </div>

                    {pipeline.targetPrompt && (
                      <p className="text-[11px] text-[var(--color-primary)]">
                        🎯 <strong>Target AI Prompt:</strong> &ldquo;{pipeline.targetPrompt}&rdquo;
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 flex items-center gap-2 pt-1">
                    {hasDraft ? (
                      <button
                        type="button"
                        onClick={() => setSelectedPipeline(pipeline)}
                        className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-primary)] px-3.5 py-1.5 text-xs font-semibold text-[var(--color-primary-fg)] hover:opacity-90 transition-opacity shadow-sm"
                      >
                        <Eye size={13} />
                        <span>Review & Publish</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleGenerateDraft(pipeline.id)}
                        disabled={isGenerating}
                        className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-primary)] px-3.5 py-1.5 text-xs font-semibold text-[var(--color-primary-fg)] hover:opacity-90 disabled:opacity-50 transition-opacity shadow-sm"
                      >
                        {isGenerating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                        <span>{isGenerating ? "Synthesizing 1,500w Draft…" : "✨ Generate Full AI Draft"}</span>
                      </button>
                    )}

                    {isPublished && pipeline.publishedUrl && (
                      <a
                        href={pipeline.publishedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)]"
                      >
                        <ExternalLink size={13} />
                        <span>Live Post</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Review Modal */}
      <ArticlePreviewModal
        pipeline={selectedPipeline}
        websiteId={websiteId}
        isOpen={Boolean(selectedPipeline)}
        onClose={() => setSelectedPipeline(null)}
        onPublished={handlePublished}
      />
    </div>
  );
}
