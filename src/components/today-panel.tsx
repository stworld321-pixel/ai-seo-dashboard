"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  Clock,
  XCircle,
  Check,
  MoreHorizontal,
  ArrowUpRight,
} from "lucide-react";
import { PriorityBadge, TypeBadge } from "./badges";
import { formatNumber, shortenUrl } from "@/lib/format";
import { OpportunityImplementModal } from "./opportunity-implement-modal";

export type ActionItem = {
  id: string;
  type: string;
  priority: number;
  keyword: string | null;
  targetUrl: string | null;
  estimatedClicks: number | null;
  why: string;
  evidence: Record<string, unknown>;
  recommendation: { action: string; detail?: string }[];
  status?: string;
};

/**
 * Spec §38: every action must answer Why / Expected objective / Affected URL /
 * Keyword / Evidence, and offer actionable implementation workflows.
 */
export function TodayPanel({ actions: initialActions }: { actions: ActionItem[] }) {
  const [actions, setActions] = useState<ActionItem[]>(initialActions);
  const [implementingAction, setImplementingAction] = useState<ActionItem | null>(null);

  if (actions.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
        <p className="text-sm font-medium">No actionable opportunities detected</p>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          Either the data has not been synced yet, or nothing currently clears the
          impression thresholds. Run <code className="font-mono">npm run sync:lite</code>.
        </p>
      </div>
    );
  }

  function handleStatusUpdate(id: string, newStatus: string) {
    setActions((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: newStatus } : a)),
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-primary)] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-[var(--color-primary-fg)]" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-primary-fg)]">
              What should I do today?
            </h2>
          </div>
          <span className="text-xs text-[var(--color-primary-fg)]/80 font-medium">
            {actions.length} prioritized {actions.length === 1 ? "action" : "actions"}
          </span>
        </div>
        <ul className="divide-y divide-[var(--color-border)]">
          {actions.map((a) => (
            <ActionRow
              key={a.id}
              action={a}
              onOpenImplement={() => setImplementingAction(a)}
              onStatusChange={(newStatus) => handleStatusUpdate(a.id, newStatus)}
            />
          ))}
        </ul>
      </div>

      {implementingAction && (
        <OpportunityImplementModal
          action={implementingAction}
          isOpen={Boolean(implementingAction)}
          onClose={() => setImplementingAction(null)}
          onImplemented={(id, newStatus) => {
            handleStatusUpdate(id, newStatus);
          }}
        />
      )}
    </>
  );
}

