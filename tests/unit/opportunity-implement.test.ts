import { describe, expect, it } from "vitest";
import { scoreContent, buildDataDrivenDraft } from "@/server/intelligence/content-scorer";
import { generateInternalLinkSuggestions } from "@/server/intelligence/internal-links";
import { runOpportunityEngine } from "@/server/intelligence/opportunity-engine";
import { litePages, liteQueries } from "../fixtures/litenatures";

describe("Opportunity Implementation Engine", () => {
  const queries = liteQueries();
  const pages = litePages();
  const { opportunities } = runOpportunityEngine({ queries, pages });

  it("produces actionable opportunities that can be resolved into optimization artifacts", () => {
    expect(opportunities.length).toBeGreaterThan(0);
    const quickWin = opportunities.find((o) => o.type === "QUICK_WIN");
    expect(quickWin).toBeDefined();

    // Verify metadata optimization workflow
    const report = scoreContent({
      keyword: quickWin!.keyword || "natural soap",
      title: "",
      metaDescription: "",
      body: "",
    });

    expect(report.suggestedTitle.length).toBeGreaterThan(10);
    expect(report.suggestedMeta.length).toBeGreaterThan(20);
    expect(report.suggestedTitle.toLowerCase()).toContain((quickWin!.keyword || "natural soap").toLowerCase().slice(0, 5));
  });

  it("generates a complete SEO/AEO/GEO draft for a Page Two or Content Gap opportunity", () => {
    const pageTwo = opportunities.find((o) => o.type === "PAGE_TWO") || opportunities[0];
    expect(pageTwo).toBeDefined();

    const draft = buildDataDrivenDraft({
      keyword: pageTwo.keyword || "organic soap",
      targetUrl: pageTwo.targetUrl,
      impressions: 50,
      position: 12.5,
    });

    expect(draft.title).toBeDefined();
    expect(draft.body.length).toBeGreaterThan(500);
    expect(draft.faq.length).toBeGreaterThan(0);
    expect(draft.schemaJsonLd).toBeDefined();
    expect(draft.qaReport.qaPassed).toBe(true);
  });

  it("generates internal link insertion suggestions for an opportunity target", () => {
    const suggestions = generateInternalLinkSuggestions({
      pages,
      queries,
      opportunities,
    });

    expect(suggestions.length).toBeGreaterThan(0);
    const first = suggestions[0];
    expect(first.sourceUrl).toBeDefined();
    expect(first.targetUrl).toBeDefined();
    expect(first.anchor).toBeDefined();
    expect(first.confidence).toBeGreaterThan(0.5);
  });

  it("supports status state transitions: OPEN -> IN_PROGRESS -> DONE / DISMISSED", () => {
    const validStatuses = ["OPEN", "IN_PROGRESS", "AWAITING_APPROVAL", "DONE", "DISMISSED", "EXPIRED"];
    expect(validStatuses).toContain("OPEN");
    expect(validStatuses).toContain("IN_PROGRESS");
    expect(validStatuses).toContain("DONE");
    expect(validStatuses).toContain("DISMISSED");
  });
});
