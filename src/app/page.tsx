import { Card, CardHeader } from "@/components/card";
import { DataTable } from "@/components/data-table";
import { MetricCard } from "@/components/metric-card";
import { TodayPanel, type ActionItem } from "@/components/today-panel";
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
  getComparisonTotals,
  getDailySeries,
  getDefaultWebsite,
  getDimension,
  getOpportunities,
  getPageMetrics,
  getQueryMetrics,
  getSyncStatus,
  getTotals,
  previousWindow,
  resolveWindow,
  type RangeKey,
} from "@/server/services/dashboard";
import { todaysActions } from "@/server/intelligence/opportunity-engine";
import type { Opportunity } from "@/lib/types";

export const dynamic = "force-dynamic";

const VALID_RANGES: RangeKey[] = ["7d", "28d", "90d", "6m", "12m"];

export default async function DashboardPage(props: PageProps<"/">) {
  const searchParams = await props.searchParams;
  const rangeParam = typeof searchParams.range === "string" ? searchParams.range : "28d";
  const range: RangeKey = VALID_RANGES.includes(rangeParam as RangeKey)
    ? (rangeParam as RangeKey)
    : "28d";

  const website = await getDefaultWebsite();
  if (!website) return <NoWebsite />;

  const window = await resolveWindow(website.id, range);
  if (!window) return <NoData websiteName={website.name} />;

  const prev = previousWindow(window);

  const [series, totals, prevResult, queries, pages, countries, devices, opps, sync] =
    await Promise.all([
      getDailySeries(website.id, window),
      getTotals(website.id, window),
      getComparisonTotals(website.id, prev),
      getQueryMetrics(website.id, window),
      getPageMetrics(website.id, window),
      getDimension(website.id, window, "country"),
      getDimension(website.id, window, "device"),
      getOpportunities(website.id),
      getSyncStatus(website.id),
    ]);

  const prevTotals = prevResult.totals;
  /**
   * Only show period-over-period deltas when the baseline window is actually
   * covered by synced data. Otherwise a 2-day baseline masquerades as a
   * 28-day one and invents enormous growth percentages.
   */
  const canCompare = prevResult.complete;
  const compareHint = canCompare
    ? "vs previous period"
    : `baseline incomplete (${prevResult.daysCovered}/${prev.days} days synced)`;

  // Stored opportunities are already ranked; pick a type-diverse top set.
  const ranked = opps.map((o) => ({
    type: o.type,
    keyword: o.keyword ?? undefined,
    targetUrl: o.targetUrl ?? undefined,
    score: o.score,
    priority: o.priority,
    estimatedClicks: o.estimatedClicks,
    why: o.why,
    evidence: o.evidence as Record<string, string | number | null>,
    recommendation: o.recommendation as { action: string; detail?: string }[],
  })) as Opportunity[];

  const actions: ActionItem[] = todaysActions(ranked, 5).map((o) => ({
    id: opps.find((x) => x.type === o.type && x.keyword === (o.keyword ?? null))?.id ?? o.type,
    type: o.type,
    priority: o.priority,
    keyword: o.keyword ?? null,
    targetUrl: o.targetUrl ?? null,
    estimatedClicks: o.estimatedClicks,
    why: o.why,
    evidence: o.evidence,
    recommendation: o.recommendation,
  }));

  const hasClicks = totals.clicks > 0;

  return (
    <>
      <TopBar
        websiteName={website.name}
        websiteUrl={website.url}
        range={range}
        lastSyncedAt={sync?.lastRunAt ?? null}
        dataThrough={window.to.toISOString().slice(0, 10)}
      />

      <div className="space-y-6 p-6">
        <TodayPanel actions={actions} />

        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard
            label="Google Clicks"
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
          <MetricCard label="Organic Users" empty="Connect GA4" />
          <MetricCard label="Organic Sessions" empty="Connect GA4" />
          <MetricCard label="Conversions" empty="Connect GA4" />
          <MetricCard label="Content Published" empty="Content engine not enabled" />
        </section>

        <Card>
          <CardHeader
            title="Organic Traffic"
            subtitle={`${window.from.toISOString().slice(0, 10)} to ${window.to
              .toISOString()
              .slice(0, 10)} · ${series.length} days`}
          />
          <TrafficChart data={series} />
        </Card>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader
              title="Top Queries"
              subtitle={`${queries.length} queries with impressions`}
            />
            <DataTable
              rows={queries.slice(0, 10)}
              getKey={(r) => r.query}
              empty="No query data in this range"
              columns={[
                {
                  key: "q",
                  header: "Query",
                  render: (r) => <span className="font-medium">{r.query}</span>,
                },
                {
                  key: "i",
                  header: "Impr.",
                  align: "right",
                  render: (r) => formatNumber(r.impressions),
                },
                {
                  key: "c",
                  header: "Clicks",
                  align: "right",
                  render: (r) => formatNumber(r.clicks),
                },
                {
                  key: "p",
                  header: "Pos.",
                  align: "right",
                  render: (r) => (
                    <span
                      className={
                        r.position <= 10 ? "font-semibold text-[var(--color-success)]" : ""
                      }
                    >
                      {formatPosition(r.position)}
                    </span>
                  ),
                },
              ]}
            />
          </Card>

          <Card>
            <CardHeader title="Top Pages" subtitle={`${pages.length} pages with impressions`} />
            <DataTable
              rows={pages.slice(0, 10)}
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
                  key: "i",
                  header: "Impr.",
                  align: "right",
                  render: (r) => formatNumber(r.impressions),
                },
                {
                  key: "c",
                  header: "Clicks",
                  align: "right",
                  render: (r) => formatNumber(r.clicks),
                },
                {
                  key: "p",
                  header: "Pos.",
                  align: "right",
                  render: (r) => formatPosition(r.position),
                },
              ]}
            />
          </Card>

          <Card>
            <CardHeader title="Countries" />
            <DataTable
              rows={countries.slice(0, 8)}
              getKey={(r) => r.value}
              empty="No country data"
              columns={[
                { key: "c", header: "Country", render: (r) => countryName(r.value) },
                {
                  key: "i",
                  header: "Impr.",
                  align: "right",
                  render: (r) => formatNumber(r.impressions),
                },
                {
                  key: "p",
                  header: "Pos.",
                  align: "right",
                  render: (r) => formatPosition(r.position),
                },
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
                {
                  key: "i",
                  header: "Impr.",
                  align: "right",
                  render: (r) => formatNumber(r.impressions),
                },
                {
                  key: "p",
                  header: "Pos.",
                  align: "right",
                  render: (r) => formatPosition(r.position),
                },
              ]}
            />
          </Card>
        </div>
      </div>
    </>
  );
}

function NoWebsite() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="max-w-md p-8 text-center">
        <h1 className="text-lg font-semibold">No website connected</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Add a website and sync Search Console data to populate this dashboard.
        </p>
        <pre className="mt-4 rounded-md bg-[var(--color-surface-muted)] p-3 text-left text-xs">
          npm run sync:lite
        </pre>
      </Card>
    </div>
  );
}

function NoData({ websiteName }: { websiteName: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="max-w-md p-8 text-center">
        <h1 className="text-lg font-semibold">{websiteName} has no data yet</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          The website exists, but no Search Console rows have been synced.
        </p>
        <pre className="mt-4 rounded-md bg-[var(--color-surface-muted)] p-3 text-left text-xs">
          npm run sync:lite
        </pre>
      </Card>
    </div>
  );
}
