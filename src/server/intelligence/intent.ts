import type { Intent } from "@/lib/types";

/**
 * Rule-based search intent classification.
 *
 * Deliberately NOT an LLM call: intent for a keyword list of any size would be
 * thousands of tokens per refresh, and the signal is mostly lexical. The
 * Keyword Strategist agent (Phase 2) can override low-confidence results, but
 * the deterministic pass handles the clear majority for free.
 *
 * Confidence is reported so the UI can visually distinguish a firm
 * classification from a guess.
 */

const TRANSACTIONAL = [
  "buy", "price", "cost", "cheap", "discount", "deal", "offer", "coupon",
  "order", "shop", "purchase", "for sale", "near me", "delivery", "online",
];

const COMMERCIAL = [
  "best", "top", "review", "vs", "versus", "compare", "comparison",
  "alternative", "which", "brand", "brands",
];

const INFORMATIONAL = [
  "how", "what", "why", "when", "where", "guide", "tutorial", "benefits",
  "uses", "meaning", "definition", "recipe", "tips", "ideas", "examples",
  "is", "can", "does", "side effects", "ingredients",
];

const LOCAL = ["near me", "in ", "nearby", "local", "store", "shop near"];

export function classifyIntent(query: string): { intent: Intent; confidence: number } {
  const q = ` ${query.toLowerCase().trim()} `;

  const hit = (terms: string[]) =>
    terms.filter((t) => q.includes(t.length <= 3 ? ` ${t} ` : t)).length;

  const scores: { intent: Intent; n: number }[] = [
    { intent: "TRANSACTIONAL", n: hit(TRANSACTIONAL) * 1.2 },
    { intent: "COMMERCIAL", n: hit(COMMERCIAL) * 1.1 },
    { intent: "LOCAL", n: hit(LOCAL) * 1.15 },
    { intent: "INFORMATIONAL", n: hit(INFORMATIONAL) },
  ];

  scores.sort((a, b) => b.n - a.n);
  const top = scores[0]!;

  if (top.n === 0) {
    // A bare product/entity term with no modifier. On an e-commerce site these
    // are overwhelmingly commercial browse queries.
    return { intent: "COMMERCIAL", confidence: 0.4 };
  }

  const runnerUp = scores[1]!.n;
  const margin = top.n - runnerUp;
  const confidence = Math.min(0.95, 0.55 + margin * 0.15 + Math.min(top.n, 3) * 0.05);

  return { intent: top.intent, confidence };
}

/** Opportunity banding by position — used for filtering and colour-coding. */
export type PositionBand = "top3" | "page1" | "page2" | "deep";

export function positionBand(position: number): PositionBand {
  if (position <= 3.5) return "top3";
  if (position <= 10.5) return "page1";
  if (position <= 20.5) return "page2";
  return "deep";
}

export const BAND_LABELS: Record<PositionBand, string> = {
  top3: "Top 3",
  page1: "Page 1",
  page2: "Page 2",
  deep: "Beyond page 2",
};
