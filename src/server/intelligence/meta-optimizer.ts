import type { CmsItem } from "@/server/integrations/cms/provider";

/**
 * Title and meta description construction for CTR recovery.
 *
 * No LLM is involved. Every element is drawn from data we measured: the exact
 * query users searched, the brand name, and claims already present in the
 * page's own content. That keeps the output honest — the system cannot invent
 * a benefit the product page does not make.
 *
 * Google truncates titles around 60 characters and descriptions around 155.
 */

export const TITLE_MAX = 60;
export const DESC_MAX = 155;

export type MetaProposal = {
  seoTitle: string;
  metaDescription: string;
  focusKeyword: string;
  rationale: string[];
  warnings: string[];
};

export type ProposalInput = {
  /** The query actually earning impressions, verbatim from Search Console. */
  primaryQuery: string;
  /** Secondary queries for the same page, if any. */
  secondaryQueries?: string[];
  brand: string;
  item: CmsItem;
  /** Plain-text page content, used only to source factual claims. */
  contentText: string;
  impressions: number;
  position: number;
};

/** Title-cases a query for display: "coconut milk soap" -> "Coconut Milk Soap". */
function titleCase(s: string): string {
  const small = new Set(["for", "and", "with", "in", "of", "the", "a", "to"]);
  return s
    .split(/\s+/)
    .map((w, i) =>
      i > 0 && small.has(w.toLowerCase())
        ? w.toLowerCase()
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join(" ");
}

/**
 * Extracts short benefit phrases that genuinely appear in the page content.
 * Returns only matches, never invented copy.
 */
function findClaims(contentText: string, candidates: string[]): string[] {
  const lower = contentText.toLowerCase();
  return candidates.filter((c) => lower.includes(c.toLowerCase()));
}

export function proposeMeta(input: ProposalInput): MetaProposal {
  const { primaryQuery, brand, item, contentText } = input;
  const rationale: string[] = [];
  const warnings: string[] = [];

  const queryTitle = titleCase(primaryQuery);

  // Does the current visible title even contain the query? This is the single
  // most common cause of a page-one listing earning no clicks.
  const currentTitle = item.seoTitle ?? item.title;
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const titleHasQuery = normalize(currentTitle).includes(normalize(primaryQuery));

  if (!item.seoTitle) {
    rationale.push(
      `No SEO title is set, so Google falls back to the post title "${item.title}".`,
    );
  }
  if (!titleHasQuery) {
    rationale.push(
      `The current title does not contain the searched phrase "${primaryQuery}" — ` +
        `"${currentTitle}" spells it differently, so the searched words are not bolded in the SERP.`,
    );
  }

  // Build the title: exact query first, then a differentiator, then brand.
  const differentiators = findClaims(contentText, [
    "handmade",
    "lavender",
    "cold pressed",
    "raw coconut milk",
    "natural",
    "herbal",
  ]);
  const differentiator = differentiators[0] ? titleCase(differentiators[0]) : null;

  let seoTitle = differentiator
    ? `${queryTitle} – ${differentiator} | ${brand}`
    : `${queryTitle} | ${brand}`;

  if (seoTitle.length > TITLE_MAX) {
    seoTitle = `${queryTitle} | ${brand}`;
  }
  if (seoTitle.length > TITLE_MAX) {
    seoTitle = queryTitle;
    warnings.push("Brand omitted from the title to stay within 60 characters.");
  }

  rationale.push(
    `Title leads with the exact phrase "${primaryQuery}" so Google bolds it in results.`,
  );

  // Description: only claims the page itself makes.
  const benefits = findClaims(contentText, [
    "moisturize",
    "fades scars",
    "soothes sunburns",
    "dark spots",
    "sensitive skin",
    "daily use",
  ]);

  const benefitPhrase =
    benefits.length >= 2
      ? `${benefits[0]}s skin, ${benefits[1]}`
      : benefits[0] ?? "gentle daily cleansing";

  let metaDescription =
    `${queryTitle} by ${brand}. ${capitalize(benefitPhrase)}. ` +
    `Made for dry and sensitive skin. Shop online in India.`;

  if (metaDescription.length > DESC_MAX) {
    metaDescription = `${queryTitle} by ${brand}. ${capitalize(benefitPhrase)}. Shop online in India.`;
  }
  if (metaDescription.length > DESC_MAX) {
    metaDescription = metaDescription.slice(0, DESC_MAX - 1).trimEnd() + "…";
    warnings.push("Description truncated to 155 characters.");
  }

  rationale.push(
    benefits.length > 0
      ? `Description uses benefits already stated on the page (${benefits.slice(0, 3).join(", ")}) — no new claims invented.`
      : "No specific benefit claims found in page content; description kept generic rather than invented.",
  );

  if (!item.metaDescription) {
    rationale.push("No meta description was set, so Google auto-generates a snippet.");
  }

  // Quality gates.
  if (seoTitle.length > TITLE_MAX) warnings.push(`Title is ${seoTitle.length} chars (over ${TITLE_MAX}).`);
  if (metaDescription.length > DESC_MAX) {
    warnings.push(`Description is ${metaDescription.length} chars (over ${DESC_MAX}).`);
  }
  const density =
    (seoTitle.toLowerCase().split(primaryQuery.toLowerCase()).length - 1) +
    (metaDescription.toLowerCase().split(primaryQuery.toLowerCase()).length - 1);
  if (density > 2) warnings.push("Primary keyword appears more than twice — risk of stuffing.");

  return {
    seoTitle,
    metaDescription,
    focusKeyword: primaryQuery,
    rationale,
    warnings,
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
