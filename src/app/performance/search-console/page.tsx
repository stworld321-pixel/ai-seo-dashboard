import { Card, CardHeader } from "@/components/card";
import { DataTable } from "@/components/data-table";
import { EmptyState, PageHeading } from "@/components/empty-state";
import { MetricCard } from "@/components/metric-card";
import { TopBar } from "@/components/top-bar";
import { TrafficChart } from "@/components/traffic-chart";
import {
  countryName,
  delta,
  formatNumber,
  formatPercent,
  formatPosition,
  shortenUrl,
} from "@/lib/format";
import {
  getDailySeries,
  getDimension,
  getPageMetrics,
  getQueryMetrics,
  getTotals,
} from "@/server/services/dashboard";
import { loadPageContext } from "@/server/services/page-context";

export const dynamic = "force-dynamic";

/**
 * Search Console performance: the full GSC picture for the selected window —
 * totals, daily series, and every dimension we sync (query, page, country,
 * device). Everything reads from Postgres.
 */
export default async function SearchConsolePage(props: PageProps<"/performance/search-console">) {
  const searchParams = await props.searchParams;
  const { ctx, reason, websiteName } = await loadPageContext(searchParams);

  if (reason === "no-website") {
    return (
      <EmptyState
        title="No website connected"
        message="Add a website and sync Search Console data to see performance."
      />
    );
  }
  if (!ctx) {
    return (
      <EmptyState
        title={`${websiteName} has no data yet`}
        message="No Search Console rows have been synced for this website."
      />
    );
  }

  const { website, window, previous, range, canCompare, compareHint } = ctx;

  const [series, totals, prevTotals, queries, pages, countries, devices] = await Promise.all([
    getDailySeries(website.id, window),
    getTotals(website.id, window),
    getTotals(website.id, previous),
    getQueryMetrics(website.id, window),
    getPageMetrics(website.id, window),
    getDimension(website.id, window, "country"),
    getDimension(website.id, window, "device"),
  ]);

  const hasClicks = totals.clicks > 0;

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
          title="Search Console"
          description={`${window.from.toISOString().slice(0, 10)} to ${window.to
            .toISOString()
            .slice(0, 10)} · ${series.length} days of data`}
        />

        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard
            label="Clicks"
            value={formatNumber(totals.clicks)}
            delta={canCompare ? delta(totals.clicks, prevTotals.clicks) : null}
            hint={hasClicks ? compareHint : "none recorded in this period"}
          />
          <MetricCard
            label="Impressions"
            value={formatNumber(totals.impressions)}
            delta={canCompare ? delta(totals.impressions, prevTotals.impressions) : null}
            hint={compareHint}
          />
          <MetricCard
            label="Avg Position"
            value={formatPosition(totals.position)}
            delta={canCompare ? delta(totals.position, prevTotals.position) : null}
            invertDelta
            hint={canCompare ? "lower is better" : compareHint}
          />
          <MetricCard
            label="CTR"
            value={formatPercent(totals.ctr)}
            delta={hasClicks && canCompare ? delta(totals.ctr, prevTotals.ctr) : null}
            hint={hasClicks ? compareHint : "no clicks to measure"}
          />
        </section>

        <Card className="mt-6">
          <CardHeader title="Daily performance" subtitle="Impressions, clicks and average position" />
          <TrafficChart data={series} />
        </Card>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader title="Queries" subtitle={`${queries.length} with impressions`} />
            <DataTable
              rows={queries.slice(0, 25)}
              getKey={(r) => r.query}
              empty="No query data in this range"
              columns={[
                { key: "q", header: "Query", render: (r) => <span className="font-medium">{r.query}</span> },
                { key: "i", header: "Impr.", align: "right", render: (r) => formatNumber(r.impressions) },
                { key: "c", header: "Clicks", align: "right", render: (r) => formatNumber(r.clicks) },
                { key: "t", header: "CTR", align: "right", render: (r) => formatPercent(r.ctr) },
                {
                  key: "p",
                  header: "Pos.",
                  align: "right",
                  render: (r) => (
                    <span className={r.position <= 10 ? "font-semibold text-[var(--color-success)]" : ""}>
                      {formatPosition(r.position)}
                    </span>
                  ),
                },
              ]}
            />
          </Card>

          <Card>
            <CardHeader title="Pages" subtitle={`${pages.length} with impressions`} />
            <DataTable
              rows={pages.slice(0, 25)}
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
                { key: "i", header: "Impr.", align: "right", render: (r) => formatNumber(r.impressions) },
                { key: "c", header: "Clicks", align: "right", render: (r) => formatNumber(r.clicks) },
                { key: "p", header: "Pos.", align: "right", render: (r) => formatPosition(r.position) },
              ]}
            />
          </Card>

          <Card>
            <CardHeader title="Countries" subtitle={`${countries.length} countries`} />
            <DataTable
              rows={countries.slice(0, 15)}
              getKey={(r) => r.value}
              empty="No country data"
              columns={[
                { key: "c", header: "Country", render: (r) => countryName(r.value) },
                { key: "i", header: "Impr.", align: "right", render: (r) => formatNumber(r.impressions) },
                { key: "c2", header: "Clicks", align: "right", render: (r) => formatNumber(r.clicks) },
                { key: "p", header: "Pos.", align: "right", render: (r) => formatPosition(r.position) },
              ]}
            />
          </Card>

          <Card>
            <CardHeader title="Devices" />
            <DataTable
              rows={devices}
              getKey={(r) => r.value}
              empty="No device data"
              columns={[
                {
                  key: "d",
                  header: "Device",
                  render: (r) => <span className="capitalize">{r.value.toLowerCase()}</span>,
                },
                { key: "i", header: "Impr.", align: "right", render: (r) => formatNumber(r.impressions) },
                { key: "c", header: "Clicks", align: "right", render: (r) => formatNumber(r.clicks) },
                { key: "p", header: "Pos.", align: "right", render: (r) => formatPosition(r.position) },
              ]}
            />
          </Card>
        </div>
      </div>
    </>
  );
}
