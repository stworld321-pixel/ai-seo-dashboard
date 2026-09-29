import { Suspense } from "react";
import { RangePicker } from "@/components/range-picker";
import { LiveSyncButton } from "@/components/live-sync-button";
import { WebsiteSwitcher, type WebsiteOption } from "@/components/website-switcher";
import { relativeTime } from "@/lib/format";

export function TopBar({
  websiteName,
  websiteUrl,
  range,
  lastSyncedAt,
  dataThrough,
  websiteId,
  allWebsites,
}: {
  websiteName: string;
  websiteUrl: string;
  range: string;
  lastSyncedAt: Date | null;
  dataThrough: string | null;
  websiteId?: string;
  allWebsites?: WebsiteOption[];
}) {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 px-6 backdrop-blur">
      <Suspense
        fallback={
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[var(--color-foreground)]">{websiteName}</p>
            <p className="truncate font-mono text-[11px] text-[var(--color-muted)]">{websiteUrl}</p>
          </div>
        }
      >
        <WebsiteSwitcher
          currentWebsite={{ id: websiteId || "default", name: websiteName, url: websiteUrl }}
          websites={allWebsites}
        />
      </Suspense>

      <div className="flex items-center gap-3">
        <div className="hidden text-right text-xs text-[var(--color-muted)] sm:block">
          <p>Synced {relativeTime(lastSyncedAt)}</p>
          {dataThrough ? <p>Data through {dataThrough}</p> : null}
        </div>
        <LiveSyncButton />
        <Suspense fallback={null}>
          <RangePicker current={range} />
        </Suspense>
      </div>
    </header>
  );
}
