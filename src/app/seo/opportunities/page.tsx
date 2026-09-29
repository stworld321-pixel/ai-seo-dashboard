import { Card, CardHeader } from "@/components/card";
import { EmptyState, PageHeading } from "@/components/empty-state";
import { MetricCard } from "@/components/metric-card";
import { TodayPanel, type ActionItem } from "@/components/today-panel";
import { TopBar } from "@/components/top-bar";
import { formatNumber } from "@/lib/format";
import { getOpportunities } from "@/server/services/dashboard";
import { loadPageContext } from "@/server/services/page-context";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

/**
 * Every detected opportunity, filterable by status and type.
 * Each opportunity is directly actionable and implementable with AI.
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

  const statusFilter =
    typeof searchParams.status === "string"
      ? (searchParams.status.toUpperCase() as "OPEN" | "IN_PROGRESS" | "DONE" | "DISMISSED" | "ALL")
      : "OPEN";

  const allOpps = await prisma.opportunity.findMany({
    where: { websiteId: website.id },
    orderBy: { score: "desc" },
  });

  const typeFilter = typeof searchParams.type === "string" ? searchParams.type : null;

  const filteredByStatus =
    statusFilter === "ALL"
      ? allOpps
      : allOpps.filter((o) => o.status === statusFilter);

  const visible = typeFilter
    ? filteredByStatus.filter((o) => o.type === typeFilter)
    : filteredByStatus;

  const counts = {
    open: allOpps.filter((o) => o.status === "OPEN").length,
    inProgress: allOpps.filter((o) => o.status === "IN_PROGRESS" || o.status === "AWAITING_APPROVAL").length,
    done: allOpps.filter((o) => o.status === "DONE").length,
    dismissed: allOpps.filter((o) => o.status === "DISMISSED").length,
    total: allOpps.length,
  };

  const byPriority = {
    p1: filteredByStatus.filter((o) => o.priority === 1).length,
    p2: filteredByStatus.filter((o) => o.priority === 2).length,
    p3plus: filteredByStatus.filter((o) => o.priority >= 3).length,
  };

  const types = [...new Set(filteredByStatus.map((o) => o.type))];

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
    status: o.status,
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
          title="Opportunities & Implementations"
          description="Deterministic analysis of Google Search Console data with 1-click AI implementation into WordPress / CMS / Content Library."
        />

        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard label="Open Opportunities" value={formatNumber(counts.open)} deltaLabel="ready to act" />
          <MetricCard label="In Progress / Approvals" value={formatNumber(counts.inProgress)} deltaLabel="queued" />
          <MetricCard label="Implemented" value={formatNumber(counts.done)} deltaLabel="completed" />
          <MetricCard label="Priority 1 Backlog" value={formatNumber(byPriority.p1)} deltaLabel="high impact" />
        </section>

        {/* Status Filter Tabs */}
        <div className="mt-6 flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] pb-3 text-xs font-medium">
          <a
            href={`/seo/opportunities?range=${range}&status=OPEN`}
            className={`rounded-md px-3 py-1.5 transition-colors ${
              statusFilter === "OPEN"
                ? "bg-[var(--color-primary)] text-[var(--color-primary-fg)] font-semibold"
                : "border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            }`}
          >
            Open ({counts.open})
          </a>
          <a
            href={`/seo/opportunities?range=${range}&status=IN_PROGRESS`}
            className={`rounded-md px-3 py-1.5 transition-colors ${
              statusFilter === "IN_PROGRESS"
                ? "bg-[var(--color-primary)] text-[var(--color-primary-fg)] font-semibold"
                : "border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            }`}
          >
            In Progress / Approvals ({counts.inProgress})
          </a>
          <a
            href={`/seo/opportunities?range=${range}&status=DONE`}
            className={`rounded-md px-3 py-1.5 transition-colors ${
              statusFilter === "DONE"
                ? "bg-[var(--color-primary)] text-[var(--color-primary-fg)] font-semibold"
                : "border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            }`}
          >
            Implemented ({counts.done})
          </a>
          <a
            href={`/seo/opportunities?range=${range}&status=DISMISSED`}
            className={`rounded-md px-3 py-1.5 transition-colors ${
              statusFilter === "DISMISSED"
                ? "bg-[var(--color-primary)] text-[var(--color-primary-fg)] font-semibold"
                : "border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            }`}
          >
            Dismissed ({counts.dismissed})
          </a>
          <a
            href={`/seo/opportunities?range=${range}&status=ALL`}
            className={`rounded-md px-3 py-1.5 transition-colors ${
              statusFilter === "ALL"
                ? "bg-[var(--color-primary)] text-[var(--color-primary-fg)] font-semibold"
                : "border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            }`}
          >
            All ({counts.total})
          </a>
        </div>

        {/* Type Filter Sub-chips */}
        {types.length > 1 ? (
          <div className="mt-4 flex flex-wrap gap-1 text-xs">
            <a
              href={`/seo/opportunities?range=${range}&status=${statusFilter}`}
              className={`rounded px-2 py-1 ${!typeFilter ? "bg-[var(--color-primary)]/20 text-[var(--color-primary)] font-semibold" : "border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"}`}
            >
              All Types ({filteredByStatus.length})
            </a>
            {types.map((t) => (
              <a
                key={t}
                href={`/seo/opportunities?range=${range}&status=${statusFilter}&type=${t}`}
                className={`rounded px-2 py-1 ${typeFilter === t ? "bg-[var(--color-primary)]/20 text-[var(--color-primary)] font-semibold" : "border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"}`}
              >
                {t.replace(/_/g, " ").toLowerCase()} ({filteredByStatus.filter((o) => o.type === t).length})
              </a>
            ))}
          </div>
        ) : null}

        <div className="mt-6">
          {actions.length > 0 ? (
            <TodayPanel actions={actions} />
          ) : (
            <Card>
              <CardHeader title="No opportunities in this view" />
              <div className="px-5 py-10 text-center text-sm text-[var(--color-muted)]">
                No opportunities match the selected status and type filters.
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
