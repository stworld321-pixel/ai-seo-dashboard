"use client";

import { useState } from "react";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/badges";
import { Check, X, RotateCcw, CheckCircle2, XCircle } from "lucide-react";

export interface CitationGapItem {
  id: string;
  promptText: string;
  intent: string | null;
  priority: number;
  status: string;
  competitorCited: string;
  citedSource: string;
  brandStatus: string;
  missingEntity: string;
  recommendedContent: string;
  recommendedExternalAuthority: string;
}

interface CitationGapsClientViewProps {
  initialGaps: CitationGapItem[];
}

export function CitationGapsClientView({ initialGaps }: CitationGapsClientViewProps) {
  const [gaps, setGaps] = useState<CitationGapItem[]>(initialGaps);
  const [filter, setFilter] = useState<"active" | "done" | "dismissed" | "all">("active");

  async function handleUpdateStatus(id: string, status: "active" | "done" | "dismissed") {
    try {
      const res = await fetch(`/api/ai/prompts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setGaps((prev) =>
          prev.map((g) => (g.id === id ? { ...g, status } : g)),
        );
      }
    } catch (err) {
      console.error("Failed to update citation gap status:", err);
    }
  }

  const activeCount = gaps.filter((g) => g.status !== "done" && g.status !== "dismissed").length;
  const doneCount = gaps.filter((g) => g.status === "done").length;
  const dismissedCount = gaps.filter((g) => g.status === "dismissed").length;

  const filtered = gaps.filter((g) => {
    if (filter === "active") return g.status !== "done" && g.status !== "dismissed";
    if (filter === "done") return g.status === "done";
    if (filter === "dismissed") return g.status === "dismissed";
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 border-b border-[var(--color-border)] pb-3">
        <button
          type="button"
          onClick={() => setFilter("active")}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
            filter === "active"
              ? "bg-[var(--color-primary)] text-white"
              : "bg-[var(--color-surface-muted)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          }`}
        >
          Active Gaps ({activeCount})
        </button>
        <button
          type="button"
          onClick={() => setFilter("done")}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
            filter === "done"
              ? "bg-[var(--color-primary)] text-white"
              : "bg-[var(--color-surface-muted)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          }`}
        >
          Done / Resolved ({doneCount})
        </button>
        <button
          type="button"
          onClick={() => setFilter("dismissed")}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
            filter === "dismissed"
              ? "bg-[var(--color-primary)] text-white"
              : "bg-[var(--color-surface-muted)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          }`}
        >
          Dismissed ({dismissedCount})
        </button>
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
            filter === "all"
              ? "bg-[var(--color-primary)] text-white"
              : "bg-[var(--color-surface-muted)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          }`}
        >
          All ({gaps.length})
        </button>
      </div>

      <DataTable
        rows={filtered}
        getKey={(r) => r.id}
        empty="No citation gaps found matching current filter."
        columns={[
          {
            key: "prompt",
            header: "Prompt",
            render: (r) => (
              <div className="space-y-0.5 max-w-xs">
                <p className="font-medium text-xs text-[var(--color-foreground)]">{r.promptText}</p>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-[var(--color-muted)] uppercase">{r.intent}</span>
                  {r.status === "done" && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-[var(--color-success)] font-semibold">
                      <CheckCircle2 size={11} />
                      Done
                    </span>
                  )}
                  {r.status === "dismissed" && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-[var(--color-muted)] font-semibold">
                      <XCircle size={11} />
                      Dismissed
                    </span>
                  )}
                </div>
              </div>
            ),
          },
          {
            key: "competitor",
            header: "Competitor Cited",
            render: (r) => <span className="text-xs font-semibold text-amber-600">{r.competitorCited}</span>,
          },
          {
            key: "source",
            header: "Cited Source Domain",
            render: (r) => <span className="font-mono text-xs text-[var(--color-foreground)]">{r.citedSource}</span>,
          },
          {
            key: "brandStatus",
            header: "Our Status",
            render: (r) => (
              <StatusBadge
                status={r.brandStatus}
                tone={r.brandStatus.includes("Mentioned") ? "warning" : "danger"}
              />
            ),
          },
          {
            key: "recommendation",
            header: "Actionable Opportunity",
            render: (r) => (
              <div className="space-y-1 text-xs max-w-sm">
                <p className="text-[var(--color-foreground)] font-medium">• {r.recommendedContent}</p>
                <p className="text-[var(--color-muted)]">• {r.recommendedExternalAuthority}</p>
              </div>
            ),
          },
          {
            key: "priority",
            header: "Priority",
            render: (r) => (
              <StatusBadge
                status={r.priority === 3 ? "High" : "Medium"}
                tone={r.priority === 3 ? "danger" : "neutral"}
              />
            ),
          },
          {
            key: "actions",
            header: "Actions",
            align: "right",
            render: (r) => (
              <div className="flex items-center justify-end gap-1.5">
                {r.status === "done" || r.status === "dismissed" ? (
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(r.id, "active")}
                    className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)] transition-colors"
                    title="Restore gap"
                  >
                    <RotateCcw size={12} />
                    <span>Restore</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(r.id, "done")}
                      className="inline-flex items-center gap-1 rounded border border-green-500/20 bg-green-500/5 px-2 py-1 text-xs font-medium text-[var(--color-success)] hover:bg-green-500/15 transition-colors"
                      title="Mark as done / resolved"
                    >
                      <Check size={12} />
                      <span>Done</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(r.id, "dismissed")}
                      className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs font-medium text-[var(--color-muted)] hover:text-red-500 hover:border-red-500/30 transition-colors"
                      title="Dismiss gap"
                    >
                      <X size={12} />
                      <span>Dismiss</span>
                    </button>
                  </>
                )}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
