import { EmptyState, PageHeading } from "@/components/empty-state";
import { TopBar } from "@/components/top-bar";
import { prisma } from "@/server/db";
import { getOpportunities, getPageMetrics } from "@/server/services/dashboard";
import { loadPageContext } from "@/server/services/page-context";
import { PagesClientView } from "@/components/pages-client-view";

export const dynamic = "force-dynamic";

function deriveStatus(
  page: { impressions: number; clicks: number; position: number },
  hasOpportunityOrMissingMeta: boolean,
  isCrawled: boolean,
): { label: string; tone: "neutral" | "success" | "warning" | "danger" } {
  if (hasOpportunityOrMissingMeta) return { label: "Optimize", tone: "warning" };
  if (page.position <= 10 && page.clicks > 0) return { label: "Healthy", tone: "success" };
  if (page.position <= 10 && page.clicks === 0) return { label: "Investigate", tone: "warning" };
  if (!isCrawled) return { label: "Pending Audit", tone: "neutral" };
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
  const [pages, opps, pageRecords] = await Promise.all([
    getPageMetrics(website.id, window),
    getOpportunities(website.id),
    prisma.pageRecord.findMany({
      where: { websiteId: website.id },
      orderBy: { lastModifiedAt: "desc" },
    }),
  ]);

  // Robust URL normalization map supporting query params, trailing slashes, and decoded paths
  const recordByUrl = new Map<string, typeof pageRecords[0]>();
  for (const r of pageRecords) {
    const clean = r.url.trim().replace(/\/+$/, "");
    recordByUrl.set(clean, r);
    try {
      const parsed = new URL(r.url);
      recordByUrl.set(parsed.pathname.replace(/\/+$/, ""), r);
      recordByUrl.set(decodeURIComponent(parsed.pathname).replace(/\/+$/, ""), r);
    } catch {}
  }

  function findRecord(pageUrl: string) {
    const clean = pageUrl.trim().replace(/\/+$/, "");
    if (recordByUrl.has(clean)) return recordByUrl.get(clean);
    try {
      const parsed = new URL(pageUrl);
      const pathOnly = parsed.pathname.replace(/\/+$/, "");
      if (recordByUrl.has(pathOnly)) return recordByUrl.get(pathOnly);
      const decodedPath = decodeURIComponent(parsed.pathname).replace(/\/+$/, "");
      if (recordByUrl.has(decodedPath)) return recordByUrl.get(decodedPath);
    } catch {}
    return undefined;
  }

  const oppUrls = new Set(opps.map((o) => o.targetUrl).filter(Boolean) as string[]);

  const rows = pages.map((p) => {
    const rec = findRecord(p.page);
    const isCrawled = Boolean(rec && rec.lastCrawledAt);
    const isMissingMeta = isCrawled && (!rec?.metaDescription || rec.metaDescription.trim().length === 0);
    const hasOpp = oppUrls.has(p.page);

    return {
      ...p,
      isCrawled,
      seoTitle: rec?.title ?? null,
      metaDescription: rec?.metaDescription ?? null,
      h1: rec?.h1 ?? null,
      wordCount: rec?.wordCount ?? null,
      canonical: rec?.canonical ?? null,
      contentScore: rec?.contentScore ?? null,
      contentScoreDetail: rec?.contentScoreDetail ?? null,
      lastCrawledAt: rec?.lastCrawledAt ?? null,
      lastModifiedAt: rec?.lastModifiedAt ?? null,
      status: deriveStatus(p, hasOpp || isMissingMeta, isCrawled),
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

      <div className="p-6">
        <PageHeading
          title="Pages & Live Site Catalog"
          description="Search Console page performance joined with live site catalog, health diagnostics, and 1-click AI fixes."
        />

        <PagesClientView
          websiteId={website.id}
          websiteUrl={website.url}
          initialPages={rows}
        />
      </div>
    </>
  );
}
