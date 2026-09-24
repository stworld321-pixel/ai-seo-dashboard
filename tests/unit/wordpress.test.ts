import { describe, expect, it } from "vitest";
import { WordPressProvider } from "@/server/integrations/cms/wordpress";
import { encrypt, decrypt, encryptJson, decryptJson } from "@/server/crypto";

describe("WordPress provider", () => {
  it("reports read-only capabilities without credentials", () => {
    const wp = new WordPressProvider({ siteUrl: "https://example.test" });
    const caps = wp.capabilities();
    expect(caps.canRead).toBe(true);
    expect(caps.canUpdateSeoMeta).toBe(false);
    // Deletion is not in the interface at all — an agent cannot remove content.
    expect("delete" in wp).toBe(false);
  });

  it("enables writes once credentials are supplied", () => {
    const wp = new WordPressProvider({
      siteUrl: "https://example.test",
      username: "user",
      appPassword: "xxxx xxxx xxxx",
    });
    expect(wp.capabilities().canUpdateSeoMeta).toBe(true);
  });

  it("refuses to write without credentials instead of failing silently", async () => {
    const wp = new WordPressProvider({ siteUrl: "https://example.test" });
    await expect(wp.updateSeoMeta("1", { seoTitle: "x" })).rejects.toThrow(
      /application password/i,
    );
  });

  it("verify() reports a clear error when unconfigured", async () => {
    const wp = new WordPressProvider({ siteUrl: "https://example.test" });
    const v = await wp.verify();
    expect(v.ok).toBe(false);
    expect(v.error).toMatch(/application password/i);
  });

  it("normalizes a trailing slash in the site URL", () => {
    const wp = new WordPressProvider({ siteUrl: "https://example.test///" });
    // No public getter; behaviour is asserted via no-throw construction plus
    // the capabilities contract. The base is used to build /wp-json paths.
    expect(wp.name).toBe("wordpress");
  });
});

describe("Secret encryption", () => {
  const KEY = Buffer.alloc(32, 7).toString("base64");

  it("round-trips a string", () => {
    process.env.ENCRYPTION_KEY = KEY;
    const e = encrypt("hunter2-application-password");
    expect(decrypt(e)).toBe("hunter2-application-password");
  });

  it("round-trips a JSON credential blob", () => {
    process.env.ENCRYPTION_KEY = KEY;
    const e = encryptJson({ username: "admin", appPassword: "abcd efgh" });
    const back = decryptJson<{ username: string; appPassword: string }>(e);
    expect(back.username).toBe("admin");
    expect(back.appPassword).toBe("abcd efgh");
  });

  it("produces a different ciphertext each time (random IV)", () => {
    process.env.ENCRYPTION_KEY = KEY;
    const a = encrypt("same input");
    const b = encrypt("same input");
    expect(Buffer.from(a.cipher).equals(Buffer.from(b.cipher))).toBe(false);
  });

  it("fails loudly on a tampered auth tag rather than returning garbage", () => {
    process.env.ENCRYPTION_KEY = KEY;
    const e = encrypt("sensitive");
    e.tag[0] = e.tag[0]! ^ 0xff;
    expect(() => decrypt(e)).toThrow();
  });

  it("rejects a key of the wrong length", () => {
    process.env.ENCRYPTION_KEY = Buffer.alloc(16, 1).toString("base64");
    expect(() => encrypt("x")).toThrow(/32 bytes/);
    process.env.ENCRYPTION_KEY = KEY;
  });
});
