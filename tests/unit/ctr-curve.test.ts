import { describe, expect, it } from "vitest";
import { fitCtrCurve } from "@/server/intelligence/ctr-curve";
import { liteQueries, siteWithClicks } from "../fixtures/litenatures";

describe("CTR curve fitting", () => {
  it("refuses to fit a curve for a site with no clicks (litenatures.in)", () => {
    const curve = fitCtrCurve(liteQueries());
    expect(curve.diagnostics.totalClicks).toBe(0);
    expect(curve.fitted).toBe(false);
    // The honest answer is null, not a made-up industry benchmark.
    expect(curve.expectedCtr(5)).toBeNull();
    expect(curve.expectedCtr(1)).toBeNull();
  });

  it("reports real impression totals from the fixture", () => {
    const curve = fitCtrCurve(liteQueries());
    // 416, not the 584 the site total shows: Google withholds anonymized
    // queries, so query-grain impressions never sum to the date-grain total.
    // Any code that reconciles the two must account for this gap rather than
    // treating it as a sync error.
    expect(curve.diagnostics.totalImpressions).toBe(416);
    expect(curve.diagnostics.totalClicks).toBe(0);
  });

  it("fits a decreasing curve for a site with click history", () => {
    const curve = fitCtrCurve(siteWithClicks());
    expect(curve.fitted).toBe(true);
    const p1 = curve.expectedCtr(1)!;
    const p5 = curve.expectedCtr(5)!;
    const p15 = curve.expectedCtr(15)!;
    expect(p1).toBeGreaterThan(p5);
    expect(p5).toBeGreaterThan(p15);
    expect(p1).toBeLessThanOrEqual(1);
  });

  it("interpolates positions between fitted buckets", () => {
    const curve = fitCtrCurve(siteWithClicks());
    const v = curve.expectedCtr(7.4);
    expect(v).not.toBeNull();
    expect(v!).toBeGreaterThan(0);
  });

  it("handles an empty dataset without throwing", () => {
    const curve = fitCtrCurve([]);
    expect(curve.fitted).toBe(false);
    expect(curve.expectedCtr(3)).toBeNull();
  });
});
