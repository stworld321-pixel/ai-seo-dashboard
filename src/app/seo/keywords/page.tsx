import { Card, CardHeader } from "@/components/card";
import { DataTable } from "@/components/data-table";
import { EmptyState, PageHeading } from "@/components/empty-state";
import { MetricCard } from "@/components/metric-card";
import { TopBar } from "@/components/top-bar";
import { formatNumber, formatPercent, formatPosition } from "@/lib/format";
import { getQueryMetrics } from "@/server/services/dashboard";
import { loadPageContext } from "@/server/services/page-context";
import { BAND_LABELS, classifyIntent, positionBand } from "@/server/intelligence/intent";

export const dynamic = "force-dynamic";

const INTENT_STYLES: Record<string, string> = {
  TRANSACTIONAL: "bg-[var(--color-success-bg)] text-[var(--color-success)]",
  COMMERCIAL: "bg-amber-50 text-amber-700",
  INFORMATIONAL: "bg-blue-50 text-blue-700",
  NAVIGATIONAL: "bg-[var(--color-surface-muted)] text-[var(--color-muted)]",
  LOCAL: "bg-purple-50 text-purple-700",
};

/**
 * Keyword intelligence: every query we hold, with intent classification,
 * position banding and the trend-relevant metrics. Filterable by band via the
 * `band` query param.
 */
export default async function KeywordsPage(props: PageProps<"/seo/keywords">) {
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
  const queries = await getQueryMetrics(website.id, window);

  const enriched = queries.map((q) => {
    const { intent, confidence } = classifyIntent(q.query);
    return { ...q, intent, confidence, band: positionBand(q.position) };
  });

  const bandFilter = typeof searchParams.band === "string" ? searchParams.band : null;
  const visible = bandFilter ? enriched.filter((q) => q.band === bandFilter) : enriched;

  const counts = {
    top3: enriched.filter((q) => q.band === "top3").length,
    page1: enriched.filter((q) => q.band === "page1").length,
    page2: enriched.filter((q) => q.band === "page2").length,
    deep: enriched.filter((q) => q.band === "deep").length,
  };

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
          title="Keywords"
          description={`${enriched.length} queries with impressions. Intent is classified by rule, with confidence shown.`}
        />

        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard label="Top 3" value={formatNumber(counts.top3)} deltaLabel="positions 1-3" />
          <MetricCard label="Page 1" value={formatNumber(counts.page1)} deltaLabel="positions 4-10" />
          <MetricCard label="Page 2" value={formatNumber(counts.page2)} deltaLabel="positions 11-20" />
          <MetricCard label="Beyond" value={formatNumber(counts.deep)} deltaLabel="position 21+" />
        </section>

        <Card className="mt-6">
          <CardHeader
            title={bandFilter ? `Keywords — ${BAND_LABELS[bandFilter as keyof typeof BAND_LABELS] ?? bandFilter}` : "All keywords"}
            subtitle={`${visible.length} shown`}
            action={
              <div className="flex gap-1 text-xs">
                <a
                  href={`/seo/keywords?range=${range}`}
                  className={`rounded px-2 py-1 ${!bandFilter ? "bg-[var(--color-primary)] text-[var(--color-primary-fg)]" : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"}`}
                >
                  All
                </a>
                {(["top3", "page1", "page2", "deep"] as const).map((b) => (
                  <a
                    key={b}
                    href={`/seo/keywords?range=${range}&band=${b}`}
                    className={`rounded px-2 py-1 ${bandFilter === b ? "bg-[var(--color-primary)] text-[var(--color-primary-fg)]" : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"}`}
                  >
                    {BAND_LABELS[b]}
                  </a>
                ))}
              </div>
            }
          />
          <DataTable
            rows={visible}
            getKey={(r) => r.query}
            empty="No keywords match this filter"
            columns={[
              {
                key: "q",
                header: "Keyword",
                render: (r) => <span className="font-medium">{r.query}</span>,
              },
              {
                key: "intent",
                header: "Intent",
                render: (r) => (
                  <span
                    className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium ${INTENT_STYLES[r.intent]}`}
                    title={`confidence ${(r.confidence * 100).toFixed(0)}%`}
                  >
                    {r.intent.toLowerCase()}
                    {r.confidence < 0.5 ? (
                      <span className="ml-1 opacity-60">?</span>
                    ) : null}
                  </span>
                ),
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
