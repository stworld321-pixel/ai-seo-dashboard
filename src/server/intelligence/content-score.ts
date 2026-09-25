/**
 * Blog content scoring. Deterministic — no LLM. Scores an article against the
 * on-page signals that actually move rankings and CTR, and returns specific,
 * actionable fixes rather than a vague number.
 *
 * The score is only ever as honest as the checks behind it (docs/06 §Health
 * Score): every point deducted names the reason.
 */

export type ContentSignals = {
  slug: string;
  url: string;
  title: string;
  seoTitle: string | null;
  metaDescription: string | null;
  focusKeyword: string | null;
  bodyText: string;
  wordCount: number;
  h2Count: number;
  h3Count: number;
  internalLinks: number;
  externalLinks: number;
  hasFaq: boolean;
  hasSchema: boolean;
  imageCount: number;
  imagesWithAlt: number;
};

export type ScoreItem = {
  label: string;
  points: number; // earned
  max: number;
  ok: boolean;
  fix?: string;
};

export type ContentScore = {
  total: number; // 0-100
  grade: "healthy" | "optimize" | "rewrite";
  items: ScoreItem[];
  topFixes: string[];
};

/** A helpful, rankable article generally needs real depth. */
const MIN_WORDS = 600;
const GOOD_WORDS = 1000;

export function scoreContent(s: ContentSignals): ContentScore {
  const items: ScoreItem[] = [];

  // SEO title (15)
  items.push(
    s.seoTitle
      ? { label: "SEO title set", points: 15, max: 15, ok: true }
      : {
          label: "SEO title",
          points: 0,
          max: 15,
          ok: false,
          fix: "No SEO title — Google falls back to the post title. Set a title that leads with the target phrase.",
        },
  );

  // Meta description (10)
  items.push(
    s.metaDescription
      ? { label: "Meta description set", points: 10, max: 10, ok: true }
      : {
          label: "Meta description",
          points: 0,
          max: 10,
          ok: false,
          fix: "No meta description — Google auto-generates a snippet. Write one with the phrase and a reason to click.",
        },
  );

  // Focus keyword (5)
  items.push(
    s.focusKeyword
      ? { label: "Focus keyword set", points: 5, max: 5, ok: true }
      : { label: "Focus keyword", points: 0, max: 5, ok: false, fix: "Set a focus keyword in Rank Math." },
  );

  // Word count / depth (20)
  if (s.wordCount >= GOOD_WORDS) {
    items.push({ label: `Depth (${s.wordCount} words)`, points: 20, max: 20, ok: true });
  } else if (s.wordCount >= MIN_WORDS) {
    items.push({
      label: `Depth (${s.wordCount} words)`,
      points: 12,
      max: 20,
      ok: true,
      fix: `Solid but expandable — reaching ${GOOD_WORDS}+ words with genuine detail helps for competitive terms.`,
    });
  } else {
    items.push({
      label: `Depth (${s.wordCount} words)`,
      points: Math.round((s.wordCount / MIN_WORDS) * 6),
      max: 20,
      ok: false,
      fix: `Thin content — ${s.wordCount} words is below the ${MIN_WORDS}-word floor for a rankable article. Expand with real substance, not filler.`,
    });
  }

  // Heading structure (10)
  if (s.h2Count >= 3) {
    items.push({ label: `Structure (${s.h2Count} H2s)`, points: 10, max: 10, ok: true });
  } else {
    items.push({
      label: `Structure (${s.h2Count} H2s)`,
      points: s.h2Count * 3,
      max: 10,
      ok: false,
      fix: "Add descriptive H2 sections — they help both scanning and how AI answer engines lift passages.",
    });
  }

  // Internal links (15)
  if (s.internalLinks >= 3) {
    items.push({ label: `Internal links (${s.internalLinks})`, points: 15, max: 15, ok: true });
  } else {
    items.push({
      label: `Internal links (${s.internalLinks})`,
      points: s.internalLinks * 4,
      max: 15,
      ok: false,
      fix: `Only ${s.internalLinks} internal link(s). Link to relevant products and related posts (aim for 3-6).`,
    });
  }

  // FAQ (12) — strong for People Also Ask and AI answers
  items.push(
    s.hasFaq
      ? { label: "FAQ section", points: 12, max: 12, ok: true }
      : {
          label: "FAQ section",
          points: 0,
          max: 12,
          ok: false,
          fix: "No FAQ — add 3-5 real questions with concise answers to win People Also Ask and AI overviews.",
        },
  );

  // Image alt text (8)
  if (s.imageCount === 0) {
    items.push({
      label: "Images",
      points: 0,
      max: 8,
      ok: false,
      fix: "No images — add at least one relevant image with descriptive alt text.",
    });
  } else if (s.imagesWithAlt >= s.imageCount) {
    items.push({ label: `Images (${s.imageCount}, all alt)`, points: 8, max: 8, ok: true });
  } else {
    items.push({
      label: `Image alt (${s.imagesWithAlt}/${s.imageCount})`,
      points: Math.round((s.imagesWithAlt / s.imageCount) * 8),
      max: 8,
      ok: false,
      fix: `${s.imageCount - s.imagesWithAlt} image(s) missing alt text.`,
    });
  }

  // Schema (5)
  items.push(
    s.hasSchema
      ? { label: "Schema present", points: 5, max: 5, ok: true }
      : { label: "Schema", points: 0, max: 5, ok: false, fix: "Add Article + FAQ JSON-LD (Rank Math can do this)." },
  );

  const total = items.reduce((sum, i) => sum + i.points, 0);
  const grade = total >= 80 ? "healthy" : total >= 55 ? "optimize" : "rewrite";
  const topFixes = items
    .filter((i) => !i.ok && i.fix)
    .sort((a, b) => b.max - b.points - (a.max - a.points))
    .map((i) => i.fix!)
    .slice(0, 5);

  return { total, grade, items, topFixes };
}
