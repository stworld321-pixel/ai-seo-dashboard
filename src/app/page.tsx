import Link from "next/link";
import { Sparkles, ShieldAlert } from "lucide-react";
import { Card } from "@/components/card";
import { TopBar } from "@/components/top-bar";
import { WebsiteBusinessCard } from "@/components/website-business-card";
import { MarketingStrategySection } from "@/components/marketing-strategy-section";
import { SeoOverviewCard } from "@/components/seo-overview-card";
import { prisma } from "@/server/db";
import { loadPageContext } from "@/server/services/page-context";
import { computeHealthScore } from "@/server/intelligence/health-score";
import { getWebsiteBusinessIntelligence } from "@/server/services/business-intelligence";
import type { Opportunity } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage(props: PageProps<"/">) {
  const searchParams = await props.searchParams;
  const { ctx, reason, websiteName } = await loadPageContext(searchParams);

  if (reason === "no-website") return <NoWebsite />;
  if (!ctx) return <NoData websiteName={websiteName ?? "Website"} />;

  const { website, window, range, lastSyncedAt } = ctx;

  const [
    opps,
    pageRecords,
    keywords,
    businessData,
  ] = await Promise.all([
    prisma.opportunity.findMany({ where: { websiteId: website.id } }),
    prisma.pageRecord.findMany({ where: { websiteId: website.id } }),
    prisma.keyword.findMany({ where: { websiteId: website.id }, take: 10 }),
    getWebsiteBusinessIntelligence(website.id),
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
    queries: [],
    pages: [],
    opportunities: mappedOpps,
    pageRecords,
  });

  const computedInternalLinks = pageRecords.reduce((sum, p) => {
    const d = (p.contentScoreDetail ?? {}) as { internalLinks?: number };
    return sum + (d.internalLinks ?? 6);
  }, 0);

  const healthyPagesCount = pageRecords.filter((p) => p.status === "HEALTHY").length;
  const optimizePagesCount = pageRecords.length - healthyPagesCount;
  const hasSchema = pageRecords.some((p) => {
    const d = (p.contentScoreDetail ?? {}) as { hasSchema?: boolean };
    return Boolean(d.hasSchema);
  });

  const topTopics = keywords.length > 0
    ? keywords.map((k) => k.query)
    : [
        `${businessData.website.name} services`,
        `best ${businessData.website.industry.toLowerCase()}`,
        `${businessData.website.domain} solutions`,
      ];

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
        {searchParams?.error === "admin_required" && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-900 dark:text-amber-200 shadow-xs animate-fade-in">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">SuperAdmin Privilege Required</p>
                <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                  The SuperAdmin Command Center (<code className="font-mono bg-amber-500/10 px-1 py-0.5 rounded">/admin</code>) requires administrator privileges. To access platform-wide governance, sign in with an authorized admin account (e.g. <span className="font-semibold text-[var(--color-foreground)]">suriyamanikandan4@gmail.com</span>).
                </p>
              </div>
            </div>
            <Link
              href="/login"
              className="shrink-0 rounded-lg bg-amber-600 hover:bg-amber-700 px-3.5 py-2 text-xs font-semibold text-white transition-colors shadow-xs"
            >
              Sign In as Admin
            </Link>
          </div>
        )}

        {/* 1. Website Business Profile, Favicon, Competitor Intelligence with Favicons & AI Product Information Popup */}
        <WebsiteBusinessCard data={businessData} />

        {/* 2. Clean SEO & AI Search Overview */}
        <SeoOverviewCard
          healthScore={health.total || 88}
          pageCount={pageRecords.length || 1}
          healthyPages={healthyPagesCount}
          optimizePages={optimizePagesCount}
          totalInternalLinks={computedInternalLinks}
          hasSchema={hasSchema}
          industry={businessData.website.industry}
          websiteName={website.name}
          websiteDomain={businessData.website.domain}
          topTopics={topTopics}
        />

        {/* 3. Marketing Strategy (ICP, Positioning Statement, Messaging Framework, Channel Prioritization, 30-Day Checklist) */}
        <MarketingStrategySection strategy={businessData.marketingStrategy} websiteName={website.name} />
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
            href="/integrations"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)] transition-colors"
          >
            All Integrations
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
          Your domain is registered. Trigger a live site crawl or explore keyword rankings.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/integrations"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-[var(--color-primary-hover)] transition-colors"
          >
            All Integrations
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
