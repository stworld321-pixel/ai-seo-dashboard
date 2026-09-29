import { describe, expect, it } from "vitest";
import { computeHealthScore } from "@/server/intelligence/health-score";
import { generateInternalLinkSuggestions } from "@/server/intelligence/internal-links";
import { scoreContent, buildDataDrivenDraft } from "@/server/intelligence/content-scorer";
import { runOpportunityEngine } from "@/server/intelligence/opportunity-engine";
import { litePages, liteQueries } from "../fixtures/litenatures";

describe("SEO Health Score & Issues against real litenatures.in data", () => {
  const queries = liteQueries();
  const pages = litePages();
  const { opportunities } = runOpportunityEngine({ queries, pages });

  it("computes a bounded score and renormalizes weights for excluded categories", () => {
    const res = computeHealthScore({ queries, pages, opportunities });
    expect(res.total).toBeGreaterThanOrEqual(10);
    expect(res.total).toBeLessThanOrEqual(100);

    const excluded = res.breakdown.filter((b) => !b.included);
    expect(excluded.length).toBeGreaterThan(0);
    for (const ex of excluded) {
      expect(ex.score).toBeNull();
      expect(ex.normalizedWeight).toBe(0);
    }

    const activeWeightSum = res.breakdown
      .filter((b) => b.included)
      .reduce((s, b) => s + b.normalizedWeight, 0);
    expect(Math.round(activeWeightSum)).toBe(100);
  });

  it("links every deducted point to concrete issues", () => {
    const res = computeHealthScore({ queries, pages, opportunities });
    expect(res.issues.length).toBeGreaterThan(0);
    // Parameterized URL and uncategorized archive in litenatures.in fixture are flagged
    expect(res.issues.some((i) => i.category === "Technical SEO" && i.url?.includes("?"))).toBe(true);
    expect(res.issues.some((i) => i.category === "CTR" && i.title.includes("coconut milk soap"))).toBe(true);
  });
});

describe("Internal link suggestion engine", () => {
  it("generates high-confidence internal link suggestions for opportunity pages", () => {
    const queries = liteQueries();
    const pages = litePages();
    const { opportunities } = runOpportunityEngine({ queries, pages });
    const suggestions = generateInternalLinkSuggestions({ pages, queries, opportunities });

    expect(suggestions.length).toBeGreaterThan(0);
    for (const s of suggestions) {
      expect(s.sourceUrl).not.toBe(s.targetUrl);
      expect(s.confidence).toBeGreaterThan(0.5);
      expect(s.anchor.length).toBeGreaterThan(2);
    }
  });
});

describe("Content scorer & QA gate", () => {
  it("passes QA for a well-formed data-driven draft", () => {
    const draft = buildDataDrivenDraft({
      keyword: "coconut milk soap",
      secondaryKeywords: ["organic soap", "camel milk soap"],
      targetUrl: "https://litenatures.in/product/coconutmilk-soap/",
      impressions: 73,
      position: 8.8,
    });
    expect(draft.qaReport.score).toBeGreaterThanOrEqual(80);
    expect(draft.qaReport.qaPassed).toBe(true);
  });

  it("rejects unsourced numeric statistics in body text", () => {
    const report = scoreContent({
      keyword: "coconut milk soap",
      title: "Coconut Milk Soap — Cold-Processed & Paraben-Free | Lite Natures",
      metaDescription:
        "Shop authentic coconut milk soap handcrafted with cold-pressed botanical oils by Lite Natures. Gentle, paraben-free daily skin care.",
      body: "## Benefits\n## Ingredients\nThis soap improves skin hydration by 87% overnight.",
    });
    const statCheck = report.checks.find((c) => c.id === "stats-guard");
    expect(statCheck?.passed).toBe(false);
    expect(report.qaPassed).toBe(false);
  });

  it("rejects keyword stuffing above the 3.5% ceiling", () => {
    const report = scoreContent({
      keyword: "coconut milk soap",
      title: "Coconut Milk Soap — Cold-Processed & Paraben-Free | Lite Natures",
      metaDescription:
        "Shop authentic coconut milk soap handcrafted with cold-pressed botanical oils by Lite Natures. Gentle, paraben-free daily skin care.",
      body: "coconut milk soap coconut milk soap coconut milk soap is great.",
    });
    const densityCheck = report.checks.find((c) => c.id === "density");
    expect(densityCheck?.passed).toBe(false);
    expect(report.qaPassed).toBe(false);
  });
});
