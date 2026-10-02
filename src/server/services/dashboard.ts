import { prisma } from "@/server/db";
import type { DailyMetrics, Opportunity, PageMetrics, QueryMetrics, Totals } from "@/lib/types";
import { classifyIntent } from "@/server/intelligence/intent";
import { runOpportunityEngine } from "@/server/intelligence/opportunity-engine";

/**
 * Read models for the dashboard. Everything here reads from OUR Postgres,
 * never from a live Google API call — so pages render fast and quota stays
 * bounded (docs/01 §5).
 */

export type RangeKey = "7d" | "28d" | "90d" | "6m" | "12m";

export const RANGE_DAYS: Record<RangeKey, number> = {
  "7d": 7,
  "28d": 28,
  "90d": 90,
  "6m": 182,
  "12m": 365,
};

export type Window = { from: Date; to: Date; days: number };

function dateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

/**
 * Anchors the window on the latest date we actually hold data for, not on
 * today. Google lags ~2-3 days, so anchoring on today would silently show an
 * empty tail and make traffic look like it collapsed.
 */
export async function resolveWindow(
  websiteId: string,
  range: RangeKey,
): Promise<Window | null> {
  let latest = await prisma.gscDaily.findFirst({
    where: { websiteId },
    orderBy: { date: "desc" },
    select: { date: true },
  });
  if (!latest) {
    latest = await prisma.gscQueryDaily.findFirst({
      where: { websiteId },
      orderBy: { date: "desc" },
      select: { date: true },
    });
  }
  if (!latest) {
    latest = await prisma.gscPageDaily.findFirst({
      where: { websiteId },
      orderBy: { date: "desc" },
      select: { date: true },
    });
  }
  if (!latest) return null;

  const to = dateOnly(latest.date);
  const days = RANGE_DAYS[range];
  return { from: addDays(to, -(days - 1)), to, days };
}

/** The equal-length window immediately before `w`, for period-over-period deltas. */
export function previousWindow(w: Window): Window {
  const to = addDays(w.from, -1);
  return { from: addDays(to, -(w.days - 1)), to, days: w.days };
}

function aggregate(rows: { clicks: number; impressions: number; position: number }[]): Totals {
  const clicks = rows.reduce((s, r) => s + r.clicks, 0);
  const impressions = rows.reduce((s, r) => s + r.impressions, 0);
  const position =
    impressions > 0
      ? rows.reduce((s, r) => s + r.position * r.impressions, 0) / impressions
      : 0;
  return { clicks, impressions, ctr: impressions > 0 ? clicks / impressions : 0, position };
}

export async function getDailySeries(
  websiteId: string,
  w: Window,
): Promise<DailyMetrics[]> {
  const rows = await prisma.gscDaily.findMany({
    where: { websiteId, date: { gte: w.from, lte: w.to } },
    orderBy: { date: "asc" },
  });
  return rows.map((r) => ({
    date: r.date.toISOString().slice(0, 10),
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr,
    position: r.position,
  }));
}

export async function getTotals(websiteId: string, w: Window): Promise<Totals> {
  const rows = await prisma.gscDaily.findMany({
    where: { websiteId, date: { gte: w.from, lte: w.to } },
    select: { clicks: true, impressions: true, position: true },
  });
  return aggregate(rows);
}

/**
 * Totals for a comparison window, plus whether we actually hold enough days to
 * make the comparison honest.
 *
 * This matters: with only 30 days backfilled, the "previous 28 days" contains
 * just 2 days of data, and naively comparing produced a headline delta of
 * +944% — pure artifact of missing history, not growth. When coverage is
 * incomplete we return `complete: false` and the UI shows no delta at all.
 */
export async function getComparisonTotals(
  websiteId: string,
  w: Window,
): Promise<{ totals: Totals; complete: boolean; daysCovered: number }> {
  const rows = await prisma.gscDaily.findMany({
    where: { websiteId, date: { gte: w.from, lte: w.to } },
    select: { clicks: true, impressions: true, position: true },
  });
  // Require near-full coverage; a day or two of GSC gaps is normal.
  const complete = rows.length >= w.days - 1;
  return { totals: aggregate(rows), complete, daysCovered: rows.length };
}

