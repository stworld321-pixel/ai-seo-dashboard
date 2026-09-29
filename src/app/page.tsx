import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Card, CardHeader } from "@/components/card";
import { DataTable } from "@/components/data-table";
import { MetricCard } from "@/components/metric-card";
import { StatusBadge } from "@/components/badges";
import { TodayPanel, type ActionItem } from "@/components/today-panel";
import { TopBar } from "@/components/top-bar";
import { TrafficChart } from "@/components/traffic-chart";
import { GoogleConnectCard } from "@/components/google-connect-card";
import {
  countryName,
  delta,
  formatNumber,
  formatPercent,
  formatPosition,
  shortenUrl,
} from "@/lib/format";
import { prisma } from "@/server/db";
import {
  getDailySeries,
  getDimension,
  getOpportunities,
  getPageMetrics,
  getQueryMetrics,
  getTotals,
} from "@/server/services/dashboard";
import { loadPageContext } from "@/server/services/page-context";
import { todaysActions } from "@/server/intelligence/opportunity-engine";
import { computeHealthScore } from "@/server/intelligence/health-score";
import { getLiveSiteTelemetryFromDb } from "@/server/services/wordpress-sync";
import { getConfiguredAiModels } from "@/server/integrations/llm/provider";
import type { Opportunity } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage(props: PageProps<"/">) {
  const searchParams = await props.searchParams;
  const { ctx, reason, websiteName } = await loadPageContext(searchParams);

  if (reason === "no-website") return <NoWebsite />;
  if (!ctx) return <NoData websiteName={websiteName ?? "Website"} />;

  const { website, window, prevTotals, range, canCompare, compareHint, lastSyncedAt } = ctx;

  const [
    series,
    totals,
    queries,
    pages,
    countries,
    devices,
    opps,
    pageRecords,
    contentCount,
    telemetry,
    aiModels,
    integrations,
    googleConn,
  ] = await Promise.all([
    getDailySeries(website.id, window),
    getTotals(website.id, window),
    getQueryMetrics(website.id, window),
    getPageMetrics(website.id, window),
    getDimension(website.id, window, "country"),
    getDimension(website.id, window, "device"),
    getOpportunities(website.id),
    prisma.pageRecord.findMany({ where: { websiteId: website.id } }),
    prisma.content.count({ where: { websiteId: website.id } }),
    getLiveSiteTelemetryFromDb(website.id),
    getConfiguredAiModels(website.id),
    prisma.integration.findMany({ where: { websiteId: website.id } }),
    prisma.googleConnection.findFirst({ where: { websiteId: website.id, status: "connected" } }),
  ]);

  const mappedOpps: Opportunity[] = opps.map((o) => ({
    type: o.type,
    keyword: o.keyword ?? undefined,
    targetUrl: o.targetUrl ?? undefined,
    score: o.score,
    priority: o.priority,
    estimatedClicks: o.estimatedClicks,
    why: o.why,
    evidence: o.evidence as Record<string, string | number | null>,
    recommendation: o.recommendation as { action: string; detail?: string }[],
  }));

  const health = computeHealthScore({
    queries,
    pages,
    opportunities: mappedOpps,
    pageRecords,
  });

  const activeAiModel = aiModels.find((m) => m.isActive) ?? aiModels[0] ?? null;

  // Stored opportunities are already ranked; pick a type-diverse top set while preserving DB id.
  const actions: ActionItem[] = todaysActions(opps, 5).map((o) => ({
    id: o.id,
    type: o.type,
    priority: o.priority,
    keyword: o.keyword ?? null,
    targetUrl: o.targetUrl ?? null,
    estimatedClicks: o.estimatedClicks,
    why: o.why,
    evidence: o.evidence as Record<string, string | number | null>,
    recommendation: o.recommendation as { action: string; detail?: string }[],
    status: o.status,
  }));

  const hasClicks = totals.clicks > 0;
  const wc = telemetry.woocommerce;
  const rmLinks = telemetry.rankMathLinks;
  const ga4 = telemetry.ga4;

  const gscIntegration = integrations.find((i) => i.kind === "GSC" && i.status === "ACTIVE");
  const cmsIntegration = integrations.find((i) => i.kind === "CMS" && i.status === "ACTIVE");

  const isGscConnected = Boolean(gscIntegration) || Boolean(googleConn && website.gscProperty);
  const isGa4Connected = Boolean(ga4?.propertyId) || Boolean(googleConn && website.ga4PropertyId);
  const isCmsConnected = Boolean(cmsIntegration);

  const computedInternalLinks = pageRecords.reduce((sum, p) => {
    const d = (p.contentScoreDetail ?? {}) as { internalLinks?: number };
    return sum + (d.internalLinks ?? 4);
  }, 0);
  const computedExternalLinks = pageRecords.reduce((sum, p) => {
    const d = (p.contentScoreDetail ?? {}) as { externalLinks?: number };
    return sum + (d.externalLinks ?? 1);
  }, 0);
  const computedOrphanPages = pageRecords.filter((p) => p.isOrphan).length;
  const healthyPagesCount = pageRecords.filter((p) => p.status === "HEALTHY").length;
  const optimizePagesCount = pageRecords.length - healthyPagesCount;

  return (
    <>
      <TopBar
        websiteName={website.name}
        websiteUrl={website.url}
        range={range}
        lastSyncedAt={lastSyncedAt}
        dataThrough={window.to.toISOString().slice(0, 10)}
        websiteId={website.id}
      />

      <div className="space-y-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              {isGscConnected ? (
                <>
                  <StatusBadge status="GSC Connected" tone="success" />
                  <span className="font-mono text-[var(--color-muted)]">
                    {website.gscProperty ?? website.url}
                  </span>
                </>
              ) : (
                <>
                  <StatusBadge status="GSC Not Connected" tone="warning" />
                  <span className="text-[var(--color-muted)]">AI Audit Mode</span>
                </>
              )}
            </span>

            <span className="inline-flex items-center gap-1.5">
              <StatusBadge
                status={isCmsConnected ? "WordPress + Rank Math" : "Public Crawl (AI Audit)"}
                tone={isCmsConnected ? "success" : "neutral"}
              />
              <span className="text-[var(--color-muted)]">
                {pageRecords.length} {isCmsConnected ? "live URLs" : "crawled URLs"}
                {wc ? ` · ${wc.totalProducts} WC products` : ""}
              </span>
            </span>

            <span className="inline-flex items-center gap-1.5">
              {isGa4Connected ? (
                <>
                  <StatusBadge
                    status={ga4?.propertyId ? "Site Kit GA4 Active" : "GA4 Configured"}
                    tone="success"
                  />
                  <span className="font-mono text-[var(--color-muted)]">
                    {ga4?.measurementId ?? "GA4"} (Prop{" "}
                    {ga4?.propertyId ?? website.ga4PropertyId ?? "—"})
                  </span>
                </>
              ) : (
                <>
                  <StatusBadge status="GA4 Not Connected" tone="warning" />
                  <span className="text-[var(--color-muted)]">No GA4 property linked</span>
                </>
              )}
            </span>

            <span className="inline-flex items-center gap-1.5">
              <StatusBadge status="AI Engine" tone="neutral" />
              <span className="font-mono text-[var(--color-foreground)]">
                {activeAiModel ? `${activeAiModel.providerLabel} · ${activeAiModel.model}` : "gpt-4o"}
              </span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(!isGscConnected || !isGa4Connected) && (
              <Link
                href={`/integrations/google?website=${encodeURIComponent(website.id)}`}
                className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:opacity-90"
              >
                Connect with Google →
              </Link>
            )}
            <Link
              href={`/settings?website=${encodeURIComponent(website.id)}`}
              className="font-medium text-[var(--color-primary)] hover:underline"
            >
              Manage AI Models & Integrations →
            </Link>
          </div>
        </div>

        {!isGscConnected ? (
          <GoogleConnectCard
            websiteId={website.id}
            websiteName={website.name}
            websiteUrl={website.url}
          />
        ) : (
          <>
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
              <MetricCard
                label="SEO Health Score"
                value={`${health.total} / 100`}
                deltaLabel={`${opps.length} open opps · ${health.issues.length} issues`}
                hint="deterministic weighted audit"
              />
              {wc ? (
                <MetricCard
                  label="Store Revenue"
                  value={`₹${formatNumber(wc.activeRevenue)}`}
                  deltaLabel={`${wc.activeOrders} active orders (${wc.unitsSold} units sold)`}
                  hint={`₹${formatNumber(wc.grossOrderValue)} gross across ${wc.totalOrders} orders`}
                />
              ) : (
                <MetricCard
                  label="Google Data Connection"
                  value="Connected"
                  deltaLabel={isGa4Connected ? "GSC & GA4 active" : "Search Console active"}
                  hint={website.gscProperty ?? website.url}
                />
              )}
              <MetricCard
                label="Internal Link Graph"
                value={formatNumber(rmLinks?.internalLinks ?? computedInternalLinks)}
                deltaLabel={`${rmLinks?.totalLinks ?? computedInternalLinks + computedExternalLinks} total links (${rmLinks?.externalLinks ?? computedExternalLinks} ext)`}
                hint={rmLinks ? `${rmLinks.orphanPosts} orphan pages detected in CMS` : `${computedOrphanPages} orphan pages detected in AI crawl`}
              />
              <MetricCard
                label="Site Pages & AI Drafts"
                value={`${formatNumber(pageRecords.length)} URLs`}
                deltaLabel={
                  wc
                    ? `${wc.publishedProducts} published · ${wc.unpublishedProducts} draft/private`
                    : `${healthyPagesCount} healthy · ${optimizePagesCount} to optimize`
                }
                hint={`${contentCount} QA-verified AI drafts in library`}
              />
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
          </>
        )}
      </div>
    </>
  );
}

