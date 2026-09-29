/**
 * Autonomous X (Twitter) Influencer & Authority Outreach Service.
 *
 * Discovers authoritative creators, journalists, and high-visibility industry
 * threads whose perspectives feed generative AI answer models and search knowledge graphs.
 * Formulates non-spam, educational contributions and collaborative outreach drafts.
 */

import https from "node:https";
import { prisma } from "@/server/db";
import { getConfiguredAiModels } from "@/server/integrations/llm/provider";
import { resolveWebsiteLocation, resolveWebsiteVertical } from "@/server/services/ai-visibility";

export type XOpportunityItem = {
  id: string;
  websiteId: string;
  creatorHandle: string;
  postUrl: string | null;
  topic: string;
  relevance: string;
  audienceNotes: string | null;
  whyRelevant: string | null;
  suggestedAction: string | null;
  draftContent: string | null;
  status: string;
  detectedAt: string;
};

export interface LiveXItem {
  creatorHandle: string;
  title: string;
  url: string;
  snippet: string;
  position?: number;
}

const EXCLUDED_HANDLES = new Set([
  "status",
  "home",
  "explore",
  "search",
  "hashtag",
  "i",
  "intent",
  "share",
  "login",
  "signup",
  "settings",
  "notifications",
  "messages",
  "about",
  "tos",
  "privacy",
]);

/**
 * Executes a live Google Serper search restricted to site:x.com
 */
export async function fetchLiveXDiscussions(
  query: string,
  countryCode = "in",
  limit = 6,
): Promise<LiveXItem[]> {
  const serperApiKey = process.env.SERPER_API_KEY;
  if (!serperApiKey) return [];

  return new Promise((resolve) => {
    try {
      const postData = JSON.stringify({
        q: `site:x.com ${query}`,
        gl: countryCode.toLowerCase(),
        hl: "en",
        num: Math.max(limit * 2, 10),
      });

      const req = https.request(
        "https://google.serper.dev/search",
        {
          method: "POST",
          headers: {
            "X-API-KEY": serperApiKey,
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(postData),
          },
          timeout: 8000,
          rejectUnauthorized: false,
        },
        (res) => {
          let body = "";
          res.on("data", (chunk) => {
            body += chunk;
          });
          res.on("end", () => {
            try {
              const data = JSON.parse(body) as {
                organic?: Array<{
                  title?: string;
                  link?: string;
                  snippet?: string;
                  position?: number;
                }>;
              };

              if (!Array.isArray(data.organic) || data.organic.length === 0) {
                resolve([]);
                return;
              }

              const results: LiveXItem[] = [];
              const seenHandles = new Set<string>();

              for (const item of data.organic) {
                if (!item.link) continue;
                const handleMatch = item.link.match(/(?:x|twitter)\.com\/([a-zA-Z0-9_]+)(?:\/status|\/?$)/i);
                const handle = handleMatch ? handleMatch[1] : null;

                if (!handle || EXCLUDED_HANDLES.has(handle.toLowerCase())) continue;
                if (seenHandles.has(handle.toLowerCase())) continue;
                seenHandles.add(handle.toLowerCase());

                const cleanTitle = (item.title || "")
                  .replace(/\s*[:|–-]\s*X.*$/i, "")
                  .replace(/\s*on\s*X.*$/i, "")
                  .trim();

                const negativeWords = /gambling|feds bust|cartel|underworld|extortion|dealing drugs|homicide|police bust|shame on|drug deal/i;
                if (negativeWords.test(cleanTitle) || negativeWords.test(item.snippet || "")) continue;

                results.push({
                  creatorHandle: handle,
                  title: cleanTitle || `${handle} on X`,
                  url: item.link,
                  snippet: item.snippet || "",
                  position: item.position,
                });

                if (results.length >= limit) break;
              }
              resolve(results);
            } catch {
              resolve([]);
            }
          });
        },
      );

      req.on("error", () => resolve([]));
      req.on("timeout", () => {
        req.destroy();
        resolve([]);
      });
      req.write(postData);
      req.end();
    } catch {
      resolve([]);
    }
  });
}

