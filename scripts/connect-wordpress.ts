/**
 * Connects the WordPress CMS to a website record and audits the SEO fields of
 * every page that has an open opportunity.
 *
 * Read-only by default. Credentials, when present, are encrypted before they
 * touch the database.
 *
 *   npx tsx scripts/connect-wordpress.ts
 */
import "dotenv/config";
import { prisma } from "../src/server/db";
import { WordPressProvider } from "../src/server/integrations/cms/wordpress";
import { encryptJson } from "../src/server/crypto";

const SITE = "https://litenatures.in";

async function main() {
  const website = await prisma.website.findFirst({ where: { url: { contains: "litenatures" } } });
  if (!website) throw new Error("Website not found. Run `npm run sync:lite` first.");

  const username = process.env.WP_USERNAME;
  const appPassword = process.env.WP_APP_PASSWORD;

  const wp = new WordPressProvider({ siteUrl: SITE, username, appPassword });
  const caps = wp.capabilities();

  console.log("1. WordPress connection");
  console.log(`   site: ${SITE}`);
  console.log(`   read: ${caps.canRead} | write SEO meta: ${caps.canUpdateSeoMeta}`);

  if (username && appPassword) {
    const v = await wp.verify();
    if (!v.ok) {
      console.log(`   AUTH FAILED: ${v.error}`);
      console.log("   Continuing in read-only mode.");
    } else {
      console.log(`   authenticated as: ${v.user}`);
    }
  } else {
    console.log("   no credentials set — read-only mode");
    console.log("   to enable writes, add WP_USERNAME and WP_APP_PASSWORD to .env");
  }

  // Store the integration record. Secrets are encrypted; the URL is not secret.
  console.log("\n2. Recording the integration");
  const hasSecret = Boolean(username && appPassword);
  const secret = hasSecret
    ? encryptJson({ username, appPassword })
    : null;

  await prisma.integration.upsert({
    where: {
      websiteId_kind_provider: {
        websiteId: website.id,
        kind: "CMS",
        provider: "wordpress",
      },
    },
    create: {
      websiteId: website.id,
      kind: "CMS",
      provider: "wordpress",
      config: { siteUrl: SITE, seoPlugin: "rank_math", primaryPostType: "product" },
      status: hasSecret ? "ACTIVE" : "PENDING",
      ...(secret
        ? { secretCipher: secret.cipher, secretIv: secret.iv, secretTag: secret.tag }
        : {}),
    },
    update: {
      config: { siteUrl: SITE, seoPlugin: "rank_math", primaryPostType: "product" },
      status: hasSecret ? "ACTIVE" : "PENDING",
      ...(secret
        ? { secretCipher: secret.cipher, secretIv: secret.iv, secretTag: secret.tag }
        : {}),
    },
  });
  console.log(`   integration stored (status: ${hasSecret ? "ACTIVE" : "PENDING"})`);
  if (hasSecret) console.log("   credentials encrypted with AES-256-GCM");

  // Audit the pages that actually matter: those with open opportunities.
  console.log("\n3. Auditing SEO fields on opportunity pages");
  const opps = await prisma.opportunity.findMany({
    where: { websiteId: website.id, status: "OPEN", targetUrl: { not: null } },
    orderBy: { score: "desc" },
  });

  if (opps.length === 0) {
    console.log("   no opportunities with a target URL");
  }

  for (const o of opps) {
    const item = await wp.getByUrl(o.targetUrl!);
    console.log(`\n   P${o.priority} ${o.type} — "${o.keyword}"`);
    console.log(`   ${o.targetUrl}`);
    if (!item) {
      console.log("   NOT FOUND in WordPress");
      continue;
    }
    console.log(`   cms id ${item.id} (${item.type}), modified ${item.modifiedAt.slice(0, 10)}`);
    console.log(`   post title : ${item.title}`);
    console.log(`   SEO title  : ${item.seoTitle ?? "*** EMPTY — Google falls back to the post title ***"}`);
    console.log(`   meta desc  : ${item.metaDescription ?? "*** EMPTY ***"}`);
    console.log(`   focus kw   : ${item.focusKeyword ?? "(none)"}`);

    // Store the page record so later phases can diff against it.
    await prisma.pageRecord.upsert({
      where: { websiteId_url: { websiteId: website.id, url: o.targetUrl! } },
      create: {
        websiteId: website.id,
        url: o.targetUrl!,
        title: item.title,
        metaDescription: item.metaDescription,
        lastCrawledAt: new Date(),
        lastModifiedAt: new Date(item.modifiedAt),
        status: "OPTIMIZE",
      },
      update: {
        title: item.title,
        metaDescription: item.metaDescription,
        lastCrawledAt: new Date(),
        lastModifiedAt: new Date(item.modifiedAt),
        status: "OPTIMIZE",
      },
    });
  }

  const pageCount = await prisma.pageRecord.count({ where: { websiteId: website.id } });
  console.log(`\n   ${pageCount} page records stored`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("FAILED:", err);
  await prisma.$disconnect();
  process.exit(1);
});
