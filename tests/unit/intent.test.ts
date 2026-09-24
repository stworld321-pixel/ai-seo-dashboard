import { describe, expect, it } from "vitest";
import { classifyIntent, positionBand } from "@/server/intelligence/intent";

describe("Intent classification", () => {
  it("classifies price/buy queries as transactional", () => {
    expect(classifyIntent("charcoal soap price").intent).toBe("TRANSACTIONAL");
    expect(classifyIntent("buy aloe vera gel online").intent).toBe("TRANSACTIONAL");
  });

  it("classifies comparison and 'best' queries as commercial", () => {
    expect(classifyIntent("best charcoal soap").intent).toBe("COMMERCIAL");
    expect(classifyIntent("fe 500 vs fe 500d").intent).toBe("COMMERCIAL");
  });

  it("classifies question queries as informational", () => {
    expect(classifyIntent("how to use kumkumadi serum").intent).toBe("INFORMATIONAL");
    expect(classifyIntent("benefits of camel milk soap").intent).toBe("INFORMATIONAL");
  });

  it("defaults a bare product term to commercial with LOW confidence", () => {
    // "coconut milk soap" carries no modifier. Guessing is fine; pretending
    // to be certain is not — the UI renders a '?' below 0.5.
    const r = classifyIntent("coconut milk soap");
    expect(r.intent).toBe("COMMERCIAL");
    expect(r.confidence).toBeLessThan(0.5);
  });

  it("reports higher confidence when signals are unambiguous", () => {
    const strong = classifyIntent("buy cheap soap online discount");
    expect(strong.confidence).toBeGreaterThan(0.6);
  });
});

describe("Position banding", () => {
  it("bands positions into actionable groups", () => {
    expect(positionBand(1.2)).toBe("top3");
    expect(positionBand(8.8)).toBe("page1"); // coconut milk soap
    expect(positionBand(16.9)).toBe("page2"); // fairness soap
    expect(positionBand(43.8)).toBe("deep"); // charcoal soap
  });

  it("puts boundary positions on the optimistic side", () => {
    expect(positionBand(3.5)).toBe("top3");
    expect(positionBand(10.5)).toBe("page1");
    expect(positionBand(20.5)).toBe("page2");
  });
});
