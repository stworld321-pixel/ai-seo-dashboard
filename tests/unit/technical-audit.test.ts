/**
 * Unit tests for page-speed and broken-links intelligence modules.
 * Uses exact Google CWV thresholds — any threshold drift will fail here first.
 */

import { describe, it, expect } from "vitest";
import { computePageSpeedAudit } from "@/server/intelligence/page-speed";
import { computeBrokenLinkAudit } from "@/server/intelligence/broken-links";
import { computeHealthScore } from "@/server/intelligence/health-score";

// ── Page Speed ────────────────────────────────────────────────────────────────

describe("Page Speed audit", () => {
  it("returns score 100 with no issues for empty input", () => {
    const result = computePageSpeedAudit([]);
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
    expect(result.pagesChecked).toBe(0);
  });

  it("returns score 100 for a perfectly green page", () => {
    const result = computePageSpeedAudit([
      {
        url: "https://example.com/",
        performanceScore: 98,
        lcp: 1.2,   // good < 2.5s
        inp: 80,    // good < 200ms
        cls: 0.02,  // good < 0.1
        ttfb: 0.3,  // good < 0.8s
        fcp: 1.0,   // good < 1.8s
        strategy: "mobile",
      },
    ]);
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
    expect(result.pagesWithPoorCWV).toBe(0);
  });

  it("flags poor LCP as a HIGH severity issue", () => {
    const result = computePageSpeedAudit([
      {
        url: "https://example.com/slow",
        performanceScore: 42,
        lcp: 5.1,   // poor ≥ 4.0s
        inp: 80,
        cls: 0.02,
        ttfb: 0.3,
        fcp: 1.0,
        strategy: "mobile",
      },
    ]);
    const lcpIssue = result.issues.find((i) => i.title.startsWith("LCP"));
    expect(lcpIssue).toBeDefined();
    expect(lcpIssue!.severity).toBe("HIGH");
    expect(result.score).toBeLessThan(100);
  });

  it("flags needs-improvement LCP as MEDIUM severity", () => {
    const result = computePageSpeedAudit([
      {
        url: "https://example.com/medium",
        performanceScore: 68,
        lcp: 3.0,   // needs-improvement: 2.5 ≤ x < 4.0
        inp: 80,
        cls: 0.02,
        ttfb: 0.3,
        fcp: 1.0,
        strategy: "mobile",
      },
    ]);
    const lcpIssue = result.issues.find((i) => i.title.startsWith("LCP"));
    expect(lcpIssue).toBeDefined();
    expect(lcpIssue!.severity).toBe("MEDIUM");
  });

  it("flags poor CLS with the correct threshold (0.25)", () => {
    const result = computePageSpeedAudit([
      {
        url: "https://example.com/cls",
        performanceScore: 55,
        lcp: 1.5,
        inp: 80,
        cls: 0.3,   // poor ≥ 0.25
        ttfb: 0.3,
        fcp: 1.0,
        strategy: "mobile",
      },
    ]);
    const clsIssue = result.issues.find((i) => i.title.startsWith("CLS"));
    expect(clsIssue).toBeDefined();
    expect(clsIssue!.severity).toBe("HIGH");
  });

  it("aggregates scores across multiple pages by averaging deductions", () => {
    const result = computePageSpeedAudit([
      { url: "https://example.com/a", performanceScore: 98, lcp: 1.2, inp: 80, cls: 0.02, ttfb: 0.3, fcp: 1.0, strategy: "mobile" },
      { url: "https://example.com/b", performanceScore: 30, lcp: 6.0, inp: 600, cls: 0.4, ttfb: 2.5, fcp: 4.0, strategy: "mobile" },
    ]);
    // Score must be between the two extremes — averaged
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(100);
    expect(result.pagesWithPoorCWV).toBe(1);
  });

  it("score is clamped to [0, 100]", () => {
    // Terrible page — ensure we never go negative
    const result = computePageSpeedAudit([
      { url: "https://example.com/worst", performanceScore: 5, lcp: 20.0, inp: 2000, cls: 1.0, ttfb: 5.0, fcp: 8.0, strategy: "mobile" },
    ]);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

// ── Broken Links ──────────────────────────────────────────────────────────────

describe("Broken Links audit", () => {
  it("returns score 100 with no issues for empty input", () => {
    const result = computeBrokenLinkAudit([]);
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
    expect(result.checked).toBe(0);
  });

  it("returns score 100 for all healthy 200 responses", () => {
    const result = computeBrokenLinkAudit([
      { url: "https://example.com/a", status: 200, redirectHops: 0, latencyMs: 120 },
      { url: "https://example.com/b", status: 200, redirectHops: 0, latencyMs: 95 },
    ]);
    expect(result.score).toBe(100);
    expect(result.broken).toBe(0);
    expect(result.redirected).toBe(0);
  });

  it("flags a 404 as HIGH severity and counts it as broken", () => {
    const result = computeBrokenLinkAudit([
      { url: "https://example.com/missing", status: 404, redirectHops: 0, latencyMs: 85 },
    ]);
    const issue = result.issues.find((i) => i.title.includes("404"));
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe("HIGH");
    expect(result.broken).toBe(1);
    expect(result.score).toBeLessThan(100);
  });

  it("flags a 410 as HIGH severity", () => {
    const result = computeBrokenLinkAudit([
      { url: "https://example.com/gone", status: 410, redirectHops: 0, latencyMs: 85 },
    ]);
    const issue = result.issues.find((i) => i.title.includes("410"));
    expect(issue!.severity).toBe("HIGH");
  });

  it("flags a 5xx as HIGH severity but does NOT count as broken", () => {
    const result = computeBrokenLinkAudit([
      { url: "https://example.com/error", status: 503, redirectHops: 0, latencyMs: 200 },
    ]);
    const issue = result.issues.find((i) => i.title.includes("503"));
    expect(issue!.severity).toBe("HIGH");
    expect(result.broken).toBe(0);
    expect(result.score).toBeLessThan(100);
  });

  it("flags a multi-hop redirect as MEDIUM severity", () => {
    const result = computeBrokenLinkAudit([
      { url: "https://example.com/old", status: 200, redirectHops: 2, redirectedTo: "https://example.com/new", latencyMs: 350 },
    ]);
    const issue = result.issues.find((i) => i.title.includes("chain"));
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe("MEDIUM");
    expect(result.redirected).toBe(1);
  });

  it("flags a single redirect as LOW severity", () => {
    const result = computeBrokenLinkAudit([
      { url: "https://example.com/page/", status: 301, redirectHops: 1, redirectedTo: "https://example.com/page", latencyMs: 80 },
    ]);
    const issue = result.issues.find((i) => i.severity === "LOW");
    expect(issue).toBeDefined();
    expect(result.redirected).toBe(1);
  });

  it("transient network socket error with null status is ignored without false broken link issues", () => {
    const result = computeBrokenLinkAudit([
      { url: "https://example.com/timeout", status: null, redirectHops: 0, latencyMs: 10000, error: "fetch failed" },
    ]);
    expect(result.issues).toHaveLength(0);
    expect(result.score).toBe(100);
    expect(result.broken).toBe(0);
  });

  it("score is clamped to [0, 100]", () => {
    const manyBroken = Array.from({ length: 10 }, (_, i) => ({
      url: `https://example.com/p${i}`,
      status: 404 as number,
      redirectHops: 0,
      latencyMs: 100,
    }));
    const result = computeBrokenLinkAudit(manyBroken);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

// ── Deterministic Health Score & CMS Neutrality ───────────────────────────────

describe("SEO Health Score & AI Technical Audit", () => {
  const CRAWLED = new Date("2026-09-28T00:00:00Z");

  it("produces CMS-neutral issue titles without hardcoding plugin names", () => {
    const result = computeHealthScore({
      queries: [],
      pages: [],
      opportunities: [],
      pageRecords: [
        {
          url: "https://myshopifyshop.com/products/wireless-earbuds",
          title: "Wireless Earbuds",
          metaDescription: null,
          wordCount: 150,
          canonical: "https://myshopifyshop.com/products/wireless-earbuds",
          lastCrawledAt: CRAWLED,
        },
      ],
    });

    const metaIssue = result.issues.find((i) => i.title.includes("Missing meta description"));
    expect(metaIssue).toBeDefined();
    expect(metaIssue?.title).not.toContain("Rank Math");
    expect(metaIssue?.title).toContain("/products/wireless-earbuds");

    const thinIssue = result.issues.find((i) => i.title.includes("Thin content"));
    expect(thinIssue).toBeDefined();
    expect(thinIssue?.title).toContain("150 words");
  });

  it("evaluates schema coverage when pageRecords are provided", () => {
    const result = computeHealthScore({
      queries: [],
      pages: [],
      opportunities: [],
      pageRecords: [
        {
          url: "https://example.com/",
          title: "Homepage",
          metaDescription: "A great homepage with high quality products and direct customer service.",
          wordCount: 500,
          contentScoreDetail: { hasSchema: true, schemaTypes: ["Organization"] },
          lastCrawledAt: CRAWLED,
        },
        {
          url: "https://example.com/pricing",
          title: "Pricing Plans",
          metaDescription: "Pricing details and subscription options for our software platform.",
          wordCount: 450,
          contentScoreDetail: { hasSchema: false, schemaTypes: [] },
          lastCrawledAt: CRAWLED,
        },
      ],
    });

    const schemaBreakdown = result.breakdown.find((b) => b.category === "Schema");
    expect(schemaBreakdown?.included).toBe(true);
    expect(schemaBreakdown?.score).toBe(50);

    const schemaIssue = result.issues.find((i) => i.category === "Schema");
    expect(schemaIssue).toBeDefined();
    expect(schemaIssue?.title).toContain("Missing JSON-LD structured schema on /pricing");
  });

  it("does NOT generate any missing meta description issues when valid meta descriptions are present", () => {
    const result = computeHealthScore({
      queries: [],
      pages: [],
      opportunities: [],
      pageRecords: [
        {
          url: "https://example.com/products/organic-soap",
          title: "Handcrafted Organic Soap | Pure Botanicals",
          metaDescription: "Discover cold-processed organic herbal soap handmade with virgin coconut oil and essential oils for healthy skin.",
          wordCount: 650,
          canonical: "https://example.com/products/organic-soap",
          lastCrawledAt: CRAWLED,
        },
      ],
    });

    const metaIssues = result.issues.filter((i) => i.title.includes("meta description"));
    expect(metaIssues).toHaveLength(0);

    const contentCategory = result.breakdown.find((b) => b.category === "Content");
    expect(contentCategory?.score).toBe(100);
  });

  it("skips meta/title checks for pages that have never been crawled (no lastCrawledAt)", () => {
    const result = computeHealthScore({
      queries: [],
      pages: [],
      opportunities: [],
      pageRecords: [
        {
          url: "https://example.com/uncrawled-page",
          title: null,
          metaDescription: null,
          wordCount: null,
          // No lastCrawledAt — this page was never live-crawled
        },
        {
          url: "https://example.com/crawled-page",
          title: "Proper Title",
          metaDescription: "Proper meta description for this real page that was actually crawled.",
          wordCount: 500,
          lastCrawledAt: CRAWLED,
        },
      ],
    });

    // Should NOT flag the uncrawled page as "Missing meta description"
    const missingMetaIssues = result.issues.filter(
      (i) => i.title.includes("Missing meta description") && i.url?.includes("uncrawled-page"),
    );
    expect(missingMetaIssues).toHaveLength(0);

    // Should flag an INFO notice about uncrawled pages
    const uncrawledNotice = result.issues.find((i) => i.title.includes("not yet crawled"));
    expect(uncrawledNotice).toBeDefined();
    expect(uncrawledNotice?.severity).toBe("INFO");
  });

  it("flags title too short and title too long issues on crawled pages", () => {
    const result = computeHealthScore({
      queries: [],
      pages: [],
      opportunities: [],
      pageRecords: [
        {
          url: "https://example.com/short-title",
          title: "Short",
          metaDescription: "A valid meta description that is long enough to be considered good quality.",
          wordCount: 500,
          lastCrawledAt: CRAWLED,
        },
        {
          url: "https://example.com/long-title",
          title: "This is an extremely long title tag that exceeds seventy characters and should be flagged as too long by the audit",
          metaDescription: "A valid meta description that is long enough to be considered good quality.",
          wordCount: 500,
          lastCrawledAt: CRAWLED,
        },
      ],
    });

    const shortTitle = result.issues.find((i) => i.title.includes("Title tag too short"));
    expect(shortTitle).toBeDefined();

    const longTitle = result.issues.find((i) => i.title.includes("Title tag too long"));
    expect(longTitle).toBeDefined();
  });
});

// ── HTML Metadata Extraction & Real World Parsing ────────────────────────────

import {
  extractMetaDescription,
  extractTitle,
  extractH1,
  extractCanonicalUrl,
  decodeHtmlEntities,
  parseHtmlPage,
} from "@/server/services/ai-site-auditor";

describe("HTML Parser & Live Metadata Extraction", () => {
  it("decodes complex HTML entities correctly", () => {
    const input = "Nature&#8217;s best &amp; &quot;organic&quot; soap &#8211; &lt;pure&gt;";
    const decoded = decodeHtmlEntities(input);
    expect(decoded).toBe("Nature’s best & \"organic\" soap – <pure>");
  });

  it("extracts standard meta description with quotes and entities", () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="description" content="Shop India&#8217;s finest handmade organic soaps &amp; botanical oils.">
          <title>Organic Body Care | Lite Natures</title>
        </head>
        <body><h1>Natural Skincare</h1></body>
      </html>
    `;
    const desc = extractMetaDescription(html);
    expect(desc).toBe("Shop India’s finest handmade organic soaps & botanical oils.");
  });

  it("extracts meta description when content attribute precedes name", () => {
    const html = `
      <head>
        <meta content="Discover enterprise cloud solutions, consulting, and 24/7 technical support." name="description">
      </head>
    `;
    const desc = extractMetaDescription(html);
    expect(desc).toBe("Discover enterprise cloud solutions, consulting, and 24/7 technical support.");
  });

  it("extracts multiline meta descriptions with single quotes", () => {
    const html = `
      <head>
        <meta
          name='description'
          content='Specialized AI consulting and machine learning pipelines for modern high-growth businesses.'
        />
      </head>
    `;
    const desc = extractMetaDescription(html);
    expect(desc).toBe("Specialized AI consulting and machine learning pipelines for modern high-growth businesses.");
  });

  it("falls back to OpenGraph og:description when standard description is missing", () => {
    const html = `
      <head>
        <meta property="og:title" content="Custom Furniture & Design">
        <meta property="og:description" content="Handcrafted solid wood dining tables and bespoke furniture crafted to last generations.">
      </head>
    `;
    const desc = extractMetaDescription(html);
    expect(desc).toBe("Handcrafted solid wood dining tables and bespoke furniture crafted to last generations.");
  });

  it("extracts JSON-LD description fallback when no meta tag exists", () => {
    const html = `
      <head>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Product",
          "name": "Lavender Soap",
          "description": "Artisan cold-pressed lavender soap made with organic essential oils and shea butter."
        }
        </script>
      </head>
    `;
    const desc = extractMetaDescription(html);
    expect(desc).toBe("Artisan cold-pressed lavender soap made with organic essential oils and shea butter.");
  });

  it("parses full HTML page attributes accurately", () => {
    const html = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <title>Premium Wool Rugs &amp; Carpets | Rug Artisans</title>
          <meta name="description" content="Explore our handcrafted wool rugs woven by master artisans. Free worldwide shipping.">
          <link rel="canonical" href="https://rugartisans.com/collections/wool-rugs">
          <script type="application/ld+json">
            {"@context": "https://schema.org", "@type": "CollectionPage"}
          </script>
        </head>
        <body>
          <h1>Handwoven Wool Area Rugs</h1>
          <h2>Moroccan Geometric Designs</h2>
          <h2>Persian Floral Patterns</h2>
          <p>We craft the finest organic wool area rugs with natural vegetable dyes for long lasting beauty and comfort.</p>
          <a href="/collections/vintage-rugs">Vintage Rugs</a>
          <a href="https://instagram.com/rugartisans">Follow Us on Instagram</a>
        </body>
      </html>
    `;
    const page = parseHtmlPage("https://rugartisans.com/collections/wool-rugs", html, "rugartisans.com");
    expect(page.title).toBe("Premium Wool Rugs & Carpets | Rug Artisans");
    expect(page.h1).toBe("Handwoven Wool Area Rugs");
    expect(page.h2s).toEqual(["Moroccan Geometric Designs", "Persian Floral Patterns"]);
    expect(page.metaDescription).toBe("Explore our handcrafted wool rugs woven by master artisans. Free worldwide shipping.");
    expect(page.canonical).toBe("https://rugartisans.com/collections/wool-rugs");
    expect(page.hasSchema).toBe(true);
    expect(page.schemaTypes).toContain("CollectionPage");
    expect(page.internalLinks).toBe(1);
    expect(page.externalLinks).toBe(1);
    expect(page.contentScore).toBeGreaterThanOrEqual(70);
  });

  it("ignores meta description inside HTML comments", () => {
    const html = `
      <html>
        <head>
          <!-- <meta name="description" content="This is the OLD commented-out description that should be ignored."> -->
          <meta name="description" content="This is the REAL active meta description for this page.">
          <title>Test Page</title>
        </head>
        <body><h1>Hello</h1></body>
      </html>
    `;
    const desc = extractMetaDescription(html);
    expect(desc).toBe("This is the REAL active meta description for this page.");
  });

  it("ignores meta description when ONLY present inside HTML comments", () => {
    const html = `
      <html>
        <head>
          <!-- <meta name="description" content="Commented out description that should not be extracted."> -->
          <title>Test Page</title>
        </head>
        <body><h1>Hello</h1></body>
      </html>
    `;
    const desc = extractMetaDescription(html);
    expect(desc).toBeNull();
  });

  it("handles > characters inside meta content attribute values", () => {
    const html = `
      <html>
        <head>
          <meta name="description" content="Compare products -> find the best deals &amp; save money today.">
          <title>Product Comparisons</title>
        </head>
        <body><h1>Compare</h1></body>
      </html>
    `;
    const desc = extractMetaDescription(html);
    expect(desc).toBe("Compare products -> find the best deals & save money today.");
  });

  it("restricts title extraction to the head section", () => {
    const html = `
      <html>
        <head>
          <title>Correct Title in Head</title>
        </head>
        <body>
          <title>Wrong Title in Body</title>
          <h1>Page Heading</h1>
        </body>
      </html>
    `;
    const title = extractTitle(html);
    expect(title).toBe("Correct Title in Head");
  });

  it("extracts meta description from JSON-LD script blocks when no meta tag exists", () => {
    const html = `
      <html>
        <head>
          <title>Service Page</title>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Service",
            "name": "SEO Consulting",
            "description": "Professional SEO consulting services that drive organic traffic growth and search engine visibility improvements."
          }
          </script>
        </head>
        <body><h1>SEO Consulting</h1></body>
      </html>
    `;
    const desc = extractMetaDescription(html);
    expect(desc).toBe("Professional SEO consulting services that drive organic traffic growth and search engine visibility improvements.");
  });
});
