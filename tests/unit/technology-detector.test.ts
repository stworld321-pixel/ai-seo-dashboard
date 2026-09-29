import { describe, it, expect } from "vitest";
import { analyzeWebsiteUrl } from "@/server/intelligence/technology-detector";
import { getGoogleOAuthUrl, GOOGLE_SCOPES } from "@/server/integrations/google/oauth";
import { publishContentToTarget } from "@/server/integrations/publishing/publisher";

describe("CMS-Independent Technology & SEO Detector", () => {
  it("formats and generates official Google OAuth 2.0 URL with required scopes", () => {
    const url = getGoogleOAuthUrl("site-123", "https://app.example.com/api/integrations/google/callback");
    expect(url).toContain("accounts.google.com/o/oauth2/v2/auth");
    expect(url).toContain("webmasters.readonly");
    expect(url).toContain("analytics.readonly");
    expect(url).toContain("access_type=offline");
  });

  it("handles failed website analysis gracefully for invalid domains without throwing", async () => {
    const result = await analyzeWebsiteUrl("https://non-existent-invalid-domain-12345.org");
    expect(result.isReachable).toBe(false);
    expect(result.detectedCms).toBe("Unknown");
  });
});

describe("Publishing & Deployment Layer", () => {
  it("supports manual export formatting when publishing is not connected", async () => {
    const res = await publishContentToTarget("non-existent", {
      title: "Test Article",
      slug: "test-article",
      body: "# Test Body",
    });

    expect(res.mode).toBe("manual");
  });
});