/** Query-grain rollup over a window, attributed to the best serving page when query+page rows exist. */
export async function getQueryMetrics(
  websiteId: string,
  w: Window,
): Promise<QueryMetrics[]> {
  const [rows, qpRows] = await Promise.all([
    prisma.gscQueryDaily.findMany({
      where: { websiteId, date: { gte: w.from, lte: w.to } },
      select: { query: true, clicks: true, impressions: true, position: true },
    }),
    prisma.gscQueryPageDaily.findMany({
      where: { websiteId, date: { gte: w.from, lte: w.to } },
      select: { query: true, page: true, impressions: true },
    }),
  ]);

  const pageByQuery = new Map<string, Map<string, number>>();
  for (const r of qpRows) {
    const inner = pageByQuery.get(r.query) ?? new Map<string, number>();
    inner.set(r.page, (inner.get(r.page) ?? 0) + r.impressions);
    pageByQuery.set(r.query, inner);
  }
  const bestPage = new Map<string, string>();
  for (const [query, inner] of pageByQuery) {
    const top = [...inner.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top) bestPage.set(query, top[0]);
  }

  const acc = new Map<string, { clicks: number; impressions: number; weighted: number }>();
  for (const r of rows) {
    const cur = acc.get(r.query) ?? { clicks: 0, impressions: 0, weighted: 0 };
    cur.clicks += r.clicks;
    cur.impressions += r.impressions;
    cur.weighted += r.position * r.impressions;
    acc.set(r.query, cur);
  }

  return [...acc.entries()]
    .filter(([query]) => {
      const lower = query.toLowerCase().trim();
      return (
        lower.length > 2 &&
        !["services", "service", "our services", "about us", "about", "contact us", "contact", "home", "homepage", "privacy", "terms", "careers", "cart", "checkout", "support", "custom web solutions"].includes(lower)
      );
    })
    .map(([query, v]) => ({
      query,
      clicks: v.clicks,
      impressions: v.impressions,
      ctr: v.impressions > 0 ? v.clicks / v.impressions : 0,
      position: v.impressions > 0 ? v.weighted / v.impressions : 0,
      ...(bestPage.has(query) ? { page: bestPage.get(query) } : {}),
    }))
    .sort((a, b) => b.impressions - a.impressions);
}

/** Query+Page grain rollup over a window, used for cannibalization detection. */
export async function getQueryPageMetrics(
  websiteId: string,
  w: Window,
): Promise<QueryMetrics[]> {
  const rows = await prisma.gscQueryPageDaily.findMany({
    where: { websiteId, date: { gte: w.from, lte: w.to } },
    select: { query: true, page: true, clicks: true, impressions: true, position: true },
  });

  const acc = new Map<
    string,
    { query: string; page: string; clicks: number; impressions: number; weighted: number }
  >();
  for (const r of rows) {
    const key = `${r.query}\0${r.page}`;
    const cur = acc.get(key) ?? {
      query: r.query,
      page: r.page,
      clicks: 0,
      impressions: 0,
      weighted: 0,
    };
    cur.clicks += r.clicks;
    cur.impressions += r.impressions;
    cur.weighted += r.position * r.impressions;
    acc.set(key, cur);
  }

  return [...acc.values()]
    .map((v) => ({
      query: v.query,
      page: v.page,
      clicks: v.clicks,
      impressions: v.impressions,
      ctr: v.impressions > 0 ? v.clicks / v.impressions : 0,
      position: v.impressions > 0 ? v.weighted / v.impressions : 0,
    }))
    .sort((a, b) => b.impressions - a.impressions);
}

/** Page-grain rollup over a window. */
export async function getPageMetrics(
  websiteId: string,
  w: Window,
): Promise<PageMetrics[]> {
  const rows = await prisma.gscPageDaily.findMany({
    where: { websiteId, date: { gte: w.from, lte: w.to } },
    select: { page: true, clicks: true, impressions: true, position: true },
  });

  const acc = new Map<string, { clicks: number; impressions: number; weighted: number }>();
  for (const r of rows) {
    const cur = acc.get(r.page) ?? { clicks: 0, impressions: 0, weighted: 0 };
    cur.clicks += r.clicks;
    cur.impressions += r.impressions;
    cur.weighted += r.position * r.impressions;
    acc.set(r.page, cur);
  }

  return [...acc.entries()]
    .map(([page, v]) => ({
      page,
      clicks: v.clicks,
      impressions: v.impressions,
      ctr: v.impressions > 0 ? v.clicks / v.impressions : 0,
      position: v.impressions > 0 ? v.weighted / v.impressions : 0,
    }))
    .sort((a, b) => b.impressions - a.impressions);
}