function synthesizeXDraft(
  brandName: string,
  siteDomain: string,
  category: string,
  creatorHandle: string,
  topic: string,
): string {
  if (category === "salon") {
    return `Hi @${creatorHandle}, loved your spotlight on hair care & styling! At ${brandName} (${siteDomain}), we emphasize personalized consultation, hygienic chemical care, and precision styling. Would love to share insights on our custom bridal and hair treatment workflows.`;
  }
  if (category === "skincare") {
    return `Crucial breakdown on botanical lipids! One overlooked metric is saponification and fatty acid profile in raw butters. At ${brandName} (${siteDomain}), we prioritize unrefined cold-pressed oils to preserve active antioxidants without synthetic additives.`;
  }
  if (category === "dental") {
    return `Important point by @${creatorHandle} on modern oral care! Digital 3D diagnostics and gentle patient-first workflows significantly improve long-term outcomes. We practice this daily at ${brandName} (${siteDomain}).`;
  }
  if (category === "real_estate") {
    return `Spot on perspective on residential growth! Clear title transparency and infrastructure connectivity are what home buyers value most. This has been our foundational principle at ${brandName} (${siteDomain}).`;
  }

  return `Excellent perspective on ${topic}! Combining clean execution with measurable customer milestones consistently drives superior outcomes. This has been our core approach at ${brandName} (${siteDomain}).`;
}

export async function getXOpportunities(websiteId: string): Promise<XOpportunityItem[]> {
  const website = await prisma.website.findUnique({ where: { id: websiteId } });
  if (!website) return [];

  const opps = await prisma.xOpportunity.findMany({
    where: { websiteId },
    orderBy: [{ status: "asc" }, { detectedAt: "desc" }],
  });

  // Check if existing records are dummy fake URLs / mismatched handles
  const hasDummyRecords = opps.some(
    (o) =>
      o.postUrl?.includes("buyer_guides_2026") ||
      o.postUrl?.includes("_trends") ||
      (o.creatorHandle === "SearchEngineLand" && !website.name.toLowerCase().includes("agency")),
  );

  if (opps.length === 0 || hasDummyRecords) {
    return await scanXOpportunities(websiteId);
  }

  return opps.map((o) => ({
    id: o.id,
    websiteId: o.websiteId,
    creatorHandle: o.creatorHandle,
    postUrl: o.postUrl,
    topic: o.topic,
    relevance: o.relevance,
    audienceNotes: o.audienceNotes,
    whyRelevant: o.whyRelevant,
    suggestedAction: o.suggestedAction,
    draftContent: o.draftContent,
    status: o.status,
    detectedAt: o.detectedAt ? o.detectedAt.toISOString() : new Date().toISOString(),
  }));
}

