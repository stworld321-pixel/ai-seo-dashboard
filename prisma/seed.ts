/**
 * Database seed script (`npx prisma db seed` or `npx tsx prisma/seed.ts`).
 *
 * Populates the database with the real Google Search Console fixture for
 * `https://litenatures.in/` (`docs/sample-gsc-litenatures.json`) when live
 * Composio credentials are unavailable, then runs the deterministic
 * Opportunity Engine to populate `Opportunity` and `Keyword` rows.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/server/db";
import { recomputeWebsiteOpportunities } from "../src/server/services/dashboard";
import { computeHealthScore } from "../src/server/intelligence/health-score";
import { generateInternalLinkSuggestions } from "../src/server/intelligence/internal-links";
import { buildDataDrivenDraft } from "../src/server/intelligence/content-scorer";
import type { SearchRow } from "../src/lib/types";

const SITE_URL = "https://litenatures.in/";

type FixturePayload = {
  results: { data?: { rows?: SearchRow[] } }[];
};

function matchServingPage(query: string, pages: string[]): string | undefined {
  const tokens = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && t !== "soap" && t !== "for" && t !== "india" && t !== "best");

  let bestUrl: string | undefined;
  let bestScore = 0;

  for (const url of pages) {
    const slug = url.toLowerCase();
    let score = 0;
    for (const token of tokens) {
      if (slug.includes(token)) score += 2;
    }
    if (query.includes("soap") && slug.includes("soap")) score += 1;
    if (query.includes("serum") && slug.includes("serum")) score += 1;
    if (query.includes("gel") && slug.includes("gel")) score += 1;
    if (query.includes("cream") && slug.includes("cream")) score += 1;
    if (score > bestScore) {
      bestScore = score;
      bestUrl = url;
    }
  }
  return bestScore >= 2 ? bestUrl : undefined;
}

export async function seedDatabase() {
  console.log("1. Upserting default Organization and Website...");
  const org = await prisma.organization.upsert({
    where: { slug: "default" },
    create: { name: "Default Workspace", slug: "default" },
    update: {},
  });

  const website = await prisma.website.upsert({
    where: { orgId_url: { orgId: org.id, url: SITE_URL } },
    create: {
      orgId: org.id,
      name: "Lite Natures",
      url: SITE_URL,
      cms: "WORDPRESS",
      gscProperty: SITE_URL,
      sitemapUrl: `${SITE_URL}sitemap_index.xml`,
      robotsUrl: `${SITE_URL}robots.txt`,
      country: "IND",
      timezone: "Asia/Kolkata",
      language: "en",
      automationLevel: 2,
    },
    update: {},
  });

  const fixturePath = path.resolve(process.cwd(), "docs/sample-gsc-litenatures.json");
  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8")) as FixturePayload;

  const queryRows = fixture.results[0]?.data?.rows ?? [];
  const pageRows = fixture.results[1]?.data?.rows ?? [];
  const countryRows = fixture.results[2]?.data?.rows ?? [];
  const deviceRows = fixture.results[3]?.data?.rows ?? [];

  // Anchor the 28-day window ending 2026-09-21 (matching tests/fixtures/litenatures.ts).
  const baseEnd = new Date(Date.UTC(2026, 8, 21));
  const dates: Date[] = [];
  for (let i = 27; i >= 0; i--) {
    const d = new Date(baseEnd);
    d.setUTCDate(d.getUTCDate() - i);
    dates.push(d);
  }

  console.log("2. Seeding 28-day GSC daily series...");
  // Total impressions across devices in the real GSC fixture = 584 (0 clicks, avg pos ~25.2).
  const totalImpressions = deviceRows.reduce((s, r) => s + r.impressions, 0) || 584;
  const weightedPosSum = deviceRows.reduce((s, r) => s + r.position * r.impressions, 0);
  const avgPosition = totalImpressions > 0 ? weightedPosSum / totalImpressions : 25.2;

  let remainingImp = totalImpressions;
  for (let i = 0; i < dates.length; i++) {
    const date = dates[i]!;
    const isLast = i === dates.length - 1;
    const baseShare = Math.floor(totalImpressions / dates.length);
    const variance = (i % 5) - 2;
    const impressions = isLast ? Math.max(0, remainingImp) : Math.max(1, baseShare + variance);
    remainingImp -= impressions;
    const posOffset = ((i % 7) - 3) * 0.6;
    const position = Math.max(1, Number((avgPosition + posOffset).toFixed(2)));

    await prisma.gscDaily.upsert({
      where: { websiteId_date: { websiteId: website.id, date } },
      create: {
        websiteId: website.id,
        date,
        clicks: 0,
        impressions,
        ctr: 0,
        position,
        dataState: "final",
      },
      update: {
        clicks: 0,
        impressions,
        ctr: 0,
        position,
        dataState: "final",
      },
    });
  }

  console.log("3. Seeding GSC query, page, query+page, country, and device rows...");
  const anchorDate = baseEnd;
  const pageUrls = pageRows.map((r) => r.keys[0]!);

  for (const r of queryRows) {
    const query = r.keys[0]!;
    await prisma.gscQueryDaily.upsert({
      where: { websiteId_date_query: { websiteId: website.id, date: anchorDate, query } },
      create: {
        websiteId: website.id,
        date: anchorDate,
        query,
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
      },
      update: {
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
      },
    });

    const page = matchServingPage(query, pageUrls);
    if (page) {
      await prisma.gscQueryPageDaily.upsert({
        where: {
          websiteId_date_query_page: {
            websiteId: website.id,
            date: anchorDate,
            query,
            page,
          },
        },
        create: {
          websiteId: website.id,
          date: anchorDate,
          query,
          page,
          clicks: r.clicks,
          impressions: r.impressions,
          ctr: r.ctr,
          position: r.position,
        },
        update: {
          clicks: r.clicks,
          impressions: r.impressions,
          ctr: r.ctr,
          position: r.position,
        },
      });
    }
  }

  for (const r of pageRows) {
    const page = r.keys[0]!;
    await prisma.gscPageDaily.upsert({
      where: { websiteId_date_page: { websiteId: website.id, date: anchorDate, page } },
      create: {
        websiteId: website.id,
        date: anchorDate,
        page,
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
      },
      update: {
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
      },
    });

    // Seed PageRecord from known URL structure
    const slug = new URL(page).pathname.replace(/\/+$/, "").split("/").pop() || "home";
    const humanTitle =
      slug === "home"
        ? "Lite Natures — Natural & Organic Skin and Hair Care"
        : slug
            .split("-")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ");

    await prisma.pageRecord.upsert({
      where: { websiteId_url: { websiteId: website.id, url: page } },
      create: {
        websiteId: website.id,
        url: page,
        title: humanTitle,
        h1: humanTitle,
        indexState: "PASS",
        canonical: page,
        lastCrawledAt: new Date(),
        status: r.position <= 10.5 && r.clicks === 0 ? "OPTIMIZE" : r.position <= 20.5 ? "EXPAND" : "HEALTHY",
      },
      update: {},
    });
  }

  for (const r of countryRows) {
    const value = r.keys[0]!;
    await prisma.gscDimensionDaily.upsert({
      where: {
        websiteId_date_dimension_value: {
          websiteId: website.id,
          date: anchorDate,
          dimension: "country",
          value,
        },
      },
      create: {
        websiteId: website.id,
        date: anchorDate,
        dimension: "country",
        value,
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
      },
      update: {
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
      },
    });
  }

  for (const r of deviceRows) {
    const value = r.keys[0]!;
    await prisma.gscDimensionDaily.upsert({
      where: {
        websiteId_date_dimension_value: {
          websiteId: website.id,
          date: anchorDate,
          dimension: "device",
          value,
        },
      },
      create: {
        websiteId: website.id,
        date: anchorDate,
        dimension: "device",
        value,
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
      },
      update: {
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
      },
    });
  }

  const now = new Date();
  for (const dataset of ["gsc:date", "gsc:query", "gsc:page", "gsc:query_page", "gsc:country", "gsc:device"]) {
    await prisma.syncCursor.upsert({
      where: { websiteId_dataset: { websiteId: website.id, dataset } },
      create: {
        websiteId: website.id,
        dataset,
        lastCompleteDate: anchorDate,
        lastRunAt: now,
        lastStatus: "ok",
      },
      update: {
        lastCompleteDate: anchorDate,
        lastRunAt: now,
        lastStatus: "ok",
      },
    });
  }

  console.log("4. Seeding Integrations and Automation Rules...");
  await prisma.integration.upsert({
    where: {
      websiteId_kind_provider: {
        websiteId: website.id,
        kind: "GSC",
        provider: "composio",
      },
    },
    create: {
      websiteId: website.id,
      kind: "GSC",
      provider: "composio",
      externalId: SITE_URL,
      config: { propertyUrl: SITE_URL },
      status: "ACTIVE",
      lastSyncAt: now,
    },
    update: {
      status: "ACTIVE",
      lastSyncAt: now,
    },
  });

  await prisma.integration.upsert({
    where: {
      websiteId_kind_provider: {
        websiteId: website.id,
        kind: "CMS",
        provider: "wordpress",
      },
    },
    create: {
      websiteId: website.id,
      kind: "CMS",
      provider: "wordpress",
      config: { siteUrl: "https://litenatures.in", seoPlugin: "rank_math", primaryPostType: "product" },
      status: "ACTIVE",
      lastSyncAt: now,
    },
    update: {},
  });

  const defaultLlms = [
    { provider: "openai", model: "gpt-4o", isActive: true },
    { provider: "anthropic", model: "claude-sonnet-4-5", isActive: false },
    { provider: "gemini", model: "gemini-2.5-pro", isActive: false },
  ];
  for (const llm of defaultLlms) {
    await prisma.integration.upsert({
      where: {
        websiteId_kind_provider: {
          websiteId: website.id,
          kind: "LLM",
          provider: llm.provider,
        },
      },
      create: {
        websiteId: website.id,
        kind: "LLM",
        provider: llm.provider,
        externalId: llm.model,
        config: {
          model: llm.model,
          baseUrl: null,
          isActive: llm.isActive,
        },
        status: "ACTIVE",
        lastSyncAt: now,
      },
      update: {},
    });
  }

  const existingRules = await prisma.automationRule.count({ where: { websiteId: website.id } });
  if (existingRules === 0) {
    await prisma.automationRule.createMany({
      data: [
        {
          websiteId: website.id,
          name: "Daily Search Console Sync & Opportunity Detection",
          kind: "daily-seo",
          enabled: true,
          schedule: "0 8 * * *",
          config: { windowDays: 28, topActionsLimit: 5 },
          lastRunAt: now,
        },
        {
          websiteId: website.id,
          name: "On-Page Title & Meta Recommendations",
          kind: "onpage-recommendations",
          enabled: true,
          schedule: "30 8 * * *",
          config: { minImpressions: 20, requireApproval: true },
          lastRunAt: now,
        },
        {
          websiteId: website.id,
          name: "Content Decay & Cannibalization Audit",
          kind: "weekly-audit",
          enabled: true,
          schedule: "0 9 * * 1",
          config: { lookbackWindows: 3 },
          lastRunAt: now,
        },
      ],
    });
  }

  console.log("4b. Syncing live WordPress catalog, WooCommerce orders, Rank Math link graph & Site Kit GA4...");
  try {
    const { syncLiveWordPressCatalogAndTelemetry } = await import(
      "../src/server/services/wordpress-sync"
    );
    const liveSync = await syncLiveWordPressCatalogAndTelemetry({
      websiteId: website.id,
      siteUrl: "https://litenatures.in",
    });
    console.log(
      `   Synced ${liveSync.syncedPages} live CMS items, GA4=${liveSync.telemetry.ga4?.propertyId ?? "none"}, WC orders=${liveSync.telemetry.woocommerce?.totalOrders ?? 0}, RM links=${liveSync.telemetry.rankMathLinks?.totalLinks ?? 0}`,
    );
  } catch (err) {
    console.warn("   Live WordPress sync skipped:", err instanceof Error ? err.message : String(err));
  }

  console.log("5. Recomputing Opportunities, Keywords, Health Score & Link Suggestions...");
  const { opportunities, queries, pages } = await recomputeWebsiteOpportunities(website.id, "28d");
  console.log(`   Seeded ${opportunities.length} opportunities for ${website.name}`);

  const pageRecords = await prisma.pageRecord.findMany({ where: { websiteId: website.id } });
  const health = computeHealthScore({
    queries,
    pages,
    opportunities,
    pageRecords,
  });

  await prisma.healthScoreSnapshot.upsert({
    where: { websiteId_date: { websiteId: website.id, date: anchorDate } },
    create: {
      websiteId: website.id,
      date: anchorDate,
      total: health.total,
      breakdown: health.breakdown,
    },
    update: {
      total: health.total,
      breakdown: health.breakdown,
    },
  });

  await prisma.seoIssue.deleteMany({ where: { websiteId: website.id, status: "open" } });
  for (const issue of health.issues) {
    await prisma.seoIssue.create({
      data: {
        websiteId: website.id,
        category: issue.category,
        severity: issue.severity,
        title: issue.title,
        url: issue.url,
        detail: issue.detail,
        status: "open",
      },
    });
  }

  const linkSuggestions = generateInternalLinkSuggestions({
    pages,
    queries,
    opportunities,
  });
  for (const s of linkSuggestions) {
    await prisma.internalLinkSuggestion.upsert({
      where: {
        websiteId_sourceUrl_targetUrl_anchor: {
          websiteId: website.id,
          sourceUrl: s.sourceUrl,
          targetUrl: s.targetUrl,
          anchor: s.anchor,
        },
      },
      create: {
        websiteId: website.id,
        sourceUrl: s.sourceUrl,
        targetUrl: s.targetUrl,
        anchor: s.anchor,
        reason: s.reason,
        confidence: s.confidence,
        status: "suggested",
      },
      update: {
        reason: s.reason,
        confidence: s.confidence,
      },
    });
  }

  const existingContent = await prisma.content.count({ where: { websiteId: website.id } });
  if (existingContent === 0 && opportunities.length > 0) {
    for (const opp of opportunities.slice(0, 3)) {
      const kw = opp.keyword ?? "coconut milk soap";
      const related = queries
        .filter((q) => q.query !== kw && q.query.split(" ").some((w) => w.length >= 4 && kw.includes(w)))
        .map((q) => q.query)
        .slice(0, 4);
      const draft = buildDataDrivenDraft({
        keyword: kw,
        secondaryKeywords: related,
        targetUrl: opp.targetUrl,
        impressions: Number(opp.evidence.impressions ?? 0),
        position: Number(opp.evidence.position ?? 0),
      });

      const targetPage = opp.targetUrl
        ? await prisma.pageRecord.findUnique({
            where: { websiteId_url: { websiteId: website.id, url: opp.targetUrl } },
          })
        : null;

      const created = await prisma.content.create({
        data: {
          websiteId: website.id,
          pageId: targetPage?.id ?? null,
          type: opp.type === "QUICK_WIN" ? "META_TITLE" : "ARTICLE",
          title: draft.title,
          slug: kw.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          primaryKeyword: kw,
          secondaryKeywords: draft.secondaryKeywords,
          intent: draft.intent,
          brief: draft.brief,
          body: draft.body,
          faq: draft.faq,
          status: "AWAITING_APPROVAL",
          qaReport: draft.qaReport,
          authorAgent: opp.type === "QUICK_WIN" ? "onpage-agent" : "content-writer",
          publishedUrl: opp.targetUrl ?? null,
        },
      });

      await prisma.contentVersion.create({
        data: {
          contentId: created.id,
          version: 1,
          body: draft.body,
          diffSummary: `Initial draft generated from ${opp.type} opportunity ("${kw}")`,
          createdBy: created.authorAgent ?? "orchestrator",
        },
      });

      await prisma.approval.create({
        data: {
          websiteId: website.id,
          entityType: "content",
          entityId: created.id,
          action: opp.type === "QUICK_WIN" ? "update_seo_meta" : "publish_content",
          riskLevel: opp.priority === 1 ? "MEDIUM" : "LOW",
          payload: {
            title: draft.title,
            metaDescription: draft.metaDescription,
            keyword: kw,
            targetUrl: opp.targetUrl ?? null,
          },
          diff: {
            before: {
              seoTitle: targetPage?.title ?? null,
              metaDescription: targetPage?.metaDescription ?? null,
            },
            after: {
              seoTitle: draft.title,
              metaDescription: draft.metaDescription,
            },
          },
          status: "pending",
          requestedBy: created.authorAgent ?? "onpage-agent",
        },
      });
    }
  }

  const rule = await prisma.automationRule.findFirst({
    where: { websiteId: website.id, kind: "daily-seo" },
  });
  const existingRuns = await prisma.automationRun.count({ where: { websiteId: website.id } });
  if (rule && existingRuns === 0) {
    const task = await prisma.agentTask.create({
      data: {
        websiteId: website.id,
        agent: "seo-analyst",
        kind: "daily-opportunity-scan",
        input: { range: "28d", datasets: 6 },
        output: {
          queriesAnalyzed: queries.length,
          pagesAnalyzed: pages.length,
          opportunitiesDetected: opportunities.length,
          healthScore: health.total,
        },
        state: "COMPLETED",
        startedAt: now,
        finishedAt: now,
      },
    });

    await prisma.automationRun.create({
      data: {
        ruleId: rule.id,
        websiteId: website.id,
        startedAt: now,
        finishedAt: now,
        status: "completed",
        summary: {
          queriesAnalyzed: queries.length,
          pagesAnalyzed: pages.length,
          opportunitiesDetected: opportunities.length,
          healthScore: health.total,
          internalLinksSuggested: linkSuggestions.length,
        },
        taskIds: [task.id],
      },
    });

    await prisma.agentLog.createMany({
      data: [
        {
          websiteId: website.id,
          taskId: task.id,
          agent: "seo-analyst",
          level: "info",
          message: `Reconciled ${queries.length} queries and ${pages.length} pages over 28d window (584 impressions, 0 clicks).`,
        },
        {
          websiteId: website.id,
          taskId: task.id,
          agent: "opportunity-engine",
          level: "info",
          message: `Detected ${opportunities.length} deterministic opportunities; CTR curve fitted=false (0 sitewide clicks).`,
        },
        {
          websiteId: website.id,
          taskId: task.id,
          agent: "qa-agent",
          level: "info",
          message: `Computed SEO Health Score ${health.total}/100 across ${health.breakdown.filter((b) => b.included).length} active categories (${health.issues.length} linked issues).`,
        },
      ],
    });
  }

  // ─────────────────────── 7. Seed AI Visibility & Authority Data ───────────────────────
  console.log("7. Seeding AI Search & Digital Authority records for Lite Natures...");

    const p1 = await prisma.aiPrompt.upsert({
      where: { websiteId_text: { websiteId: website.id, text: "Best organic handmade soap in Tamil Nadu" } },
      create: {
        websiteId: website.id,
        text: "Best organic handmade soap in Tamil Nadu",
        intent: "commercial",
        priority: 3,
        source: "gsc_query",
        status: "active",
        approved: true,
      },
      update: {},
    });

    const p2 = await prisma.aiPrompt.upsert({
      where: { websiteId_text: { websiteId: website.id, text: "Which coconut milk soap is best for dry skin?" } },
      create: {
        websiteId: website.id,
        text: "Which coconut milk soap is best for dry skin?",
        intent: "comparison",
        priority: 3,
        source: "product_catalog",
        status: "active",
        approved: true,
      },
      update: {},
    });

    const p3 = await prisma.aiPrompt.upsert({
      where: { websiteId_text: { websiteId: website.id, text: "Camel milk soap benefits for sensitive skin and eczema" } },
      create: {
        websiteId: website.id,
        text: "Camel milk soap benefits for sensitive skin and eczema",
        intent: "informational",
        priority: 2,
        source: "paa_question",
        status: "active",
        approved: true,
      },
      update: {},
    });

    const p4 = await prisma.aiPrompt.upsert({
      where: { websiteId_text: { websiteId: website.id, text: "Natural chemical free skincare products online in India" } },
      create: {
        websiteId: website.id,
        text: "Natural chemical free skincare products online in India",
        intent: "commercial",
        priority: 3,
        source: "gsc_query",
        status: "active",
        approved: true,
      },
      update: {},
    });

    const p5 = await prisma.aiPrompt.upsert({
      where: { websiteId_text: { websiteId: website.id, text: "Cold processed soap vs commercial soap difference" } },
      create: {
        websiteId: website.id,
        text: "Cold processed soap vs commercial soap difference",
        intent: "informational",
        priority: 2,
        source: "paa_question",
        status: "active",
        approved: true,
      },
      update: {},
    });

    // Seed realistic multi-engine observations for the prompts
    const promptList = [p1, p2, p3, p4, p5];
    for (const prompt of promptList) {
      // ChatGPT
      await prisma.aiPromptRun.create({
        data: {
          promptId: prompt.id,
          websiteId: website.id,
          engine: "chatgpt",
          response: `When searching for artisanal and cold-processed soaps in South India, Lite Natures (litenatures.in) is among the regional handcrafted botanical brands offering paraben-free formulations like coconut milk soap and camel milk soap. Other popular brands include Soulflower and Forest Essentials.\n\nSources:\n- https://litenatures.in/product/coconutmilk-soap/\n- https://soulflower.biz`,
          brandMentioned: true,
          brandPosition: 2,
          citationFound: true,
          citationUrl: "https://litenatures.in/product/coconutmilk-soap/",
          citationDomain: "litenatures.in",
          sourceDomains: ["litenatures.in", "soulflower.biz"],
          competitorsMentioned: ["soulflower.biz", "forestessentialsindia.com"],
          mentionContext: "Lite Natures (litenatures.in) is among the regional handcrafted botanical brands offering paraben-free formulations",
          sentiment: "positive",
          collectionMethod: "api",
        },
      });

      // Claude
      await prisma.aiPromptRun.create({
        data: {
          promptId: prompt.id,
          websiteId: website.id,
          engine: "claude",
          response: `Cold-processed soaps made with coconut milk and botanical oils provide natural moisturizing properties. Handcrafted soap makers in Tamil Nadu like Lite Natures formulate traditional bars without artificial hardening agents or sulfates.`,
          brandMentioned: true,
          brandPosition: 1,
          citationFound: false,
          sourceDomains: ["ayush.gov.in"],
          mentionContext: "Handcrafted soap makers in Tamil Nadu like Lite Natures formulate traditional bars",
          sentiment: "positive",
          collectionMethod: "api",
        },
      });

      // Perplexity
      await prisma.aiPromptRun.create({
        data: {
          promptId: prompt.id,
          websiteId: website.id,
          engine: "perplexity",
          response: `Top recommended organic handmade soaps in India include brands certified for cruelty-free cold-process manufacturing. Natural oils like unrefined coconut oil, olive oil, and camel milk are commonly used for sensitive skin.\n\nSources:\n- https://litenatures.in/\n- https://organicskincareportal.com`,
          brandMentioned: true,
          brandPosition: 3,
          citationFound: true,
          citationUrl: "https://litenatures.in/",
          citationDomain: "litenatures.in",
          sourceDomains: ["litenatures.in", "organicskincareportal.com"],
          sentiment: "neutral",
          collectionMethod: "api",
        },
      });
    }

    // Seed Citation Opportunities
    await prisma.citationOpportunity.createMany({
      data: [
        {
          websiteId: website.id,
          targetDomain: "ayush.gov.in",
          targetUrl: "https://ayush.gov.in",
          whyRelevant: "Ministry of Ayush guidelines and certified herbal cosmetic standards regularly referenced in Perplexity and Claude health overviews.",
          authorityNotes: "Domain Authority 89 · Government standards body",
          action: "Align product ingredient labeling with Ayush standard nomenclature and include regulatory registration numbers.",
          status: "identified",
        },
        {
          websiteId: website.id,
          targetDomain: "indianskincarejournal.org",
          targetUrl: "https://indianskincarejournal.org/artisanal-soaps",
          whyRelevant: "Leading editorial journal reviewing independent cold-processed organic skincare formulators across South India.",
          authorityNotes: "Domain Authority 64 · High citation frequency in Google AI Overviews",
          action: "Submit cold-processed coconut milk soap batch samples for editorial independent review.",
          status: "identified",
        },
      ],
    });

    // Seed GEO Opportunities
    await prisma.geoOpportunity.createMany({
      data: [
        {
          websiteId: website.id,
          promptId: p2.id,
          gapType: "entity",
          title: "Add Detailed Fatty Acid & Botanical Ingredient Breakdown",
          description: "AI engines extract specific lauric acid percentages and saponification values when generating answers for coconut milk soap inquiries.",
          recommendation: "Publish a structured ingredient table on /product/coconutmilk-soap/ detailing saponified cold-pressed coconut oil, virgin olive oil, and pure coconut milk ratios.",
          priority: 3,
          status: "open",
        },
        {
          websiteId: website.id,
          promptId: p5.id,
          gapType: "comparison",
          title: "Publish Cold-Processed vs Commercial Soap Comparison Matrix",
          description: "Generative search models directly cite side-by-side comparison tables evaluating glycerin retention, curing time, and pH levels.",
          recommendation: "Create dedicated educational guide comparing cold-process cure (4-6 weeks) vs melt-and-pour commercial bars.",
          priority: 3,
          status: "open",
        },
      ],
    });

    // Seed Entity Nodes & Graph
    const e1 = await prisma.entityNode.create({
      data: {
        websiteId: website.id,
        name: "Lite Natures",
        type: "Brand / Organization",
        description: "Artisanal handcrafted organic soap and natural skincare formulator based in Tamil Nadu, India.",
        pageUrl: "https://litenatures.in/",
        schemaType: "Organization",
        confidence: 1.0,
      },
    });

    const e2 = await prisma.entityNode.create({
      data: {
        websiteId: website.id,
        name: "Cold-Processed Coconut Milk Soap",
        type: "Product",
        description: "Sulfate-free handcrafted herbal soap enriched with cold-pressed virgin coconut oil and coconut milk.",
        pageUrl: "https://litenatures.in/product/coconutmilk-soap/",
        schemaType: "Product",
        confidence: 0.95,
      },
    });

    const e3 = await prisma.entityNode.create({
      data: {
        websiteId: website.id,
        name: "Tamil Nadu, India",
        type: "Location",
        description: "Primary manufacturing and regional operating hub.",
        schemaType: "Place",
        confidence: 1.0,
      },
    });

    await prisma.entityRelationship.createMany({
      data: [
        { sourceId: e1.id, targetId: e2.id, relationship: "manufactures", confidence: 1.0 },
        { sourceId: e1.id, targetId: e3.id, relationship: "operatesIn", confidence: 1.0 },
      ],
    });

    // Seed Reddit Opportunities
    await prisma.redditOpportunity.createMany({
      data: [
        {
          websiteId: website.id,
          subreddit: "IndianSkincareAddicts",
          postUrl: "https://reddit.com/r/IndianSkincareAddicts/comments/cold_process_soap_tn",
          postTitle: "Looking for authentic cold-processed soaps in South India without artificial fragrance",
          question: "Has anyone tried small batch artisanal soaps made with fresh coconut milk? Most commercial bars strip my skin barrier.",
          topic: "Artisanal Cold-Process Skincare",
          relevance: "relevant",
          engagement: 34,
          status: "draft_created",
          draftResponse: "Look for soap bars made via traditional cold-process where natural glycerin formed during saponification is retained in the bar rather than extracted. Genuine coconut milk bars have a distinct creamy lather without needing synthetic foaming agents like SLS/SLES. Check that the ingredient list specifies saponified plant oils rather than 'soap base'.",
        },
      ],
    });

    // Seed X Influencer Opportunities
    await prisma.xOpportunity.createMany({
      data: [
        {
          websiteId: website.id,
          creatorHandle: "CleanBeautyIndia",
          topic: "Cold Processed Botanical Cleansers vs Syndet Bars",
          relevance: "relevant",
          audienceNotes: "Followed by 28k clean beauty enthusiasts and organic skincare practitioners.",
          whyRelevant: "Frequently cited in Google AI Overviews discussing non-toxic Indian cosmetic brands.",
          suggestedAction: "Propose expert commentary on small-batch coconut milk curing dynamics.",
          draftContent: "Informative breakdown! One overlooked aspect of authentic cold-process soap is the 4-6 week curing cycle which naturally reduces bar moisture and yields a mild, skin-friendly pH without chemical hardeners.",
        },
      ],
    });

    // Seed Weekly AI Audit baseline record
    const prevWeekStart = new Date(Date.UTC(2026, 8, 14));
    const prevWeekEnd = new Date(Date.UTC(2026, 8, 20));
    await prisma.weeklyAiAudit.create({
      data: {
        websiteId: website.id,
        weekStart: prevWeekStart,
        weekEnd: prevWeekEnd,
        promptsTested: 5,
        mentionsTotal: 12,
        citationsTotal: 8,
        newMentions: 3,
        lostMentions: 0,
        newCitations: 2,
        lostCitations: 0,
        opportunities: 4,
        summary: {
          chatgptCitationRate: "60%",
          claudeMentionRate: "100%",
          perplexityCitationRate: "80%",
        },
      },
    });
}

if (require.main === module || process.argv[1]?.endsWith("seed.ts")) {
  seedDatabase()
    .then(async () => {
      await prisma.$disconnect();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error("Seed failed:", err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
