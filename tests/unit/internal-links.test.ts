import { describe, expect, it } from "vitest";
import {
  isUtilityOrLegalPage,
  generateCleanAnchor,
  generateInternalLinkSuggestions,
} from "@/server/intelligence/internal-links";

describe("Internal Links Utility & Legal Page Filtering", () => {
  it("filters out privacy policy, terms, careers, cookies, and cart pages", () => {
    expect(isUtilityOrLegalPage("https://webdoux.com/privacy-policy/")).toBe(true);
    expect(isUtilityOrLegalPage("https://webdoux.com/terms-and-conditions/")).toBe(true);
    expect(isUtilityOrLegalPage("https://webdoux.com/careers/")).toBe(true);
    expect(isUtilityOrLegalPage("https://webdoux.com/career/")).toBe(true);
    expect(isUtilityOrLegalPage("https://webdoux.com/jobs/")).toBe(true);
    expect(isUtilityOrLegalPage("https://webdoux.com/cookie-policy/")).toBe(true);
    expect(isUtilityOrLegalPage("https://webdoux.com/cart/")).toBe(true);
    expect(isUtilityOrLegalPage("https://webdoux.com/checkout/")).toBe(true);
    expect(isUtilityOrLegalPage("https://webdoux.com/my-account/")).toBe(true);
  });

  it("allows homepage, service pages, blogs, and product pages", () => {
    expect(isUtilityOrLegalPage("https://webdoux.com/")).toBe(false);
    expect(isUtilityOrLegalPage("https://webdoux.com/services-we-offer/website-design-development/")).toBe(false);
    expect(isUtilityOrLegalPage("https://webdoux.com/services-we-offer/e-commerce-website/")).toBe(false);
    expect(isUtilityOrLegalPage("https://webdoux.com/services-we-offer/landing-page-development/")).toBe(false);
    expect(isUtilityOrLegalPage("https://webdoux.com/blog/seo-best-practices/")).toBe(false);
  });
});

describe("Descriptive Anchor Text Generation", () => {
  it("generates natural, keyword-rich anchor text from slugs and titles without generic 'learn more'", () => {
    const ecomAnchor = generateCleanAnchor({
      url: "https://webdoux.com/services-we-offer/e-commerce-website/",
      title: "E-Commerce Website Development | Webdoux",
    });
    expect(ecomAnchor).not.toBe("learn more");
    expect(ecomAnchor.toLowerCase()).toContain("e-commerce");

    const landingAnchor = generateCleanAnchor({
      url: "https://webdoux.com/services-we-offer/landing-page-development/",
      title: "Landing Page Development Company",
    });
    expect(landingAnchor).not.toBe("learn more");
    expect(landingAnchor.toLowerCase()).toContain("landing page");

    const webDesignAnchor = generateCleanAnchor({
      url: "https://webdoux.com/services-we-offer/website-design-development/",
      title: "Website Design & Development Services | Webdoux",
    });
    expect(webDesignAnchor).not.toBe("learn more");
    expect(webDesignAnchor.toLowerCase()).toContain("website design");
  });
});

describe("Internal Link Suggestion Generator for Services & Blogs", () => {
  it("generates high-confidence link suggestions exclusively between service and blog pages", () => {
    const suggestions = generateInternalLinkSuggestions({
      pageRecords: [
        {
          url: "https://webdoux.com/",
          title: "Webdoux — Web Design & Digital Solutions",
          h1: "Leading Web Design & Development Agency",
        },
        {
          url: "https://webdoux.com/services-we-offer/website-design-development/",
          title: "Website Design & Development Services",
          h1: "Custom Website Design and Development",
        },
        {
          url: "https://webdoux.com/services-we-offer/e-commerce-website/",
          title: "E-Commerce Website Development",
          h1: "High-Growth E-Commerce Websites",
        },
        {
          url: "https://webdoux.com/services-we-offer/landing-page-development/",
          title: "Landing Page Development Services",
          h1: "High-Converting Landing Page Design",
        },
        {
          url: "https://webdoux.com/privacy-policy/",
          title: "Privacy Policy | Webdoux",
        },
        {
          url: "https://webdoux.com/careers/",
          title: "Careers & Job Openings | Webdoux",
        },
      ],
    });

    expect(suggestions.length).toBeGreaterThan(0);

    for (const s of suggestions) {
      expect(s.anchor.toLowerCase()).not.toBe("learn more");
      expect(s.anchor.toLowerCase()).not.toBe("click here");
      expect(s.anchor.length).toBeGreaterThan(3);

      // Verify privacy policy & careers pages are NEVER suggested as targets or sources
      expect(s.targetUrl).not.toContain("privacy");
      expect(s.targetUrl).not.toContain("career");
      expect(s.sourceUrl).not.toContain("privacy");
      expect(s.sourceUrl).not.toContain("career");
    }
  });
});
