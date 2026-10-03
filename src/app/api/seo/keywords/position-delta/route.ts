import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl ? req.nextUrl.searchParams : new URL(req.url).searchParams;
  const websiteId = searchParams.get("websiteId");
  if (!websiteId) {
    return NextResponse.json({ error: "websiteId required" }, { status: 400 });
  }

  try {
    // Find the latest date we have data for
    const latest = await prisma.gscQueryDaily.findFirst({
      where: { websiteId },
      orderBy: { date: "desc" },
      select: { date: true },
    });

    if (!latest) {
      return NextResponse.json({ data: {} });
    }

    const latestDate = new Date(latest.date);
    const sevenDaysAgo = new Date(latestDate);
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);
    const fourteenDaysAgo = new Date(latestDate);
    fourteenDaysAgo.setUTCDate(fourteenDaysAgo.getUTCDate() - 13);

    // Fetch recent 7 days
    const recentRows = await prisma.gscQueryDaily.findMany({
      where: {
        websiteId,
        date: { gte: sevenDaysAgo, lte: latestDate },
      },
      select: { query: true, position: true, impressions: true },
    });

    // Fetch previous 7 days
    const previousRows = await prisma.gscQueryDaily.findMany({
      where: {
        websiteId,
        date: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
      },
      select: { query: true, position: true, impressions: true },
    });

    // Compute weighted average position for each query in each period
    function avgPosition(
      rows: Array<{ query: string; position: number; impressions: number }>,
    ) {
      const map = new Map<
        string,
        { totalWeight: number; weightedPos: number }
      >();
      for (const r of rows) {
        const w = Math.max(r.impressions, 1);
        const existing = map.get(r.query);
        if (existing) {
          existing.totalWeight += w;
          existing.weightedPos += r.position * w;
        } else {
          map.set(r.query, { totalWeight: w, weightedPos: r.position * w });
        }
      }
      const result = new Map<string, number>();
      for (const [q, v] of map) {
        result.set(q, Math.round((v.weightedPos / v.totalWeight) * 10) / 10);
      }
      return result;
    }

    const currentPositions = avgPosition(recentRows);
    const previousPositions = avgPosition(previousRows);

    const deltas: Record<
      string,
      {
        currentPosition: number;
        previousPosition: number | null;
        delta: number | null;
      }
    > = {};

    for (const [query, pos] of currentPositions) {
      const prev = previousPositions.get(query);
      deltas[query] = {
        currentPosition: pos,
        previousPosition: prev ?? null,
        // Positive delta = position improved (lower number = better rank)
        delta: prev != null ? Math.round((prev - pos) * 10) / 10 : null,
      };
    }

    return NextResponse.json({ data: deltas });
  } catch (err) {
    console.error("Position delta error:", err);
    return NextResponse.json({ data: {} });
  }
}
