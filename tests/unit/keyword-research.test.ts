import { describe, it, expect } from "vitest";
import {
  HARD_STOPLIST,
  filterAndScoreKeywords,
  enrichAndMapKeyword,
  clusterKeywords,
  generateGeoPromptsForClusters,
  type BusinessProfile,
} from "@/server/intelligence/keyword-research";
import {
  cleanRawHtml,
  stripRecurringCrossPageBlocks,
  extractJsonLdSchemas,
} from "@/server/intelligence/content-cleaner";

describe("Content Cleaner (Step 2)", () => {
  it("strips nav, header, footer, aside, scripts and form boilerplate", () => {
    const rawHtml = `
      <html>
        <head><title>Unisex Salon & Spa</title></head>
        <body>
          <header class="navbar"><nav><a href="/">Home</a><a href="/about">About Us</a></nav></header>
          <main>
            <h1>Best Hair Styling & Keratin Treatment</h1>
            <p>We provide professional hair styling, bridal makeup, and organic facial services.</p>
          </main>
          <aside class="sidebar"><div class="widget">Recent Posts</div></aside>
          <footer id="footer"><p>Copyright 2026 All Rights Reserved. <a href="/privacy">Privacy Policy</a></p></footer>
        </body>
      </html>
    `;

    const cleaned = cleanRawHtml(rawHtml);
    expect(cleaned).toContain("Best Hair Styling & Keratin Treatment");
    expect(cleaned).toContain("We provide professional hair styling");
    expect(cleaned).not.toContain("Copyright 2026");
    expect(cleaned).not.toContain("Recent Posts");
  });

  it("removes recurring cross-page text blocks appearing on >50% of pages", () => {
    const page1 = "We offer hair styling and grooming. Call us now at 999999 for booking. Special discount this month.";
    const page2 = "Skin care and facial treatments. Call us now at 999999 for booking. Organic ingredients used.";
    const page3 = "Bridal makeup and hair spa packages. Call us now at 999999 for booking. Book in advance.";

    const cleaned = stripRecurringCrossPageBlocks([page1, page2, page3]);
    for (const p of cleaned) {
      expect(p).not.toContain("call us now at 999999 for booking");
    }
  });

  it("extracts structured JSON-LD schemas", () => {
    const html = `
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "BeautySalon",
        "name": "Elite Hair Spa"
      }
      </script>
    `;
    const { types, data } = extractJsonLdSchemas(html);
    expect(types).toContain("BeautySalon");
    expect(data[0].name).toBe("Elite Hair Spa");
  });
});

describe("Hard Stoplist & Rule Filters (Step 6)", () => {
  const sampleProfile: BusinessProfile = {
    business_name: "Salon Mafia",
    business_type: "local_service",
    industry: "Unisex Salon & Beauty Spa",
    primary_offerings: [
      { name: "Haircut & Styling", type: "service", description: "Hair styling for men and women" },
      { name: "Keratin Treatment", type: "service", description: "Hair smoothing and keratin" },
      { name: "Bridal Makeup", type: "service", description: "Bridal makeover and beauty packages" },
    ],
    target_audience: ["Local clients in Chennai"],
    locations_served: ["Chennai"],
    is_local_business: true,
    unique_selling_points: ["Expert Stylists"],
    customer_problems_solved: ["Frizzy Hair", "Special Occasion Styling"],
    competitor_like_terms: ["beauty parlour", "hair spa"],
    brand_terms: ["Salon Mafia", "salonmafia.in"],
  };

  it("rejects menu words, boilerplate, and navigation links", () => {
    const rawCandidates = [
      { keyword: "about us", offering: "General", source: "page_menu" },
      { keyword: "contact", offering: "General", source: "page_menu" },
      { keyword: "services", offering: "General", source: "page_menu" },
      { keyword: "privacy policy", offering: "General", source: "footer" },
      { keyword: "read more", offering: "General", source: "button" },
      { keyword: "keratin treatment chennai", offering: "Keratin Treatment", source: "ai_seed" },
      { keyword: "bridal makeup price in chennai", offering: "Bridal Makeup", source: "google_autocomplete" },
    ];

    const { accepted, rejected } = filterAndScoreKeywords(rawCandidates, sampleProfile);
    const acceptedKeywords = accepted.map((a) => a.keyword);
    const rejectedKeywords = rejected.map((r) => r.keyword);

    expect(rejectedKeywords).toContain("about us");
    expect(rejectedKeywords).toContain("contact");
    expect(rejectedKeywords).toContain("services");
    expect(rejectedKeywords).toContain("privacy policy");
    expect(rejectedKeywords).toContain("read more");

    expect(acceptedKeywords).toContain("keratin treatment chennai");
    expect(acceptedKeywords).toContain("bridal makeup price in chennai");
  });
});

