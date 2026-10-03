import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl ? req.nextUrl.searchParams : new URL(req.url).searchParams;
  const websiteId = searchParams.get("websiteId");
  if (!websiteId) {
    return NextResponse.json({ error: "websiteId required" }, { status: 400 });
  }

  try {
    // Get the website for brand terms filtering
    const website = await prisma.website.findUnique({
      where: { id: websiteId },
      select: { name: true, url: true },
    });

    let domainName = "";
    if (website?.url) {
      try {
        domainName = new URL(website.url).hostname.replace(/^www\./, "").split(".")[0].toLowerCase();
      } catch {
        domainName = website.name.toLowerCase();
      }
    }

    const brandTerms = website
      ? [website.name.toLowerCase(), domainName].filter(Boolean)
      : [];

    // Get the latest 28 days of query+page data
    const latest = await prisma.gscQueryPageDaily.findFirst({
      where: { websiteId },
      orderBy: { date: "desc" },
      select: { date: true },
    });

    if (!latest) {
      return NextResponse.json({ data: [] });
    }

    const to = new Date(latest.date);
    const from = new Date(to);
    from.setUTCDate(from.getUTCDate() - 27);

    const rows = await prisma.gscQueryPageDaily.findMany({
      where: {
        websiteId,
        date: { gte: from, lte: to },
      },
      select: {
        query: true,
        page: true,
        clicks: true,
        impressions: true,
        position: true,
      },
    });

    // Aggregate by query+page
    const queryPageMap = new Map<
      string,
      Map<
        string,
        { impressions: number; clicks: number; posSum: number; count: number }
      >
    >();
    for (const r of rows) {
      if (!r.page) continue;
      // Skip utility pages
      if (
        r.page.includes("/cart/") ||
        r.page.includes("/checkout/") ||
        r.page.includes("/my-account/")
      )
        continue;

      let pageMap = queryPageMap.get(r.query);
      if (!pageMap) {
        pageMap = new Map();
        queryPageMap.set(r.query, pageMap);
      }
      const existing = pageMap.get(r.page);
      if (existing) {
        existing.impressions += r.impressions;
        existing.clicks += r.clicks;
        existing.posSum += r.position;
        existing.count++;
      } else {
        pageMap.set(r.page, {
          impressions: r.impressions,
          clicks: r.clicks,
          posSum: r.position,
          count: 1,
        });
      }
    }

    // Find cannibalization conflicts
    const conflicts: Array<{
      query: string;
      pages: Array<{
        url: string;
        impressions: number;
        clicks: number;
        position: number;
        share: number;
      }>;
      totalImpressions: number;
    }> = [];

    for (const [query, pageMap] of queryPageMap) {
      if (pageMap.size < 2) continue;

      // Skip brand queries
      const qLower = query.toLowerCase();
      if (brandTerms.some((bt) => qLower.includes(bt))) continue;

      const pages = Array.from(pageMap.entries()).map(([url, stats]) => ({
        url,
        impressions: stats.impressions,
        clicks: stats.clicks,
        position: Math.round((stats.posSum / stats.count) * 10) / 10,
        share: 0,
      }));

      const totalImpressions = pages.reduce((s, p) => s + p.impressions, 0);
      if (totalImpressions < 20) continue;

      // Compute shares
      for (const p of pages) {
        p.share =
          Math.round((p.impressions / totalImpressions) * 1000) / 1000;
      }

      // Sort by impressions desc
      pages.sort((a, b) => b.impressions - a.impressions);

      // Only flag if top page holds less than 70% share AND both top pages rank
      if (pages[0].share >= 0.7) continue;
      if (pages[0].position > 30 || pages[1].position > 30) continue;

      conflicts.push({ query, pages, totalImpressions });
    }

    // Sort by total impressions desc
    conflicts.sort((a, b) => b.totalImpressions - a.totalImpressions);

    return NextResponse.json({ data: conflicts });
  } catch (err) {
    console.error("Cannibalization analysis error:", err);
    return NextResponse.json({ data: [] });
  }
}
