"use client";

import { useState } from "react";
import Link from "next/link";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/badges";
import { PromptRunButton } from "@/components/prompt-run-button";
import { Check, X, RotateCcw, CheckCircle, XCircle, CheckCircle2 } from "lucide-react";

export interface PromptTableItem {
  id: string;
  text: string;
  intent: string | null;
  source: string;
  priority: number;
  status: string;
  approved: boolean;
  runs: {
    id: string;
    engine: string;
    citationFound: boolean | null;
    brandMentioned: boolean | null;
  }[];
}

interface PromptsTableClientProps {
  initialPrompts: PromptTableItem[];
  websiteId: string;
}

export function PromptsTableClient({ initialPrompts, websiteId }: PromptsTableClientProps) {
  const [prompts, setPrompts] = useState<PromptTableItem[]>(initialPrompts);
  const [statusFilter, setStatusFilter] = useState<"active" | "done" | "dismissed" | "all">("active");

  async function handleUpdateStatus(id: string, status: "active" | "done" | "dismissed") {
    try {
      const res = await fetch(`/api/ai/prompts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setPrompts((prev) =>
          prev.map((p) => (p.id === id ? { ...p, status } : p)),
        );
      }
    } catch (err) {
      console.error("Failed to update prompt status:", err);
    }
  }

  const activeCount = prompts.filter((p) => p.status !== "done" && p.status !== "dismissed").length;
  const doneCount = prompts.filter((p) => p.status === "done").length;
  const dismissedCount = prompts.filter((p) => p.status === "dismissed").length;

  const filtered = prompts.filter((p) => {
    if (statusFilter === "active") return p.status !== "done" && p.status !== "dismissed";
    if (statusFilter === "done") return p.status === "done";
    if (statusFilter === "dismissed") return p.status === "dismissed";
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 border-b border-[var(--color-border)] pb-3">
        <button
          type="button"
          onClick={() => setStatusFilter("active")}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
            statusFilter === "active"
              ? "bg-[var(--color-primary)] text-white"
              : "bg-[var(--color-surface-muted)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          }`}
        >
          Active Prompts ({activeCount})
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("done")}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
            statusFilter === "done"
              ? "bg-[var(--color-primary)] text-white"
              : "bg-[var(--color-surface-muted)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          }`}
        >
          Done / Optimized ({doneCount})
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("dismissed")}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
            statusFilter === "dismissed"
              ? "bg-[var(--color-primary)] text-white"
              : "bg-[var(--color-surface-muted)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          }`}
        >
          Dismissed ({dismissedCount})
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
            statusFilter === "all"
              ? "bg-[var(--color-primary)] text-white"
              : "bg-[var(--color-surface-muted)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          }`}
        >
          All ({prompts.length})
        </button>
      </div>

      <DataTable
        rows={filtered}
        getKey={(r) => r.id}
        empty="No prompts found matching current filter."
        columns={[
          {
            key: "text",
            header: "Prompt / Inquiry",
            render: (r) => (
              <div className="space-y-0.5 max-w-md">
                <Link
                  href={`/ai-visibility/prompts/${r.id}`}
                  className="font-medium text-sm hover:text-[var(--color-primary)] hover:underline"
                >
                  {r.text}
                </Link>
                <div className="flex items-center gap-2 text-[11px] text-[var(--color-muted)]">
                  <span className="uppercase">{r.intent || "informational"}</span>
                  <span>·</span>
                  <span>Source: {r.source}</span>
                  {r.status === "done" && (
                    <>
                      <span>·</span>
                      <span className="inline-flex items-center gap-0.5 text-[var(--color-success)] font-semibold">
                        <CheckCircle2 size={11} /> Done
                      </span>
                    </>
                  )}
                  {r.status === "dismissed" && (
                    <>
                      <span>·</span>
                      <span className="inline-flex items-center gap-0.5 text-[var(--color-muted)] font-semibold">
                        <XCircle size={11} /> Dismissed
                      </span>
                    </>
                  )}
                </div>
              </div>
            ),
          },
          {
            key: "priority",
            header: "Priority",
            render: (r) => (
              <StatusBadge
                status={r.priority === 3 ? "High" : r.priority === 2 ? "Medium" : "Low"}
                tone={r.priority === 3 ? "danger" : r.priority === 2 ? "warning" : "neutral"}
              />
            ),
          },
          {
            key: "approval",
            header: "Approval",
            render: (r) => (
              <span className={`inline-flex items-center gap-1 text-xs font-medium ${r.approved ? "text-[var(--color-success)]" : "text-amber-600"}`}>
                {r.approved ? <CheckCircle size={14} /> : <XCircle size={14} />}
                {r.approved ? "Approved" : "Needs Review"}
              </span>
            ),
          },
          {
            key: "recentRuns",
            header: "Recent Results",
            render: (r) => {
              if (r.runs.length === 0) {
                return <span className="text-xs text-[var(--color-muted)]">Not tested yet</span>;
              }
              return (
                <div className="flex flex-wrap gap-1">
                  {r.runs.map((run) => (
                    <span
                      key={run.id}
                      title={`${run.engine}: ${run.citationFound ? "Cited" : run.brandMentioned ? "Mentioned" : "Not Mentioned"}`}
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        run.citationFound
                          ? "bg-green-500/10 text-[var(--color-success)]"
                          : run.brandMentioned
                          ? "bg-blue-500/10 text-[var(--color-info)]"
                          : "bg-[var(--color-surface-muted)] text-[var(--color-muted)]"
                      }`}
                    >
                      {run.engine.slice(0, 4)}
                    </span>
                  ))}
                </div>
              );
            },
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
                    title="Restore prompt to active"
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
                      title="Mark prompt as done / optimized"
                    >
                      <Check size={12} />
                      <span>Done</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(r.id, "dismissed")}
                      className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs font-medium text-[var(--color-muted)] hover:text-red-500 hover:border-red-500/30 transition-colors"
                      title="Dismiss prompt"
                    >
                      <X size={12} />
                      <span>Dismiss</span>
                    </button>
                  </>
                )}
                <PromptRunButton promptId={r.id} websiteId={websiteId} promptText={r.text} />
                <Link
                  href={`/ai-visibility/prompts/${r.id}`}
                  className="rounded border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--color-surface-muted)]"
                >
                  Detail
                </Link>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
