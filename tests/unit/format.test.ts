import { describe, expect, it } from "vitest";
import { delta, formatDelta, countryName, shortenUrl, formatPercent } from "@/lib/format";

describe("Delta reporting", () => {
  /**
   * REGRESSION: the dashboard first shipped showing "+944.3%" for impressions.
   * The cause was comparing a full 28-day window against a "previous 28 days"
   * that only held 2 days of synced data. The engine-level guard is in
   * getComparisonTotals(); this covers the formatting contract it relies on.
   */
  it("returns null rather than a percentage when the baseline is zero", () => {
    expect(delta(637, 0)).toBeNull();
    expect(formatDelta(null)).toBe("—");
  });

  it("computes ordinary deltas correctly", () => {
    expect(delta(150, 100)).toBeCloseTo(0.5);
    expect(formatDelta(0.5)).toBe("+50.0%");
    expect(formatDelta(-0.25)).toBe("-25.0%");
  });

  it("formats a zero CTR without pretending it is missing", () => {
    // litenatures.in genuinely has 0% CTR — that is a real measurement,
    // distinct from "no data".
    expect(formatPercent(0)).toBe("0.00%");
  });
});

describe("Display helpers", () => {
  it("maps GSC ISO-3 country codes to readable names", () => {
    expect(countryName("ind")).toBe("India");
    expect(countryName("usa")).toBe("United States");
  });

  it("falls back to an uppercased code for unmapped countries", () => {
    expect(countryName("xyz")).toBe("XYZ");
  });

  it("shortens URLs to their path", () => {
    expect(shortenUrl("https://litenatures.in/product/coconutmilk-soap/")).toBe(
      "/product/coconutmilk-soap/",
    );
  });

  it("shows the hostname for a root URL", () => {
    expect(shortenUrl("https://litenatures.in/")).toBe("litenatures.in");
  });

  it("returns the input unchanged when it is not a URL", () => {
    expect(shortenUrl("not a url")).toBe("not a url");
  });
});