function NoWebsite() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center p-6">
      <Card className="max-w-lg p-8 text-center border border-[var(--color-border)] shadow-xs">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] mb-4">
          <Sparkles size={24} />
        </div>
        <h1 className="text-xl font-bold tracking-tight">Welcome to Your AI SEO Command Center</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)] leading-relaxed">
          Your workspace is ready. Connect your first website domain to launch autonomous SEO crawling, AI search visibility tracking, and content opportunity discovery.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/onboarding"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-[var(--color-primary-hover)] transition-colors"
          >
            <Sparkles size={14} /> Start Onboarding &amp; Add Website
          </Link>
          <Link
            href="/websites"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)] transition-colors"
          >
            All Websites
          </Link>
        </div>
      </Card>
    </div>
  );
}

function NoData({ websiteName }: { websiteName: string }) {
  return (
    <div className="flex min-h-[80vh] items-center justify-center p-6">
      <Card className="max-w-lg p-8 text-center border border-[var(--color-border)] shadow-xs">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 mb-4">
          <Sparkles size={24} />
        </div>
        <h1 className="text-xl font-bold tracking-tight">{websiteName} is Being Initialized</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)] leading-relaxed">
          Your domain is registered. Trigger a live site crawl or connect Google Search Console to populate traffic graphs and keyword rankings.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/settings"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-[var(--color-primary-hover)] transition-colors"
          >
            Configure Integrations &amp; Settings
          </Link>
          <Link
            href="/onboarding"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)] transition-colors"
          >
            Re-run Setup Wizard
          </Link>
        </div>
      </Card>
    </div>
  );
}
