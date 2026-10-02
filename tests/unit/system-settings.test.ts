import { describe, it, expect } from "vitest";
import { shouldKeepStoredSecret, maskSecret } from "@/server/services/system-settings";

describe("shouldKeepStoredSecret", () => {
  it("keeps the stored secret when the box is empty or whitespace", () => {
    expect(shouldKeepStoredSecret("whatsapp_meta_token", "")).toBe(true);
    expect(shouldKeepStoredSecret("whatsapp_meta_token", "   ")).toBe(true);
  });

  it("keeps the stored secret when the value still carries the display mask", () => {
    const masked = maskSecret("EAAB1234567890abcdefXYZ");
    expect(masked).toContain("••••••••");
    expect(shouldKeepStoredSecret("whatsapp_meta_token", masked)).toBe(true);
    // Pasting next to the mask instead of replacing it must not overwrite either.
    expect(shouldKeepStoredSecret("whatsapp_meta_token", `${masked}EAAnewtoken`)).toBe(true);
  });

  it("writes a genuinely new secret through", () => {
    expect(shouldKeepStoredSecret("whatsapp_meta_token", "EAAnewtokenvalue123")).toBe(false);
  });

  it("never short-circuits non-secret keys, so clearing them still works", () => {
    // whatsapp_provider is not a secret: an empty or any value must be written.
    expect(shouldKeepStoredSecret("whatsapp_provider", "")).toBe(false);
    expect(shouldKeepStoredSecret("whatsapp_provider", "meta")).toBe(false);
    expect(shouldKeepStoredSecret("whatsapp_meta_phone_id", "")).toBe(false);
  });
});
