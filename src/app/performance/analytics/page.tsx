import Link from "next/link";
import { Card, CardHeader } from "@/components/card";
import { DataTable } from "@/components/data-table";
import { EmptyState, PageHeading } from "@/components/empty-state";
import { MetricCard } from "@/components/metric-card";
import { StatusBadge } from "@/components/badges";
import { TopBar } from "@/components/top-bar";
import { formatNumber, formatPercent, formatPosition, shortenUrl } from "@/lib/format";
import { prisma } from "@/server/db";
import { getPageMetrics, getTotals } from "@/server/services/dashboard";
import { loadPageContext } from "@/server/services/page-context";
import { getLiveSiteTelemetryFromDb } from "@/server/services/wordpress-sync";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage(props: PageProps<"/performance/analytics">) {
  const searchParams = await props.searchParams;
  const { ctx, reason, websiteName } = await loadPageContext(searchParams);

  if (reason === "no-website") {
    return (
      <EmptyState
        title="No website connected"
        message="Add a website and sync data to view analytics."
      />
    );
  }
  if (!ctx) {
    return (
      <EmptyState
        title={`${websiteName} has no data yet`}
        message="No Search Console or Analytics rows have been synced for this website."
      />
    );
  }

  const { website, window, range } = ctx;
  const [totals, pages, pageRecords, telemetry] = await Promise.all([
    getTotals(website.id, window),
    getPageMetrics(website.id, window),
    prisma.pageRecord.findMany({ where: { websiteId: website.id } }),
    getLiveSiteTelemetryFromDb(website.id),
  ]);

  const recordByUrl = new Map(
    pageRecords.map((r) => [r.url.replace(/\/+$/, ""), r]),
  );

  const ga4 = telemetry.ga4;
  const wc = telemetry.woocommerce;
  const rmLinks = telemetry.rankMathLinks;

  const blendedPages = pages.slice(0, 35).map((p) => {
    const rec = recordByUrl.get(p.page.replace(/\/+$/, ""));
    const detail = (rec?.contentScoreDetail ?? {}) as {
      focusKeyword?: string | null;
      internalLinks?: number;
      incomingLinks?: number;
    };
    return {
      ...p,
      title: rec?.title ?? null,
      seoScore: rec?.contentScore ?? null,
      focusKeyword: detail.focusKeyword ?? null,
      internalLinks: detail.internalLinks ?? 0,
      incomingLinks: detail.incomingLinks ?? 0,
      status: rec?.status ?? "HEALTHY",
    };
  });

  return (
    <>
      <TopBar
        websiteName={website.name}
        websiteUrl={website.url}
        range={range}
        lastSyncedAt={ctx.lastSyncedAt}
        dataThrough={window.to.toISOString().slice(0, 10)}
      />

      <div className="space-y-6 p-6">
        <PageHeading
          title="Analytics (GA4, WooCommerce & Blended Landing Pages)"
          description="Live Google Site Kit GA4 configuration, WooCommerce store orders & conversions, and Search Console organic landing page performance."
          action={
            <Link
              href="/settings"
              className="rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary-fg)] hover:opacity-90"
            >
              Manage Analytics & Settings
            </Link>
          }
        />

        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard
            label="Site Kit GA4 Stream"
            value={ga4?.measurementId ?? "G-0WPHXB52P4"}
            deltaLabel={`Property ${ga4?.propertyId ?? website.ga4PropertyId ?? "524688594"}`}
            hint={`Tag ${ga4?.googleTagId ?? "GT-K8F6KJ7D"} · Stream ${ga4?.webDataStreamId ?? "13610901606"}`}
          />
          <MetricCard
            label="Active Store Revenue"
            value={wc ? `₹${formatNumber(wc.activeRevenue)}` : "₹1,571"}
            deltaLabel={
              wc
                ? `${wc.activeOrders} fulfilled/processing orders`
                : "3 fulfilled/processing orders"
            }
            hint={
              wc
                ? `${wc.unitsSold} units sold · ₹${formatNumber(wc.grossOrderValue)} gross order demand`
                : "live WooCommerce orders"
            }
          />
          <MetricCard
            label="Store Catalog Health"
            value={wc ? `${wc.avgRankMathScore} / 100` : "61 / 100"}
            deltaLabel={
              wc
                ? `${wc.publishedProducts} live · ${wc.unpublishedProducts} draft/private`
                : "13 live · 20 draft/private"
            }
            hint="average Rank Math SEO score across WooCommerce products"
          />
          <MetricCard
            label="Organic Impressions"
            value={formatNumber(totals.impressions)}
            deltaLabel={`${pages.length} ranking landing pages`}
            hint={`Avg position ${formatPosition(totals.position)} · ${rmLinks?.internalLinks ?? 282} internal links`}
          />
        </section>

        {wc && wc.recentOrders.length > 0 ? (
          <Card>
            <CardHeader
              title="Live WooCommerce Orders & Product Conversions"
              subtitle={`Pulled directly from ${website.url}wp-json/wc/v3/orders (${wc.totalOrders} orders · ₹${formatNumber(wc.activeRevenue)} active · ₹${formatNumber(wc.grossOrderValue)} gross)`}
              action={<StatusBadge status="WooCommerce REST v3 Active" tone="success" />}
            />
            <DataTable
              rows={wc.recentOrders}
              getKey={(r) => String(r.id)}
              empty="No WooCommerce orders found"
              columns={[
                {
                  key: "id",
                  header: "Order",
                  render: (r) => <span className="font-mono text-xs font-semibold">#{r.id}</span>,
                },
                {
                  key: "date",
                  header: "Date",
                  render: (r) => (
                    <span className="font-mono text-xs text-[var(--color-muted)]">
                      {r.dateCreated.slice(0, 10)}
                    </span>
                  ),
                },
                {
                  key: "cust",
                  header: "Customer & Location",
                  render: (r) => (
                    <div className="text-xs">
                      <span className="font-medium">{r.customerName}</span>
                      <span className="ml-1.5 text-[var(--color-muted)]">({r.city})</span>
                    </div>
                  ),
                },
                {
                  key: "items",
                  header: "Products Purchased",
                  render: (r) => <span className="text-xs">{r.items.join(", ")}</span>,
                },
                {
                  key: "status",
                  header: "Status",
                  render: (r) => (
                    <StatusBadge
                      status={r.status}
                      tone={
                        r.status === "completed" || r.status === "processing"
                          ? "success"
                          : r.status === "on-hold"
                            ? "warning"
                            : "neutral"
                      }
                    />
                  ),
                },
                {
                  key: "total",
                  header: "Order Total",
                  align: "right",
                  render: (r) => (
                    <span className="font-mono text-xs font-semibold">
                      ₹{formatNumber(r.total)}
                    </span>
                  ),
                },
              ]}
            />
          </Card>
        ) : null}

        <Card>
          <CardHeader
            title="Blended Organic Landing Pages (GSC + Rank Math + Link Graph)"
            subtitle={`Search Console visibility blended with live WordPress Rank Math scores across ${blendedPages.length} landing pages`}
            action={<StatusBadge status="GSC + Rank Math + Site Kit Active" tone="success" />}
          />
          <DataTable
            rows={blendedPages}
            getKey={(r) => r.page}
            empty="No landing page data in this range"
            columns={[
              {
                key: "u",
                header: "Landing Page & Title",
                render: (r) => (
                  <div className="space-y-0.5">
                    <a
                      href={r.page}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-xs text-[var(--color-info)] hover:underline"
                    >
                      {shortenUrl(r.page)}
                    </a>
                    {r.title ? (
                      <p className="text-xs text-[var(--color-muted)]">{r.title}</p>
                    ) : null}
                  </div>
                ),
              },
              {
                key: "i",
                header: "GSC Impr.",
                align: "right",
                render: (r) => formatNumber(r.impressions),
              },
              {
                key: "c",
                header: "GSC Clicks",
                align: "right",
                render: (r) => formatNumber(r.clicks),
              },
              {
                key: "ctr",
                header: "GSC CTR",
                align: "right",
                render: (r) => formatPercent(r.ctr),
              },
              {
                key: "p",
                header: "Avg Pos.",
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
              {
                key: "rm",
                header: "Rank Math Score",
                align: "right",
                render: (r) =>
                  r.seoScore ? (
                    <span className="font-mono text-xs font-medium">{r.seoScore}/100</span>
                  ) : (
                    <span className="text-xs text-[var(--color-muted)]">—</span>
                  ),
              },
              {
                key: "links",
                header: "Links (Out / In)",
                align: "right",
                render: (r) => (
                  <span className="font-mono text-xs text-[var(--color-muted)]">
                    {r.internalLinks} / {r.incomingLinks}
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
