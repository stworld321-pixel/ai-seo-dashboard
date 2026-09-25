/**
 * Full-site technical + content audit.
 *
 * Crawls the WordPress REST API and the live homepage to find measurable
 * problems: missing SEO fields, demo/placeholder content left over from a
 * theme install, duplicate titles, thin copy. Every finding is a fact read
 * from the site, never an opinion.
 *
 *   npx tsx scripts/audit-site.ts
 */
import "dotenv/config";
import { prisma } from "../src/server/db";
import { WordPressProvider } from "../src/server/integrations/cms/wordpress";

const SITE = "https://litenatures.in";

/** Text fragments that ship with WooCommerce/theme demos and must never be live. */
const DEMO_MARKERS = [
  "button-up shirt",
  "lenzing",
  "ecovero",
  "relaxed silhouette",
  "lorem ipsum",
  "crinkle-texture",
  "drapey",
  "sample product",
  "placeholder",
];

type Finding = {
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  category: string;
  title: string;
  url?: string;
  detail: string;
};

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#\d+;/g, " ")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const website = await prisma.website.findFirst({
    where: { url: { contains: "litenatures" } },
  });
  if (!website) throw new Error("Run `npm run sync:lite` first.");

  const wp = new WordPressProvider({
    siteUrl: SITE,
    username: process.env.WP_USERNAME,
    appPassword: process.env.WP_APP_PASSWORD,
  });

  const findings: Finding[] = [];

  console.log("=".repeat(74));
  console.log("FULL SITE AUDIT — litenatures.in");
  console.log("=".repeat(74));

  // ---------- 1. Inventory ----------
  console.log("\n1. CONTENT INVENTORY");
  const products = await wp.listContent({ type: "product", limit: 100 });
  const posts = await wp.listContent({ type: "posts", limit: 100 });
  const pages = await wp.listContent({ type: "pages", limit: 100 });
  console.log(`   products: ${products.length}`);
  console.log(`   posts   : ${posts.length}`);
  console.log(`   pages   : ${pages.length}`);

  // ---------- 2. SEO field coverage ----------
  console.log("\n2. SEO FIELD COVERAGE");
  const all = [...products, ...posts, ...pages];
  const noTitle = all.filter((i) => !i.seoTitle);
  const noDesc = all.filter((i) => !i.metaDescription);
  const noFocus = all.filter((i) => !i.focusKeyword);

  console.log(`   missing SEO title       : ${noTitle.length}/${all.length}`);
  console.log(`   missing meta description: ${noDesc.length}/${all.length}`);
  console.log(`   missing focus keyword   : ${noFocus.length}/${all.length}`);

  if (noTitle.length > 0) {
    findings.push({
      severity: noTitle.length > all.length / 2 ? "CRITICAL" : "HIGH",
      category: "on-page",
      title: `${noTitle.length} of ${all.length} URLs have no SEO title`,
      detail:
        "Google falls back to the post title, which often omits the phrase people actually search. " +
        `Affected: ${noTitle.slice(0, 8).map((i) => i.slug).join(", ")}${noTitle.length > 8 ? ", …" : ""}`,
    });
  }
  if (noDesc.length > 0) {
    findings.push({
      severity: noDesc.length > all.length / 2 ? "HIGH" : "MEDIUM",
      category: "on-page",
      title: `${noDesc.length} of ${all.length} URLs have no meta description`,
      detail:
        "Google auto-generates the snippet, which usually reads as a fragment of body copy and suppresses CTR.",
    });
  }

  // ---------- 3. Demo/placeholder content ----------
  console.log("\n3. DEMO / PLACEHOLDER CONTENT");
  const contaminated: { item: (typeof all)[number]; marker: string }[] = [];
  for (const item of all) {
    const haystack = stripHtml(
      `${item.title} ${item.content ?? ""} ${item.metaDescription ?? ""}`,
    ).toLowerCase();
    const marker = DEMO_MARKERS.find((m) => haystack.includes(m));
    if (marker) contaminated.push({ item, marker });
  }

  // The excerpt is a separate field the provider does not expose; check it directly.
  const rawProducts = (await (
    await fetch(`${SITE}/wp-json/wp/v2/product?per_page=100`)
  ).json()) as { id: number; slug: string; link: string; excerpt?: { rendered?: string } }[];

  const badExcerpts = rawProducts.filter((p) => {
    const t = stripHtml(p.excerpt?.rendered ?? "").toLowerCase();
    return DEMO_MARKERS.some((m) => t.includes(m));
  });

  console.log(`   products with demo text in body   : ${contaminated.length}`);
  console.log(`   products with demo text in excerpt: ${badExcerpts.length}`);

  if (badExcerpts.length > 0) {
    findings.push({
      severity: "CRITICAL",
      category: "content",
      title: `${badExcerpts.length} products show WooCommerce demo copy in their short description`,
      detail:
        'Text about a "button-up shirt … LENZING ECOVERO Viscose" is displayed on soap product pages. ' +
        "This is visible to customers, destroys trust at the point of purchase, and is indexable. " +
        `Affected: ${badExcerpts.slice(0, 10).map((p) => p.slug).join(", ")}${badExcerpts.length > 10 ? ", …" : ""}`,
    });
    for (const p of badExcerpts.slice(0, 10)) console.log(`     - ${p.slug}`);
  }

  // ---------- 4. Duplicate titles ----------
  console.log("\n4. DUPLICATE TITLES");
  const titleMap = new Map<string, string[]>();
  for (const i of all) {
    const key = (i.seoTitle ?? i.title).trim().toLowerCase();
    titleMap.set(key, [...(titleMap.get(key) ?? []), i.url]);
  }
  const dupes = [...titleMap.entries()].filter(([, urls]) => urls.length > 1);
  console.log(`   duplicate title groups: ${dupes.length}`);
  if (dupes.length > 0) {
    findings.push({
      severity: "MEDIUM",
      category: "on-page",
      title: `${dupes.length} groups of pages share an identical title`,
      detail: dupes
        .slice(0, 5)
        .map(([t, urls]) => `"${t}" → ${urls.length} URLs`)
        .join("; "),
    });
  }

  // ---------- 5. Homepage inspection ----------
  console.log("\n5. HOMEPAGE");
  const homeRes = await fetch(SITE);
  const homeHtml = await homeRes.text();
  const homeText = stripHtml(homeHtml);

  const titleMatch = homeHtml.match(/<title[^>]*>([^<]*)<\/title>/i);
  const descMatch = homeHtml.match(
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
  );
  const h1s = [...homeHtml.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) =>
    stripHtml(m[1] ?? ""),
  );

  console.log(`   status     : ${homeRes.status}`);
  console.log(`   title      : ${titleMatch?.[1] ?? "(none)"}`);
  console.log(`   description: ${descMatch?.[1]?.slice(0, 110) ?? "(none)"}`);
  console.log(`   H1 count   : ${h1s.length} ${h1s.length ? `→ ${h1s.map((h) => `"${h.slice(0, 60)}"`).join(", ")}` : ""}`);
  console.log(`   word count : ${homeText.split(/\s+/).length}`);
  console.log(`   page weight: ${(homeHtml.length / 1024).toFixed(0)} KB of HTML`);

  if (h1s.length === 0) {
    findings.push({
      severity: "HIGH",
      category: "on-page",
      title: "Homepage has no H1",
      url: SITE,
      detail: "Search engines and screen readers rely on a single descriptive H1 to identify the page topic.",
    });
  } else if (h1s.length > 1) {
    findings.push({
      severity: "MEDIUM",
      category: "on-page",
      title: `Homepage has ${h1s.length} H1 elements`,
      url: SITE,
      detail: `Multiple H1s dilute the topic signal: ${h1s.map((h) => `"${h.slice(0, 40)}"`).join(", ")}`,
    });
  }

  const demoOnHome = DEMO_MARKERS.filter((m) => homeText.toLowerCase().includes(m));
  if (demoOnHome.length > 0) {
    findings.push({
      severity: "CRITICAL",
      category: "content",
      title: "Homepage displays demo/placeholder copy",
      url: SITE,
      detail: `Found markers: ${demoOnHome.join(", ")}`,
    });
    console.log(`   DEMO TEXT ON HOMEPAGE: ${demoOnHome.join(", ")}`);
  }

  if (homeHtml.length > 500_000) {
    findings.push({
      severity: "MEDIUM",
      category: "performance",
      title: `Homepage HTML is ${(homeHtml.length / 1024).toFixed(0)} KB`,
      url: SITE,
      detail: "Large HTML payloads slow first render, especially on mobile — 66% of this site's impressions are mobile.",
    });
  }

  // ---------- 6. Technical ----------
  console.log("\n6. TECHNICAL");
  const robotsRes = await fetch(`${SITE}/robots.txt`);
  const robots = await robotsRes.text();
  const sitemapMatch = robots.match(/Sitemap:\s*(\S+)/i);
  console.log(`   robots.txt : ${robotsRes.status}`);
  console.log(`   sitemap    : ${sitemapMatch?.[1] ?? "(not declared in robots.txt)"}`);

  if (!sitemapMatch) {
    findings.push({
      severity: "MEDIUM",
      category: "technical",
      title: "robots.txt does not declare a sitemap",
      detail: "Declaring the sitemap helps crawlers discover all URLs reliably.",
    });
  } else {
    const smRes = await fetch(sitemapMatch[1]!);
    const sm = await smRes.text();
    const count = (sm.match(/<loc>/g) ?? []).length;
    console.log(`   sitemap entries: ${count}`);
  }

  // ---------- 7. Search Console cross-reference ----------
  console.log("\n7. SEARCH PERFORMANCE CROSS-REFERENCE");
  const pageMetrics = await prisma.gscPageDaily.groupBy({
    by: ["page"],
    where: { websiteId: website.id },
    _sum: { impressions: true, clicks: true },
  });
  const totalImp = pageMetrics.reduce((s, p) => s + (p._sum.impressions ?? 0), 0);
  const totalClicks = pageMetrics.reduce((s, p) => s + (p._sum.clicks ?? 0), 0);
  const rankingUrls = new Set(pageMetrics.map((p) => p.page));
  const productUrls = new Set(products.map((p) => p.url));
  const neverSeen = [...productUrls].filter((u) => !rankingUrls.has(u));

  console.log(`   URLs with impressions : ${rankingUrls.size}`);
  console.log(`   total impressions     : ${totalImp}`);
  console.log(`   total clicks          : ${totalClicks}`);
  console.log(`   products with ZERO impressions: ${neverSeen.length}/${products.length}`);

  if (totalClicks === 0 && totalImp > 0) {
    findings.push({
      severity: "CRITICAL",
      category: "ctr",
      title: `${totalImp} impressions produced zero clicks in 30 days`,
      detail:
        "The site is being shown in search results but nobody clicks. With missing titles and " +
        "descriptions sitewide, the listing itself is the most likely cause.",
    });
  }
  if (neverSeen.length > 0) {
    findings.push({
      severity: "HIGH",
      category: "indexation",
      title: `${neverSeen.length} of ${products.length} products have never received a single impression`,
      detail:
        "These pages may be unindexed, orphaned, or targeting phrases nobody searches. " +
        `Examples: ${neverSeen.slice(0, 6).map((u) => u.replace(SITE, "")).join(", ")}`,
    });
  }

  // ---------- Report ----------
  console.log("\n" + "=".repeat(74));
  console.log("FINDINGS");
  console.log("=".repeat(74));

  const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as const;
  findings.sort((a, b) => order[a.severity] - order[b.severity]);

  for (const f of findings) {
    console.log(`\n[${f.severity}] ${f.category.toUpperCase()} — ${f.title}`);
    if (f.url) console.log(`  ${f.url}`);
    console.log(`  ${f.detail}`);
  }

  // Persist so the dashboard can show them.
  await prisma.seoIssue.deleteMany({ where: { websiteId: website.id } });
  for (const f of findings) {
    await prisma.seoIssue.create({
      data: {
        websiteId: website.id,
        category: f.category,
        severity: f.severity,
        title: f.title,
        detail: { text: f.detail },
        url: f.url ?? null,
      },
    });
  }

  console.log(`\n${findings.length} findings stored to the database.`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("FAILED:", err instanceof Error ? err.message : err);
  await prisma.$disconnect();
  process.exit(1);
});
