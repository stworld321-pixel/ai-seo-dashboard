/**
 * End-to-end Phase 1 proof: creates the org/website, pulls REAL Search Console
 * data through the Composio provider, writes it to Postgres, then reads it
 * back out of the database and runs the opportunity engine on it.
 *
 *   npx tsx scripts/sync-litenatures.ts
 */
import "dotenv/config";
import { prisma } from "../src/server/db";
import { ComposioGscProvider } from "../src/server/integrations/search/composio-gsc";
import { syncAll } from "../src/server/services/gsc-sync";
import { runOpportunityEngine, todaysActions } from "../src/server/intelligence/opportunity-engine";
import type { PageMetrics, QueryMetrics } from "../src/lib/types";

const SITE_URL = "https://litenatures.in/";
const BACKFILL_DAYS = 30;

async function main() {
  console.log("1. Ensuring organization and website exist...");
  const org = await prisma.organization.upsert({
    where: { slug: "default" },
    create: { name: "Default Workspace", slug: "default" },
    update: {},
  });

  const website = await prisma.website.upsert({
    where: { orgId_url: { orgId: org.id, url: SITE_URL } },
    create: {
      orgId: org.id,
      name: "Lite Natures",
      url: SITE_URL,
      cms: "WORDPRESS",
      gscProperty: SITE_URL,
      country: "IND",
      timezone: "Asia/Kolkata",
      automationLevel: 2,
    },
    update: {},
  });
  console.log(`   website ${website.id} (${website.name})`);

  console.log("\n2. Verifying the Composio connection...");
  const provider = new ComposioGscProvider();
  const properties = await provider.listProperties();
  const match = properties.find((p) => p.siteUrl === SITE_URL);
  if (!match) {
    throw new Error(
      `${SITE_URL} not found among ${properties.length} connected properties.`,
    );
  }
  console.log(`   ${properties.length} properties; ${match.siteUrl} (${match.permissionLevel})`);

  console.log("\n3. Syncing Search Console data into Postgres...");
  const results = await syncAll({
    websiteId: website.id,
    siteUrl: SITE_URL,
    provider,
    backfillDays: BACKFILL_DAYS,
  });
  for (const r of results) {
    console.log(
      `   ${r.dataset.padEnd(12)} ${r.from}..${r.to}  fetched=${r.rowsFetched} written=${r.rowsWritten}`,
    );
  }

  console.log("\n4. Reading back FROM THE DATABASE...");
  const daily = await prisma.gscDaily.findMany({
    where: { websiteId: website.id },
    orderBy: { date: "asc" },
  });
  const totals = daily.reduce(
    (acc, d) => ({
      clicks: acc.clicks + d.clicks,
      impressions: acc.impressions + d.impressions,
    }),
    { clicks: 0, impressions: 0 },
  );
  const weightedPos =
    totals.impressions > 0
      ? daily.reduce((s, d) => s + d.position * d.impressions, 0) / totals.impressions
      : 0;
  console.log(
    `   ${daily.length} days stored | clicks=${totals.clicks} impressions=${totals.impressions} avgPos=${weightedPos.toFixed(1)}`,
  );

  // Aggregate query grain over the whole stored window.
  const qGroups = await prisma.gscQueryDaily.groupBy({
    by: ["query"],
    where: { websiteId: website.id },
    _sum: { clicks: true, impressions: true },
  });
  const qRows = await prisma.gscQueryDaily.findMany({
    where: { websiteId: website.id },
    select: { query: true, impressions: true, position: true },
  });
  const posByQuery = new Map<string, { impSum: number; weighted: number }>();
  for (const r of qRows) {
    const cur = posByQuery.get(r.query) ?? { impSum: 0, weighted: 0 };
    cur.impSum += r.impressions;
    cur.weighted += r.position * r.impressions;
    posByQuery.set(r.query, cur);
  }
  const queries: QueryMetrics[] = qGroups.map((g) => {
    const clicks = g._sum.clicks ?? 0;
    const impressions = g._sum.impressions ?? 0;
    const p = posByQuery.get(g.query)!;
    return {
      query: g.query,
      clicks,
      impressions,
      ctr: impressions > 0 ? clicks / impressions : 0,
      position: p.impSum > 0 ? p.weighted / p.impSum : 0,
    };
  });

  // Attribute each query to the page that actually serves it, so a
  // "rewrite the title" recommendation has a URL to act on. Uses the
  // query+page grain; the winner is the page with the most impressions.
  const qpRows = await prisma.gscQueryPageDaily.findMany({
    where: { websiteId: website.id },
    select: { query: true, page: true, impressions: true },
  });
  const pageByQuery = new Map<string, Map<string, number>>();
  for (const r of qpRows) {
    const inner = pageByQuery.get(r.query) ?? new Map<string, number>();
    inner.set(r.page, (inner.get(r.page) ?? 0) + r.impressions);
    pageByQuery.set(r.query, inner);
  }
  const bestPage = new Map<string, string>();
  for (const [query, inner] of pageByQuery) {
    const top = [...inner.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top) bestPage.set(query, top[0]);
  }
  for (const q of queries) {
    q.page = bestPage.get(q.query);
  }
  console.log(`   ${bestPage.size} queries attributed to a serving page`);

  const pGroups = await prisma.gscPageDaily.groupBy({
    by: ["page"],
    where: { websiteId: website.id },
    _sum: { clicks: true, impressions: true },
  });
  const pRows = await prisma.gscPageDaily.findMany({
    where: { websiteId: website.id },
    select: { page: true, impressions: true, position: true },
  });
  const posByPage = new Map<string, { impSum: number; weighted: number }>();
  for (const r of pRows) {
    const cur = posByPage.get(r.page) ?? { impSum: 0, weighted: 0 };
    cur.impSum += r.impressions;
    cur.weighted += r.position * r.impressions;
    posByPage.set(r.page, cur);
  }
  const pages: PageMetrics[] = pGroups.map((g) => {
    const clicks = g._sum.clicks ?? 0;
    const impressions = g._sum.impressions ?? 0;
    const p = posByPage.get(g.page)!;
    return {
      page: g.page,
      clicks,
      impressions,
      ctr: impressions > 0 ? clicks / impressions : 0,
      position: p.impSum > 0 ? p.weighted / p.impSum : 0,
    };
  });
  console.log(`   ${queries.length} distinct queries, ${pages.length} distinct pages`);

  console.log("\n5. Running the opportunity engine on database-sourced data...");
  const { opportunities, curve } = runOpportunityEngine({ queries, pages });
  console.log(
    `   CTR curve fitted=${curve.fitted} | opportunities=${opportunities.length}`,
  );

  // Persist the opportunities so the dashboard can read them.
  await prisma.opportunity.deleteMany({ where: { websiteId: website.id, status: "OPEN" } });
  for (const o of opportunities) {
    await prisma.opportunity.create({
      data: {
        websiteId: website.id,
        type: o.type,
        targetUrl: o.targetUrl ?? null,
        keyword: o.keyword ?? null,
        priority: o.priority,
        score: o.score,
        estimatedClicks: o.estimatedClicks,
        why: o.why,
        evidence: o.evidence,
        recommendation: o.recommendation,
      },
    });
  }
  const stored = await prisma.opportunity.count({ where: { websiteId: website.id } });
  console.log(`   ${stored} opportunities persisted`);

  console.log("\n─── WHAT SHOULD I DO TODAY? ───");
  for (const o of todaysActions(opportunities, 5)) {
    console.log(`\nP${o.priority}  [${o.type}]  ${o.keyword ?? o.targetUrl}`);
    console.log(`  ${o.why}`);
    console.log(
      `  Estimated clicks: ${o.estimatedClicks ?? "not modelled (insufficient click history)"}`,
    );
    console.log(`  Actions: ${o.recommendation.map((r) => r.action).join(" | ")}`);
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("FAILED:", err);
  await prisma.$disconnect();
  process.exit(1);
});
