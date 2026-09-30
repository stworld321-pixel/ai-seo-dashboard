import type { Opportunity, PageMetrics, QueryMetrics } from "@/lib/types";
import { fitCtrCurve, type CtrCurve } from "./ctr-curve";
import { clamp, percentile } from "./stats";

/**
 * The Opportunity Engine.
 *
 * Deliberately contains ZERO LLM calls: all detection is deterministic maths
 * over data we actually pulled from Search Console. LLMs are used later, only
 * to write language for an opportunity we already proved exists.
 *
 * Every returned opportunity carries `evidence` (measured numbers) and `why`
 * (a sentence a human can check). `estimatedClicks` is null whenever the site
 * lacks the click history needed to model it honestly.
 */

export type EngineInput = {
  /** Current window, query grain. */
  queries: QueryMetrics[];
  /** Current window, page grain. */
  pages: PageMetrics[];
  /** Current window, query+page grain for cannibalization detection (optional; falls back to `queries`). */
  queryPages?: QueryMetrics[];
  /** Previous window of equal length, query grain (optional). */
  previousQueries?: QueryMetrics[];
  /** Previous window of equal length, page grain (optional). */
  previousPages?: PageMetrics[];
  /** Learned multipliers from ContentExperiment outcomes, clamped 0.7..1.4. */
  learnedWeights?: Record<string, number>;
};

export type EngineResult = {
  opportunities: Opportunity[];
  curve: CtrCurve;
};

const QUICK_WIN_MIN = 3.5;
const QUICK_WIN_MAX = 10.5;
const PAGE_TWO_MAX = 20.5;
/** Position we model a page-two listing reaching after successful work. */
const PAGE_TWO_TARGET_POSITION = 8;

function learned(weights: Record<string, number> | undefined, key: string) {
  const w = weights?.[key];
  return typeof w === "number" ? clamp(w, 0.7, 1.4) : 1;
}