describe("Metrics Enrichment & Opportunity Score (Step 7 & 11)", () => {
  const sampleProfile: BusinessProfile = {
    business_name: "Dental Care Clinic",
    business_type: "local_service",
    industry: "Dental Clinic & Healthcare",
    primary_offerings: [
      { name: "Dental Implants", type: "service", description: "Permanent tooth replacement" },
    ],
    target_audience: ["Patients in Chennai"],
    locations_served: ["Chennai"],
    is_local_business: true,
    unique_selling_points: ["Painless Treatment"],
    customer_problems_solved: ["Tooth Pain"],
    competitor_like_terms: ["dentist"],
    brand_terms: ["Dental Care"],
  };

  it("calculates opportunity score using the spec formula and NEVER hallucinates volume", () => {
    const item = {
      keyword: "root canal treatment cost in chennai",
      offering: "Dental Implants",
      source: ["google_autocomplete"],
      relevance: 90,
    };

    const enriched = enrichAndMapKeyword(item, sampleProfile, []);

    // Search volume must be null when uncalibrated from provider (never AI hallucinated)
    expect(enriched.search_volume).toBeNull();
    expect(enriched.intent).toBe("transactional");
    expect(enriched.opportunity_score).toBeGreaterThan(0.6);
    expect(enriched.opportunity_score).toBeLessThanOrEqual(1.0);
  });
});

describe("Clustering & GEO/AEO Layer (Step 9 & 10)", () => {
  const sampleProfile: BusinessProfile = {
    business_name: "Ayur Glow",
    business_type: "ecommerce",
    industry: "Organic Skincare",
    primary_offerings: [
      { name: "Millet Dosa Mix", type: "product", description: "Healthy instant millet dosa mix" },
      { name: "Herbal Hair Oil", type: "product", description: "Pure cold pressed hair oil" },
    ],
    target_audience: ["Healthy living consumers"],
    locations_served: ["India"],
    is_local_business: false,
    unique_selling_points: ["100% Organic"],
    customer_problems_solved: ["Hair fall"],
    competitor_like_terms: ["organic food"],
    brand_terms: ["Ayur Glow"],
  };

  it("clusters keywords and creates conversational GEO/AEO prompts", () => {
    const keywords = [
      enrichAndMapKeyword({ keyword: "buy millet dosa mix online", offering: "Millet Dosa Mix", source: ["seed"], relevance: 95 }, sampleProfile, []),
      enrichAndMapKeyword({ keyword: "millet dosa mix price", offering: "Millet Dosa Mix", source: ["seed"], relevance: 90 }, sampleProfile, []),
      enrichAndMapKeyword({ keyword: "best herbal hair oil for hair fall", offering: "Herbal Hair Oil", source: ["seed"], relevance: 92 }, sampleProfile, []),
    ];

    const { clusters, clusteredKeywords } = clusterKeywords(keywords, sampleProfile);
    expect(clusters.length).toBe(2);

    const geoPrompts = generateGeoPromptsForClusters(clusters, sampleProfile);
    expect(geoPrompts.length).toBeGreaterThan(4);
    expect(geoPrompts.some((p) => p.prompt.includes("Ayur Glow") || p.prompt.includes("millet dosa mix"))).toBe(true);
  });
});