function ActionRow({
  action,
  onOpenImplement,
  onStatusChange,
}: {
  action: ActionItem;
  onOpenImplement: () => void;
  onStatusChange: (status: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const status = action.status || "OPEN";
  const isDone = status === "DONE";
  const isInProgress = status === "IN_PROGRESS" || status === "AWAITING_APPROVAL";
  const isDismissed = status === "DISMISSED";

  async function handleDirectStatus(newStatus: "DONE" | "DISMISSED" | "OPEN") {
    setIsUpdating(true);
    setMenuOpen(false);
    try {
      const res = await fetch(`/api/seo/opportunities/${action.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        onStatusChange(newStatus);
      }
    } catch {
      // ignore
    } finally {
      setIsUpdating(false);
    }
  }

  // Get primary button label based on opportunity type
  const actionButtonText =
    action.type === "QUICK_WIN" || action.type === "CTR_GAP"
      ? "⚡ Optimize Meta"
      : action.type === "INTERNAL_LINK"
        ? "🔗 Insert Links"
        : "📝 Generate Article";

  return (
    <li className={`px-5 py-4 transition-colors ${isDone ? "bg-[var(--color-surface-muted)]/50 opacity-75" : isDismissed ? "opacity-50" : ""}`}>
      <div className="flex items-start gap-3">
        <PriorityBadge priority={action.priority} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-semibold text-[var(--color-foreground)]">
                {action.keyword ?? shortenUrl(action.targetUrl ?? "")}
              </span>
              <TypeBadge type={action.type} />

              {/* Status Badge */}
              {isInProgress && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-info)]/15 px-2 py-0.5 text-[11px] font-medium text-[var(--color-info)]">
                  <Clock size={11} className="animate-spin" />
                  In Progress / Queued
                </span>
              )}
              {isDone && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success)]/15 px-2 py-0.5 text-[11px] font-medium text-[var(--color-success)]">
                  <CheckCircle2 size={11} />
                  Implemented
                </span>
              )}
              {isDismissed && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-muted)]/20 px-2 py-0.5 text-[11px] font-medium text-[var(--color-muted)]">
                  <XCircle size={11} />
                  Dismissed
                </span>
              )}
            </div>

            {/* Direct Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={onOpenImplement}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--color-primary-fg)] shadow-xs transition-opacity hover:opacity-90 active:scale-95"
              >
                <Sparkles size={13} />
                {actionButtonText}
              </button>

              <div className="relative">
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  disabled={isUpdating}
                  className="rounded-lg border border-[var(--color-border)] p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-foreground)]"
                  title="More actions"
                >
                  <MoreHorizontal size={14} />
                </button>

                {menuOpen && (
                  <div className="absolute right-0 top-full z-20 mt-1 w-36 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-lg text-xs">
                    {!isDone && (
                      <button
                        onClick={() => handleDirectStatus("DONE")}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)]"
                      >
                        <Check size={13} className="text-[var(--color-success)]" />
                        Mark as Done
                      </button>
                    )}
                    {isDone && (
                      <button
                        onClick={() => handleDirectStatus("OPEN")}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)]"
                      >
                        <Clock size={13} />
                        Re-open
                      </button>
                    )}
                    {!isDismissed ? (
                      <button
                        onClick={() => handleDirectStatus("DISMISSED")}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[var(--color-danger)] hover:bg-[var(--color-surface-muted)]"
                      >
                        <XCircle size={13} />
                        Dismiss
                      </button>
                    ) : (
                      <button
                        onClick={() => handleDirectStatus("OPEN")}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)]"
                      >
                        <Clock size={13} />
                        Restore
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-muted)]">{action.why}</p>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            {action.targetUrl ? (
              <a
                href={action.targetUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-mono text-[var(--color-info)] hover:underline"
              >
                {shortenUrl(action.targetUrl)}
                <ArrowUpRight size={11} />
              </a>
            ) : null}
            <span className="text-[var(--color-muted)]">
              Expected:{" "}
              {action.estimatedClicks !== null ? (
                <span className="font-medium text-[var(--color-foreground)] tabular">
                  ~{formatNumber(action.estimatedClicks)} clicks
                  <span className="font-normal text-[var(--color-muted)]"> (estimate)</span>
                </span>
              ) : (
                <span className="italic">not modelled — insufficient click history</span>
              )}
            </span>
          </div>

          {/* Interactive Recommendation Chips */}
          <div className="mt-3 flex flex-wrap gap-2">
            {action.recommendation.slice(0, 4).map((r) => (
              <button
                key={r.action}
                onClick={onOpenImplement}
                className="group inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2.5 py-1 text-xs text-[var(--color-foreground)] transition-colors hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/10"
                title={r.detail ?? "Click to implement with AI"}
              >
                <Sparkles size={11} className="text-[var(--color-primary)] opacity-70 group-hover:opacity-100" />
                <span>{r.action}</span>
              </button>
            ))}
          </div>

          <button
            onClick={() => setOpen((v) => !v)}
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          >
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Auditable Evidence
          </button>

          {open ? (
            <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 text-xs sm:grid-cols-3">
              {Object.entries(action.evidence).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <dt className="text-[var(--color-muted)]">{humanize(k)}</dt>
                  <dd className="font-medium tabular">
                    {v === null ? <span className="italic text-[var(--color-muted)]">n/a</span> : String(v)}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function humanize(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}
