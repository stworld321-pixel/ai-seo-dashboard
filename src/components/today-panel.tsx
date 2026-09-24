"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { PriorityBadge, TypeBadge } from "./badges";
import { formatNumber, shortenUrl } from "@/lib/format";

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
};

/**
 * Spec §38: every action must answer Why / Expected objective / Affected URL /
 * Keyword / Evidence, and offer an action button. The evidence drawer exposes
 * the raw measured numbers so a user can audit any claim the system makes.
 */
export function TodayPanel({ actions }: { actions: ActionItem[] }) {
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

  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-primary)] px-5 py-3.5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-primary-fg)]">
          What should I do today?
        </h2>
        <span className="text-xs text-[var(--color-primary-fg)]/70">
          {actions.length} prioritized {actions.length === 1 ? "action" : "actions"}
        </span>
      </div>
      <ul className="divide-y divide-[var(--color-border)]">
        {actions.map((a) => (
          <ActionRow key={a.id} action={a} />
        ))}
      </ul>
    </div>
  );
}

function ActionRow({ action }: { action: ActionItem }) {
  const [open, setOpen] = useState(false);

  return (
    <li className="px-5 py-4">
      <div className="flex items-start gap-3">
        <PriorityBadge priority={action.priority} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold">
              {action.keyword ?? shortenUrl(action.targetUrl ?? "")}
            </span>
            <TypeBadge type={action.type} />
          </div>

          <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-muted)]">{action.why}</p>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            {action.targetUrl ? (
              <a
                href={action.targetUrl}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-[var(--color-info)] hover:underline"
              >
                {shortenUrl(action.targetUrl)}
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

          <div className="mt-3 flex flex-wrap gap-2">
            {action.recommendation.slice(0, 4).map((r) => (
              <span
                key={r.action}
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2 py-1 text-xs"
                title={r.detail}
              >
                {r.action}
              </span>
            ))}
          </div>

          <button
            onClick={() => setOpen((v) => !v)}
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          >
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Evidence
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
