import { EmptyState, PageHeading } from "@/components/empty-state";
import { TopBar } from "@/components/top-bar";
import { getQueryMetrics } from "@/server/services/dashboard";
import { loadPageContext } from "@/server/services/page-context";
import { classifyIntent, positionBand } from "@/server/intelligence/intent";
import { prisma } from "@/server/db";
import { KeywordsClientView, type KeywordRow } from "@/components/keywords-client-view";
import type { GoogleSerpData } from "@/server/services/google-serp";
import { isStoplistedKeyword, HARD_STOPLIST } from "@/server/intelligence/keyword-research";

export const dynamic = "force-dynamic";

/**
 * Keyword intelligence & Rank tracking:
 * Combines Google Search Console queries + Custom tracked keywords + Live Google SERP checking.
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
  const hasGscConnected = Boolean(website.gscProperty);

  // If GSC is NOT connected, purge any old synthetic GSC rows so fake numbers are never shown
  if (!hasGscConnected) {
    await prisma.gscQueryDaily.deleteMany({ where: { websiteId: website.id } });
    await prisma.gscPageDaily.deleteMany({ where: { websiteId: website.id } });
    await prisma.gscQueryPageDaily.deleteMany({ where: { websiteId: website.id } });
    await prisma.gscDaily.deleteMany({ where: { websiteId: website.id } });
  }

  // Clean up any unwanted or stoplisted keywords
  await prisma.keyword.deleteMany({
    where: {
      websiteId: website.id,
      query: { in: Array.from(HARD_STOPLIST) },
    },
  });

  let [queries, dbKeywords, pageRecords] = await Promise.all([
    hasGscConnected && window ? getQueryMetrics(website.id, window) : Promise.resolve([]),
    prisma.keyword.findMany({
      where: { websiteId: website.id },
      orderBy: [{ isCustom: "desc" }, { clicks28: "desc" }],
    }),
    prisma.pageRecord.findMany({ where: { websiteId: website.id } }),
  ]);

  // If no monitored keywords exist yet but crawled pages exist, run the full Keyword Research pipeline
  if (dbKeywords.length === 0 && pageRecords.length > 0) {
    try {
      const { runFullKeywordResearch } = await import("@/server/intelligence/keyword-research");
      await runFullKeywordResearch({
        websiteId: website.id,
        country: website.country || "IND",
        language: "en",
        maxPagesToCrawl: 20,
      });

      dbKeywords = await prisma.keyword.findMany({
        where: { websiteId: website.id },
        orderBy: [{ isCustom: "desc" }, { clicks28: "desc" }],
      });
    } catch {
      // non-fatal
    }
  }

  const dbMap = new Map(dbKeywords.map((k) => [k.query.toLowerCase(), k]));

  // Merge GSC queries with DB records
  const allRows: KeywordRow[] = [];
  const processedQueries = new Set<string>();

  for (const q of queries) {
    const norm = q.query.toLowerCase();
    // Skip unwanted utility queries and stoplist words
    if (isStoplistedKeyword(q.query)) {
      continue;
    }

    processedQueries.add(norm);
    const db = dbMap.get(norm);
    const { intent, confidence } = classifyIntent(q.query);
    const effectivePos = db?.liveRank ?? q.position;

    allRows.push({
      id: db?.id ?? `gsc-${norm}`,
      query: q.query,
      intent: (db?.intent as string) ?? intent,
      intentConfidence: db?.intentConfidence ?? confidence,
      isCustom: db?.isCustom ?? false,
      tags: db?.tags ?? [],
      targetUrl: db?.targetUrl ?? q.page ?? null,
      targetPosition: db?.targetPosition ?? null,
      liveRank: db?.liveRank ?? null,
      liveRankUrl: db?.liveRankUrl ?? null,
      lastCheckedAt: db?.lastCheckedAt ?? null,
      serpData: (db?.serpData as unknown as GoogleSerpData) ?? null,
      clicks28: hasGscConnected ? q.clicks : 0,
      impressions28: hasGscConnected ? q.impressions : 0,
      ctr28: hasGscConnected ? q.ctr : 0,
      position28: hasGscConnected ? q.position : null,
      opportunityScore: db?.opportunityScore ?? 0,
      band: positionBand(effectivePos),
      clusterId: db?.clusterId ?? null,
      bestPage: db?.bestPage ?? null,
    });
  }

  // Include custom keywords that might not have GSC impressions yet
  for (const db of dbKeywords) {
    const norm = db.query.toLowerCase();
    if (processedQueries.has(norm)) continue;
    if (isStoplistedKeyword(db.query)) {
      continue;
    }

    const { intent, confidence } = classifyIntent(db.query);
    const effectivePos = db.liveRank ?? (hasGscConnected ? db.position28 : null) ?? 999;

    allRows.push({
      id: db.id,
      query: db.query,
      intent: (db.intent as string) ?? intent,
      intentConfidence: db.intentConfidence ?? confidence,
      isCustom: db.isCustom,
      tags: db.tags,
      targetUrl: db.targetUrl ?? null,
      targetPosition: db.targetPosition ?? null,
      liveRank: db.liveRank ?? null,
      liveRankUrl: db.liveRankUrl ?? null,
      lastCheckedAt: db.lastCheckedAt ?? null,
      serpData: (db.serpData as unknown as GoogleSerpData) ?? null,
      clicks28: hasGscConnected ? db.clicks28 : 0,
      impressions28: hasGscConnected ? db.impressions28 : 0,
      ctr28: hasGscConnected ? db.ctr28 : 0,
      position28: hasGscConnected ? db.position28 : null,
      opportunityScore: db.opportunityScore,
      band: positionBand(effectivePos),
      clusterId: db.clusterId ?? null,
      bestPage: db.bestPage ?? null,
    });
  }

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
          title="Keywords & Google Rank Tracking"
          description={`${allRows.length} monitored queries — Track GSC impressions, add custom target keywords, and inspect live Google SERP competitor rankings.`}
        />

        <KeywordsClientView
          websiteId={website.id}
          websiteUrl={website.url}
          initialKeywords={allRows}
        />
      </div>
    </>
  );
}
