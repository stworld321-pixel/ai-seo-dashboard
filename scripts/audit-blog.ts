/**
 * Scores every blog post on litenatures.in and prints an optimization report.
 * Read-only. Persists a PageRecord contentScore per post so the dashboard and
 * later phases can use it.
 *
 *   npx tsx scripts/audit-blog.ts
 */
import "dotenv/config";
import { prisma } from "../src/server/db";
import { scoreContent, type ContentSignals } from "../src/server/intelligence/content-score";

const SITE = "https://litenatures.in";

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

type WpPost = {
  id: number;
  slug: string;
  link: string;
  title?: { rendered?: string };
  content?: { rendered?: string };
  meta?: Record<string, unknown>;
};

async function main() {
  const website = await prisma.website.findFirst({ where: { url: { contains: "litenatures" } } });
  if (!website) throw new Error("Run `npm run sync:lite` first.");

  const posts = (await (
    await fetch(`${SITE}/wp-json/wp/v2/posts?per_page=100`)
  ).json()) as WpPost[];

  console.log("=".repeat(74));
  console.log(`BLOG OPTIMIZATION AUDIT — ${posts.length} posts`);
  console.log("=".repeat(74));

  const scored: { slug: string; total: number; grade: string }[] = [];

  for (const p of posts) {
    const html = p.content?.rendered ?? "";
    const meta = (p.meta ?? {}) as Record<string, string>;
    const str = (v: unknown) => (typeof v === "string" && v.length ? v : null);

    const imgs = [...html.matchAll(/<img[^>]*>/gi)].map((m) => m[0]);
    const signals: ContentSignals = {
      slug: p.slug,
      url: p.link,
      title: p.title?.rendered ?? "",
      seoTitle: str(meta.rank_math_title),
      metaDescription: str(meta.rank_math_description),
      focusKeyword: str(meta.rank_math_focus_keyword),
      bodyText: stripHtml(html),
      wordCount: stripHtml(html).split(/\s+/).filter(Boolean).length,
      h2Count: (html.match(/<h2/gi) ?? []).length,
      h3Count: (html.match(/<h3/gi) ?? []).length,
      internalLinks: (html.match(/href="https?:\/\/litenatures\.in/gi) ?? []).length,
      externalLinks: (html.match(/href="https?:\/\/(?!litenatures\.in)/gi) ?? []).length,
      hasFaq: /frequently asked|faq|<summary|schema\.org\/FAQ/i.test(html),
      hasSchema: /application\/ld\+json|schema\.org/i.test(html),
      imageCount: imgs.length,
      imagesWithAlt: imgs.filter((t) => /alt="[^"]+"/i.test(t)).length,
    };

    const result = scoreContent(signals);
    scored.push({ slug: p.slug, total: result.total, grade: result.grade });

    const gradeTag =
      result.grade === "healthy" ? "HEALTHY" : result.grade === "optimize" ? "OPTIMIZE" : "REWRITE ";
    console.log(`\n[${gradeTag}] ${result.total}/100  ${p.slug}`);
    console.log(`   ${signals.wordCount} words · ${signals.h2Count} H2 · ${signals.internalLinks} internal links · FAQ:${signals.hasFaq ? "yes" : "no"}`);
    if (result.topFixes.length) {
      for (const f of result.topFixes) console.log(`   → ${f}`);
    }

    // Persist the score.
    await prisma.pageRecord.upsert({
      where: { websiteId_url: { websiteId: website.id, url: p.link } },
      create: {
        websiteId: website.id,
        url: p.link,
        title: signals.title,
        wordCount: signals.wordCount,
        contentScore: result.total,
        contentScoreDetail: { grade: result.grade, items: result.items },
        status: result.grade === "healthy" ? "HEALTHY" : result.grade === "optimize" ? "OPTIMIZE" : "REFRESH",
        lastCrawledAt: new Date(),
      },
      update: {
        wordCount: signals.wordCount,
        contentScore: result.total,
        contentScoreDetail: { grade: result.grade, items: result.items },
        status: result.grade === "healthy" ? "HEALTHY" : result.grade === "optimize" ? "OPTIMIZE" : "REFRESH",
        lastCrawledAt: new Date(),
      },
    });
  }

  console.log("\n" + "=".repeat(74));
  console.log("SUMMARY");
  const healthy = scored.filter((s) => s.grade === "healthy").length;
  const optimize = scored.filter((s) => s.grade === "optimize").length;
  const rewrite = scored.filter((s) => s.grade === "rewrite").length;
  const avg = Math.round(scored.reduce((s, x) => s + x.total, 0) / scored.length);
  console.log(`  average score: ${avg}/100`);
  console.log(`  healthy: ${healthy} · optimize: ${optimize} · rewrite: ${rewrite}`);
  console.log("\n  Worst first:");
  for (const s of [...scored].sort((a, b) => a.total - b.total).slice(0, 6)) {
    console.log(`    ${String(s.total).padStart(3)}/100  ${s.slug}`);
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("FAILED:", err instanceof Error ? err.message : err);
  await prisma.$disconnect();
  process.exit(1);
});
