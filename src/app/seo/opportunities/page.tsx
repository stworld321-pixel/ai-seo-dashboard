import { Card, CardHeader } from "@/components/card";
import { EmptyState, PageHeading } from "@/components/empty-state";
import { MetricCard } from "@/components/metric-card";
import { TodayPanel, type ActionItem } from "@/components/today-panel";
import { TopBar } from "@/components/top-bar";
import { formatNumber } from "@/lib/format";
import { getOpportunities } from "@/server/services/dashboard";
import { loadPageContext } from "@/server/services/page-context";

export const dynamic = "force-dynamic";

/**
 * Every detected opportunity, not just today's diverse top five. Filterable by
 * type. The detection itself runs during sync (see scripts/sync-litenatures.ts);
 * this page reads the persisted rows.
 */
export default async function OpportunitiesPage(props: PageProps<"/seo/opportunities">) {
  const searchParams = await props.searchParams;
  const { ctx, reason, websiteName } = await loadPageContext(searchParams);

  if (reason === "no-website") {
    return <EmptyState title="No website connected" message="Add a website and sync data first." />;
  }
  if (!ctx) {
    return (
      <EmptyState
        title={`${websiteName} has no data yet`}
        message="No Search Console rows have been synced for this website."
      />
    );
  }

  const { website, window, range } = ctx;
  const opps = await getOpportunities(website.id);

  const typeFilter = typeof searchParams.type === "string" ? searchParams.type : null;
  const visible = typeFilter ? opps.filter((o) => o.type === typeFilter) : opps;

  const types = [...new Set(opps.map((o) => o.type))];
  const byPriority = {
    p1: opps.filter((o) => o.priority === 1).length,
    p2: opps.filter((o) => o.priority === 2).length,
    p3plus: opps.filter((o) => o.priority >= 3).length,
  };

  const actions: ActionItem[] = visible.map((o) => ({
    id: o.id,
    type: o.type,
    priority: o.priority,
    keyword: o.keyword,
    targetUrl: o.targetUrl,
    estimatedClicks: o.estimatedClicks,
    why: o.why,
    evidence: o.evidence as Record<string, unknown>,
    recommendation: o.recommendation as { action: string; detail?: string }[],
  }));

  return (
    <>
      <TopBar
        websiteName={website.name}
        websiteUrl={website.url}
        range={range}
        lastSyncedAt={ctx.lastSyncedAt}
        dataThrough={window.to.toISOString().slice(0, 10)}
      />

      <div className="p-6">
        <PageHeading
          title="Opportunities"
          description="Detected by deterministic analysis of Search Console data — no AI guesswork. Expand any item to audit the evidence."
        />

        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard label="Total open" value={formatNumber(opps.length)} deltaLabel="detected" />
          <MetricCard label="Priority 1" value={formatNumber(byPriority.p1)} deltaLabel="act first" />
          <MetricCard label="Priority 2" value={formatNumber(byPriority.p2)} deltaLabel="next up" />
          <MetricCard label="Priority 3+" value={formatNumber(byPriority.p3plus)} deltaLabel="backlog" />
        </section>

        {types.length > 1 ? (
          <div className="mt-6 flex flex-wrap gap-1 text-xs">
            <a
              href={`/seo/opportunities?range=${range}`}
              className={`rounded px-2 py-1 ${!typeFilter ? "bg-[var(--color-primary)] text-[var(--color-primary-fg)]" : "border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"}`}
            >
              All ({opps.length})
            </a>
            {types.map((t) => (
              <a
                key={t}
                href={`/seo/opportunities?range=${range}&type=${t}`}
                className={`rounded px-2 py-1 ${typeFilter === t ? "bg-[var(--color-primary)] text-[var(--color-primary-fg)]" : "border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"}`}
              >
                {t.replace(/_/g, " ").toLowerCase()} ({opps.filter((o) => o.type === t).length})
              </a>
            ))}
          </div>
        ) : null}

        <div className="mt-6">
          {actions.length > 0 ? (
            <TodayPanel actions={actions} />
          ) : (
            <Card>
              <CardHeader title="No opportunities" />
              <div className="px-5 py-10 text-center text-sm text-[var(--color-muted)]">
                Nothing currently clears the detection thresholds. Opportunities are
                recomputed on each sync.
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
