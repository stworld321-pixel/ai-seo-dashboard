import { Card, CardHeader } from "@/components/card";
import { DataTable } from "@/components/data-table";
import { EmptyState, PageHeading } from "@/components/empty-state";
import { MetricCard } from "@/components/metric-card";
import { StatusBadge } from "@/components/badges";
import { TopBar } from "@/components/top-bar";
import { formatNumber, formatPercent, formatPosition, shortenUrl } from "@/lib/format";
import { getOpportunities, getPageMetrics } from "@/server/services/dashboard";
import { loadPageContext } from "@/server/services/page-context";

export const dynamic = "force-dynamic";

/**
 * Page intelligence. Status is derived from measured performance only —
 * crawl-based signals (word count, last modified, content score) arrive with
 * the crawler in Phase 3, and their columns are intentionally absent rather
 * than filled with placeholder values.
 */
function deriveStatus(
  page: { impressions: number; clicks: number; position: number },
  hasOpportunity: boolean,
): { label: string; tone: "neutral" | "success" | "warning" | "danger" } {
  if (hasOpportunity) return { label: "Optimize", tone: "warning" };
  if (page.position <= 10 && page.clicks > 0) return { label: "Healthy", tone: "success" };
  if (page.position <= 10 && page.clicks === 0) return { label: "Investigate", tone: "warning" };
  if (page.position <= 20) return { label: "Expand", tone: "neutral" };
  return { label: "Supporting", tone: "neutral" };
}

export default async function PagesPage(props: PageProps<"/seo/pages">) {
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
  const [pages, opps] = await Promise.all([
    getPageMetrics(website.id, window),
    getOpportunities(website.id),
  ]);

  const oppUrls = new Set(opps.map((o) => o.targetUrl).filter(Boolean) as string[]);

  const rows = pages.map((p) => ({
    ...p,
    status: deriveStatus(p, oppUrls.has(p.page)),
  }));

  const page1 = rows.filter((r) => r.position <= 10.5).length;
  const zeroClick = rows.filter((r) => r.clicks === 0 && r.impressions > 0).length;

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
          title="Pages"
          description="Pages receiving impressions in this window. Status is derived from measured performance; content metrics arrive with the crawler."
        />

        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard label="Pages with impressions" value={formatNumber(rows.length)} deltaLabel="in this window" />
          <MetricCard label="Ranking page 1" value={formatNumber(page1)} deltaLabel="avg position ≤ 10" />
          <MetricCard label="Zero-click pages" value={formatNumber(zeroClick)} deltaLabel="impressions but no clicks" />
          <MetricCard label="Flagged" value={formatNumber(oppUrls.size)} deltaLabel="have an open opportunity" />
        </section>

        <Card className="mt-6">
          <CardHeader title="All pages" subtitle={`${rows.length} pages`} />
          <DataTable
            rows={rows}
            getKey={(r) => r.page}
            empty="No page data in this range"
            columns={[
              {
                key: "u",
                header: "Page",
                render: (r) => (
                  <a
                    href={r.page}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-xs text-[var(--color-info)] hover:underline"
                  >
                    {shortenUrl(r.page)}
                  </a>
                ),
              },
              {
                key: "s",
                header: "Status",
                render: (r) => <StatusBadge status={r.status.label} tone={r.status.tone} />,
              },
              { key: "i", header: "Impr.", align: "right", render: (r) => formatNumber(r.impressions) },
              { key: "c", header: "Clicks", align: "right", render: (r) => formatNumber(r.clicks) },
              { key: "t", header: "CTR", align: "right", render: (r) => formatPercent(r.ctr) },
              {
                key: "p",
                header: "Position",
                align: "right",
                render: (r) => (
                  <span
                    className={
                      r.position <= 10
                        ? "font-semibold text-[var(--color-success)]"
                        : r.position <= 20
                          ? "text-[var(--color-warning)]"
                          : "text-[var(--color-muted)]"
                    }
                  >
                    {formatPosition(r.position)}
                  </span>
                ),
              },
            ]}
          />
        </Card>
      </div>
    </>
  );
}