function round(n: number, dp = 2) {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/** A. Position 4-10 with impressions but CTR below the site's own curve. */
function quickWins(input: EngineInput, curve: CtrCurve): Opportunity[] {
  const impressions = input.queries.map((q) => q.impressions);
  const impFloor = Math.max(20, percentile(impressions, 0.6));
  const out: Opportunity[] = [];

  for (const q of input.queries) {
    if (q.position < QUICK_WIN_MIN || q.position > QUICK_WIN_MAX) continue;
    if (q.impressions < impFloor) continue;

    const expected = curve.expectedCtr(q.position);
    const gap = expected === null ? null : Math.max(0, expected - q.ctr);
    if (gap !== null && gap <= 0) continue;

    const estimatedClicks = gap === null ? null : gap * q.impressions;
    // Without a curve we still know a page-1 listing earning zero clicks is a
    // problem; score on impressions alone and say so in `why`.
    const base =
      estimatedClicks === null
        ? q.impressions * (q.clicks === 0 ? 0.08 : 0.04)
        : estimatedClicks;
    const score =
      base * Math.log10(q.impressions + 10) * learned(input.learnedWeights, "QUICK_WIN");

    out.push({
      type: "QUICK_WIN",
      keyword: q.query,
      targetUrl: q.page,
      score,
      priority: 5,
      estimatedClicks: estimatedClicks === null ? null : round(estimatedClicks, 1),
      why:
        expected === null
          ? `"${q.query}" ranks at position ${round(q.position, 1)} with ${q.impressions} impressions but ${q.clicks} clicks. There is not enough sitewide click history to model an expected CTR, so this is flagged on the raw mismatch between page-one visibility and clicks.`
          : `"${q.query}" ranks at position ${round(q.position, 1)} with ${q.impressions} impressions and a ${round(q.ctr * 100, 2)}% CTR, against ${round(expected * 100, 2)}% typical for this site at that position.`,
      evidence: {
        impressions: q.impressions,
        clicks: q.clicks,
        ctr: round(q.ctr, 4),
        position: round(q.position, 2),
        siteExpectedCtr: expected === null ? null : round(expected, 4),
        ctrGap: gap === null ? null : round(gap, 4),
      },
      recommendation: [
        { action: "Rewrite the title tag", detail: "Lead with the query intent and a differentiator." },
        { action: "Rewrite the meta description", detail: "Add a concrete reason to click." },
        { action: "Add an FAQ block", detail: "Targets People Also Ask and AI answer surfaces." },
        { action: "Strengthen internal links", detail: "Increase inbound links from related pages." },
      ],
    });
  }
  return out;
}

/** B. Position 11-20: real headroom, needs content work rather than a title tweak. */
function pageTwo(input: EngineInput, curve: CtrCurve): Opportunity[] {
  const out: Opportunity[] = [];
  for (const q of input.queries) {
    if (q.position <= QUICK_WIN_MAX || q.position > PAGE_TWO_MAX) continue;
    if (q.impressions < 10) continue;

    const targetCtr = curve.expectedCtr(PAGE_TWO_TARGET_POSITION);
    const headroom = targetCtr === null ? null : targetCtr * q.impressions;
    const base = headroom ?? q.impressions * 0.05;
    const score = base * Math.log10(q.impressions + 10) * 0.8 * learned(input.learnedWeights, "PAGE_TWO");

    out.push({
      type: "PAGE_TWO",
      keyword: q.query,
      targetUrl: q.page,
      score,
      priority: 5,
      estimatedClicks: headroom === null ? null : round(headroom, 1),
      why: `"${q.query}" sits at position ${round(q.position, 1)} with ${q.impressions} impressions — one page short of meaningful traffic.`,
      evidence: {
        impressions: q.impressions,
        clicks: q.clicks,
        position: round(q.position, 2),
        targetPosition: PAGE_TWO_TARGET_POSITION,
        modelledCtrAtTarget: targetCtr === null ? null : round(targetCtr, 4),
      },
      recommendation: [
        { action: "Expand the page", detail: "Cover the subtopics competitors answer and this page does not." },
        { action: "Add a comparison table" },
        { action: "Add an FAQ section" },
        { action: "Add supporting internal links from related pages" },
      ],
    });
  }
  return out;
}

/** C. Any position: impressions high, CTR far below the site curve. */
function ctrGaps(input: EngineInput, curve: CtrCurve): Opportunity[] {
  if (!curve.fitted) return []; // Without a curve this detector would be fiction.
  const impressions = input.queries.map((q) => q.impressions);
  const floor = percentile(impressions, 0.75);
  const out: Opportunity[] = [];

  for (const q of input.queries) {
    if (q.impressions < floor) continue;
    if (q.position > QUICK_WIN_MAX && q.position <= PAGE_TWO_MAX) continue; // covered by PAGE_TWO
    const expected = curve.expectedCtr(q.position);
    if (expected === null || q.ctr >= 0.5 * expected) continue;

    const estimatedClicks = (expected - q.ctr) * q.impressions;
    out.push({
      type: "CTR_GAP",
      keyword: q.query,
      targetUrl: q.page,
      score: estimatedClicks * Math.log10(q.impressions + 10) * learned(input.learnedWeights, "CTR_GAP"),
      priority: 5,
      estimatedClicks: round(estimatedClicks, 1),
      why: `"${q.query}" earns ${round(q.ctr * 100, 2)}% CTR versus ${round(expected * 100, 2)}% typical at position ${round(q.position, 1)} on this site.`,
      evidence: {
        impressions: q.impressions,
        clicks: q.clicks,
        ctr: round(q.ctr, 4),
        siteExpectedCtr: round(expected, 4),
        position: round(q.position, 2),
      },
      recommendation: [
        { action: "Generate 3 alternative titles and pick one" },
        { action: "Generate 3 alternative meta descriptions" },
      ],
    });
  }
  return out;
}

/** D. Declining keywords, comparing the current window against the previous one. */
function decliningKeywords(input: EngineInput): Opportunity[] {
  if (!input.previousQueries?.length) return [];
  const prev = new Map(input.previousQueries.map((q) => [q.query, q]));
  const out: Opportunity[] = [];

  for (const q of input.queries) {
    const p = prev.get(q.query);
    if (!p) continue;

    const clickDrop = p.clicks - q.clicks;
    const clickPct = p.clicks > 0 ? clickDrop / p.clicks : 0;
    const posDrop = q.position - p.position;
    const impPct = p.impressions > 0 ? (p.impressions - q.impressions) / p.impressions : 0;

    const byClicks = clickPct >= 0.25 && clickDrop >= 5;
    const byPosition = posDrop >= 3 && q.impressions >= 50;
    const byImpressions = impPct >= 0.3 && p.impressions >= 100;
    if (!byClicks && !byPosition && !byImpressions) continue;

    const score =
      (clickDrop * 4 + Math.max(0, posDrop) * q.impressions * 0.02) *
      learned(input.learnedWeights, "DECLINING_KEYWORD");

    out.push({
      type: "DECLINING_KEYWORD",
      keyword: q.query,
      targetUrl: q.page,
      score,
      priority: 5,
      estimatedClicks: clickDrop > 0 ? round(clickDrop, 1) : null,
      why: `"${q.query}" lost ${clickDrop} clicks and moved from position ${round(p.position, 1)} to ${round(q.position, 1)} versus the previous period.`,
      evidence: {
        clicksNow: q.clicks,
        clicksBefore: p.clicks,
        impressionsNow: q.impressions,
        impressionsBefore: p.impressions,
        positionNow: round(q.position, 2),
        positionBefore: round(p.position, 2),
      },
      recommendation: [
        { action: "Check whether search intent shifted", detail: "Compare current SERP against what the page answers." },
        { action: "Refresh the page content" },
        { action: "Verify the page is still indexed and canonical" },
      ],
    });
  }
  return out;
}

/** E. Declining pages, same comparison at URL grain. */
function decliningPages(input: EngineInput): Opportunity[] {
  if (!input.previousPages?.length) return [];
  const prev = new Map(input.previousPages.map((p) => [p.page, p]));
  const out: Opportunity[] = [];

  for (const cur of input.pages) {
    const p = prev.get(cur.page);
    if (!p) continue;
    const clickDrop = p.clicks - cur.clicks;
    const impDrop = p.impressions - cur.impressions;
    const clickPct = p.clicks > 0 ? clickDrop / p.clicks : 0;
    const impPct = p.impressions > 0 ? impDrop / p.impressions : 0;

    if (!((clickPct >= 0.25 && clickDrop >= 5) || (impPct >= 0.3 && p.impressions >= 100))) continue;

    out.push({
      type: "DECLINING_PAGE",
      targetUrl: cur.page,
      score: (clickDrop * 4 + impDrop * 0.05) * learned(input.learnedWeights, "DECLINING_PAGE"),
      priority: 5,
      estimatedClicks: clickDrop > 0 ? round(clickDrop, 1) : null,
      why: `${cur.page} lost ${clickDrop} clicks and ${impDrop} impressions versus the previous period.`,
      evidence: {
        clicksNow: cur.clicks,
        clicksBefore: p.clicks,
        impressionsNow: cur.impressions,
        impressionsBefore: p.impressions,
        positionNow: round(cur.position, 2),
        positionBefore: round(p.position, 2),
      },
      recommendation: [
        { action: "Refresh and expand the page" },
        { action: "Check for cannibalization from newer pages" },
        { action: "Re-inspect indexing status" },
      ],
    });
  }
  return out;
}

/**
 * F. Cannibalization: one query served by several pages, none dominant.
 * Requires query+page grain data; silently returns [] when unavailable.
 */
export function detectCannibalization(rows: QueryMetrics[]): Opportunity[] {
  const byQuery = new Map<string, QueryMetrics[]>();
  for (const r of rows) {
    if (!r.page) continue;
    const list = byQuery.get(r.query);
    if (list) list.push(r);
    else byQuery.set(r.query, [r]);
  }

  const out: Opportunity[] = [];
  for (const [query, list] of byQuery) {
    if (list.length < 2) continue;
    const total = list.reduce((s, r) => s + r.impressions, 0);
    if (total < 20) continue;
    const sorted = [...list].sort((a, b) => b.impressions - a.impressions);
    const share = sorted[0]!.impressions / total;
    const bothRank = sorted[0]!.position < 30 && sorted[1]!.position < 30;
    if (share >= 0.7 || !bothRank) continue;

    out.push({
      type: "CANNIBALIZATION",
      keyword: query,
      targetUrl: sorted[0]!.page,
      score: total * (1 - share) * 2,
      priority: 5,
      estimatedClicks: null,
      why: `"${query}" is split across ${list.length} pages; the strongest holds only ${Math.round(share * 100)}% of impressions.`,
      evidence: {
        pages: list.length,
        topPage: sorted[0]!.page ?? "",
        topShare: round(share, 3),
        secondPage: sorted[1]!.page ?? "",
        totalImpressions: total,
      },
      recommendation: [
        { action: "Differentiate the pages by intent", detail: "Or consolidate into one stronger page." },
        { action: "Set a canonical to the preferred page", detail: "Requires approval — canonical changes are gated." },
        { action: "Point internal links at the chosen page" },
      ],
    });
  }
  return out;
}

/**
 * Assign 1..5 priority within this website's set.
 *
 * Rank is derived from descending score ORDER, not from `percentileRank`:
 * with a small result set (a new domain might yield only two opportunities)
 * a tie-aware percentile puts the best item at ~0.75 and it would never be
 * labelled P1. The top opportunity must always be P1.
 */
function assignPriorities(items: Opportunity[]): Opportunity[] {
  const sorted = [...items].sort((a, b) => b.score - a.score);
  const n = sorted.length;
  return sorted.map((o, i) => {
    const rank = n <= 1 ? 1 : 1 - i / n; // 1 for the best, approaching 0
    const priority = rank >= 0.9 ? 1 : rank >= 0.7 ? 2 : rank >= 0.4 ? 3 : rank >= 0.15 ? 4 : 5;
    return { ...o, priority, score: round(o.score, 3) };
  });
}

export function runOpportunityEngine(input: EngineInput): EngineResult {
  const isStopword = (q?: string) => {
    if (!q) return false;
    const lower = q.toLowerCase().trim();
    return ["services", "service", "our services", "about us", "about", "contact us", "contact", "home", "homepage", "privacy", "terms", "careers", "cart", "checkout", "support", "custom web solutions"].includes(lower);
  };

  const cleanInput: EngineInput = {
    ...input,
    queries: input.queries.filter((q) => !isStopword(q.query)),
    queryPages: input.queryPages?.filter((q) => !isStopword(q.query)),
    previousQueries: input.previousQueries?.filter((q) => !isStopword(q.query)),
  };

  const curve = fitCtrCurve(cleanInput.queries);

  const all = [
    ...quickWins(cleanInput, curve),
    ...pageTwo(cleanInput, curve),
    ...ctrGaps(cleanInput, curve),
    ...decliningKeywords(cleanInput),
    ...decliningPages(cleanInput),
    ...detectCannibalization(cleanInput.queryPages ?? cleanInput.queries),
  ].filter((o) => !isStopword(o.keyword));

  const ranked = assignPriorities(all).sort((a, b) => b.score - a.score);
  return { opportunities: ranked, curve };
}

/**
 * The "What should I do today?" list: the strongest action from each distinct
 * opportunity type, so the user gets a diverse plan rather than five variants
 * of the same fix.
 */
export function todaysActions<T extends { type: string }>(
  opportunities: T[],
  limit = 5,
): T[] {
  const seen = new Set<string>();
  const picked: T[] = [];
  for (const o of opportunities) {
    if (seen.has(o.type)) continue;
    seen.add(o.type);
    picked.push(o);
    if (picked.length >= limit) break;
  }
  // If there are fewer types than `limit`, backfill with the next best overall.
  for (const o of opportunities) {
    if (picked.length >= limit) break;
    if (!picked.includes(o)) picked.push(o);
  }
  return picked;
}
