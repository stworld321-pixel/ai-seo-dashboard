import { describe, expect, it } from "vitest";
import {
  runOpportunityEngine,
  todaysActions,
  detectCannibalization,
} from "@/server/intelligence/opportunity-engine";
import { liteQueries, litePages, siteWithClicks } from "../fixtures/litenatures";

describe("Opportunity engine against real litenatures.in data", () => {
  const result = runOpportunityEngine({
    queries: liteQueries(),
    pages: litePages(),
  });

  it("produces opportunities from genuine GSC data", () => {
    expect(result.opportunities.length).toBeGreaterThan(0);
  });

  it("surfaces 'coconut milk soap' as the leading quick win", () => {
    const top = result.opportunities.filter((o) => o.type === "QUICK_WIN");
    expect(top.length).toBeGreaterThan(0);
    // 73 impressions at position 8.8 with zero clicks is the single best
    // page-one opportunity this site has.
    expect(top[0]!.keyword).toBe("coconut milk soap");
    expect(top[0]!.evidence.impressions).toBe(73);
    expect(top[0]!.evidence.clicks).toBe(0);
  });

  it("never invents estimated clicks when the site has no click history", () => {
    expect(result.curve.fitted).toBe(false);
    for (const o of result.opportunities) {
      if (o.type === "QUICK_WIN" || o.type === "PAGE_TWO") {
        expect(o.estimatedClicks).toBeNull();
      }
    }
  });

  it("suppresses the CTR_GAP detector entirely without a fitted curve", () => {
    // Without a curve, a CTR gap cannot be measured — so it must not be claimed.
    expect(result.opportunities.some((o) => o.type === "CTR_GAP")).toBe(false);
  });

  it("classifies 'fairness soap' (position 17.3) as a page-two opportunity", () => {
    const pageTwo = result.opportunities.filter((o) => o.type === "PAGE_TWO");
    const fairness = pageTwo.find((o) => o.keyword === "fairness soap");
    expect(fairness).toBeDefined();
    expect(fairness!.evidence.impressions).toBe(32);
  });

  it("ignores deep-ranking keywords that are not yet actionable", () => {
    // "charcoal soap" sits at position 51 — real impressions, but a title
    // rewrite there is worthless. It must not appear as a quick win.
    const quickWins = result.opportunities.filter((o) => o.type === "QUICK_WIN");
    expect(quickWins.some((o) => o.keyword === "charcoal soap")).toBe(false);
  });

  it("gives every opportunity an explanation and evidence", () => {
    for (const o of result.opportunities) {
      expect(o.why.length).toBeGreaterThan(20);
      expect(Object.keys(o.evidence).length).toBeGreaterThan(0);
      expect(o.recommendation.length).toBeGreaterThan(0);
    }
  });

  it("assigns priorities 1..5 in descending score order", () => {
    const scores = result.opportunities.map((o) => o.score);
    const sorted = [...scores].sort((a, b) => b - a);
    expect(scores).toEqual(sorted);
    for (const o of result.opportunities) {
      expect(o.priority).toBeGreaterThanOrEqual(1);
      expect(o.priority).toBeLessThanOrEqual(5);
    }
    expect(result.opportunities[0]!.priority).toBe(1);
  });

  it("builds a diverse 'today' list rather than five of the same fix", () => {
    const today = todaysActions(result.opportunities, 5);
    // This site genuinely only has 2 actionable opportunities right now
    // (one page-one listing and one page-two listing above the impression
    // floor). Padding the list to 5 would mean inventing work, so the engine
    // returns what actually exists.
    expect(today.length).toBe(Math.min(5, result.opportunities.length));
    const types = new Set(today.map((o) => o.type));
    expect(types.size).toBe(today.length); // no duplicate types while types remain
  });
});

