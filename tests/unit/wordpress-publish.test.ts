import { describe, it, expect } from "vitest";
import { WordPressProvider } from "@/server/integrations/cms/wordpress";

/**
 * Captures the request bodies publishBlogPost sends, so the scheduling and
 * category wiring can be checked without touching a live WordPress site.
 * `request` is private to TypeScript only; it exists at runtime.
 */
function withCapturedRequests(wp: WordPressProvider) {
  const calls: Array<{ path: string; body: Record<string, unknown> }> = [];
  const patched = wp as unknown as {
    request: (path: string, init?: { method?: string; body?: string }) => Promise<unknown>;
  };
  patched.request = async (path, init) => {
    const body = init?.body ? (JSON.parse(init.body) as Record<string, unknown>) : {};
    calls.push({ path, body });
    // The slug-lookup call expects an array; the write expects a post object.
    if (path.startsWith("/wp/v2/posts?slug=")) return [];
    return { id: 42, link: "https://example.com/my-post/", slug: "my-post" };
  };
  return calls;
}

function provider() {
  return new WordPressProvider({
    siteUrl: "https://example.com",
    username: "admin",
    appPassword: "secret",
  });
}

const base = { title: "My Post", htmlContent: "<p>hi</p>" };

describe("publishBlogPost scheduling", () => {
  it("publishes immediately when no schedule is given", async () => {
    const wp = provider();
    const calls = withCapturedRequests(wp);
    const res = await wp.publishBlogPost(base);

    const write = calls.find((c) => !c.path.includes("?slug="))!;
    expect(write.body.status).toBe("publish");
    expect(write.body.date_gmt).toBeUndefined();
    expect(res.status).toBe("publish");
    expect(res.scheduledAt).toBeUndefined();
  });

  it("hands a future date to WordPress as a scheduled post", async () => {
    const wp = provider();
    const calls = withCapturedRequests(wp);
    const when = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const res = await wp.publishBlogPost({ ...base, scheduledAt: when });

    const write = calls.find((c) => !c.path.includes("?slug="))!;
    expect(write.body.status).toBe("future");
    // ISO8601 with no zone suffix: WordPress reads date_gmt as UTC.
    expect(write.body.date_gmt).toBe(when.toISOString().slice(0, 19));
    expect(write.body.date_gmt as string).not.toMatch(/Z$/);
    expect(res.status).toBe("future");
    expect(res.scheduledAt).toBe(when.toISOString());
  });

  it("ignores a past date rather than scheduling a post that can never fire", async () => {
    const wp = provider();
    const calls = withCapturedRequests(wp);
    const res = await wp.publishBlogPost({ ...base, scheduledAt: new Date(Date.now() - 60_000) });

    const write = calls.find((c) => !c.path.includes("?slug="))!;
    expect(write.body.status).toBe("publish");
    expect(write.body.date_gmt).toBeUndefined();
    expect(res.status).toBe("publish");
  });

  it("sends categories only when some are chosen", async () => {
    const wp = provider();
    let calls = withCapturedRequests(wp);
    await wp.publishBlogPost({ ...base, categories: [7, 12] });
    expect(calls.find((c) => !c.path.includes("?slug="))!.body.categories).toEqual([7, 12]);

    calls = withCapturedRequests(wp);
    await wp.publishBlogPost({ ...base, categories: [] });
    expect(calls.find((c) => !c.path.includes("?slug="))!.body.categories).toBeUndefined();
  });
});
