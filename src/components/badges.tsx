import { cn } from "@/lib/format";

const PRIORITY_STYLES: Record<number, string> = {
  1: "bg-[var(--color-danger-bg)] text-[var(--color-danger)] border-[var(--color-danger)]/20",
  2: "bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[var(--color-warning)]/20",
  3: "bg-amber-50 text-amber-700 border-amber-200",
  4: "bg-[var(--color-surface-muted)] text-[var(--color-muted)] border-[var(--color-border)]",
  5: "bg-[var(--color-surface-muted)] text-[var(--color-muted)] border-[var(--color-border)]",
};

export function PriorityBadge({ priority }: { priority: number }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 min-w-6 items-center justify-center rounded-md border px-1.5 text-xs font-semibold tabular",
        PRIORITY_STYLES[priority] ?? PRIORITY_STYLES[5],
      )}
    >
      P{priority}
    </span>
  );
}

const TYPE_LABELS: Record<string, string> = {
  QUICK_WIN: "Quick win",
  PAGE_TWO: "Page 2",
  CTR_GAP: "CTR gap",
  DECLINING_KEYWORD: "Declining keyword",
  DECLINING_PAGE: "Declining page",
  CONTENT_DECAY: "Content decay",
  CONTENT_GAP: "Content gap",
  CANNIBALIZATION: "Cannibalization",
  INTERNAL_LINK: "Internal link",
  SCHEMA_MISSING: "Schema",
  AEO_GAP: "AEO",
  TECHNICAL: "Technical",
};

export function TypeBadge({ type }: { type: string }) {
  return (
    <span className="inline-flex items-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2 py-0.5 text-xs font-medium text-[var(--color-muted)]">
      {TYPE_LABELS[type] ?? type}
    </span>
  );
}

export function StatusBadge({
  status,
  tone = "neutral",
}: {
  status: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "info" | "positive";
}) {
  const tones = {
    neutral: "bg-[var(--color-surface-muted)] text-[var(--color-muted)] border-[var(--color-border)]",
    info: "bg-[var(--color-info)]/15 text-[var(--color-info)] border-[var(--color-info)]/20",
    positive: "bg-[var(--color-success-bg)] text-[var(--color-success)] border-[var(--color-success)]/20",
    success: "bg-[var(--color-success-bg)] text-[var(--color-success)] border-[var(--color-success)]/20",
    warning: "bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[var(--color-warning)]/20",
    danger: "bg-[var(--color-danger-bg)] text-[var(--color-danger)] border-[var(--color-danger)]/20",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        tones[tone],
      )}
    >
      {status}
    </span>
  );
}
