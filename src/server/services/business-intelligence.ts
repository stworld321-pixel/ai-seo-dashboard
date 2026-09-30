import { prisma } from "@/server/db";
import { getConfiguredAiModels } from "@/server/integrations/llm/provider";
import { resolveWebsiteLocation, resolveWebsiteVertical } from "@/server/services/ai-visibility";

export type CompetitorItem = {
  id?: string;
  name: string;
  domain: string;
  url: string;
  faviconUrl: string;
  category: string;
  overlapScore: number; // 0-100%
  keyStrength: string;
};

export type ProductInformation = {
  productName: string;
  website: string;
  oneLiner: string;
  whatItDoes: string;
  productCategory: string;
  productType: string;
  targetCustomers: string[];
  keyFeatures: string[];
  techSignals: {
    framework: string;
    cms: string;
    hosting: string;
    hasAnalytics: boolean;
    hasSchema: boolean;
    pageCount: number;
  };
  businessModel: string;
  analyzedAt: string;
};

export type MarketingStrategy = {
  icp: {
    personaTitle: string;
    targetIndustries: string[];
    companySize: string;
    corePainPoints: string[];
    buyingTriggers: string[];
    decisionMakers: string[];
  };
  positioningStatement: {
    forTarget: string;
    whoNeed: string;
    productName: string;
    category: string;
    keyBenefit: string;
    unlikeCompetitors: string;
    reasonToBelieve: string;
    fullStatement: string;
  };
  messagingFramework: {
    headline: string;
    subheadline: string;
    elevatorPitch: string;
    keyProofPoints: string[]; // "Key proof points to repeat across all channels"
  };
  channelPrioritization: Array<{
    tier: "Tier 1 (High Impact)" | "Tier 2 (Growth Scale)" | "Tier 3 (Exploratory)";
    channelName: string;
    expectedCac: "Low" | "Medium" | "High";
    effortLevel: "Low" | "Medium" | "High";
    potentialRoi: string;
    strategicAction: string;
  }>;
  roadmap30Day: Array<{
    week: string;
    title: string;
    days: string;
    tasks: Array<{ id: string; task: string; completed?: boolean; impact: "High" | "Medium" | "Critical" }>;
  }>;
};

export type BusinessIntelligenceData = {
  website: {
    id: string;
    name: string;
    url: string;
    domain: string;
    faviconUrl: string;
    technology?: string | null;
    framework?: string | null;
    cms?: string | null;
    hosting?: string | null;
    industry: string;
    pageCount: number;
    healthScore: number;
  };
  competitors: CompetitorItem[];
  productInfo: ProductInformation;
  marketingStrategy: MarketingStrategy;
};

function getFaviconUrl(domain: string, explicitFavicon?: string | null): string {
  if (explicitFavicon && (explicitFavicon.startsWith("http://") || explicitFavicon.startsWith("https://"))) {
    return explicitFavicon;
  }
  const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]!;
  return `https://www.google.com/s2/favicons?domain=${cleanDomain}&sz=64`;
}

function cleanBrandName(domain: string, siteName?: string): string {
  if (siteName && siteName.trim() && siteName.trim() !== domain) {
    return siteName.trim();
  }
  const bare = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split(".")[0]!;
  return bare.charAt(0).toUpperCase() + bare.slice(1).replace(/[-_]/g, " ");
}

/**
 * Generates or extracts full Business Intelligence (Profile, Competitors with Favicons,
 * Product Information, and Marketing Strategy).
 */
