import { describe, it, expect } from "vitest";
import { buildDataDrivenDraft, scoreContent } from "@/server/intelligence/content-scorer";

describe("Article Agent Orchestration Engine", () => {
  it("formulates structured search intent brief from target keywords", () => {
    const keyword = "cold pressed facial oil";
    const draft = buildDataDrivenDraft({
      keyword,
      customTitle: "The Complete Guide to Cold-Pressed Facial Oils: Botanical Science & Daily Routine",
      secondaryKeywords: ["pure botanical oil", "natural skincare benefits"],
    });

    expect(draft.title).toContain("Cold-Pressed Facial Oils");
    expect(draft.brief.targetKeyword).toBe(keyword);
    expect(draft.brief.recommendedHeadings.length).toBeGreaterThanOrEqual(4);
    expect(draft.faq.length).toBeGreaterThanOrEqual(3);
    expect(draft.qaReport.score).toBeGreaterThanOrEqual(80);
    expect(draft.qaReport.qaPassed).toBe(true);
  });

  it("evaluates draft content against Page-1 SEO, AEO, and GEO quality gates", () => {
    const keyword = "organic botanical oils";
    const draft = buildDataDrivenDraft({
      keyword,
    });

    const qa = scoreContent({
      keyword,
      title: draft.title,
      metaDescription: draft.metaDescription,
      body: draft.body,
    });

    expect(qa.score).toBeGreaterThanOrEqual(80);
    expect(qa.wordCount).toBeGreaterThan(500);
    expect(qa.qaPassed).toBe(true);
  });
});