/** country / device breakdowns. */
export async function getDimension(
  websiteId: string,
  w: Window,
  dimension: "country" | "device",
): Promise<{ value: string; clicks: number; impressions: number; position: number }[]> {
  const rows = await prisma.gscDimensionDaily.findMany({
    where: { websiteId, dimension, date: { gte: w.from, lte: w.to } },
    select: { value: true, clicks: true, impressions: true, position: true },
  });

  const acc = new Map<string, { clicks: number; impressions: number; weighted: number }>();
  for (const r of rows) {
    const cur = acc.get(r.value) ?? { clicks: 0, impressions: 0, weighted: 0 };
    cur.clicks += r.clicks;
    cur.impressions += r.impressions;
    cur.weighted += r.position * r.impressions;
    acc.set(r.value, cur);
  }

  return [...acc.entries()]
    .map(([value, v]) => ({
      value,
      clicks: v.clicks,
      impressions: v.impressions,
      position: v.impressions > 0 ? v.weighted / v.impressions : 0,
    }))
    .sort((a, b) => b.impressions - a.impressions);
}

/**
 * Resolves the website a request should operate on, enforcing tenancy.
 *
 * Every page and ~43 API routes funnel through here with a client-supplied id,
 * so this is the chokepoint for "a user can only see their own projects". A
 * requested id that the user does not own is ignored (never returned), and we
 * fall back to their own most recent site.
 *
 * The one caller that is allowed past tenancy is a CLI script, which has no
 * request context at all and already holds direct database credentials.
 */
export async function getDefaultWebsite(websiteId?: string) {
  let targetId = websiteId;
  let currentUserOrgIds: string[] = [];
  let isUserAdmin = false;
  let inRequestContext = false;
  let hasUser = false;

  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    inRequestContext = true;

    const { getCurrentUser, getAccessibleOrgIds } = await import("@/server/auth");
    const user = await getCurrentUser();
    if (user) {
      hasUser = true;
      isUserAdmin = user.isAdmin;
      currentUserOrgIds = await getAccessibleOrgIds(user);
    }

    if (!targetId) {
      targetId = cookieStore.get("active_website_id")?.value || undefined;
    }
  } catch {
    // No request context: a CLI script (scripts/*.ts), which is trusted.
  }

  // Inside a request, an unauthenticated caller gets nothing. The proxy already
  // rejects these, so reaching here means a gap upstream — fail closed.
  if (inRequestContext && !hasUser) return null;

  if (targetId && targetId !== "default") {
    const found = await prisma.website.findUnique({ where: { id: targetId } });
    if (found) {
      if (!inRequestContext || isUserAdmin || currentUserOrgIds.includes(found.orgId)) {
        return found;
      }
      // Requested someone else's site: ignore the id and fall through to their own.
    }
  }

  if (currentUserOrgIds.length > 0) {
    const userSite = await prisma.website.findFirst({
      where: { orgId: { in: currentUserOrgIds } },
      orderBy: { createdAt: "desc" },
    });
    if (userSite) return userSite;
  }

  // An admin with no site of their own still needs a workspace to inspect.
  if (isUserAdmin) {
    return prisma.website.findFirst({ orderBy: { createdAt: "desc" } });
  }

  // CLI scripts keep their previous behaviour of picking the newest site.
  if (!inRequestContext) {
    return prisma.website.findFirst({ orderBy: { createdAt: "desc" } });
  }

  // No website in the user's organization: the onboarding wizard takes over.
  return null;
}

export async function listWebsites(options?: { all?: boolean }) {
  let inRequestContext = false;
  try {
    const { cookies } = await import("next/headers");
    await cookies();
    inRequestContext = true;

    const { getCurrentUser, getAccessibleOrgIds } = await import("@/server/auth");
    const user = await getCurrentUser();

    if (user) {
      if (user.isAdmin) {
        // Admins see everything only when they ask for it; otherwise their own.
        if (options?.all) return prisma.website.findMany({ orderBy: { createdAt: "desc" } });
      }
      const orgIds = await getAccessibleOrgIds(user);
      if (orgIds.length === 0) return user.isAdmin ? prisma.website.findMany({ orderBy: { createdAt: "desc" } }) : [];
      return prisma.website.findMany({
        where: { orgId: { in: orgIds } },
        orderBy: { createdAt: "desc" },
      });
    }
  } catch {
    // No request context: CLI script.
  }

  // Fail closed inside a request; only trusted CLI callers get the full list.
  if (inRequestContext) return [];
  return prisma.website.findMany({ orderBy: { createdAt: "desc" } });
}

