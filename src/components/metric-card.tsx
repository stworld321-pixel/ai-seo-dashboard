import { cn, formatDelta } from "@/lib/format";
import { Card } from "./card";

/**
 * A single KPI. Three states, because honesty about missing data matters more
 * than a tidy grid:
 *   - value present          → number + delta
 *   - `empty` set            → the reason the number is absent (e.g. "Connect GA4")
 *   - delta null             → em dash, never a fabricated percentage
 */
export function MetricCard({
  label,
  value,
  delta,
  deltaLabel,
  hint,
  empty,
  invertDelta = false,
}: {
  label: string;
  value?: string;
  delta?: number | null;
  deltaLabel?: string;
  hint?: string;
  empty?: string;
  /** For metrics where lower is better (average position). */
  invertDelta?: boolean;
}) {
  const good = delta === null || delta === undefined ? null : invertDelta ? delta < 0 : delta > 0;

  return (
    <Card className="px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
        {label}
      </p>

      {empty ? (
        <>
          <p className="mt-2 text-2xl font-semibold tabular text-[var(--color-muted)]">—</p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">{empty}</p>
        </>
      ) : (
        <>
          <p className="mt-2 text-2xl font-semibold tabular">{value}</p>
          <div className="mt-1 flex items-center gap-2 text-xs">
            <span
              className={cn(
                "font-medium tabular",
                good === null && "text-[var(--color-muted)]",
                good === true && "text-[var(--color-success)]",
                good === false && "text-[var(--color-danger)]",
              )}
            >
              {deltaLabel ?? formatDelta(delta ?? null)}
            </span>
            {hint ? <span className="text-[var(--color-muted)]">{hint}</span> : null}
          </div>
        </>
      )}
    </Card>
  );
}
