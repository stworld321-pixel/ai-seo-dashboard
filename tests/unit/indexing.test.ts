import { describe, it, expect } from "vitest";
import { classifyIndexStatus } from "@/server/integrations/google/indexing";

describe("classifyIndexStatus", () => {
  it("treats a passing, submitted-and-indexed URL as indexed", () => {
    const r = classifyIndexStatus({
      verdict: "PASS",
      coverageState: "Submitted and indexed",
      robotsTxtState: "ALLOWED",
      indexingState: "INDEXING_ALLOWED",
      pageFetchState: "SUCCESSFUL",
    });
    expect(r.indexed).toBe(true);
    expect(r.issue).toBeNull();
  });

  it("does not call 'Crawled - currently not indexed' indexed just because it contains 'indexed'", () => {
    const r = classifyIndexStatus({
      verdict: "NEUTRAL",
      coverageState: "Crawled - currently not indexed",
      robotsTxtState: "ALLOWED",
      indexingState: "INDEXING_ALLOWED",
      pageFetchState: "SUCCESSFUL",
    });
    expect(r.indexed).toBe(false);
    expect(r.issue).toBe("Crawled - currently not indexed");
  });

  it("surfaces the blocking reason ahead of the generic coverage text", () => {
    expect(
      classifyIndexStatus({
        verdict: "FAIL",
        coverageState: "Blocked by robots.txt",
        robotsTxtState: "DISALLOWED",
      }).issue,
    ).toMatch(/robots\.txt/);

    expect(
      classifyIndexStatus({
        verdict: "FAIL",
        coverageState: "Excluded by 'noindex' tag",
        robotsTxtState: "ALLOWED",
        indexingState: "BLOCKED_BY_META_TAG",
      }).issue,
    ).toMatch(/noindex meta tag/);

    expect(
      classifyIndexStatus({
        verdict: "FAIL",
        robotsTxtState: "ALLOWED",
        pageFetchState: "SOFT_404",
      }).issue,
    ).toMatch(/SOFT_404/);
  });

  it("reports an unknown URL when Google returns no index status", () => {
    const r = classifyIndexStatus(undefined);
    expect(r.indexed).toBe(false);
    expect(r.issue).toMatch(/no record/);
  });
});
