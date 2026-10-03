"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  Sparkles,
  Loader2,
  CheckCircle2,
  Search,
  ExternalLink,
  ShieldAlert,
  Copy,
  Eye,
  Check,
  X,
  XCircle,
  RotateCcw,
} from "lucide-react";
import { StatusBadge } from "./badges";
import { RedditDraftModal } from "./reddit-draft-modal";
import type { RedditOpportunityItem } from "@/server/services/reddit-agent";

interface RedditAgentViewProps {
  websiteId: string;
  initialOpportunities: RedditOpportunityItem[];
}

export function RedditAgentView({ websiteId, initialOpportunities }: RedditAgentViewProps) {
  const router = useRouter();
  const [opportunities, setOpportunities] = useState<RedditOpportunityItem[]>(initialOpportunities);
  const [activeTab, setActiveTab] = useState<"all" | "active" | "drafts" | "posted" | "dismissed">("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [selectedOpp, setSelectedOpp] = useState<RedditOpportunityItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function handleUpdateRedditStatus(oppId: string, status: "new" | "posted" | "dismissed") {
    try {
      const res = await fetch("/api/reddit-agent/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId: oppId, status }),
      });
      if (res.ok) {
        setOpportunities((prev) =>
          prev.map((o) => (o.id === oppId ? { ...o, status } : o)),
        );
      }
    } catch (err) {
      console.error("Failed to update Reddit status", err);
    }
  }

  async function handleScanDiscussions() {
    setIsScanning(true);
    setStatusMessage("Scanning Reddit community inquiries cited by AI answer models...");
    try {
      const res = await fetch("/api/reddit-agent/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId }),
      });
      const json = await res.json();
      if (json.data?.opportunities) {
        setOpportunities(json.data.opportunities);
        setStatusMessage(`Scan complete: ${json.data.totalDiscussions} community discussions monitored!`);
        router.refresh();
      }
    } catch {
      setStatusMessage("Scan encountered an issue. Please retry.");
    } finally {
      setIsScanning(false);
      setTimeout(() => setStatusMessage(null), 5000);
    }
  }

  async function handleGenerateDraft(oppId: string) {
    setGeneratingId(oppId);
    setStatusMessage("Synthesizing educational, non-promotional Reddit response draft...");
    try {
      const res = await fetch("/api/reddit-agent/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId: oppId, websiteId }),
      });
      const json = await res.json();
      if (json.data?.opportunity) {
        setOpportunities((prev) =>
          prev.map((o) => (o.id === oppId ? json.data.opportunity : o))
        );
        setStatusMessage("Expert response draft created! Ready for review & copy.");
        router.refresh();
      }
    } catch {
      setStatusMessage("Failed to generate response draft.");
    } finally {
      setGeneratingId(null);
      setTimeout(() => setStatusMessage(null), 5000);
    }
  }

  async function handleQuickCopy(opp: RedditOpportunityItem) {
    if (!opp.draftResponse) return;
    await navigator.clipboard.writeText(opp.draftResponse);
    setCopiedId(opp.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function handleApproved(updated: RedditOpportunityItem) {
    setOpportunities((prev) =>
      prev.map((o) => (o.id === updated.id ? updated : o))
    );
    router.refresh();
  }

  const filteredOpps = opportunities.filter((o) => {
    if (activeTab === "active" && (o.status === "dismissed" || o.status === "posted")) return false;
    if (activeTab === "drafts" && (!o.draftResponse || o.status === "dismissed")) return false;
    if (activeTab === "posted" && o.status !== "posted") return false;
    if (activeTab === "dismissed" && o.status !== "dismissed") return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        o.postTitle.toLowerCase().includes(q) ||
        o.subreddit.toLowerCase().includes(q) ||
        (o.topic && o.topic.toLowerCase().includes(q)) ||
        (o.question && o.question.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const totalCount = opportunities.length;
  const activeCount = opportunities.filter((o) => o.status !== "dismissed" && o.status !== "posted").length;
  const readyCount = opportunities.filter((o) => o.draftResponse && o.status !== "dismissed").length;
  const postedCount = opportunities.filter((o) => o.status === "posted").length;
  const dismissedCount = opportunities.filter((o) => o.status === "dismissed").length;
  const totalEngagement = opportunities.reduce((acc, o) => acc + o.engagement, 0);

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-primary)] text-white shadow-sm">
            <MessageSquare size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">Reddit Intelligence Agent</h1>
              <span className="inline-flex items-center gap-1 rounded bg-green-500/10 px-2 py-0.5 text-xs font-semibold text-[var(--color-success)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" />
                Active Monitor
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[var(--color-muted)]">
              Monitors organic Reddit discussions frequently cited by ChatGPT, Perplexity &amp; Gemini, formulating educational, non-promotional responses.
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
            onClick={handleScanDiscussions}
            disabled={isScanning || Boolean(generatingId)}
            className="flex items-center gap-1.5 rounded-md bg-[var(--color-primary)] px-3.5 py-1.5 text-xs font-semibold text-[var(--color-primary-fg)] hover:opacity-90 disabled:opacity-50 transition-opacity shadow-sm"
          >
            {isScanning ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            <span>{isScanning ? "Scanning Threads…" : "⚡ Run Reddit Discovery Scan"}</span>
          </button>
        </div>
      </div>

      {/* Ethical Compliance Card */}
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 flex items-start gap-3 text-xs">
        <ShieldAlert size={18} className="text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-amber-800 dark:text-amber-300">
            Strict Ethical Policy: Genuine Educational Contributions (Zero Automated Spam)
          </p>
          <p className="text-[var(--color-foreground)]">
            All drafts are designed solely as genuine, factual advice. The agent never automates direct posting or manipulates votes. All responses require human review before manual submission.
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
          <p className="text-xs font-medium text-[var(--color-muted)]">Discussions Monitored</p>
          <p className="mt-1 text-2xl font-bold">{totalCount}</p>
          <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">relevant community threads</p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
          <p className="text-xs font-medium text-[var(--color-muted)]">Draft Responses Ready</p>
          <p className="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-400">{readyCount}</p>
          <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">for human review &amp; copy</p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
          <p className="text-xs font-medium text-[var(--color-muted)]">Community Engagement</p>
          <p className="mt-1 text-2xl font-bold text-purple-600 dark:text-purple-400">{totalEngagement}</p>
          <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">total upvotes &amp; comments</p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
          <p className="text-xs font-medium text-[var(--color-muted)]">Verified Postings</p>
          <p className="mt-1 text-2xl font-bold text-green-600 dark:text-green-400">{postedCount}</p>
          <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">active authority citations</p>
        </div>
      </section>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--color-border)] pb-3">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab("active")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === "active"
                ? "bg-[var(--color-primary)] text-white"
                : "bg-[var(--color-surface-muted)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            }`}
          >
            Active ({activeCount})
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
            Drafts Ready ({readyCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("posted")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === "posted"
                ? "bg-[var(--color-primary)] text-white"
                : "bg-[var(--color-surface-muted)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            }`}
          >
            Done / Posted ({postedCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("dismissed")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === "dismissed"
                ? "bg-[var(--color-primary)] text-white"
                : "bg-[var(--color-surface-muted)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            }`}
          >
            Dismissed ({dismissedCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === "all"
                ? "bg-[var(--color-primary)] text-white"
                : "bg-[var(--color-surface-muted)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            }`}
          >
            All ({totalCount})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search subreddits or topics..."
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] py-1.5 pl-8 pr-3 text-xs text-[var(--color-foreground)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
          />
        </div>
      </div>

      {/* Discussion Threads List */}
      <div className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden shadow-sm">
        {filteredOpps.length === 0 ? (
          <div className="p-8 text-center text-xs text-[var(--color-muted)]">
            No Reddit discussions match your search. Click &quot;⚡ Run Reddit Discovery Scan&quot; to fetch fresh threads.
          </div>
        ) : (
          filteredOpps.map((opp) => {
            const isGenerating = generatingId === opp.id;
            const hasDraft = Boolean(opp.draftResponse);
            const isPosted = opp.status === "posted";
            const isDismissed = opp.status === "dismissed";

            return (
              <div key={opp.id} className="p-5 hover:bg-[var(--color-surface-muted)] transition-colors space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1.5 max-w-xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-[var(--color-surface-muted)] border border-[var(--color-border)] px-2.5 py-0.5 text-xs font-mono font-bold text-[var(--color-primary)]">
                        r/{opp.subreddit}
                      </span>
                      <StatusBadge status={opp.relevance} tone="positive" />
                      <span className="text-xs text-[var(--color-muted)]">
                        {opp.engagement} comments &amp; votes
                      </span>
                      {isPosted && (
                        <span className="inline-flex items-center gap-1 rounded bg-green-500/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-success)]">
                          <CheckCircle2 size={12} />
                          Verified Posted
                        </span>
                      )}
                      {isDismissed && (
                        <span className="inline-flex items-center gap-1 rounded bg-zinc-500/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-muted)]">
                          <XCircle size={12} />
                          Dismissed
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-[var(--color-foreground)]">
                      {opp.postTitle}
                    </h3>

                    {opp.question && (
                      <p className="text-xs text-[var(--color-muted)] italic leading-relaxed">
                        &ldquo;{opp.question}&rdquo;
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 flex flex-wrap items-center gap-2 pt-1">
                    <a
                      href={opp.postUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)] transition-colors"
                    >
                      <span>Reddit Thread</span>
                      <ExternalLink size={12} />
                    </a>

                    {isPosted || isDismissed ? (
                      <button
                        type="button"
                        onClick={() => handleUpdateRedditStatus(opp.id, "new")}
                        className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)] transition-colors"
                        title="Reopen / restore to active"
                      >
                        <RotateCcw size={12} />
                        <span>Restore</span>
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleUpdateRedditStatus(opp.id, "posted")}
                          className="inline-flex items-center gap-1 rounded border border-green-500/20 bg-green-500/5 px-2.5 py-1.5 text-xs font-medium text-[var(--color-success)] hover:bg-green-500/15 transition-colors"
                          title="Mark as done / posted"
                        >
                          <Check size={12} />
                          <span>Done</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateRedditStatus(opp.id, "dismissed")}
                          className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-muted)] hover:text-red-500 hover:border-red-500/30 transition-colors"
                          title="Dismiss this opportunity"
                        >
                          <X size={12} />
                          <span>Dismiss</span>
                        </button>
                      </>
                    )}

                    {hasDraft ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleQuickCopy(opp)}
                          className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--color-surface-muted)] transition-colors"
                        >
                          {copiedId === opp.id ? <Check size={13} className="text-[var(--color-success)]" /> : <Copy size={13} />}
                          <span>{copiedId === opp.id ? "Copied!" : "Quick Copy"}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedOpp(opp)}
                          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-primary)] px-3.5 py-1.5 text-xs font-semibold text-[var(--color-primary-fg)] hover:opacity-90 transition-opacity shadow-sm"
                        >
                          <Eye size={13} />
                          <span>Review &amp; Approve</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleGenerateDraft(opp.id)}
                        disabled={isGenerating}
                        className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-primary)] px-3.5 py-1.5 text-xs font-semibold text-[var(--color-primary-fg)] hover:opacity-90 disabled:opacity-50 transition-opacity shadow-sm"
                      >
                        {isGenerating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                        <span>{isGenerating ? "Drafting…" : "✨ Generate Draft"}</span>
                      </button>
                    )}
                  </div>
                </div>

                {hasDraft && (
                  <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3.5 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-semibold uppercase text-[var(--color-muted)]">
                      <span>Suggested Helpful Answer</span>
                      <span className={isPosted ? "text-[var(--color-success)]" : "text-amber-600"}>
                        {isPosted ? "● Verified Posted" : "● Awaiting Human Submission"}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--color-foreground)] leading-relaxed whitespace-pre-wrap">
                      {opp.draftResponse}
                    </p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Draft Review Modal */}
      <RedditDraftModal
        opportunity={selectedOpp}
        websiteId={websiteId}
        isOpen={Boolean(selectedOpp)}
        onClose={() => setSelectedOpp(null)}
        onApproved={handleApproved}
      />
    </div>
  );
}
