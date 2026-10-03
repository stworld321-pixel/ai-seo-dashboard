"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  Sparkles,
  Loader2,
  CheckCircle2,
  Play,
  Filter,
  Search,
  Code2,
  Table,
  FileText,
  Link2,
  ArrowRight,
  ExternalLink,
  Check,
  X,
  XCircle,
  RotateCcw,
} from "lucide-react";
import { StatusBadge } from "./badges";
import { GeoImplementModal, type GeoOpportunityItem } from "./geo-implement-modal";

interface GeoAgentViewProps {
  websiteId: string;
  initialOpportunities: GeoOpportunityItem[];
}

export function GeoAgentView({ websiteId, initialOpportunities }: GeoAgentViewProps) {
  const router = useRouter();
  const [opportunities, setOpportunities] = useState<GeoOpportunityItem[]>(initialOpportunities);
  const [activeTab, setActiveTab] = useState<"all" | "open" | "schema" | "comparison" | "quick_answer" | "citation" | "done" | "dismissed">("open");
  const [searchQuery, setSearchQuery] = useState("");
  const [isRunningDiag, setIsRunningDiag] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [selectedOpp, setSelectedOpp] = useState<GeoOpportunityItem | null>(null);

  async function handleUpdateGeoStatus(oppId: string, status: "open" | "done" | "dismissed") {
    try {
      const res = await fetch("/api/geo/opportunities/status", {
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
      console.error("Failed to update GEO opportunity status", err);
    }
  }

  async function handleRunDiagnostics() {
    setIsRunningDiag(true);
    setStatusMessage("Running GEO entity and generative gap analysis...");
    try {
      const res = await fetch("/api/geo/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId }),
      });
      const json = await res.json();
      if (json.data?.opportunities) {
        setOpportunities(json.data.opportunities);
        setStatusMessage(`Diagnostic complete: ${json.data.totalGaps} actionable GEO gaps detected!`);
        router.refresh();
      }
    } catch {
      setStatusMessage("Diagnostic encountered an issue. Please try again.");
    } finally {
      setIsRunningDiag(false);
      setTimeout(() => setStatusMessage(null), 5000);
    }
  }

  function handleOpportunityImplemented(oppId: string) {
    setOpportunities((prev) =>
      prev.map((o) => (o.id === oppId ? { ...o, status: "done" } : o))
    );
    router.refresh();
  }

  const filteredOpps = opportunities.filter((opp) => {
    // Filter by tab
    if (activeTab === "open" && (opp.status === "done" || opp.status === "dismissed")) return false;
    if (activeTab === "done" && opp.status !== "done") return false;
    if (activeTab === "dismissed" && opp.status !== "dismissed") return false;
    if (activeTab !== "done" && activeTab !== "dismissed" && activeTab !== "all" && activeTab !== "open") {
      if (opp.status === "dismissed") return false;
      if (activeTab === "schema" && !opp.gapType.includes("schema") && !opp.gapType.includes("entity")) return false;
      if (activeTab === "comparison" && !opp.gapType.includes("comparison")) return false;
      if (activeTab === "quick_answer" && !opp.gapType.includes("quick") && !opp.gapType.includes("faq")) return false;
      if (activeTab === "citation" && !opp.gapType.includes("citation")) return false;
    }
    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        opp.title.toLowerCase().includes(q) ||
        opp.description.toLowerCase().includes(q) ||
        opp.recommendation.toLowerCase().includes(q) ||
        (opp.prompt?.text && opp.prompt.text.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const openCount = opportunities.filter((o) => o.status !== "done" && o.status !== "dismissed").length;
  const doneCount = opportunities.filter((o) => o.status === "done").length;
  const dismissedCount = opportunities.filter((o) => o.status === "dismissed").length;
  const schemaCount = opportunities.filter((o) => o.status !== "dismissed" && (o.gapType.includes("schema") || o.gapType.includes("entity"))).length;
  const comparisonCount = opportunities.filter((o) => o.status !== "dismissed" && o.gapType.includes("comparison")).length;
  const quickAnswerCount = opportunities.filter((o) => o.status !== "dismissed" && (o.gapType.includes("quick") || o.gapType.includes("faq"))).length;

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-primary)] text-white shadow-sm">
            <Bot size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">GEO Agent</h1>
              <span className="inline-flex items-center gap-1 rounded bg-green-500/10 px-2 py-0.5 text-xs font-semibold text-[var(--color-success)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" />
                Active Engine
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[var(--color-muted)]">
              Generative Engine Optimization — extracts JSON-LD schemas, tabular comparisons, and AEO quick-answer cards to rank in ChatGPT, Claude, Perplexity & Gemini.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {statusMessage && (
            <div className="flex items-center gap-1.5 rounded-md border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10 px-3 py-1.5 text-xs text-[var(--color-primary)] animate-in fade-in">
              {isRunningDiag ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} className="text-[var(--color-success)]" />}
              <span>{statusMessage}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleRunDiagnostics}
            disabled={isRunningDiag}
            className="flex items-center gap-1.5 rounded-md bg-[var(--color-primary)] px-3.5 py-1.5 text-xs font-semibold text-[var(--color-primary-fg)] hover:opacity-90 disabled:opacity-50 transition-all shadow-sm"
          >
            {isRunningDiag ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} className="fill-current" />}
            <span>{isRunningDiag ? "Diagnosing Gaps…" : "⚡ Run GEO Diagnostics"}</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
          <p className="text-xs font-medium text-[var(--color-muted)]">Active GEO Gaps</p>
          <p className="mt-1 text-2xl font-bold">{openCount}</p>
          <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">opportunities detected</p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
          <p className="text-xs font-medium text-[var(--color-muted)]">Schema & Entity Gaps</p>
          <p className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">{schemaCount}</p>
          <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">Product & JSON-LD markup</p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
          <p className="text-xs font-medium text-[var(--color-muted)]">Comparison Matrix Gaps</p>
          <p className="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-400">{comparisonCount}</p>
          <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">head-to-head tables</p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
          <p className="text-xs font-medium text-[var(--color-muted)]">AEO Quick Answers</p>
          <p className="mt-1 text-2xl font-bold text-purple-600 dark:text-purple-400">{quickAnswerCount}</p>
          <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">50-word answer cards</p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
          <p className="text-xs font-medium text-[var(--color-muted)]">Implemented</p>
          <p className="mt-1 text-2xl font-bold text-green-600 dark:text-green-400">{doneCount}</p>
          <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">deployed fixes</p>
        </div>
      </section>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--color-border)] pb-3">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab("open")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === "open"
                ? "bg-[var(--color-primary)] text-white"
                : "bg-[var(--color-surface-muted)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            }`}
          >
            Open Gaps ({openCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("schema")}
            className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === "schema"
                ? "bg-[var(--color-primary)] text-white"
                : "bg-[var(--color-surface-muted)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            }`}
          >
            <Code2 size={13} />
            Schema & Entities ({schemaCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("comparison")}
            className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === "comparison"
                ? "bg-[var(--color-primary)] text-white"
                : "bg-[var(--color-surface-muted)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            }`}
          >
            <Table size={13} />
            Comparison Matrices ({comparisonCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("quick_answer")}
            className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === "quick_answer"
                ? "bg-[var(--color-primary)] text-white"
                : "bg-[var(--color-surface-muted)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            }`}
          >
            <FileText size={13} />
            Quick Answers & FAQs ({quickAnswerCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("done")}
            className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === "done"
                ? "bg-emerald-600 text-white"
                : "bg-[var(--color-surface-muted)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            }`}
          >
            <CheckCircle2 size={13} />
            Done ({doneCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("dismissed")}
            className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === "dismissed"
                ? "bg-gray-600 text-white"
                : "bg-[var(--color-surface-muted)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            }`}
          >
            <XCircle size={13} />
            Dismissed ({dismissedCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === "all"
                ? "bg-[var(--color-surface)] text-[var(--color-foreground)] border border-[var(--color-border)]"
                : "bg-[var(--color-surface-muted)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            }`}
          >
            All ({opportunities.length})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search gaps or prompts..."
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] py-1.5 pl-8 pr-3 text-xs text-[var(--color-foreground)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
          />
        </div>
      </div>

      {/* Opportunities List */}
      <div className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
        {filteredOpps.length === 0 ? (
          <div className="p-8 text-center text-xs text-[var(--color-muted)]">
            No GEO opportunities match the selected criteria.
          </div>
        ) : (
          filteredOpps.map((opp) => {
            const isDone = opp.status === "done";
            const isDismissed = opp.status === "dismissed";
            return (
              <div
                key={opp.id}
                className={`p-4 transition-colors hover:bg-[var(--color-surface-muted)] ${
                  isDone ? "opacity-70 bg-gray-50/50 dark:bg-gray-900/20" : isDismissed ? "opacity-50" : ""
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1.5 max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-[var(--color-surface-muted)] border border-[var(--color-border)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--color-primary)]">
                        {opp.gapType}
                      </span>
                      <StatusBadge
                        status={opp.priority === 3 ? "High Impact" : "Medium"}
                        tone={opp.priority === 3 ? "danger" : "warning"}
                      />
                      {isDone && (
                        <span className="inline-flex items-center gap-1 rounded bg-green-500/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-success)]">
                          <CheckCircle2 size={12} />
                          Implemented
                        </span>
                      )}
                      {isDismissed && (
                        <span className="inline-flex items-center gap-1 rounded bg-gray-500/10 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
                          <X size={12} />
                          Dismissed
                        </span>
                      )}
                      <h4 className={`text-sm font-semibold text-[var(--color-foreground)] ${isDismissed ? "line-through opacity-70" : ""}`}>
                        {opp.title}
                      </h4>
                    </div>

                    <p className="text-xs text-[var(--color-foreground)]">{opp.description}</p>

                    <div className="rounded border border-[var(--color-border)]/60 bg-[var(--color-surface-muted)]/50 p-2.5 text-xs text-[var(--color-foreground)] space-y-1">
                      <p className="text-[11px] font-semibold text-[var(--color-primary)]">
                        💡 Recommended Fix:
                      </p>
                      <p>{opp.recommendation}</p>
                    </div>

                    {opp.prompt?.text && (
                      <p className="text-[11px] text-[var(--color-muted)]">
                        <strong>Target AI Prompt:</strong> &ldquo;{opp.prompt.text}&rdquo;
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 flex items-center gap-1.5 pt-1">
                    {!isDone && !isDismissed && (
                      <button
                        type="button"
                        onClick={() => setSelectedOpp(opp)}
                        className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--color-primary-fg)] hover:opacity-90 transition-opacity shadow-sm"
                      >
                        <Sparkles size={13} />
                        <span>Implement</span>
                      </button>
                    )}

                    {!isDone ? (
                      <button
                        type="button"
                        onClick={() => handleUpdateGeoStatus(opp.id, "done")}
                        className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                        title="Mark as Done"
                      >
                        <Check size={12} />
                        <span>Done</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleUpdateGeoStatus(opp.id, "open")}
                        className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-foreground)] transition-colors"
                        title="Reopen gap"
                      >
                        <RotateCcw size={12} />
                        <span>Reopen</span>
                      </button>
                    )}

                    {!isDismissed ? (
                      <button
                        type="button"
                        onClick={() => handleUpdateGeoStatus(opp.id, "dismissed")}
                        className="inline-flex items-center gap-1 rounded border border-gray-500/20 bg-gray-500/5 px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                        title="Dismiss gap"
                      >
                        <X size={12} />
                        <span>Dismiss</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleUpdateGeoStatus(opp.id, "open")}
                        className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-foreground)] transition-colors"
                        title="Restore gap"
                      >
                        <RotateCcw size={12} />
                        <span>Restore</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* GEO Implementation Modal */}
      <GeoImplementModal
        opportunity={selectedOpp}
        websiteId={websiteId}
        isOpen={Boolean(selectedOpp)}
        onClose={() => setSelectedOpp(null)}
        onImplemented={handleOpportunityImplemented}
      />
    </div>
  );
}
