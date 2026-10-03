import { describe, it, expect, afterEach } from "vitest";
import { isAdminEmail, adminEmails } from "@/server/authz";

const ORIGINAL = { list: process.env.ADMIN_EMAILS, single: process.env.ADMIN_EMAIL };

afterEach(() => {
  process.env.ADMIN_EMAILS = ORIGINAL.list;
  process.env.ADMIN_EMAIL = ORIGINAL.single;
  if (ORIGINAL.list === undefined) delete process.env.ADMIN_EMAILS;
  if (ORIGINAL.single === undefined) delete process.env.ADMIN_EMAIL;
});

describe("isAdminEmail", () => {
  it("grants admin only to the configured owner by default", () => {
    delete process.env.ADMIN_EMAILS;
    delete process.env.ADMIN_EMAIL;
    expect(adminEmails()).toEqual([
      "suriymanikandan4@gmail.com",
      "suriyamanikandan4@gmail.com",
    ]);
    expect(isAdminEmail("suriymanikandan4@gmail.com")).toBe(true);
    expect(isAdminEmail("suriyamanikandan4@gmail.com")).toBe(true);
  });

  it("refuses every other account, including look-alikes", () => {
    delete process.env.ADMIN_EMAILS;
    delete process.env.ADMIN_EMAIL;
    for (const email of [
      "stworld321@gmail.com",
      "attacker@example.com",
      "suriyamanikandan4@gmail.com.evil.com",
      "xsuriyamanikandan4@gmail.com",
      "suriyamanikandan4@googlemail.com",
    ]) {
      expect(isAdminEmail(email), email).toBe(false);
    }
  });

  it("ignores case and surrounding whitespace", () => {
    delete process.env.ADMIN_EMAILS;
    delete process.env.ADMIN_EMAIL;
    expect(isAdminEmail("  SuriyaManikandan4@Gmail.COM  ")).toBe(true);
    expect(isAdminEmail("  SuriyManikandan4@Gmail.COM  ")).toBe(true);
  });

  it("treats a missing address as not admin", () => {
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
    expect(isAdminEmail("")).toBe(false);
    expect(isAdminEmail("   ")).toBe(false);
  });

  it("honours an ADMIN_EMAILS override and drops the built-in default", () => {
    process.env.ADMIN_EMAILS = "owner@acme.com, ops@acme.com";
    expect(isAdminEmail("owner@acme.com")).toBe(true);
    expect(isAdminEmail("ops@acme.com")).toBe(true);
    // Overriding replaces the default rather than adding to it.
    expect(isAdminEmail("suriymanikandan4@gmail.com")).toBe(false);
    expect(isAdminEmail("suriyamanikandan4@gmail.com")).toBe(false);
  });

  it("falls back to the default when the override is blank or junk", () => {
    process.env.ADMIN_EMAILS = "   ,  , ";
    delete process.env.ADMIN_EMAIL;
    expect(isAdminEmail("suriymanikandan4@gmail.com")).toBe(true);
    expect(isAdminEmail("suriyamanikandan4@gmail.com")).toBe(true);
  });
});