export async function getOpportunities(
  websiteId: string,
  status?: "OPEN" | "IN_PROGRESS" | "AWAITING_APPROVAL" | "DONE" | "DISMISSED" | "EXPIRED" | "ALL",
) {
  const where: {
    websiteId: string;
    status?: "OPEN" | "IN_PROGRESS" | "AWAITING_APPROVAL" | "DONE" | "DISMISSED" | "EXPIRED";
  } = { websiteId };

  if (status && status !== "ALL") {
    where.status = status;
  } else if (!status) {
    where.status = "OPEN";
  }

  return prisma.opportunity.findMany({
    where,
    orderBy: { score: "desc" },
  });
}

/** Last sync time across all datasets, for the "data freshness" indicator. */
export async function getSyncStatus(websiteId: string) {
  const cursors = await prisma.syncCursor.findMany({ where: { websiteId } });
  if (cursors.length === 0) return null;
  const lastRunAt = cursors
    .map((c) => c.lastRunAt)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0];
  const lastCompleteDate = cursors
    .map((c) => c.lastCompleteDate)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0];
  return { lastRunAt: lastRunAt ?? null, lastCompleteDate: lastCompleteDate ?? null, datasets: cursors.length };
}

/**
 * Recomputes opportunities and Keyword rollups over the active 28d window,
 * including query+page grain for cannibalization and previous-window metrics
 * for decline detectors when baseline coverage is complete.
 */
