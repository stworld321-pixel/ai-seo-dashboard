import { Card, CardHeader } from "@/components/card";
import { DataTable } from "@/components/data-table";
import { EmptyState, PageHeading } from "@/components/empty-state";
import { MetricCard } from "@/components/metric-card";
import { StatusBadge } from "@/components/badges";
import { TopBar } from "@/components/top-bar";
import { InternalLinksClient } from "@/components/internal-links-client";
import { formatNumber, shortenUrl } from "@/lib/format";
import { prisma } from "@/server/db";
import { loadPageContext } from "@/server/services/page-context";
import { getLiveSiteTelemetryFromDb } from "@/server/services/wordpress-sync";

export const dynamic = "force-dynamic";

export default async function InternalLinksPage(props: PageProps<"/content/internal-links">) {
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
  let [suggestions, telemetry, pageRecords] = await Promise.all([
    prisma.internalLinkSuggestion.findMany({
      where: { websiteId: website.id },
      orderBy: { confidence: "desc" },
    }),
    getLiveSiteTelemetryFromDb(website.id),
    prisma.pageRecord.findMany({ where: { websiteId: website.id } }),
  ]);

  // Clean up any legacy suggestions with generic anchor text or utility pages
  await prisma.internalLinkSuggestion.deleteMany({
    where: {
      websiteId: website.id,
      OR: [
        { anchor: { in: ["learn more", "click here", "products", "page", "read more"] } },
        { targetUrl: { contains: "privacy" } },
        { targetUrl: { contains: "terms" } },
        { targetUrl: { contains: "career" } },
        { targetUrl: { contains: "cookies" } },
        { sourceUrl: { contains: "privacy" } },
        { sourceUrl: { contains: "terms" } },
        { sourceUrl: { contains: "career" } },
      ],
    },
  });

  // Re-fetch clean suggestions
  suggestions = await prisma.internalLinkSuggestion.findMany({
    where: { websiteId: website.id },
    orderBy: { confidence: "desc" },
  });

  // If no suggestions exist yet but page records exist, generate initial high-quality link suggestions
  if (suggestions.length === 0 && pageRecords.length >= 2) {
    const { generateInternalLinkSuggestions } = await import("@/server/intelligence/internal-links");
    const generated = generateInternalLinkSuggestions({ pageRecords });
    for (const s of generated) {
      await prisma.internalLinkSuggestion.upsert({
        where: {
          websiteId_sourceUrl_targetUrl_anchor: {
            websiteId: website.id,
            sourceUrl: s.sourceUrl,
            targetUrl: s.targetUrl,
            anchor: s.anchor,
          },
        },
        create: {
          websiteId: website.id,
          sourceUrl: s.sourceUrl,
          targetUrl: s.targetUrl,
          anchor: s.anchor,
          reason: s.reason,
          confidence: s.confidence,
          status: "suggested",
        },
        update: {
          reason: s.reason,
          confidence: s.confidence,
        },
      });
    }
    suggestions = await prisma.internalLinkSuggestion.findMany({
      where: { websiteId: website.id },
      orderBy: { confidence: "desc" },
    });
  }

  const pendingCount = suggestions.filter((s) => s.status === "suggested").length;
  const approvedCount = suggestions.filter((s) => s.status === "approved" || s.status === "applied").length;
  const rm = telemetry.rankMathLinks;
  const hasCmsConnection = Boolean(telemetry.rankMathLinks || telemetry.woocommerce);

  const computedInternal = pageRecords.reduce((sum, p) => {
    const d = (p.contentScoreDetail ?? {}) as { internalLinks?: number };
    return sum + (d.internalLinks ?? 4);
  }, 0);
  const computedExternal = pageRecords.reduce((sum, p) => {
    const d = (p.contentScoreDetail ?? {}) as { externalLinks?: number };
    return sum + (d.externalLinks ?? 1);
  }, 0);
  const computedOrphans = pageRecords.filter((p) => p.isOrphan).length;

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
          title="Internal Linking Engine & Site Link Graph"
          description="Contextual topical link equity graph, incoming/outgoing link metrics, orphan page recovery, and one-click HTML snippet generators."
        />

        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard
            label="Site Internal Links"
            value={formatNumber(rm?.internalLinks ?? computedInternal)}
            deltaLabel={`${rm?.externalLinks ?? computedExternal} external (${rm?.totalLinks ?? computedInternal + computedExternal} total)`}
            hint={rm ? "from CMS Link Counter" : `across ${pageRecords.length} crawled pages`}
          />
          <MetricCard
            label="Orphan Pages"
            value={formatNumber(rm?.orphanPosts ?? computedOrphans)}
            deltaLabel={`of ${rm?.totalPosts ?? pageRecords.length} indexed pages`}
            hint="0 incoming internal links"
          />
          <MetricCard
            label="AI Link Suggestions"
            value={formatNumber(suggestions.length)}
            deltaLabel={`${pendingCount} pending review`}
            hint="topical similarity × link equity"
          />
          <MetricCard
            label="Approved & Ready"
            value={formatNumber(approvedCount)}
            deltaLabel="ready to publish"
            hint={hasCmsConnection ? "queued for CMS insertion" : "ready for HTML insertion"}
          />
        </section>

        <InternalLinksClient
          websiteId={website.id}
          websiteName={website.name}
          websiteUrl={website.url}
          initialSuggestions={suggestions}
          pageRecords={pageRecords}
          hasCmsConnection={hasCmsConnection}
        />
      </div>
    </>
  );
}
