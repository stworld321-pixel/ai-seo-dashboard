"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Globe,
  Sparkles,
  Loader2,
  CheckCircle2,
  Search,
  ExternalLink,
  ShieldAlert,
  Copy,
  Eye,
  Check,
} from "lucide-react";
import { StatusBadge } from "./badges";
import { XDraftModal } from "./x-draft-modal";
import type { XOpportunityItem } from "@/server/services/x-agent";

interface XAgentViewProps {
  websiteId: string;
  initialOpportunities: XOpportunityItem[];
}

export function XAgentView({ websiteId, initialOpportunities }: XAgentViewProps) {
  const router = useRouter();
  const [opportunities, setOpportunities] = useState<XOpportunityItem[]>(initialOpportunities);
  const [activeTab, setActiveTab] = useState<"all" | "drafts" | "posted">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [selectedOpp, setSelectedOpp] = useState<XOpportunityItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function handleScanOpportunities() {
    setIsScanning(true);
    setStatusMessage("Scanning authoritative X creators and discussions cited by AI engines...");
    try {
      const res = await fetch("/api/x-agent/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId }),
      });
      const json = await res.json();
      if (json.data?.opportunities) {
        setOpportunities(json.data.opportunities);
        setStatusMessage(`Scan complete: ${json.data.totalOpportunities} creators & discussions identified!`);
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
    setStatusMessage("Generating expert value-adding X response draft...");
    try {
      const res = await fetch("/api/x-agent/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId: oppId, websiteId }),
      });
      const json = await res.json();
      if (json.data?.opportunity) {
        setOpportunities((prev) =>
          prev.map((o) => (o.id === oppId ? json.data.opportunity : o))
        );
        setStatusMessage("Expert draft ready! Click Review & Copy.");
        router.refresh();
      }
    } catch {
      setStatusMessage("Failed to generate response draft.");
    } finally {
      setGeneratingId(null);
      setTimeout(() => setStatusMessage(null), 5000);
    }
  }

  async function handleQuickCopy(opp: XOpportunityItem) {
    if (!opp.draftContent) return;
    await navigator.clipboard.writeText(opp.draftContent);
    setCopiedId(opp.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function handleApproved(updated: XOpportunityItem) {
    setOpportunities((prev) =>
      prev.map((o) => (o.id === updated.id ? updated : o))
    );
    router.refresh();
  }

  const filteredOpps = opportunities.filter((o) => {
    if (activeTab === "drafts" && !o.draftContent) return false;
    if (activeTab === "posted" && o.status !== "posted") return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        o.creatorHandle.toLowerCase().includes(q) ||
        o.topic.toLowerCase().includes(q) ||
        (o.audienceNotes && o.audienceNotes.toLowerCase().includes(q)) ||
        (o.suggestedAction && o.suggestedAction.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const totalCount = opportunities.length;
  const readyCount = opportunities.filter((o) => o.draftContent).length;
  const postedCount = opportunities.filter((o) => o.status === "posted").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-primary)] text-white shadow-sm">
            <Globe size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">X (Twitter) Influencer &amp; Authority Agent</h1>
              <span className="inline-flex items-center gap-1 rounded bg-green-500/10 px-2 py-0.5 text-xs font-semibold text-[var(--color-success)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" />
                Active Monitor
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[var(--color-muted)]">
              Identifies verified industry creators, journalists, and authoritative discussions cited in search engine knowledge graphs.
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
            onClick={handleScanOpportunities}
            disabled={isScanning || Boolean(generatingId)}
            className="flex items-center gap-1.5 rounded-md bg-[var(--color-primary)] px-3.5 py-1.5 text-xs font-semibold text-[var(--color-primary-fg)] hover:opacity-90 disabled:opacity-50 transition-opacity shadow-sm"
          >
            {isScanning ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            <span>{isScanning ? "Scanning X Threads…" : "⚡ Run X Creator Discovery"}</span>
          </button>
        </div>
      </div>

      {/* Ethical Compliance Banner */}
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 flex items-start gap-3 text-xs">
        <ShieldAlert size={18} className="text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-amber-800 dark:text-amber-300">
            Strict Ethical Policy: Non-Spam &amp; Value-First Engagement
          </p>
          <p className="text-[var(--color-foreground)]">
            All suggested replies and collaboration pitches require human review and manual execution. The agent never mass-DMs or automates unauthorized social posting.
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
          <p className="text-xs font-medium text-[var(--color-muted)]">Creators Monitored</p>
          <p className="mt-1 text-2xl font-bold">{totalCount}</p>
          <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">verified industry accounts</p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
          <p className="text-xs font-medium text-[var(--color-muted)]">Draft Outreach Ready</p>
          <p className="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-400">{readyCount}</p>
          <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">for manual review &amp; copy</p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
          <p className="text-xs font-medium text-[var(--color-muted)]">Engagement Strategy</p>
          <p className="mt-1 text-2xl font-bold text-purple-600 dark:text-purple-400">High Impact</p>
          <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">data-backed replies</p>
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
            onClick={() => setActiveTab("all")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === "all"
                ? "bg-[var(--color-primary)] text-white"
                : "bg-[var(--color-surface-muted)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            }`}
          >
            All Creators ({opportunities.length})
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
            Verified Posted ({postedCount})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search handles or topics..."
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] py-1.5 pl-8 pr-3 text-xs text-[var(--color-foreground)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
          />
        </div>
      </div>

      {/* Creator & Discussion List */}
      <div className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden shadow-sm">
        {filteredOpps.length === 0 ? (
          <div className="p-8 text-center text-xs text-[var(--color-muted)]">
            No creator discussions match your search. Click &quot;⚡ Run X Creator Discovery&quot; to fetch fresh opportunities.
          </div>
        ) : (
          filteredOpps.map((opp) => {
            const isGenerating = generatingId === opp.id;
            const hasDraft = Boolean(opp.draftContent);
            const isPosted = opp.status === "posted";

            return (
              <div key={opp.id} className="p-5 hover:bg-[var(--color-surface-muted)] transition-colors space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1.5 max-w-xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-sky-500/10 border border-sky-500/20 px-2.5 py-0.5 text-xs font-mono font-bold text-sky-600">
                        @{opp.creatorHandle}
                      </span>
                      <StatusBadge status={opp.relevance} tone="positive" />
                      {isPosted && (
                        <span className="inline-flex items-center gap-1 rounded bg-green-500/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-success)]">
                          <CheckCircle2 size={12} />
                          Verified Posted
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-[var(--color-foreground)]">
                      {opp.topic}
                    </h3>

                    {opp.audienceNotes && (
                      <p className="text-xs text-[var(--color-muted)] leading-relaxed">
                        {opp.audienceNotes}
                      </p>
                    )}

                    {opp.whyRelevant && (
                      <p className="text-[11px] text-[var(--color-muted)]">
                        <strong>Why Relevant:</strong> {opp.whyRelevant}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 flex flex-wrap items-center gap-2 pt-1">
                    {opp.postUrl && (
                      <a
                        href={opp.postUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)] transition-colors"
                      >
                        <span>View on X</span>
                        <ExternalLink size={12} />
                      </a>
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
                          <span>Review &amp; Edit</span>
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
                      <span>Suggested Value-Add Reply ({opp.suggestedAction})</span>
                      <span className={isPosted ? "text-[var(--color-success)]" : "text-amber-600"}>
                        {isPosted ? "● Verified Posted" : "● Awaiting Manual Approval"}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--color-foreground)] leading-relaxed italic whitespace-pre-wrap">
                      &ldquo;{opp.draftContent}&rdquo;
                    </p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Draft Review Modal */}
      <XDraftModal
        opportunity={selectedOpp}
        websiteId={websiteId}
        isOpen={Boolean(selectedOpp)}
        onClose={() => setSelectedOpp(null)}
        onApproved={handleApproved}
      />
    </div>
  );
}
