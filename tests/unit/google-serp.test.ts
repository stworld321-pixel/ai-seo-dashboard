import { describe, expect, it } from "vitest";
import {
  fetchGoogleSerpData,
  extractDomain,
  getGoogleSuggestions,
} from "@/server/intelligence/../services/google-serp";

describe("Google SERP & Live Rank Tracking Service", () => {
  it("extracts clean domain from various URL formats", () => {
    expect(extractDomain("https://webdoux.com/services/")).toBe("webdoux.com");
    expect(extractDomain("https://www.webdoux.com")).toBe("webdoux.com");
    expect(extractDomain("http://example.com:8080/path")).toBe("example.com");
    expect(extractDomain("webdoux.com")).toBe("webdoux.com");
  });

  it("fetches Google suggestions and search intent for keywords", async () => {
    const suggestions = await getGoogleSuggestions("website design and development");
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some((s) => s.toLowerCase().includes("website") || s.toLowerCase().includes("design"))).toBe(true);
  }, 15000);

  it("performs Google SERP analysis with organic results and competitor domains", async () => {
    const serp = await fetchGoogleSerpData({
      keyword: "website design and development company",
      targetDomain: "webdoux.com",
    });

    expect(serp.query).toBe("website design and development company");
    expect(serp.targetDomain).toBe("webdoux.com");
    expect(serp.organicResults.length).toBeGreaterThan(0);
    expect(serp.peopleAlsoAsk.length).toBeGreaterThan(0);
    expect(serp.relatedSearches.length).toBeGreaterThan(0);
    expect(serp.difficultyEstimate).toBeGreaterThanOrEqual(20);
    expect(serp.opportunityScore).toBeGreaterThanOrEqual(10);
    expect(serp.topCompetitors.length).toBeGreaterThan(0);
  }, 15000);

  it("handles non-ranking custom keywords honestly", async () => {
    const serp = await fetchGoogleSerpData({
      keyword: "quantum hyperdrive interplanetary propulsion",
      targetDomain: "webdoux.com",
    });

    expect(serp.rank).toBeNull();
    expect(serp.rankingUrl).toBeNull();
    expect(serp.organicResults.length).toBeGreaterThan(0);
  }, 15000);
});
