"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  ExternalLink,
  RotateCcw,
  Zap,
} from "lucide-react";
import { PriorityBadge, TypeBadge } from "./badges";
import { OpportunityImplementModal } from "./opportunity-implement-modal";
import type { ActionItem } from "./today-panel";
import { shortenUrl } from "@/lib/format";

interface DashboardActionCenterProps {
  initialActions: ActionItem[];
  websiteName: string;
}

export function DashboardActionCenter({ initialActions, websiteName }: DashboardActionCenterProps) {
  const [actions, setActions] = useState<ActionItem[]>(initialActions);
  const [filter, setFilter] = useState<"all" | "open" | "done" | "dismissed">("open");
  const [implementAction, setImplementAction] = useState<ActionItem | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function updateStatus(id: string, newStatus: "DONE" | "DISMISSED" | "OPEN") {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/seo/opportunities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setActions((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status: newStatus } : a)),
        );
      }
    } catch {
      // ignore
    } finally {
      setUpdatingId(null);
    }
  }

  const counts = {
    open: actions.filter((a) => !a.status || a.status === "OPEN" || a.status === "IN_PROGRESS").length,
    done: actions.filter((a) => a.status === "DONE").length,
    dismissed: actions.filter((a) => a.status === "DISMISSED").length,
    total: actions.length,
  };

  const visibleActions = actions.filter((a) => {
    const s = a.status || "OPEN";
    if (filter === "open") return s === "OPEN" || s === "IN_PROGRESS";
    if (filter === "done") return s === "DONE";
    if (filter === "dismissed") return s === "DISMISSED";
    return true;
  });

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface-muted)]/40 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-[var(--color-foreground)] tracking-tight">
              Top SEO Actions & Recommendations
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-primary)]/10 px-2 py-0.5 text-[11px] font-semibold text-[var(--color-primary)]">
              <Zap className="h-3 w-3" /> Quick Wins & Fixes
            </span>
          </div>
          <p className="mt-0.5 text-xs text-[var(--color-muted)]">
            High-ROI ranking opportunities for {websiteName}. Complete tasks, implement with AI, or dismiss unwanted items.
          </p>
        </div>

        <Link
          href="/seo/opportunities"
          className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)] transition-colors shadow-2xs"
        >
          <span>View All Opportunities</span>
          <ArrowRight className="h-3 w-3 opacity-60" />
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-2.5 text-xs font-medium">
        <button
          onClick={() => setFilter("open")}
          className={`rounded-lg px-2.5 py-1 transition-colors ${
            filter === "open"
              ? "bg-[var(--color-primary)] text-[var(--color-primary-fg)] font-semibold shadow-xs"
              : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          }`}
        >
          Open Tasks ({counts.open})
        </button>
        <button
          onClick={() => setFilter("done")}
          className={`rounded-lg px-2.5 py-1 transition-colors ${
            filter === "done"
              ? "bg-emerald-600 text-white font-semibold shadow-xs"
              : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          }`}
        >
          Done ({counts.done})
        </button>
        <button
          onClick={() => setFilter("dismissed")}
          className={`rounded-lg px-2.5 py-1 transition-colors ${
            filter === "dismissed"
              ? "bg-gray-600 text-white font-semibold shadow-xs"
              : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          }`}
        >
          Dismissed ({counts.dismissed})
        </button>
        <button
          onClick={() => setFilter("all")}
          className={`rounded-lg px-2.5 py-1 transition-colors ${
            filter === "all"
              ? "bg-[var(--color-surface-muted)] text-[var(--color-foreground)] font-semibold"
              : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          }`}
        >
          All ({counts.total})
        </button>
      </div>

      {/* Action Items List */}
      <div className="divide-y divide-[var(--color-border)]">
        {visibleActions.length === 0 ? (
          <div className="p-8 text-center text-xs text-[var(--color-muted)]">
            No actions found in this status view.
          </div>
        ) : (
          visibleActions.slice(0, 6).map((action) => {
            const isDone = action.status === "DONE";
            const isDismissed = action.status === "DISMISSED";
            const isBusy = updatingId === action.id;

            return (
              <div
                key={action.id}
                className={`p-4 transition-colors hover:bg-[var(--color-surface-muted)]/40 ${
                  isDone ? "bg-[var(--color-surface-muted)]/30 opacity-80" : isDismissed ? "opacity-50" : ""
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <PriorityBadge priority={action.priority} />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-xs font-semibold text-[var(--color-foreground)]">
                          {action.keyword || shortenUrl(action.targetUrl || "")}
                        </span>
                        <TypeBadge type={action.type} />

                        {isDone && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 size={11} /> Done
                          </span>
                        )}
                        {isDismissed && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-500/10 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
                            <XCircle size={11} /> Dismissed
                          </span>
                        )}
                      </div>

                      <p className="mt-1 line-clamp-2 text-xs text-[var(--color-muted)] leading-relaxed">
                        {action.why}
                      </p>
                    </div>
                  </div>

                  {/* Action Controls */}
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    {!isDone && !isDismissed && (
                      <button
                        onClick={() => setImplementAction(action)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--color-primary-fg)] shadow-xs hover:opacity-90 active:scale-95 transition-all"
                      >
                        <Sparkles size={12} />
                        Implement
                      </button>
                    )}

                    {!isDone ? (
                      <button
                        onClick={() => updateStatus(action.id, "DONE")}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
                        title="Mark as Done"
                      >
                        <CheckCircle2 size={12} />
                        <span>Done</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => updateStatus(action.id, "OPEN")}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-foreground)] disabled:opacity-50 transition-colors"
                        title="Reopen action"
                      >
                        <RotateCcw size={12} />
                        <span>Reopen</span>
                      </button>
                    )}

                    {!isDismissed ? (
                      <button
                        onClick={() => updateStatus(action.id, "DISMISSED")}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-500/20 bg-gray-500/5 px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:bg-red-500/10 hover:text-red-600 disabled:opacity-50 transition-colors"
                        title="Dismiss action"
                      >
                        <XCircle size={12} />
                        <span>Dismiss</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => updateStatus(action.id, "OPEN")}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-foreground)] disabled:opacity-50 transition-colors"
                        title="Restore action"
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

      {implementAction && (
        <OpportunityImplementModal
          action={implementAction}
          isOpen={Boolean(implementAction)}
          onClose={() => setImplementAction(null)}
          onImplemented={(newStatus) => {
            setActions((prev) =>
              prev.map((a) => (a.id === implementAction.id ? { ...a, status: newStatus } : a)),
            );
          }}
        />
      )}
    </div>
  );
}