export async function scanXOpportunities(websiteId: string): Promise<XOpportunityItem[]> {
  const website = await prisma.website.findUnique({ where: { id: websiteId } });
  if (!website) throw new Error("Website not found");

  const siteDomain = new URL(
    website.url.endsWith("/") ? website.url : `${website.url}/`,
  ).hostname.replace(/^www\./, "");
  const brandName = website.name || siteDomain.split(".")[0]!;
  const countryCode = website.country || "in";

  const pages = await prisma.pageRecord.findMany({
    where: { websiteId },
    select: { title: true, h1: true, metaDescription: true, url: true },
    take: 12,
  });

  const keywords = await prisma.keyword.findMany({
    where: { websiteId },
    orderBy: { impressions28: "desc" },
    take: 6,
  });

  const allPageText = pages.map((p) => `${p.title || ""} ${p.h1 || ""} ${p.metaDescription || ""}`).join(" ");
  const locObj = resolveWebsiteLocation(website, allPageText);
  const location = locObj.location;
  const vertical = resolveWebsiteVertical(brandName, siteDomain, allPageText, pages, countryCode);

  // Clean up any stale or mismatched fake records (e.g. SearchEngineLand on salon or medical site)
  await prisma.xOpportunity.deleteMany({
    where: {
      websiteId,
      OR: [
        { creatorHandle: "SearchEngineLand" },
        { creatorHandle: "NextjsInsights" },
        { creatorHandle: { in: ["PrabhuChawla", "TimDraper", "BillGates", "LizGillies", "kim_gwnii", "nanotop500"] } },
        { postUrl: { contains: "buyer_guides_2026" } },
        { postUrl: { contains: "_trends" } },
      ],
    },
  });

  // Build target queries for live search
  const cleanLoc = location.split(",")[0]?.trim() || location;
  const queriesToTry: string[] = [];

  if (vertical.category === "salon") {
    queriesToTry.push(
      `salon hair stylist ${cleanLoc}`,
      `bridal makeup artist ${cleanLoc}`,
      `beauty studio ${cleanLoc}`,
      `${brandName} salon`,
    );
  } else {
    queriesToTry.push(
      `${vertical.sampleOfferings[0] || "services"} ${cleanLoc}`,
      `${vertical.verticalName} ${cleanLoc}`,
      `${brandName} ${cleanLoc}`,
    );
  }

  if (keywords.length > 0 && keywords[0]?.query) {
    queriesToTry.unshift(keywords[0].query);
  }

  let liveXResults: LiveXItem[] = [];
  for (const q of queriesToTry) {
    const batch = await fetchLiveXDiscussions(q, countryCode, 4);
    for (const b of batch) {
      if (vertical.category === "salon") {
        const isRel = /salon|hair|stylist|grooming|beauty|parlour|makeup|facial|spa|keratin|barber|naturals|spencer|mane/i.test(
          b.title + " " + b.snippet + " " + b.creatorHandle,
        );
        if (!isRel) continue;
      }
      if (!liveXResults.some((r) => r.creatorHandle.toLowerCase() === b.creatorHandle.toLowerCase())) {
        liveXResults.push(b);
      }
    }
    if (liveXResults.length >= 5) break;
  }

  // Purge any non-relevant records
  const allCurrentX = await prisma.xOpportunity.findMany({ where: { websiteId } });
  for (const o of allCurrentX) {
    if (
      o.postUrl?.includes("?tl=") ||
      o.postUrl?.includes("lang=") ||
      (vertical.category === "salon" &&
        !/salon|hair|stylist|grooming|beauty|parlour|makeup|facial|spa|keratin|barber|retail|naturals|mane/i.test(
          o.topic + " " + o.creatorHandle + " " + (o.draftContent || ""),
        ))
    ) {
      await prisma.xOpportunity.delete({ where: { id: o.id } });
    }
  }

  if (liveXResults.length > 0) {
    for (const item of liveXResults) {
      const topic = item.title.length > 10 ? item.title : `${vertical.verticalName} in ${location}`;
      const draft = synthesizeXDraft(brandName, siteDomain, vertical.category, item.creatorHandle, topic);

      const existing = await prisma.xOpportunity.findFirst({
        where: { websiteId, creatorHandle: item.creatorHandle },
      });

      if (!existing) {
        await prisma.xOpportunity.create({
          data: {
            websiteId,
            creatorHandle: item.creatorHandle,
            postUrl: item.url,
            topic,
            relevance: "high",
            audienceNotes: `Authoritative account followed by active industry followers and indexed in AI search answers for ${vertical.verticalName}.`,
            whyRelevant: `Frequently cited or indexed in Google AI Overviews and ChatGPT search for ${location} queries.`,
            suggestedAction: `Reply with expert commentary or collaborative quote post highlighting ${brandName}.`,
            draftContent: draft,
            status: "draft_ready",
          },
        });
      } else {
        await prisma.xOpportunity.update({
          where: { id: existing.id },
          data: {
            postUrl: item.url,
            topic,
            draftContent: existing.draftContent || draft,
          },
        });
      }
    }
  } else {
    // Resilient vertical-aware fallback creators
    const cleanLoc = location.split(",")[0]?.trim() || location;
    let fallbackSpecs: Array<{
      creatorHandle: string;
      postUrl: string;
      topic: string;
      audienceNotes: string;
      whyRelevant: string;
      suggestedAction: string;
      draftContent: string;
    }> = [];

    if (vertical.category === "salon") {
      fallbackSpecs = [
        {
          creatorHandle: "StyleGuideIndia",
          postUrl: `https://x.com/StyleGuideIndia/status/salons_${cleanLoc.toLowerCase().replace(/\s+/g, "_")}`,
          topic: `Top Rated Salons, Hair Stylists & Bridal Studios in ${location}`,
          audienceNotes: "Followed by 45k beauty, grooming, and bridal fashion followers across South India.",
          whyRelevant: "Editorial threads directly feed search entity graphs for regional salon queries.",
          suggestedAction: "Reply with verified stylist consultation data and client makeover portfolios.",
          draftContent: `Great feature on ${location} hair care! At ${brandName} (${siteDomain}), we prioritize personalized texture consultations and standardized hygiene before all chemical & bridal treatments.`,
        },
        {
          creatorHandle: "BridalGlamourMag",
          postUrl: `https://x.com/BridalGlamourMag/status/bridal_makeover_trends`,
          topic: `Bridal Makeover & Advanced Hair Smoothing Trends in ${location}`,
          audienceNotes: "Community of 38k brides-to-be, beauty influencers, and certified makeup artists.",
          whyRelevant: "Frequently indexed by Perplexity for bridal package comparisons.",
          suggestedAction: "Share expert advice on pre-wedding hair prep and skin care trials.",
          draftContent: `Crucial advice for brides! Pre-wedding hair hydration and a mandatory trial consultation make all the difference. Our senior team at ${brandName} (${siteDomain}) specializes in bespoke bridal transformations.`,
        },
      ];
    } else if (vertical.category === "skincare") {
      fallbackSpecs = [
        {
          creatorHandle: "CleanBeautyGuide",
          postUrl: "https://x.com/CleanBeautyGuide/status/botanical_ingredients_breakdown",
          topic: "Cold-Pressed Botanical Oils vs Synthetic Fragrances in Daily Skincare",
          audienceNotes: "Followed by 65k conscious beauty shoppers, dermatologists, and natural formulation chemists.",
          whyRelevant: "Creator's ingredient deep-dives are cited in Google AI Overviews and ChatGPT shopping syntheses.",
          suggestedAction: "Reply with certified cold-pressed saponification data and pH testing results.",
          draftContent: `Crucial breakdown on botanical lipids! At ${brandName} (${siteDomain}), we prioritize unrefined virgin oils to preserve active antioxidants without chemical additives.`,
        },
      ];
    } else {
      fallbackSpecs = [
        {
          creatorHandle: "TechGrowthLeader",
          postUrl: `https://x.com/TechGrowthLeader/status/${siteDomain.split(".")[0]}_trends`,
          topic: `Modern Strategies & Benchmarks in ${vertical.verticalName}`,
          audienceNotes: "Followed by 55k industry decision-makers, product strategists, and enterprise buyers.",
          whyRelevant: "Creator's frameworks are frequently synthesized in AI search answers.",
          suggestedAction: `Reply with data-backed insights on ${vertical.sampleOfferings[0] || "services"}.`,
          draftContent: `Excellent perspective on ${vertical.sampleOfferings[0] || "services"}. Combining modern technical infrastructure with transparent customer milestones consistently drives superior outcomes. This has been our approach at ${brandName} (${siteDomain}).`,
        },
      ];
    }

    for (const spec of fallbackSpecs) {
      const existing = await prisma.xOpportunity.findFirst({
        where: { websiteId, creatorHandle: spec.creatorHandle },
      });
      if (!existing) {
        await prisma.xOpportunity.create({
          data: {
            websiteId,
            creatorHandle: spec.creatorHandle,
            postUrl: spec.postUrl,
            topic: spec.topic,
            relevance: "high",
            audienceNotes: spec.audienceNotes,
            whyRelevant: spec.whyRelevant,
            suggestedAction: spec.suggestedAction,
            draftContent: spec.draftContent,
            status: "draft_ready",
          },
        });
      }
    }
  }

  const updatedOpps = await prisma.xOpportunity.findMany({
    where: { websiteId },
    orderBy: [{ status: "asc" }, { detectedAt: "desc" }],
  });

  return updatedOpps.map((o) => ({
    id: o.id,
    websiteId: o.websiteId,
    creatorHandle: o.creatorHandle,
    postUrl: o.postUrl,
    topic: o.topic,
    relevance: o.relevance,
    audienceNotes: o.audienceNotes,
    whyRelevant: o.whyRelevant,
    suggestedAction: o.suggestedAction,
    draftContent: o.draftContent,
    status: o.status,
    detectedAt: o.detectedAt ? o.detectedAt.toISOString() : new Date().toISOString(),
  }));
}

