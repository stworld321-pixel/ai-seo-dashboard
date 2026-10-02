import { NextResponse } from "next/server";
import { getDefaultWebsite } from "@/server/services/dashboard";
import { inspectIndexStatus, requestIndexing } from "@/server/integrations/google/indexing";

/** Live index coverage for the given URLs (or the top candidates). */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const website = await getDefaultWebsite(searchParams.get("website") ?? undefined);
  if (!website) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Website not found" } }, { status: 404 });
  }

  const urls = searchParams.getAll("url").filter(Boolean);
  if (urls.length === 0) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "At least one url is required" } },
      { status: 400 },
    );
  }

  const { results, error } = await inspectIndexStatus(website.id, urls);
  if (error) {
    return NextResponse.json({ error: { code: "GOOGLE_ERROR", message: error } }, { status: 400 });
  }

  return NextResponse.json({ data: { results } });
}

/** Submits URLs to the Google Indexing API. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { websiteId?: string; urls?: unknown };

  const urls = Array.isArray(body.urls)
    ? body.urls.filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u))
    : [];

  if (urls.length === 0) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Provide at least one absolute http(s) URL" } },
      { status: 400 },
    );
  }

  const website = await getDefaultWebsite(body.websiteId);
  if (!website) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Website not found" } }, { status: 404 });
  }

  // Only submit URLs that belong to this website.
  let host = website.url;
  try {
    host = new URL(website.url.startsWith("http") ? website.url : `https://${website.url}`).hostname.replace(
      /^www\./,
      "",
    );
  } catch {
    // keep raw value
  }

  const owned = urls.filter((u) => {
    try {
      return new URL(u).hostname.replace(/^www\./, "") === host;
    } catch {
      return false;
    }
  });

  if (owned.length === 0) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: `URLs must belong to ${host}` } },
      { status: 403 },
    );
  }

  const { results, error } = await requestIndexing(website.id, owned);
  if (error) {
    return NextResponse.json({ error: { code: "GOOGLE_ERROR", message: error } }, { status: 400 });
  }

  const submitted = results.filter((r) => r.ok).length;
  return NextResponse.json({
    data: { results, submitted, failed: results.length - submitted },
    message: `${submitted} of ${results.length} URL(s) submitted to Google for indexing.`,
  });
}
