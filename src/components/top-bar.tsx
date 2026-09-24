import { Suspense } from "react";
import { RangePicker } from "@/components/range-picker";
import { relativeTime } from "@/lib/format";

/**
 * Top bar: which website, which date range, and how fresh the data is.
 * Freshness is shown explicitly because every number below it comes from our
 * database rather than a live API call — the user should always know how old
 * "now" actually is.
 */
export function TopBar({
  websiteName,
  websiteUrl,
  range,
  lastSyncedAt,
  dataThrough,
}: {
  websiteName: string;
  websiteUrl: string;
  range: string;
  lastSyncedAt: Date | null;
  dataThrough: string | null;
}) {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 px-6 backdrop-blur">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{websiteName}</p>
        <p className="truncate text-xs text-[var(--color-muted)]">{websiteUrl}</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden text-right text-xs text-[var(--color-muted)] sm:block">
          <p>Synced {relativeTime(lastSyncedAt)}</p>
          {dataThrough ? <p>Data through {dataThrough}</p> : null}
        </div>
        <Suspense fallback={null}>
          <RangePicker current={range} />
        </Suspense>
      </div>
    </header>
  );
}