describe("Opportunity engine with click history", () => {
  const withClicks = siteWithClicks();

  it("fits a curve and then does estimate clicks", () => {
    const r = runOpportunityEngine({ queries: withClicks, pages: [] });
    expect(r.curve.fitted).toBe(true);
    const quick = r.opportunities.filter((o) => o.type === "QUICK_WIN");
    for (const o of quick) expect(typeof o.estimatedClicks).toBe("number");
  });

  it("flags a deliberately underperforming listing as a CTR gap", () => {
    const rows = [...withClicks];
    rows.push({
      query: "underperformer",
      impressions: 5000,
      clicks: 5,
      ctr: 0.001,
      position: 2.1,
      page: "https://example.com/sad",
    });
    const r = runOpportunityEngine({ queries: rows, pages: [] });
    const gaps = r.opportunities.filter((o) => o.type === "CTR_GAP");
    expect(gaps.some((o) => o.keyword === "underperformer")).toBe(true);
  });
});

describe("Decline detection", () => {
  it("flags a keyword that lost clicks and positions", () => {
    const previous = [
      { query: "steel price today", clicks: 40, impressions: 1000, ctr: 0.04, position: 5 },
    ];
    const current = [
      { query: "steel price today", clicks: 10, impressions: 900, ctr: 0.011, position: 9 },
    ];
    const r = runOpportunityEngine({ queries: current, pages: [], previousQueries: previous });
    const decline = r.opportunities.find((o) => o.type === "DECLINING_KEYWORD");
    expect(decline).toBeDefined();
    expect(decline!.evidence.clicksBefore).toBe(40);
    expect(decline!.evidence.clicksNow).toBe(10);
  });

  it("does not flag noise below the threshold", () => {
    const previous = [{ query: "x", clicks: 10, impressions: 100, ctr: 0.1, position: 5 }];
    const current = [{ query: "x", clicks: 9, impressions: 98, ctr: 0.09, position: 5.2 }];
    const r = runOpportunityEngine({ queries: current, pages: [], previousQueries: previous });
    expect(r.opportunities.some((o) => o.type === "DECLINING_KEYWORD")).toBe(false);
  });

  it("flags a declining page", () => {
    const r = runOpportunityEngine({
      queries: [],
      pages: [{ page: "https://a.com/p", clicks: 5, impressions: 300, ctr: 0.016, position: 12 }],
      previousPages: [
        { page: "https://a.com/p", clicks: 50, impressions: 800, ctr: 0.06, position: 6 },
      ],
    });
    expect(r.opportunities.some((o) => o.type === "DECLINING_PAGE")).toBe(true);
  });
});

describe("Cannibalization", () => {
  it("flags one query split across two competing pages", () => {
    const out = detectCannibalization([
      { query: "tmt bar price", clicks: 0, impressions: 60, ctr: 0, position: 12, page: "https://a.com/1" },
      { query: "tmt bar price", clicks: 0, impressions: 55, ctr: 0, position: 14, page: "https://a.com/2" },
    ]);
    expect(out.length).toBe(1);
    expect(out[0]!.evidence.pages).toBe(2);
  });

  it("does not flag when one page clearly dominates", () => {
    const out = detectCannibalization([
      { query: "q", clicks: 0, impressions: 95, ctr: 0, position: 5, page: "https://a.com/1" },
      { query: "q", clicks: 0, impressions: 5, ctr: 0, position: 22, page: "https://a.com/2" },
    ]);
    expect(out.length).toBe(0);
  });

  it("never recommends deleting a page", () => {
    const out = detectCannibalization([
      { query: "q", clicks: 0, impressions: 60, ctr: 0, position: 12, page: "https://a.com/1" },
      { query: "q", clicks: 0, impressions: 55, ctr: 0, position: 14, page: "https://a.com/2" },
    ]);
    const text = JSON.stringify(out).toLowerCase();
    expect(text).not.toContain("delete");
  });
});

describe("Robustness", () => {
  it("handles completely empty input", () => {
    const r = runOpportunityEngine({ queries: [], pages: [] });
    expect(r.opportunities).toEqual([]);
    expect(todaysActions(r.opportunities)).toEqual([]);
  });

  it("handles a single one-impression query without throwing", () => {
    const r = runOpportunityEngine({
      queries: [{ query: "rare", clicks: 0, impressions: 1, ctr: 0, position: 47 }],
      pages: [],
    });
    expect(Array.isArray(r.opportunities)).toBe(true);
  });
});