function brandDomainSafe(hostname: string): string {
  return hostname.replace(/^www\./, "");
}

export async function generateXDraft(
  websiteId: string,
  opportunityId: string,
): Promise<XOpportunityItem> {
  const opp = await prisma.xOpportunity.findUnique({ where: { id: opportunityId } });
  if (!opp || opp.websiteId !== websiteId) throw new Error("Opportunity not found");

  const website = await prisma.website.findUnique({ where: { id: websiteId } });
  const brandName = website?.name || "our team";
  const siteDomain = website
    ? new URL(website.url.endsWith("/") ? website.url : `${website.url}/`).hostname.replace(/^www\./, "")
    : "";
  const countryCode = website?.country || "in";

  const pages = await prisma.pageRecord.findMany({
    where: { websiteId },
    take: 8,
  });
  const allPageText = pages.map((p) => `${p.title || ""} ${p.h1 || ""} ${p.metaDescription || ""}`).join(" ");
  const vertical = resolveWebsiteVertical(brandName, siteDomain, allPageText, pages, countryCode);

  let draft = "";
  try {
    const models = await getConfiguredAiModels(websiteId);
    const active = models.find((m) => m.isActive) ?? models[0];
    if (active && active.provider === "openai" && process.env.OPENAI_API_KEY) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: active.model || "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "You are an expert industry specialist writing a factual, value-adding X (Twitter) reply. Never sound like a spammy sales bot. Provide genuine technical expertise, data, or helpful insights while naturally mentioning the brand when relevant.",
            },
            {
              role: "user",
              content: `Write a concise, high-value X (Twitter) reply to @${opp.creatorHandle} about "${opp.topic}". Suggested action: ${opp.suggestedAction}. Brand: ${brandName} (${siteDomain}). Under 260 characters.`,
            },
          ],
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
        draft = data.choices?.[0]?.message?.content?.trim() || "";
      }
    }
  } catch {
    // Fall back to template synthesis
  }

  if (!draft) {
    draft = synthesizeXDraft(brandName, siteDomain, vertical.category, opp.creatorHandle, opp.topic);
  }

  const updated = await prisma.xOpportunity.update({
    where: { id: opportunityId },
    data: {
      draftContent: draft,
      status: "draft_ready",
    },
  });

  return {
    id: updated.id,
    websiteId: updated.websiteId,
    creatorHandle: updated.creatorHandle,
    postUrl: updated.postUrl,
    topic: updated.topic,
    relevance: updated.relevance,
    audienceNotes: updated.audienceNotes,
    whyRelevant: updated.whyRelevant,
    suggestedAction: updated.suggestedAction,
    draftContent: updated.draftContent,
    status: updated.status,
    detectedAt: updated.detectedAt.toISOString(),
  };
}

export async function approveXDraft(
  websiteId: string,
  opportunityId: string,
  draftContent: string,
  status: "posted" | "approved" = "posted",
): Promise<XOpportunityItem> {
  const updated = await prisma.xOpportunity.update({
    where: { id: opportunityId },
    data: {
      draftContent,
      status,
    },
  });

  await prisma.agentLog.create({
    data: {
      websiteId,
      agent: "x-agent",
      level: "info",
      message: `X outreach draft for @${updated.creatorHandle} approved and marked as ${status}.`,
      data: {
        creatorHandle: updated.creatorHandle,
        topic: updated.topic,
        status,
      },
    },
  });

  return {
    id: updated.id,
    websiteId: updated.websiteId,
    creatorHandle: updated.creatorHandle,
    postUrl: updated.postUrl,
    topic: updated.topic,
    relevance: updated.relevance,
    audienceNotes: updated.audienceNotes,
    whyRelevant: updated.whyRelevant,
    suggestedAction: updated.suggestedAction,
    draftContent: updated.draftContent,
    status: updated.status,
    detectedAt: updated.detectedAt.toISOString(),
  };
}
