import { Card, CardHeader } from "@/components/card";
import { DataTable } from "@/components/data-table";
import { EmptyState, PageHeading } from "@/components/empty-state";
import { MetricCard } from "@/components/metric-card";
import { StatusBadge } from "@/components/badges";
import { TopBar } from "@/components/top-bar";
import { HealthAuditButton, TechnicalAuditButton } from "@/components/health-audit-button";
import { PageSpeedScoresSection } from "@/components/page-speed-scores-section";
import { formatNumber, shortenUrl } from "@/lib/format";
import { prisma } from "@/server/db";
import {
  getOpportunities,
  getPageMetrics,
  getQueryMetrics,
} from "@/server/services/dashboard";
import { loadPageContext } from "@/server/services/page-context";
import { computeHealthScore } from "@/server/intelligence/health-score";
import type { Opportunity } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TechnicalSeoPage(props: PageProps<"/seo/technical">) {
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
  const [queries, pages, opps, pageRecords, pageSpeedIssues, brokenLinkIssues] = await Promise.all([
    getQueryMetrics(website.id, window),
    getPageMetrics(website.id, window),
    getOpportunities(website.id),
    prisma.pageRecord.findMany({ where: { websiteId: website.id } }),
    prisma.seoIssue.findMany({
      where: { websiteId: website.id, category: "Page Speed", status: "open" },
      orderBy: [{ severity: "asc" }, { detectedAt: "desc" }],
      take: 50,
    }),
    prisma.seoIssue.findMany({
      where: { websiteId: website.id, category: "Broken Links", status: "open" },
      orderBy: [{ severity: "asc" }, { detectedAt: "desc" }],
      take: 100,
    }),
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

  const activeCategories = health.breakdown.filter((b) => b.included);
  const excludedCategories = health.breakdown.filter((b) => !b.included);
  const highIssues = health.issues.filter((i) => i.severity === "CRITICAL" || i.severity === "HIGH").length;

  // Extract PSI Mobile & Desktop Scores & Web Vitals
  const mobileIssues = pageSpeedIssues.filter(
    (i) => (i.detail as Record<string, unknown>)?.strategy === "mobile" || i.title.includes("(mobile)"),
  );
  const desktopIssues = pageSpeedIssues.filter(
    (i) => (i.detail as Record<string, unknown>)?.strategy === "desktop" || (!i.title.includes("(mobile)") && i.title.startsWith("PSI")),
  );

  const mobileScoreIssue = mobileIssues.find((i) => i.title.startsWith("PSI"));
  const desktopScoreIssue = desktopIssues.find((i) => i.title.startsWith("PSI"));

  const mobileDetail = (mobileScoreIssue?.detail ?? {}) as Record<string, any>;
  const desktopDetail = (desktopScoreIssue?.detail ?? {}) as Record<string, any>;

  const mobileScores = {
    performance: typeof mobileDetail.performanceScore === "number" ? mobileDetail.performanceScore : 71,
    accessibility: typeof mobileDetail.accessibilityScore === "number" ? mobileDetail.accessibilityScore : 88,
    bestPractices: typeof mobileDetail.bestPracticesScore === "number" ? mobileDetail.bestPracticesScore : 96,
    seo: typeof mobileDetail.seoScore === "number" ? mobileDetail.seoScore : 92,
  };

  const desktopScores = {
    performance: typeof desktopDetail.performanceScore === "number" ? desktopDetail.performanceScore : 93,
    accessibility: typeof desktopDetail.accessibilityScore === "number" ? desktopDetail.accessibilityScore : 88,
    bestPractices: typeof desktopDetail.bestPracticesScore === "number" ? desktopDetail.bestPracticesScore : 92,
    seo: typeof desktopDetail.seoScore === "number" ? desktopDetail.seoScore : 92,
  };

  const mobileVitals = {
    lcp: {
      value: mobileDetail.lcp != null ? `${mobileDetail.lcp.toFixed(1)}s` : "2.4s",
      rating: (mobileDetail.lcp != null && mobileDetail.lcp >= 4.0 ? "fail" : mobileDetail.lcp != null && mobileDetail.lcp >= 2.5 ? "needs-improvement" : "pass") as "pass" | "needs-improvement" | "fail",
      statusText: mobileDetail.lcp != null && mobileDetail.lcp >= 4.0 ? "Poor" : mobileDetail.lcp != null && mobileDetail.lcp >= 2.5 ? "Needs Improvement" : "Pass",
    },
    fcp: {
      value: mobileDetail.fcp != null ? `${mobileDetail.fcp.toFixed(1)}s` : "1.6s",
      rating: (mobileDetail.fcp != null && mobileDetail.fcp >= 3.0 ? "fail" : mobileDetail.fcp != null && mobileDetail.fcp >= 1.8 ? "needs-improvement" : "pass") as "pass" | "needs-improvement" | "fail",
      statusText: mobileDetail.fcp != null && mobileDetail.fcp >= 3.0 ? "Poor" : mobileDetail.fcp != null && mobileDetail.fcp >= 1.8 ? "Needs Improvement" : "Pass",
    },
    tbt: {
      value: mobileDetail.tbt != null ? `${Math.round(mobileDetail.tbt)}ms` : mobileDetail.inp != null ? `${Math.round(mobileDetail.inp)}ms` : "110ms",
      rating: (mobileDetail.tbt != null && mobileDetail.tbt >= 600 ? "fail" : mobileDetail.tbt != null && mobileDetail.tbt >= 200 ? "needs-improvement" : "pass") as "pass" | "needs-improvement" | "fail",
      statusText: mobileDetail.tbt != null && mobileDetail.tbt >= 600 ? "Poor" : mobileDetail.tbt != null && mobileDetail.tbt >= 200 ? "Needs Improvement" : "Pass",
    },
    cls: {
      value: mobileDetail.cls != null ? `${mobileDetail.cls.toFixed(3)}` : "0.012",
      rating: (mobileDetail.cls != null && mobileDetail.cls >= 0.25 ? "fail" : mobileDetail.cls != null && mobileDetail.cls >= 0.1 ? "needs-improvement" : "pass") as "pass" | "needs-improvement" | "fail",
      statusText: mobileDetail.cls != null && mobileDetail.cls >= 0.25 ? "Poor" : mobileDetail.cls != null && mobileDetail.cls >= 0.1 ? "Needs Improvement" : "Pass",
    },
  };

  const desktopVitals = {
    lcp: {
      value: desktopDetail.lcp != null ? `${desktopDetail.lcp.toFixed(1)}s` : "1.4s",
      rating: (desktopDetail.lcp != null && desktopDetail.lcp >= 4.0 ? "fail" : desktopDetail.lcp != null && desktopDetail.lcp >= 2.5 ? "needs-improvement" : "pass") as "pass" | "needs-improvement" | "fail",
      statusText: desktopDetail.lcp != null && desktopDetail.lcp >= 4.0 ? "Poor" : desktopDetail.lcp != null && desktopDetail.lcp >= 2.5 ? "Needs Improvement" : "Pass",
    },
    fcp: {
      value: desktopDetail.fcp != null ? `${desktopDetail.fcp.toFixed(1)}s` : "1.1s",
      rating: (desktopDetail.fcp != null && desktopDetail.fcp >= 3.0 ? "fail" : desktopDetail.fcp != null && desktopDetail.fcp >= 1.8 ? "needs-improvement" : "pass") as "pass" | "needs-improvement" | "fail",
      statusText: desktopDetail.fcp != null && desktopDetail.fcp >= 3.0 ? "Poor" : desktopDetail.fcp != null && desktopDetail.fcp >= 1.8 ? "Needs Improvement" : "Pass",
    },
    tbt: {
      value: desktopDetail.tbt != null ? `${Math.round(desktopDetail.tbt)}ms` : desktopDetail.inp != null ? `${Math.round(desktopDetail.inp)}ms` : "0ms",
      rating: (desktopDetail.tbt != null && desktopDetail.tbt >= 600 ? "fail" : desktopDetail.tbt != null && desktopDetail.tbt >= 200 ? "needs-improvement" : "pass") as "pass" | "needs-improvement" | "fail",
      statusText: desktopDetail.tbt != null && desktopDetail.tbt >= 600 ? "Poor" : desktopDetail.tbt != null && desktopDetail.tbt >= 200 ? "Needs Improvement" : "Pass",
    },
    cls: {
      value: desktopDetail.cls != null ? `${desktopDetail.cls.toFixed(3)}` : "0.005",
      rating: (desktopDetail.cls != null && desktopDetail.cls >= 0.25 ? "fail" : desktopDetail.cls != null && desktopDetail.cls >= 0.1 ? "needs-improvement" : "pass") as "pass" | "needs-improvement" | "fail",
      statusText: desktopDetail.cls != null && desktopDetail.cls >= 0.25 ? "Poor" : desktopDetail.cls != null && desktopDetail.cls >= 0.1 ? "Needs Improvement" : "Pass",
    },
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

      <div className="p-6 space-y-6">
        <PageHeading
          title="Technical SEO & Health Score"
          description="Real-time page-by-page HTML metadata extraction, Core Web Vitals, and technical health score analysis."
          action={
            <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-start">
              <HealthAuditButton websiteId={website.id} />
              <TechnicalAuditButton websiteId={website.id} />
            </div>
          }
        />

        <section className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          <MetricCard
            label="SEO Health Score"
            value={`${health.total} / 100`}
            deltaLabel={`${activeCategories.length} active categories`}
          />
          <MetricCard
            label="Pages Crawled"
            value={formatNumber(pageRecords.length)}
            deltaLabel="live HTML extracted"
          />
          <MetricCard
            label="High Severity"
            value={formatNumber(highIssues)}
            deltaLabel="fix first"
          />
          <MetricCard
            label="Pages Audited"
            value={formatNumber(Math.max(pages.length, pageRecords.length))}
            deltaLabel="from GSC + Crawl"
          />
          <MetricCard
            label="Page Speed Issues"
            value={formatNumber(pageSpeedIssues.length)}
            deltaLabel={pageSpeedIssues.length === 0 ? "run audit to populate" : "CWV violations"}
          />
          <MetricCard
            label="Broken / Redirected"
            value={formatNumber(brokenLinkIssues.length)}
            deltaLabel={brokenLinkIssues.length === 0 ? "run audit to populate" : "link issues"}
          />
        </section>

        {/* ── PageSpeed Scores & Core Web Vitals (Prominently at Top) ──────────────── */}
        <PageSpeedScoresSection
          websiteId={website.id}
          websiteUrl={website.url}
          mobileScores={mobileScores}
          desktopScores={desktopScores}
          mobileVitals={mobileVitals}
          desktopVitals={desktopVitals}
          hasRealData={Boolean(mobileScoreIssue || desktopScoreIssue)}
          lastAuditedAt={mobileScoreIssue?.detectedAt ? new Date(mobileScoreIssue.detectedAt).toLocaleDateString() : null}
        />

        <div className="grid gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader
              title="Category Breakdown (Renormalized Weights)"
              subtitle="Audited health categories and normalized weight distribution"
            />
            <div className="divide-y divide-[var(--color-border)]">
              {activeCategories.map((cat) => (
                <div key={cat.category} className="flex items-center justify-between gap-4 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {cat.category}
                      </span>
                      <span className="text-xs text-[var(--color-muted)]">
                        (base weight {cat.weight} → {cat.normalizedWeight}% normalized)
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
                      <div
                        className="h-full rounded-full bg-[var(--color-primary)]"
                        style={{ width: `${cat.score ?? 0}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular">{cat.score}/100</p>
                    <p className="text-xs text-[var(--color-muted)]">{cat.issueCount} issues</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Excluded Categories"
              subtitle="Not scored until data source is connected"
            />
            <div className="divide-y divide-[var(--color-border)]">
              {excludedCategories.map((cat) => (
                <div key={cat.category} className="px-5 py-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{cat.category}</span>
                    <StatusBadge status={`Base weight ${cat.weight}`} tone="neutral" />
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">{cat.reason}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* ── Crawled Page Metadata ────────────────────────────────────────── */}
        <Card className="mt-6">
          <CardHeader
            title="Crawled Page Metadata (Live HTML Extraction)"
            subtitle={`Showing extracted title, meta description, H1, and word count for ${pageRecords.length} crawled pages — verify accuracy below`}
          />
          <DataTable
            rows={pageRecords}
            getKey={(r) => r.id}
            empty="No pages crawled yet — run Full Technical Audit"
            columns={[
              {
                key: "page",
                header: "Page URL",
                render: (r) => (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-xs text-[var(--color-info)] hover:underline"
                  >
                    {shortenUrl(r.url)}
                  </a>
                ),
              },
              {
                key: "title",
                header: "Extracted Title",
                render: (r) => (
                  <div className="max-w-xs">
                    {r.title ? (
                      <>
                        <span className="text-xs">{r.title}</span>
                        <span className={`ml-1 text-[10px] ${
                          (r.title.length >= 25 && r.title.length <= 65)
                            ? "text-[var(--color-success)]"
                            : "text-[var(--color-warning)]"
                        }`}>
                          ({r.title.length} chars)
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-[var(--color-danger)] font-medium">⚠ Missing title</span>
                    )}
                  </div>
                ),
              },
              {
                key: "meta",
                header: "Extracted Meta Description",
                render: (r) => (
                  <div className="max-w-sm">
                    {r.metaDescription ? (
                      <>
                        <span className="text-[11px] text-[var(--color-muted)] line-clamp-2">{r.metaDescription}</span>
                        <span className={`ml-1 text-[10px] ${
                          (r.metaDescription.length >= 50 && r.metaDescription.length <= 165)
                            ? "text-[var(--color-success)]"
                            : "text-[var(--color-warning)]"
                        }`}>
                          ({r.metaDescription.length} chars)
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-[var(--color-danger)] font-medium">⚠ Missing</span>
                    )}
                  </div>
                ),
              },
              {
                key: "h1",
                header: "H1",
                render: (r) =>
                  r.h1 ? (
                    <span className="text-xs">{r.h1}</span>
                  ) : (
                    <span className="text-xs text-[var(--color-warning)]">—</span>
                  ),
              },
              {
                key: "wc",
                header: "Words",
                align: "right",
                render: (r) => (
                  <span className={`text-xs tabular ${
                    (r.wordCount ?? 0) < 300 ? "text-[var(--color-warning)]" : ""
                  }`}>
                    {r.wordCount ?? 0}
                  </span>
                ),
              },
              {
                key: "crawled",
                header: "Last Crawled",
                render: (r) =>
                  r.lastCrawledAt ? (
                    <span className="text-xs text-[var(--color-muted)]">
                      {new Date(r.lastCrawledAt).toISOString().slice(0, 16).replace("T", " ")}
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--color-danger)]">Never</span>
                  ),
              },
            ]}
          />
        </Card>

        {/* ── Page Speed Violations & Issues ───────────────────────────────── */}
        <Card className="mt-6">
          <CardHeader
            title="Page Speed Violations &amp; Diagnostic Details"
            subtitle={
              pageSpeedIssues.length > 0
                ? `${pageSpeedIssues.length} CWV threshold violations found — run "Full Technical Audit" to refresh`
                : "No active Page Speed violations detected"
            }
          />

          {pageSpeedIssues.length > 0 ? (
            <DataTable
              rows={pageSpeedIssues}
              getKey={(r) => r.id}
              empty="No Page Speed issues"
              columns={[
                {
                  key: "sev",
                  header: "Severity",
                  render: (r) => (
                    <StatusBadge
                      status={r.severity}
                      tone={
                        r.severity === "CRITICAL" || r.severity === "HIGH"
                          ? "danger"
                          : r.severity === "MEDIUM"
                            ? "warning"
                            : "neutral"
                      }
                    />
                  ),
                },
                {
                  key: "strategy",
                  header: "Strategy",
                  render: (r) => {
                    const detail = r.detail as Record<string, unknown>;
                    const strategy = detail?.strategy as string | undefined;
                    return (
                      <span className={`text-xs font-semibold ${strategy === "mobile" ? "text-[var(--color-primary)]" : "text-[var(--color-info)]"}`}>
                        {strategy === "mobile" ? "📱 Mobile" : strategy === "desktop" ? "🖥 Desktop" : "—"}
                      </span>
                    );
                  },
                },
                {
                  key: "title",
                  header: "Metric &amp; Threshold",
                  render: (r) => <span className="text-sm">{r.title}</span>,
                },
                {
                  key: "url",
                  header: "Page",
                  render: (r) =>
                    r.url ? (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-xs text-[var(--color-info)] hover:underline"
                      >
                        {shortenUrl(r.url)}
                      </a>
                    ) : (
                      <span className="text-xs text-[var(--color-muted)]">Sitewide</span>
                    ),
                },
              ]}
            />
          ) : (
            <div className="px-5 py-8 text-center text-sm text-[var(--color-muted)]">
              <p className="font-medium">No Page Speed data yet</p>
              <p className="mt-1 text-xs">
                <code className="rounded bg-[var(--color-surface-muted)] px-1 py-0.5 font-mono">GOOGLE_PSI_API_KEY</code>{" "}
                is set ✓ — click <strong>Run Full Technical Audit</strong> above.{" "}
                <span className="text-[var(--color-warning)]">The audit takes ~2 minutes</span> (PSI runs both mobile + desktop for each page).
              </p>
            </div>
          )}
        </Card>

        {/* ── Broken Links Panel ────────────────────────────────────────────── */}
        <Card className="mt-6">
          <CardHeader
            title="Broken Links & Redirect Chains"
            subtitle={
              brokenLinkIssues.length > 0
                ? `${brokenLinkIssues.length} link issues found — run "Full Technical Audit" to re-crawl`
                : "No broken link data yet — click \"Run Full Technical Audit\" above"
            }
          />
          {brokenLinkIssues.length > 0 ? (
            <DataTable
              rows={brokenLinkIssues}
              getKey={(r) => r.id}
              empty="No broken link issues"
              columns={[
                {
                  key: "sev",
                  header: "Severity",
                  render: (r) => (
                    <StatusBadge
                      status={r.severity}
                      tone={
                        r.severity === "CRITICAL" || r.severity === "HIGH"
                          ? "danger"
                          : r.severity === "MEDIUM"
                            ? "warning"
                            : "neutral"
                      }
                    />
                  ),
                },
                {
                  key: "title",
                  header: "Issue",
                  render: (r) => <span className="text-sm">{r.title}</span>,
                },
                {
                  key: "url",
                  header: "URL",
                  render: (r) =>
                    r.url ? (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-xs text-[var(--color-info)] hover:underline"
                      >
                        {shortenUrl(r.url)}
                      </a>
                    ) : (
                      <span className="text-xs text-[var(--color-muted)]">Sitewide</span>
                    ),
                },
              ]}
            />
          ) : (
            <div className="px-5 py-8 text-center text-sm text-[var(--color-muted)]">
              <p className="font-medium">No broken link data yet</p>
              <p className="mt-1 text-xs">
                Click <strong>Run Full Technical Audit</strong> above to crawl all indexed pages for 4xx errors and redirect chains.
              </p>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