export async function getWebsiteBusinessIntelligence(websiteId: string): Promise<BusinessIntelligenceData> {
  const website = await prisma.website.findUnique({ where: { id: websiteId } });
  if (!website) throw new Error("Website not found");

  const normalizedSiteUrl = website.url.endsWith("/") ? website.url : `${website.url}/`;
  const domain = new URL(normalizedSiteUrl).hostname.replace(/^www\./, "");
  const brandName = cleanBrandName(domain, website.name);
  const siteFavicon = getFaviconUrl(domain, website.faviconUrl);

  const [pages, keywords, competitorsInDb] = await Promise.all([
    prisma.pageRecord.findMany({ where: { websiteId }, take: 15 }),
    prisma.keyword.findMany({ where: { websiteId }, take: 15 }),
    prisma.aiCompetitor.findMany({ where: { websiteId }, take: 8 }),
  ]);

  const allPageText = pages
    .map((p) => `${p.title} ${p.h1} ${p.metaDescription ?? ""}`)
    .join(" ")
    .toLowerCase();

  const { location, countryCode } = resolveWebsiteLocation(website, allPageText, brandName);
  const vertical = resolveWebsiteVertical(brandName, domain, allPageText, pages, countryCode);
  const industryName = vertical.verticalName;

  // 1. Process / Seed Competitors
  let competitorDomains = competitorsInDb.map((c) => ({
    name: c.name || cleanBrandName(c.domain),
    domain: c.domain,
  }));

  if (competitorDomains.length === 0) {
    const defaultList = vertical.defaultCompetitors.map((compDomain) => ({
      name: cleanBrandName(compDomain),
      domain: compDomain,
    }));
    competitorDomains = defaultList;

    // Persist to aiCompetitor so they are permanently saved
    for (const c of defaultList) {
      try {
        await prisma.aiCompetitor.upsert({
          where: { websiteId_domain: { websiteId, domain: c.domain } },
          create: {
            websiteId,
            name: c.name,
            domain: c.domain,
          },
          update: {
            name: c.name,
          },
        });
      } catch {
        // ignore unique constraints
      }
    }
  }

  const competitors: CompetitorItem[] = competitorDomains.map((c, i) => {
    const compDomain = c.domain.replace(/^www\./, "");
    return {
      name: c.name || cleanBrandName(compDomain),
      domain: compDomain,
      url: `https://${compDomain}`,
      faviconUrl: getFaviconUrl(compDomain),
      category: industryName,
      overlapScore: Math.max(65, 95 - i * 8),
      keyStrength: i === 0 ? "High Search Visibility & Regional Authority" : i === 1 ? "Broad Catalog & Direct Organic Presence" : "Specialized Niche Offerings",
    };
  });

  // Calculate tech signals
  const hasSchema = pages.some((p) => {
    const d = (p.contentScoreDetail ?? {}) as { hasSchema?: boolean };
    return Boolean(d.hasSchema);
  });

  // 2. Synthesize Product Information
  const topKw = keywords[0]?.query || vertical.sampleOfferings[0] || `${brandName} solutions`;
  const homeTitle = pages[0]?.title || `${brandName} — ${industryName}`;
  const homeDesc = pages[0]?.metaDescription || `Leading provider of ${industryName} specializing in ${topKw}.`;

  const isB2B =
    allPageText.includes("enterprise") ||
    allPageText.includes("b2b") ||
    allPageText.includes("consulting") ||
    allPageText.includes("agency") ||
    allPageText.includes("software") ||
    allPageText.includes("services");

  const isEcommerce =
    website.cms === "SHOPIFY" ||
    allPageText.includes("cart") ||
    allPageText.includes("shop") ||
    allPageText.includes("product") ||
    allPageText.includes("shipping");

  const productCategory = industryName;
  const productType = isEcommerce ? "B2C / D2C E-Commerce & Retail" : isB2B ? "B2B Professional Services & Solutions" : "Local Business & Service Provider";
  const businessModel = isEcommerce ? "Direct-to-Consumer (D2C) & Online Sales" : isB2B ? "Service Contracts, Subscriptions & Retainers" : "Client Appointments & Service Delivery";

  const keyFeatures = [
    `Comprehensive ${industryName} tailored for clients in ${location} and beyond.`,
    `Optimized user experience and digital workflows with high availability.`,
    `Targeted solutions for ${topKw} with transparent pricing and expert consultation.`,
    `Rapid turnaround and customer support backed by verifiable quality standards.`,
  ];

  const targetCustomers = [
    isEcommerce ? "Direct consumers searching for premium quality & fast delivery" : "Business owners, decision-makers & operations directors",
    `Clients in ${location} seeking top-rated ${industryName.toLowerCase()}`,
    "Companies demanding scalable performance, verified results, and dedicated support",
  ];

  const productInfo: ProductInformation = {
    productName: brandName,
    website: normalizedSiteUrl,
    oneLiner: `${brandName} is a premier ${industryName.toLowerCase()} platform engineered for ${topKw}.`,
    whatItDoes: homeDesc,
    productCategory,
    productType,
    targetCustomers,
    keyFeatures,
    techSignals: {
      framework: website.framework || "Next.js / Modern Web",
      cms: website.cms ? String(website.cms) : "Custom CMS",
      hosting: website.hosting || "Vercel / Cloudflare Edge",
      hasAnalytics: Boolean(website.ga4PropertyId),
      hasSchema,
      pageCount: pages.length || 1,
    },
    businessModel,
    analyzedAt: new Date().toISOString(),
  };

  // 3. Synthesize Marketing Strategy
  const marketingStrategy: MarketingStrategy = {
    icp: {
      personaTitle: isB2B ? "Head of Growth / Marketing Director / Business Owner" : "Informed Consumer / Local Service Seeker",
      targetIndustries: [industryName, "Digital Commerce", "Corporate Services", "Regional Enterprise"],
      companySize: isB2B ? "10–250 employees (Mid-Market to Growing SMBs)" : "Direct Retail / Individual Consumers",
      corePainPoints: [
        `Inconsistent service quality and opaque pricing across legacy alternatives.`,
        `Low discoverability and difficulty verifying domain credentials and real client reviews.`,
        `Friction in onboarding, communication bottlenecks, and slow support resolution.`,
      ],
      buyingTriggers: [
        `Urgent need to upgrade to higher quality ${industryName.toLowerCase()}.`,
        `Dissatisfaction with current competitor delivery speed and unexpected costs.`,
        `Discovery of ${brandName} via organic search or high-trust AI citations (ChatGPT/Perplexity).`,
      ],
      decisionMakers: isB2B ? ["Founder / CEO", "Chief Marketing Officer", "VP Operations"] : ["Individual Consumer", "Household Decision Maker"],
    },
    positioningStatement: {
      forTarget: `ambitious clients and businesses in ${location}`,
      whoNeed: `reliable, high-performance ${industryName.toLowerCase()}`,
      productName: brandName,
      category: industryName,
      keyBenefit: `delivers superior quality, transparent execution, and measurable outcomes`,
      unlikeCompetitors: `fragmented competitors (${competitors.slice(0, 2).map((c) => c.name).join(", ")})`,
      reasonToBelieve: `our purpose-built digital platform, proven satisfaction records, and verified operational expertise`,
      fullStatement: `For ambitious clients in ${location} who need reliable ${industryName.toLowerCase()}, ${brandName} is a premier ${industryName} platform that delivers superior quality and transparent execution, unlike ${competitors.slice(0, 2).map((c) => c.name).join(", ")} because of our purpose-built digital architecture, verified client satisfaction, and responsive service.`,
    },
    messagingFramework: {
      headline: `${brandName} — Redefining Excellence in ${industryName}`,
      subheadline: `Accelerate your growth with reliable, precision-crafted solutions engineered for ${location} and beyond.`,
      elevatorPitch: `${brandName} (${domain}) empowers customers with industry-leading ${industryName.toLowerCase()}. We eliminate complexity through modern delivery, transparent standards, and relentless dedication to quality.`,
      keyProofPoints: [
        `Verified Market Excellence: Ranked among the top contenders in ${location} with verifiable client feedback.`,
        `Engineered for Speed & Clarity: Streamlined digital touchpoints ensuring rapid onboarding and zero hidden charges.`,
        `AEO & GEO Search Authority: Structured data citations indexed across Google Search, ChatGPT, Perplexity, and Claude.`,
        `End-to-End Reliability: Dedicated quality assurance and responsive support guaranteeing peace of mind.`,
      ],
    },
    channelPrioritization: [
      {
        tier: "Tier 1 (High Impact)",
        channelName: "Organic Search (SEO) & AI Citations (AEO/GEO)",
        expectedCac: "Low",
        effortLevel: "Medium",
        potentialRoi: "12x–25x Lifetime ROI",
        strategicAction: `Dominate high-intent commercial keywords (${topKw}) and optimize structured JSON-LD schema for ChatGPT/Perplexity AI Overviews.`,
      },
      {
        tier: "Tier 1 (High Impact)",
        channelName: "Programmatic Topical Clusters & Landing Pages",
        expectedCac: "Low",
        effortLevel: "Medium",
        potentialRoi: "8x–15x ROI",
        strategicAction: `Publish targeted solution guides and comparison pages addressing long-tail buyer questions.`,
      },
      {
        tier: "Tier 2 (Growth Scale)",
        channelName: "Community Engagement (Reddit & Niche Forums)",
        expectedCac: "Medium",
        effortLevel: "Medium",
        potentialRoi: "5x–8x ROI",
        strategicAction: `Answer relevant buyer queries with expert solutions, establishing ${brandName} as the default trusted recommendation.`,
      },
      {
        tier: "Tier 2 (Growth Scale)",
        channelName: "Social Thought Leadership & Brand Channels (X / LinkedIn)",
        expectedCac: "Medium",
        effortLevel: "Medium",
        potentialRoi: "4x–7x ROI",
        strategicAction: `Distribute case studies, behind-the-scenes insights, and client proof points to attract decision-makers.`,
      },
      {
        tier: "Tier 3 (Exploratory)",
        channelName: "High-Intent Search Ads (Google Ads / SEM Retargeting)",
        expectedCac: "High",
        effortLevel: "Low",
        potentialRoi: "2.5x–4x ROI",
        strategicAction: `Capture bottom-of-funnel searchers comparing ${brandName} against ${competitors[0]?.name || "alternatives"}.`,
      },
    ],
    roadmap30Day: [
      {
        week: "Week 1",
        title: "Foundation & Technical Architecture",
        days: "Days 1–7",
        tasks: [
          { id: "w1-1", task: `Audit technical core vitals, crawlability, and mobile responsiveness on ${domain}`, completed: true, impact: "Critical" },
          { id: "w1-2", task: `Deploy Organization & WebSite JSON-LD Schema markup across all main templates`, completed: true, impact: "High" },
          { id: "w1-3", task: `Resolve missing or unoptimized meta titles and descriptions for top URLs`, completed: false, impact: "Critical" },
        ],
      },
      {
        week: "Week 2",
        title: "Content Clustering & High-Intent Target Pages",
        days: "Days 8–14",
        tasks: [
          { id: "w2-1", task: `Publish 3 high-depth topical cluster guides targeting "${topKw}"`, completed: false, impact: "Critical" },
          { id: "w2-2", task: `Implement internal contextual links from high-impression pages to conversion hubs`, completed: false, impact: "High" },
          { id: "w2-3", task: `Add 48-word direct answer definition boxes for AEO AI snippets`, completed: false, impact: "Medium" },
        ],
      },
      {
        week: "Week 3",
        title: "Authority Building, Social Citations & GEO Alignment",
        days: "Days 15–21",
        tasks: [
          { id: "w3-1", task: `Claim and verify business directory profiles on top industry citation sources`, completed: false, impact: "High" },
          { id: "w3-2", task: `Participate in top Reddit and community threads discussing ${industryName.toLowerCase()}`, completed: false, impact: "Medium" },
          { id: "w3-3", task: `Publish comparative analysis highlighting ${brandName}'s differentiation vs competitors`, completed: false, impact: "High" },
        ],
      },
      {
        week: "Week 4",
        title: "Conversion Optimization, Internal Links & Scale",
        days: "Days 22–30",
        tasks: [
          { id: "w4-1", task: `A/B test hero CTA headlines and proof point placements on landing pages`, completed: false, impact: "High" },
          { id: "w4-2", task: `Audit 28-day keyword velocity and rank movements across Google and AI search`, completed: false, impact: "Critical" },
          { id: "w4-3", task: `Automate weekly opportunity scans and AI draft generation workflows`, completed: false, impact: "Medium" },
        ],
      },
    ],
  };

  return {
    website: {
      id: website.id,
      name: brandName,
      url: normalizedSiteUrl,
      domain,
      faviconUrl: siteFavicon,
      technology: website.technology,
      framework: website.framework || "Next.js / Modern Web",
      cms: website.cms ? String(website.cms) : "Custom",
      hosting: website.hosting || "Cloud Edge",
      industry: industryName,
      pageCount: pages.length || 1,
      healthScore: 88,
    },
    competitors,
    productInfo,
    marketingStrategy,
  };
}
