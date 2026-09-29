import { describe, it, expect } from "vitest";
import { extractBrandMentions } from "@/server/intelligence/ai-extractor";
import { discoverPrompts } from "@/server/intelligence/prompt-discovery";

describe("AI Brand Mention & Citation Extractor", () => {
  it("detects direct brand mentions and domain citations in AI response text", () => {
    const responseText = `When choosing construction steel in Tamil Nadu, Agni Steels is among the prominent primary manufacturers. You can verify technical specifications at https://agnisteels.com/products. Other options include Tata Tiscon and JSW Steel.`;

    const result = extractBrandMentions({
      responseText,
      brandDomain: "agnisteels.com",
      brandName: "Agni Steels",
      competitors: ["tata.com", "jsw.in"],
    });

    expect(result.brandMentioned).toBe(true);
    expect(result.citationFound).toBe(true);
    expect(result.citationUrl).toBe("https://agnisteels.com/products");
    expect(result.citationDomain).toBe("agnisteels.com");
    expect(result.sourceDomains).toContain("agnisteels.com");
    expect(result.sentiment).toBe("positive");
  });

  it("handles responses where brand is not mentioned without fabricating data", () => {
    const responseText = `Top manufacturers in the region include JSW Steel, Tata Tiscon, and SAIL. Sources: https://jsw.in`;

    const result = extractBrandMentions({
      responseText,
      brandDomain: "agnisteels.com",
      brandName: "Agni Steels",
    });

    expect(result.brandMentioned).toBe(false);
    expect(result.citationFound).toBe(false);
    expect(result.citationUrl).toBeNull();
    expect(result.sentiment).toBe("not_mentioned");
    expect(result.sourceDomains).toContain("jsw.in");
  });

  it("extracts observed position from numbered lists in AI responses", () => {
    const responseText = `Here are the top TMT bar suppliers:\n1. JSW Steel\n2. Tata Tiscon\n3. Agni Steels\n4. SAIL`;

    const result = extractBrandMentions({
      responseText,
      brandDomain: "agnisteels.com",
      brandName: "Agni Steels",
    });

    expect(result.brandMentioned).toBe(true);
    expect(result.brandPosition).toBe(3);
  });
});

describe("AI Prompt Discovery Engine", () => {
  it("synthesizes categorized prompts from GSC queries and product entities", () => {
    const discovered = discoverPrompts({
      websiteName: "Agni Steels",
      websiteUrl: "https://agnisteels.com",
      location: "Tamil Nadu",
      topQueries: [
        { query: "best tmt bars in tamilnadu", impressions: 1200, position: 4.2 },
        { query: "how to check tmt bar quality", impressions: 450, position: 2.1 },
      ],
      pages: [
        { url: "https://agnisteels.com/fe-500d", title: "Fe 500D TMT Bars | Agni Steels" },
      ],
    });

    expect(discovered.length).toBeGreaterThanOrEqual(4);
    const hasComparison = discovered.some((p) => p.category === "comparison" || p.intent === "comparison");
    const hasBestOf = discovered.some((p) => p.category === "best-of" || p.category === "informational");

    expect(hasComparison).toBe(true);
    expect(hasBestOf).toBe(true);
  });
});

describe("Universal Project Resolution & Dynamic AI Answer Synthesis", () => {
  it("resolves location and country code for international and regional websites", async () => {
    const { resolveWebsiteLocation } = await import("@/server/services/ai-visibility");

    const usSite = resolveWebsiteLocation(
      { name: "CloudMetrics", url: "https://cloudmetrics.io", country: "USA" },
      "cloud analytics api platform crm automation",
    );
    expect(usSite.countryCode).toBe("us");
    expect(usSite.location).toBe("United States");

    const ukSite = resolveWebsiteLocation(
      { name: "Harley Dental", url: "https://harleydental.co.uk", country: "GBR" },
      "award winning dental clinic in london providing dental implants and teeth whitening",
    );
    expect(ukSite.countryCode).toBe("uk");
    expect(ukSite.location).toBe("London, UK");

    const inSite = resolveWebsiteLocation(
      { name: "Salon Mafia", url: "https://salonmafia.in", country: "IND" },
      "unisex salon in pallavaram chennai offering bridal makeovers",
    );
    expect(inSite.countryCode).toBe("in");
    expect(inSite.location).toBe("Pallavaram, Chennai");
  });

  it("identifies business vertical, extracts offerings, and picks localized competitors", async () => {
    const { resolveWebsiteVertical } = await import("@/server/services/ai-visibility");

    // US SaaS
    const saas = resolveWebsiteVertical(
      "CloudMetrics",
      "cloudmetrics.io",
      "cloud analytics platform crm automation software as a service",
      [{ title: "Cloud Data Pipeline", h1: "Automated Analytics" }],
      "us",
    );
    expect(saas.category).toBe("saas");
    expect(saas.defaultCompetitors).toContain("hubspot.com");
    expect(saas.sampleOfferings).toContain("Automated Analytics");

    // UK Dental
    const dentalUk = resolveWebsiteVertical(
      "Harley Dental",
      "harleydental.co.uk",
      "dentist clinic london dental implants whitening",
      [{ title: "Dental Implants London", h1: "Teeth Whitening" }],
      "uk",
    );
    expect(dentalUk.category).toBe("dental");
    expect(dentalUk.defaultCompetitors).toContain("bupa.co.uk");
    expect(dentalUk.sampleOfferings).toContain("Teeth Whitening");
  });

  it("synthesizes authentic engine-formatted answers for any custom project", async () => {
    const { synthesizeDynamicAiAnswer } = await import("@/server/services/ai-visibility");

    const vertical = {
      verticalName: "Cloud Analytics Platform",
      category: "saas",
      defaultCompetitors: ["hubspot.com", "salesforce.com"],
      sampleOfferings: ["Data Pipeline", "Executive Dashboards"],
    };

    const answer = synthesizeDynamicAiAnswer(
      "perplexity",
      "CloudMetrics reviews and features",
      "CloudMetrics",
      "cloudmetrics.io",
      "United States",
      vertical,
      ["hubspot.com", "salesforce.com"],
    );

    expect(answer).toContain("CloudMetrics");
    expect(answer).toContain("https://cloudmetrics.io");
    expect(answer).toContain("Data Pipeline");
    expect(answer).toContain("United States");
  });
});
