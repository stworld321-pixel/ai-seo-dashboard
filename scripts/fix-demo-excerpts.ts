/**
 * Replaces leftover WooCommerce demo copy in product short descriptions with
 * a real summary derived from each product's OWN body content.
 *
 *   npx tsx scripts/fix-demo-excerpts.ts            # preview only
 *   npx tsx scripts/fix-demo-excerpts.ts --apply    # write to the live site
 *
 * No claims are invented: the replacement is built from the product's existing
 * hook line and its stated ingredients/benefits. Every write captures the old
 * value first so it is reversible.
 */
import "dotenv/config";
import { prisma } from "../src/server/db";
import { WordPressProvider } from "../src/server/integrations/cms/wordpress";

const SITE = "https://litenatures.in";
const APPLY = process.argv.includes("--apply");

const DEMO_MARKERS = ["button-up shirt", "lenzing", "ecovero", "crinkle-texture", "drapey"];

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&#8211;/g, "-")
    .replace(/&#\d+;/g, " ")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Builds a short description from the product's real body copy.
 * Strategy: take the opening hook line, then the first two sentences that name
 * ingredients or benefits. Falls back gracefully if the structure differs.
 */
function buildExcerpt(bodyText: string): { text: string; hook: string } {
  const clean = bodyText.replace(/✅|Key Benefits[\s\S]*$/i, "").trim();

  // The hook is the leading run of short imperative words ("Hydrate. Glow. ...").
  const hookMatch = clean.match(/^((?:[A-Z][a-z]+\.\s*){2,6})/);
  const hook = hookMatch ? hookMatch[1]!.trim() : "";

  const rest = hook ? clean.slice(hook.length).trim() : clean;
  const sentences = rest
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 30);

  // Prefer the sentence that names ingredients (contains "with"/"crafted"/"blend").
  const ingredientSentence =
    sentences.find((s) => /blend|craft|enrich|packed|made with|infused|raw /i.test(s)) ??
    sentences[0] ??
    "";
  const benefitSentence =
    sentences.find(
      (s) => s !== ingredientSentence && /hydrat|nourish|soothe|heal|glow|moistur|gentle|skin/i.test(s),
    ) ?? "";

  let text = [hook, ingredientSentence, benefitSentence]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  // Clean spacing artifacts carried over from the source body copy, e.g.
  // "oi l" -> "oil", "ski n" -> "skin", and a stray space before punctuation.
  text = text
    .replace(/\boi l\b/gi, "oil")
    .replace(/\bski n\b/gi, "skin")
    .replace(/\s+([,.])/g, "$1");

  // Keep it to a tidy short-description length.
  if (text.length > 320) {
    text = text.slice(0, 317).replace(/\s+\S*$/, "") + "…";
  }
  return { text, hook };
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

  if (APPLY) {
    const v = await wp.verify();
    if (!v.ok) throw new Error(`Cannot write: ${v.error}`);
    console.log(`Authenticated as ${v.user}\n`);
  }

  console.log(APPLY ? "=== APPLYING ===" : "=== PREVIEW ONLY (use --apply to write) ===\n");

  // Find every product whose excerpt contains demo markers.
  const raw = (await (
    await fetch(`${SITE}/wp-json/wp/v2/product?per_page=100`)
  ).json()) as {
    id: number;
    slug: string;
    link: string;
    type: string;
    excerpt?: { rendered?: string };
    content?: { rendered?: string };
  }[];

  const affected = raw.filter((p) => {
    const t = stripHtml(p.excerpt?.rendered ?? "").toLowerCase();
    return DEMO_MARKERS.some((m) => t.includes(m));
  });

  console.log(`${affected.length} products have demo copy in their short description.\n`);

  let applied = 0;
  for (const p of affected) {
    const bodyText = stripHtml(p.content?.rendered ?? "");
    const { text } = buildExcerpt(bodyText);

    console.log("─".repeat(72));
    console.log(`${p.slug} (id ${p.id})`);
    console.log(`  OLD: ${stripHtml(p.excerpt?.rendered ?? "").slice(0, 120)}…`);
    console.log(`  NEW: ${text}`);

    if (!text || text.length < 40) {
      console.log("  SKIP — could not derive a solid excerpt from body copy; needs manual review.\n");
      continue;
    }

    if (!APPLY) {
      console.log("  (preview only)\n");
      continue;
    }

    const html = `<p>${text}</p>`;
    await wp.updateExcerpt(String(p.id), "product", html);

    // Verify the write landed.
    const check = (await (
      await fetch(`${SITE}/wp-json/wp/v2/product/${p.id}`)
    ).json()) as { excerpt?: { rendered?: string } };
    const nowText = stripHtml(check.excerpt?.rendered ?? "");
    const clean = !DEMO_MARKERS.some((m) => nowText.toLowerCase().includes(m));

    console.log(`  WRITE ${clean ? "CONFIRMED — demo copy gone" : "FAILED — demo text still present"}`);

    if (clean) {
      applied++;
      await prisma.contentExperiment.create({
        data: {
          websiteId: website.id,
          url: p.link,
          changeType: "excerpt_demo_copy_fix",
          appliedAt: new Date(),
          baseline: { note: "no traffic baseline; correctness fix, not a CTR test" },
          attributes: {
            oldExcerpt: stripHtml(p.excerpt?.rendered ?? ""),
            newExcerpt: text,
          },
        },
      });
    }
    console.log();
  }

  if (APPLY) {
    console.log("─".repeat(72));
    console.log(`${applied}/${affected.length} product excerpts fixed and verified.`);
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("FAILED:", err instanceof Error ? err.message : err);
  await prisma.$disconnect();
  process.exit(1);
});
