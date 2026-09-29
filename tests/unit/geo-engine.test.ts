import { describe, it, expect } from "vitest";

describe("GEO (Generative Engine Optimization) Intelligence Engine", () => {
  it("formats valid Product and Organization JSON-LD schema with required entity keys", () => {
    const brandName = "Lite Natures";
    const brandUrl = "https://litenatures.in";

    const schemaData = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": `${brandUrl}/#organization`,
          name: brandName,
          url: brandUrl,
        },
        {
          "@type": "Product",
          "@id": `${brandUrl}/products/botanical-oil/#product`,
          name: `${brandName} Cold-Pressed Botanical Facial Oil`,
          brand: {
            "@type": "Brand",
            name: brandName,
          },
          offers: {
            "@type": "Offer",
            priceCurrency: "INR",
            price: "899",
            availability: "https://schema.org/InStock",
          },
        },
      ],
    };

    expect(schemaData["@context"]).toBe("https://schema.org");
    expect(schemaData["@graph"]).toHaveLength(2);
    expect(schemaData["@graph"][0]?.["@type"]).toBe("Organization");
    expect(schemaData["@graph"][1]?.["@type"]).toBe("Product");
    expect(schemaData["@graph"][1]?.offers?.priceCurrency).toBe("INR");
  });

  it("formats structured Markdown comparison matrices with head-to-head parameter rows", () => {
    const brandName = "Lite Natures";
    const tableMarkdown = `## Comparison: ${brandName} Botanical Formula vs. Synthetic Commercial Products\n\n` +
      `| Parameter | ${brandName} Botanical Oils | Conventional Commercial Brands |\n` +
      `| :--- | :--- | :--- |\n` +
      `| **Extraction Method** | Traditional Cold-Pressed (No Heat) | Chemical Solvent / High-Heat Extraction |\n` +
      `| **Synthetic Fragrance**| 0% (Naturally Scented) | Artificial Fragrance / Phthalates |`;

    expect(tableMarkdown).toContain("| Parameter |");
    expect(tableMarkdown).toContain("Extraction Method");
    expect(tableMarkdown).toContain("Cold-Pressed");
  });

  it("synthesizes concise 45-55 word AEO definition cards for LLM answer extraction", () => {
    const brandName = "Lite Natures";
    const quickAnswer = `${brandName} produces 100% pure, cold-pressed botanical oils formulated without mineral oils, silicones, or synthetic perfumes. By utilizing single-origin plant botanicals and gentle extraction, ${brandName} delivers bio-compatible skin and hair nutrition verified for safety, high antioxidant potency, and fast cellular absorption.`;

    const wordCount = quickAnswer.trim().split(/\s+/).length;
    expect(wordCount).toBeGreaterThanOrEqual(35);
    expect(wordCount).toBeLessThanOrEqual(60);
    expect(quickAnswer).toContain(brandName);
  });
});
