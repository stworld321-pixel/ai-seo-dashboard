/**
 * Proposes SEO title and meta description fixes for pages with open
 * opportunities, and — only with --apply — writes them to WordPress.
 *
 *   npx tsx scripts/optimize-meta.ts            # preview only (default)
 *   npx tsx scripts/optimize-meta.ts --apply    # write to the live site
 *
 * Every write records a ContentExperiment with the 28-day baseline, so the
 * effect can be measured later rather than assumed.
 */
import "dotenv/config";
import { prisma } from "../src/server/db";
import { WordPressProvider } from "../src/server/integrations/cms/wordpress";
import { proposeMeta, TITLE_MAX, DESC_MAX } from "../src/server/intelligence/meta-optimizer";

const SITE = "https://litenatures.in";
const BRAND = "Lite Natures";
const APPLY = process.argv.includes("--apply");

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&#8211;/g, "-")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const website = await prisma.website.findFirst({
    where: { url: { contains: "litenatures" } },
  });
  if (!website) throw new Error("Website not found. Run `npm run sync:lite` first.");

  const wp = new WordPressProvider({
    siteUrl: SITE,
    username: process.env.WP_USERNAME,
    appPassword: process.env.WP_APP_PASSWORD,
  });

  if (APPLY) {
    const v = await wp.verify();
    if (!v.ok) throw new Error(`Cannot write: ${v.error}`);
    console.log(`Authenticated as ${v.user}\n`);
  }

  console.log(APPLY ? "=== APPLYING CHANGES ===" : "=== PREVIEW ONLY (use --apply to write) ===");
  console.log(`Automation level: ${website.automationLevel} (writes require approval below level 4)\n`);

  const opps = await prisma.opportunity.findMany({
    where: {
      websiteId: website.id,
      status: "OPEN",
      targetUrl: { not: null },
      type: { in: ["QUICK_WIN", "CTR_GAP"] },
    },
    orderBy: { score: "desc" },
  });

  if (opps.length === 0) {
    console.log("No title/meta opportunities are open.");
    await prisma.$disconnect();
    return;
  }

  for (const opp of opps) {
    const url = opp.targetUrl!;
    const item = await wp.getByUrl(url);
    if (!item) {
      console.log(`SKIP ${url} — not found in WordPress\n`);
      continue;
    }

    // Gather the real queries this page ranks for.
    const qpRows = await prisma.gscQueryPageDaily.findMany({
      where: { websiteId: website.id, page: url },
      select: { query: true, impressions: true, position: true, clicks: true },
    });
    const byQuery = new Map<string, { imp: number; clicks: number; weighted: number }>();
    for (const r of qpRows) {
      const cur = byQuery.get(r.query) ?? { imp: 0, clicks: 0, weighted: 0 };
      cur.imp += r.impressions;
      cur.clicks += r.clicks;
      cur.weighted += r.position * r.impressions;
      byQuery.set(r.query, cur);
    }
    const ranked = [...byQuery.entries()].sort((a, b) => b[1].imp - a[1].imp);
    const [primaryQuery, primaryStats] = ranked[0] ?? [opp.keyword ?? "", { imp: 0, clicks: 0, weighted: 0 }];

    const proposal = proposeMeta({
      primaryQuery,
      secondaryQueries: ranked.slice(1).map(([q]) => q),
      brand: BRAND,
      item,
      contentText: stripHtml(item.content ?? ""),
      impressions: primaryStats.imp,
      position: primaryStats.imp > 0 ? primaryStats.weighted / primaryStats.imp : 0,
    });

    console.log("─".repeat(72));
    console.log(`P${opp.priority} ${opp.type} — ${url}`);
    console.log(`   ${primaryStats.imp} impressions, ${primaryStats.clicks} clicks, position ${(primaryStats.weighted / Math.max(primaryStats.imp, 1)).toFixed(1)}`);
    console.log(`   queries: ${ranked.map(([q, v]) => `"${q}" (${v.imp})`).join(", ")}`);

    console.log("\n   CURRENT");
    console.log(`     post title : ${item.title}`);
    console.log(`     SEO title  : ${item.seoTitle ?? "(empty — Google uses the post title)"}`);
    console.log(`     meta desc  : ${item.metaDescription ?? "(empty — Google auto-generates)"}`);
    console.log(`     focus kw   : ${item.focusKeyword ?? "(none)"}`);

    console.log("\n   PROPOSED");
    console.log(`     SEO title  : ${proposal.seoTitle}  [${proposal.seoTitle.length}/${TITLE_MAX}]`);
    console.log(`     meta desc  : ${proposal.metaDescription}  [${proposal.metaDescription.length}/${DESC_MAX}]`);
    console.log(`     focus kw   : ${proposal.focusKeyword}`);

    console.log("\n   WHY");
    for (const r of proposal.rationale) console.log(`     - ${r}`);
    if (proposal.warnings.length) {
      console.log("\n   WARNINGS");
      for (const w of proposal.warnings) console.log(`     ! ${w}`);
    }

    if (!APPLY) {
      console.log("\n   (preview only — nothing written)\n");
      continue;
    }

    // Capture the baseline BEFORE changing anything, so the effect is measurable.
    const baseline = {
      windowDays: 28,
      impressions: primaryStats.imp,
      clicks: primaryStats.clicks,
      ctr: primaryStats.imp > 0 ? primaryStats.clicks / primaryStats.imp : 0,
      position: primaryStats.imp > 0 ? primaryStats.weighted / primaryStats.imp : 0,
      capturedAt: new Date().toISOString(),
    };

    await wp.updateSeoMeta(item.id, {
      seoTitle: proposal.seoTitle,
      metaDescription: proposal.metaDescription,
      focusKeyword: proposal.focusKeyword,
    });

    // Verify the write actually landed rather than trusting a 200 response.
    const after = await wp.getByUrl(url);
    const ok =
      after?.seoTitle === proposal.seoTitle &&
      after?.metaDescription === proposal.metaDescription;

    console.log(`\n   WRITE ${ok ? "CONFIRMED" : "FAILED VERIFICATION"}`);
    if (after) {
      console.log(`     now SEO title : ${after.seoTitle ?? "(still empty)"}`);
      console.log(`     now meta desc : ${after.metaDescription ?? "(still empty)"}`);
    }

    if (ok) {
      await prisma.contentExperiment.create({
        data: {
          websiteId: website.id,
          url,
          changeType: "title_and_meta_rewrite",
          appliedAt: new Date(),
          baseline,
          attributes: {
            previousSeoTitle: item.seoTitle ?? null,
            previousMetaDescription: item.metaDescription ?? null,
            newSeoTitle: proposal.seoTitle,
            newMetaDescription: proposal.metaDescription,
            primaryQuery,
            titlePattern: "exact_query_first",
          },
        },
      });

      await prisma.opportunity.update({
        where: { id: opp.id },
        data: { status: "DONE", resolvedAt: new Date() },
      });

      console.log("     baseline recorded; opportunity marked DONE");
    }
    console.log();
  }

  if (APPLY) {
    console.log("─".repeat(72));
    console.log("Re-measure in 14 and 28 days to see whether CTR actually improved.");
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("FAILED:", err instanceof Error ? err.message : err);
  await prisma.$disconnect();
  process.exit(1);
});