export async function recomputeWebsiteOpportunities(
  websiteId: string,
  range: RangeKey = "28d",
) {
  let w = await resolveWindow(websiteId, range);
  if (!w) {
    const latestQuery = await prisma.gscQueryDaily.findFirst({
      where: { websiteId },
      orderBy: { date: "desc" },
      select: { date: true },
    });
    if (!latestQuery) {
      return { opportunities: [], curve: { fitted: false, totalClicks: 0, byPosition: {}, expectedCtr: () => null }, queries: [], pages: [], queryPages: [] };
    }
    const to = dateOnly(latestQuery.date);
    const days = RANGE_DAYS[range];
    w = { from: addDays(to, -(days - 1)), to, days };
  }

  const prev = previousWindow(w);
  const [queries, pages, queryPages, prevComparison, signals] = await Promise.all([
    getQueryMetrics(websiteId, w),
    getPageMetrics(websiteId, w),
    getQueryPageMetrics(websiteId, w),
    getComparisonTotals(websiteId, prev),
    prisma.learningSignal.findMany({ where: { websiteId } }),
  ]);

  const [previousQueries, previousPages] = prevComparison.complete
    ? await Promise.all([getQueryMetrics(websiteId, prev), getPageMetrics(websiteId, prev)])
    : [undefined, undefined];

  const learnedWeights: Record<string, number> = {};
  for (const s of signals) {
    learnedWeights[s.signal] = s.weight;
  }

  const { opportunities: baseOpportunities, curve } = runOpportunityEngine({
    queries,
    pages,
    queryPages,
    previousQueries,
    previousPages,
    learnedWeights,
  });

  const website = await prisma.website.findUnique({ where: { id: websiteId } });
  const brandName = website?.name?.trim() || "brand";

  const pageRecords = await prisma.pageRecord.findMany({ where: { websiteId } });
  const recByUrl = new Map(pageRecords.map((r) => [r.url.replace(/\/+$/, ""), r]));
  const coveredUrls = new Set(
    baseOpportunities
      .map((o) => o.targetUrl?.replace(/\/+$/, ""))
      .filter((u): u is string => Boolean(u)),
  );

  const extraOpportunities = [...baseOpportunities];
  for (const p of pages) {
    const normUrl = p.page.replace(/\/+$/, "");
    if (coveredUrls.has(normUrl) || p.page.includes("?")) continue;
    const rec = recByUrl.get(normUrl);
    const detail = (rec?.contentScoreDetail ?? {}) as { focusKeyword?: string | null };
    const slugKw =
      new URL(p.page).pathname
        .replace(/\/+$/, "")
        .split("/")
        .pop()
        ?.replace(/-/g, " ") || `${brandName} services`;
    const kw = (detail.focusKeyword || slugKw).toLowerCase();

    if (p.position <= 10.5 && p.impressions >= 8 && p.clicks === 0) {
      coveredUrls.add(normUrl);
      extraOpportunities.push({
        type: "QUICK_WIN",
        keyword: kw,
        targetUrl: p.page,
        score: Number((p.impressions * 0.08 * Math.log10(p.impressions + 10)).toFixed(3)),
        priority: 2,
        estimatedClicks: null,
        why: `Page "${p.page}" ranks on Page 1 at position ${p.position.toFixed(1)} with ${p.impressions} Search Console impressions and 0 clicks${!rec?.metaDescription ? " (meta description is currently empty)" : ""}.`,
        evidence: {
          impressions: p.impressions,
          clicks: p.clicks,
          ctr: 0,
          position: Number(p.position.toFixed(2)),
          contentScore: rec?.contentScore ?? null,
        },
        recommendation: [
          { action: "Rewrite SEO title & meta description", detail: "Add benefit-driven CTA to convert page-1 impressions into clicks." },
          { action: "Add FAQ schema block", detail: "Win rich snippet space on Google page 1." },
        ],
      });
    } else if (p.position > 10.5 && p.position <= 20.5 && p.impressions >= 10) {
      coveredUrls.add(normUrl);
      extraOpportunities.push({
        type: "PAGE_TWO",
        keyword: kw,
        targetUrl: p.page,
        score: Number((p.impressions * 0.05 * Math.log10(p.impressions + 10) * 0.8).toFixed(3)),
        priority: 3,
        estimatedClicks: null,
        why: `Page "${p.page}" ranks on Page 2 at position ${p.position.toFixed(1)} with ${p.impressions} impressions — expanding content and internal links can push it into the Top 10.`,
        evidence: {
          impressions: p.impressions,
          clicks: p.clicks,
          position: Number(p.position.toFixed(2)),
          targetPosition: 8,
          contentScore: rec?.contentScore ?? null,
        },
        recommendation: [
          { action: "Expand page copy with subtopic headings & expert guidance" },
          { action: "Add contextual internal links from high-impression pages" },
        ],
      });
    } else if (p.impressions >= 50 && p.position > 20.5) {
      coveredUrls.add(normUrl);
      extraOpportunities.push({
        type: "CONTENT_DECAY",
        keyword: kw,
        targetUrl: p.page,
        score: Number((p.impressions * 0.03 * Math.log10(p.impressions + 10)).toFixed(3)),
        priority: 4,
        estimatedClicks: null,
        why: `High-demand page "${p.page}" earned ${p.impressions} impressions over 28 days but ranks deep at position ${p.position.toFixed(1)}.`,
        evidence: {
          impressions: p.impressions,
          clicks: p.clicks,
          position: Number(p.position.toFixed(2)),
          contentScore: rec?.contentScore ?? null,
        },
        recommendation: [
          { action: "Publish a dedicated comparison & guide targeting this keyword" },
          { action: "Ensure page status is published and indexed in search engines" },
        ],
      });
    }
  }

  // Include custom tracked keywords as high-priority Blog & Content Opportunities
  const customKeywords = await prisma.keyword.findMany({
    where: { websiteId, isCustom: true },
  });

  const existingOppKeywords = new Set(
    extraOpportunities
      .map((o) => o.keyword?.toLowerCase().trim())
      .filter((k): k is string => Boolean(k)),
  );

  for (const ck of customKeywords) {
    const ckLower = ck.query.toLowerCase().trim();
    if (!existingOppKeywords.has(ckLower)) {
      existingOppKeywords.add(ckLower);
      const isTop5 = (ck.liveRank ?? 99) <= 5;
      const isPage2 = (ck.liveRank ?? 99) > 10 && (ck.liveRank ?? 99) <= 20;

      extraOpportunities.push({
        type: isTop5 ? "QUICK_WIN" : isPage2 ? "PAGE_TWO" : "CONTENT_GAP",
        keyword: ck.query,
        targetUrl: ck.liveRankUrl ?? ck.targetUrl ?? undefined,
        score: Number(((ck.opportunityScore ?? 75) * 1.5).toFixed(3)),
        priority: 1,
        estimatedClicks: null,
        why: `Custom tracked keyword "${ck.query}" targeted for high ROI and Page-1 Google dominance.${
          ck.liveRank ? ` Current Live Rank: #${ck.liveRank}.` : ""
        }`,
        evidence: {
          impressions: ck.impressions28,
          clicks: ck.clicks28,
          position: ck.liveRank ?? ck.position28 ?? 0,
          opportunityScore: ck.opportunityScore ?? 75,
        },
        recommendation: [
          {
            action: "Generate AI Article Draft",
            detail: `Synthesize a high-CTR, AEO+GEO optimized blog post targeting "${ck.query}".`,
          },
          { action: "Optimize Title & Meta Description", detail: "Incorporate primary search intent with a compelling call-to-action." },
          { action: "Add FAQ Schema block", detail: "Target People Also Ask & AI Overview citations." },
        ],
      });
    }
  }

  const sortedOpps = [...extraOpportunities].sort((a, b) => b.score - a.score);
  const totalOpps = sortedOpps.length;
  const opportunities = sortedOpps.map((o, i) => {
    const rank = totalOpps <= 1 ? 1 : 1 - i / totalOpps;
    const priority =
      rank >= 0.85 ? 1 : rank >= 0.65 ? 2 : rank >= 0.4 ? 3 : rank >= 0.15 ? 4 : 5;
    return { ...o, priority };
  });

  // Persist Keyword rollups for the 28-day window.
  const prevByQuery = new Map((previousQueries ?? []).map((q) => [q.query, q]));
  const scoreByQuery = new Map<string, number>();
  for (const o of opportunities) {
    if (o.keyword) {
      scoreByQuery.set(o.keyword, Math.max(scoreByQuery.get(o.keyword) ?? 0, o.score));
    }
  }

  for (const q of queries) {
    const { intent, confidence } = classifyIntent(q.query);
    const prevQ = prevByQuery.get(q.query);
    const trend = !prevQ
      ? previousQueries
        ? "NEW"
        : "FLAT"
      : q.clicks > prevQ.clicks || (prevQ.position - q.position >= 1.5)
        ? "UP"
        : q.clicks < prevQ.clicks || (q.position - prevQ.position >= 1.5)
          ? "DOWN"
          : "FLAT";

    await prisma.keyword.upsert({
      where: { websiteId_query: { websiteId, query: q.query } },
      create: {
        websiteId,
        query: q.query,
        intent,
        intentConfidence: confidence,
        bestPage: q.page ?? null,
        clicks28: q.clicks,
        impressions28: q.impressions,
        ctr28: q.ctr,
        position28: q.position,
        clicksPrev28: prevQ?.clicks ?? 0,
        positionPrev28: prevQ?.position ?? null,
        trend,
        opportunityScore: scoreByQuery.get(q.query) ?? 0,
      },
      update: {
        intent,
        intentConfidence: confidence,
        bestPage: q.page ?? null,
        clicks28: q.clicks,
        impressions28: q.impressions,
        ctr28: q.ctr,
        position28: q.position,
        clicksPrev28: prevQ?.clicks ?? 0,
        positionPrev28: prevQ?.position ?? null,
        trend,
        opportunityScore: scoreByQuery.get(q.query) ?? 0,
      },
    });
  }

  // Persist open opportunities so the dashboard reads them directly from Postgres.
  await prisma.opportunity.deleteMany({ where: { websiteId, status: "OPEN" } });
  const mappedOpportunities: (Opportunity & { id: string })[] = [];
  for (const o of opportunities) {
    const created = await prisma.opportunity.create({
      data: {
        websiteId,
        type: o.type,
        targetUrl: o.targetUrl ?? null,
        keyword: o.keyword ?? null,
        priority: o.priority,
        score: o.score,
        estimatedClicks: o.estimatedClicks,
        why: o.why,
        evidence: o.evidence,
        recommendation: o.recommendation,
      },
    });
    mappedOpportunities.push({
      ...o,
      id: created.id,
    });
  }

  return { opportunities: mappedOpportunities, curve, queries, pages, queryPages };
}
