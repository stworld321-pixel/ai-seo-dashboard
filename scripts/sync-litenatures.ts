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
import { recomputeWebsiteOpportunities } from "../src/server/services/dashboard";
import { todaysActions } from "../src/server/intelligence/opportunity-engine";

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

  console.log("\n5. Running the opportunity engine on database-sourced 28d window...");
  const { opportunities, curve, queries, pages } = await recomputeWebsiteOpportunities(
    website.id,
    "28d",
  );
  console.log(
    `   ${queries.length} distinct queries, ${pages.length} distinct pages in 28d window`,
  );
  console.log(
    `   CTR curve fitted=${curve.fitted} | opportunities=${opportunities.length}`,
  );
  const stored = await prisma.opportunity.count({ where: { websiteId: website.id } });
  console.log(`   ${stored} opportunities persisted`);

  console.log("\n─── WHAT SHOULD I DO TODAY? ───");
  for (const o of todaysActions(opportunities, 5)) {
    console.log(`\nP${o.priority}  [${o.type}]  ${o.keyword ?? o.targetUrl}`);
    console.log(`  ${o.why}`);
    console.log(
      `  Estimated clicks: ${o.estimatedClicks ?? "not modelled (insufficient click history)"}`,
    );
    const recs = Array.isArray(o.recommendation)
      ? (o.recommendation as { action: string }[]).map((r) => r.action).join(" | ")
      : "";
    console.log(`  Actions: ${recs}`);
  }

  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("FAILED:", err);
  await prisma.$disconnect();
  process.exit(1);
});
