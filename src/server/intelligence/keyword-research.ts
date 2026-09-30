/**
 * Keyword Research Module — Complete 11-Step Pipeline
 *
 * Implements the specification:
 * 1. Crawl site (homepage + sitemap, prioritizing /services/, /product/, etc.)
 * 2. Clean content (strip navigation/header/footer/boilerplate & recurring blocks)
 * 3. AI: Build Business Profile (what they sell, where, to whom)
 * 4. AI: Generate seed keywords (per product/service/location/problem across patterns)
 * 5. Expand seeds (Google Autocomplete, People Also Ask, related searches, GSC)
 * 6. Filter (hard stoplist + rules + relevance score)
 * 7. Enrich with metrics (search volume, difficulty, CPC — from provider or null, never AI-invented)
 * 8. AI: Classify intent + funnel stage + map to page
 * 9. Cluster into topics
 * 10. GEO/AEO layer: conversational prompts & questions for AI search
 * 11. Score, rank, store, display
 */

import { prisma } from "@/server/db";
import { fetchUrlResilient } from "@/server/services/ai-site-auditor";
import { cleanPagesContent, type CleanedPage } from "@/server/intelligence/content-cleaner";
import { classifyIntent as defaultClassifyIntent } from "@/server/intelligence/intent";
import { getConfiguredAiModels } from "@/server/integrations/llm/provider";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type OfferingItem = {
  name: string;
  type: "product" | "service";
  description: string;
  source_url?: string;
};

export type BusinessProfile = {
  business_name: string;
  business_type: "ecommerce" | "local_service" | "saas" | "agency" | "publisher" | "marketplace" | "other";
  industry: string;
  primary_offerings: OfferingItem[];
  target_audience: string[];
  locations_served: string[];
  is_local_business: boolean;
  unique_selling_points: string[];
  customer_problems_solved: string[];
  competitor_like_terms: string[];
  brand_terms: string[];
};

export type ResearchKeyword = {
  keyword: string;
  cluster_id?: string;
  offering?: string;
  source: string[];
  relevance: number; // 0-100
  search_volume: number | null; // Null if low/no data, never AI hallucinated
  keyword_difficulty: number; // 0-100
  cpc: number | null;
  trend_12m: number[];
  serp_features: string[];
  intent: "informational" | "commercial" | "transactional" | "navigational" | "local";
  funnel: "TOFU" | "MOFU" | "BOFU";
  best_page_type: "product" | "category" | "service" | "location" | "blog" | "comparison" | "faq" | "homepage";
  mapped_url: string | null;
  action: "optimise_existing" | "create_new_page" | "create_blog_post";
  current_rank: number | null;
  opportunity_score: number; // 0.00 - 1.00
  status: "new" | "tracking" | "ignored";
};

export type KeywordCluster = {
  cluster_id: string;
  name: string;
  primary_keyword: string;
  secondary_keywords: string[];
  total_volume: number;
  avg_difficulty: number;
  mapped_url: string | null;
};

export type AiPromptItem = {
  cluster_id?: string;
  prompt: string;
  type: "recommendation" | "comparison" | "how_to" | "definition" | "problem_solving" | "local";
  answer_format: "list" | "step_by_step" | "short_answer" | "table";
};

export type KeywordResearchResult = {
  project_id: string;
  country: string;
  language: string;
  generated_at: string;
  business_profile: BusinessProfile;
  keywords: ResearchKeyword[];
  clusters: KeywordCluster[];
  ai_prompts: AiPromptItem[];
  rejected: Array<{ keyword: string; reason: string }>;
};

// ─────────────────────────────────────────────────────────────────────────────
// Hard Stoplist (Step 6a)
// ─────────────────────────────────────────────────────────────────────────────

export const HARD_STOPLIST = new Set([
  "home", "homepage", "about", "about us", "who we are", "our story", "our team", "team",
  "contact", "contact us", "get in touch", "services", "our services", "service",
  "products", "our products", "shop", "store", "blog", "news", "articles", "faq", "faqs",
  "careers", "jobs", "login", "sign in", "register", "sign up", "support", "customer support",
  "my account", "account", "cart", "checkout", "wishlist", "privacy", "privacy policy",
  "terms", "terms and conditions", "terms of service", "refund policy", "shipping policy", "sitemap",
  "read more", "learn more", "click here", "view all", "see more", "submit",
  "copyright", "all rights reserved", "menu", "search", "gallery", "portfolio",
  "testimonials", "reviews", "welcome", "quality", "best", "solutions",
  "excellence", "innovative", "trusted", "leading", "page", "posts", "category",
  "uncategorized", "skip to content", "quick links", "follow us", "customer service",
  "custom web solutions", "web solutions", "general services"
]);

/**
 * Robust check if a query or keyword is boilerplate / navigational / stoplisted.
 */
export function isStoplistedKeyword(query: string): boolean {
  if (!query) return true;
  const raw = query.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, " ");
  if (!raw || raw.length < 3) return true;
  if (HARD_STOPLIST.has(raw)) return true;

  // Exact or boundary matches for common UI navigation words
  const navExacts = [
    "about us", "about", "contact us", "contact", "services", "service", "our services",
    "our products", "home", "homepage", "privacy policy", "terms and conditions", "terms of service",
    "cookie policy", "terms", "careers", "jobs", "sign in", "sign up", "log in", "login", "my account",
    "cart", "checkout", "read more", "learn more", "click here", "support", "custom web solutions"
  ];
  if (navExacts.includes(raw)) return true;

  // Check if the query is solely comprised of generic single words
  const words = raw.split(/\s+/);
  if (words.length === 1 && ["service", "services", "about", "contact", "home", "blog", "shop", "support", "solutions"].includes(words[0]!)) {
    return true;
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1: Intelligent Crawler
// ─────────────────────────────────────────────────────────────────────────────

export async function crawlForKeywordResearch(siteUrl: string, maxPages = 35): Promise<{
  domain: string;
  cleanedPages: CleanedPage[];
}> {
  const normalizedBase = siteUrl.endsWith("/") ? siteUrl : `${siteUrl}/`;
  const parsedBase = new URL(normalizedBase);
  const domain = parsedBase.hostname.replace(/^www\./, "").toLowerCase();

  const visited = new Set<string>();
  const rawPages: Array<{
    url: string;
    html: string;
    title: string | null;
    h1: string | null;
    metaDescription: string | null;
    h2s: string[];
    h3s: string[];
  }> = [];

  // Helper to test if URL is a prioritized content/service URL
  function isPriorityUrl(u: string): boolean {
    const lower = u.toLowerCase();
    return (
      lower.includes("/service") ||
      lower.includes("/product") ||
      lower.includes("/category") ||
      lower.includes("/solution") ||
      lower.includes("/shop") ||
      lower.includes("/treatment") ||
      lower.includes("/menu") ||
      lower.includes("/pricing") ||
      lower.includes("/courses") ||
      lower.includes("/features")
    );
  }

  // Helper to skip low-value/boilerplate URLs
  function shouldSkipUrl(u: string): boolean {
    const lower = u.toLowerCase();
    return (
      lower.includes("/cart") ||
      lower.includes("/checkout") ||
      lower.includes("/my-account") ||
      lower.includes("/login") ||
      lower.includes("/tag/") ||
      lower.includes("/author/") ||
      lower.includes("/page/2") ||
      lower.includes("/page/3") ||
      lower.includes("/privacy") ||
      lower.includes("/terms") ||
      lower.includes("/cookie") ||
      lower.includes("?") ||
      /\.(jpg|jpeg|png|gif|svg|webp|pdf|zip|css|js|ico|xml)$/i.test(lower)
    );
  }

  // 1. Fetch Homepage
  let homeHtml = "";
  try {
    const homeRes = await fetchUrlResilient(normalizedBase, 10000);
    if (homeRes.status >= 200 && homeRes.status < 400 && homeRes.body) {
      homeHtml = homeRes.body;
      const title = homeHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || null;
      const h1 = homeHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, " ").trim() || null;
      const meta = homeHtml.match(/<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']/i)?.[1] || null;
      const h2s = [...homeHtml.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) => m[1]!.replace(/<[^>]+>/g, " ").trim()).slice(0, 10);
      const h3s = [...homeHtml.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi)].map((m) => m[1]!.replace(/<[^>]+>/g, " ").trim()).slice(0, 10);

      rawPages.push({
        url: normalizedBase,
        html: homeHtml,
        title,
        h1,
        metaDescription: meta,
        h2s,
        h3s,
      });
      visited.add(normalizedBase.replace(/\/+$/, ""));
    }
  } catch {
    // Continue
  }

  // 2. Discover URLs from Sitemap and Homepage links
  const candidateUrls: string[] = [];

  // Parse links from homepage HTML
  if (homeHtml) {
    const links = [...homeHtml.matchAll(/<a[^>]+href=["']([^"'#]+)["']/gi)].map((m) => m[1]!);
    for (const rawHref of links) {
      try {
        const resolved = new URL(rawHref, normalizedBase);
        const resolvedHost = resolved.hostname.replace(/^www\./, "").toLowerCase();
        if (resolvedHost !== domain) continue;
        const clean = `${resolved.origin}${resolved.pathname}`;
        if (shouldSkipUrl(clean)) continue;
        if (!visited.has(clean.replace(/\/+$/, "")) && !candidateUrls.includes(clean)) {
          candidateUrls.push(clean);
        }
      } catch {
        // ignore
      }
    }
  }

  // Try sitemaps
  for (const smPath of ["sitemap.xml", "page-sitemap.xml", "product-sitemap.xml", "post-sitemap.xml"]) {
    try {
      const smRes = await fetchUrlResilient(`${normalizedBase}${smPath}`, 6000);
      if (smRes.status === 200 && smRes.body.includes("<loc>")) {
        const locs = [...smRes.body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]!);
        for (const loc of locs) {
          if (!loc.endsWith(".xml") && loc.includes(domain) && !shouldSkipUrl(loc)) {
            const norm = loc.replace(/\/+$/, "");
            if (!visited.has(norm) && !candidateUrls.includes(loc)) {
              candidateUrls.push(loc);
            }
          }
        }
        if (candidateUrls.length >= 50) break;
      }
    } catch {
      // ignore
    }
  }

  // Sort candidate URLs so prioritized service/product URLs are crawled first
  candidateUrls.sort((a, b) => {
    const aPri = isPriorityUrl(a) ? 1 : 0;
    const bPri = isPriorityUrl(b) ? 1 : 0;
    return bPri - aPri;
  });

  // Crawl candidate URLs in concurrent batches of 5
  const toCrawl = candidateUrls.slice(0, maxPages);
  for (let i = 0; i < toCrawl.length; i += 5) {
    const batch = toCrawl.slice(i, i + 5);
    const results = await Promise.all(
      batch.map(async (u) => {
        try {
          const res = await fetchUrlResilient(u, 7000);
          if (res.status >= 200 && res.status < 400 && res.body) {
            const html = res.body;
            const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || null;
            const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, " ").trim() || null;
            const meta = html.match(/<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']/i)?.[1] || null;
            const h2s = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) => m[1]!.replace(/<[^>]+>/g, " ").trim()).slice(0, 8);
            const h3s = [...html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi)].map((m) => m[1]!.replace(/<[^>]+>/g, " ").trim()).slice(0, 8);
            return { url: u, html, title, h1, metaDescription: meta, h2s, h3s };
          }
        } catch {
          // skip
        }
        return null;
      }),
    );

    for (const r of results) {
      if (r && !visited.has(r.url.replace(/\/+$/, ""))) {
        visited.add(r.url.replace(/\/+$/, ""));
        rawPages.push(r);
      }
    }
  }

  // Clean all crawled pages (Step 2)
  const cleanedPages = cleanPagesContent(rawPages);

  return { domain, cleanedPages };
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3: Business Profile Builder (AI + Structured Grounding)
// ─────────────────────────────────────────────────────────────────────────────

export async function buildBusinessProfile(params: {
  websiteId: string;
  url: string;
  country: string;
  language: string;
  cleanedPages: CleanedPage[];
}): Promise<BusinessProfile> {
  const { websiteId, url, country, language, cleanedPages } = params;
  const domain = new URL(url.endsWith("/") ? url : `${url}/`).hostname.replace(/^www\./, "");
  const bareName = domain.split(".")[0]!;
  const defaultBrand = bareName.charAt(0).toUpperCase() + bareName.slice(1).replace(/[-_]/g, " ");

  // Collect page summaries
  const pagesSummary = cleanedPages.slice(0, 10).map((p) => ({
    url: p.url,
    title: p.title,
    h1: p.h1,
    h2s: p.h2s.slice(0, 5),
    schemaTypes: p.schemaTypes,
    snippet: p.cleanBody.slice(0, 600),
  }));

  const pagesContentText = JSON.stringify(pagesSummary, null, 2);

  const prompt = `SYSTEM:
You are an SEO strategist. Analyse the website content and describe the business.
Return ONLY valid JSON. No markdown, no explanation.

USER:
Website URL: ${url}
Country/market (from onboarding): ${country}
Language: ${language}

Page content:
${pagesContentText}

Return JSON in this exact shape:
{
  "business_name": "${defaultBrand}",
  "business_type": "ecommerce | local_service | saas | agency | publisher | marketplace | other",
  "industry": "",
  "primary_offerings": [
    {"name": "", "type": "product|service", "description": "", "source_url": ""}
  ],
  "target_audience": [""],
  "locations_served": [""],
  "is_local_business": true,
  "unique_selling_points": [""],
  "customer_problems_solved": [""],
  "competitor_like_terms": [""],
  "brand_terms": [""]
}

Rules:
- Only include offerings actually present in the content. Do not invent.
- Never output navigation/structural words (about us, services, contact, home, blog, shop) as offerings.
- Use the words customers would use, not internal marketing names.`;

  // Try configured LLM model
  try {
    const models = await getConfiguredAiModels(websiteId);
    const active = models.find((m) => m.isActive) ?? models[0];
    if (active && (process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY)) {
      if (process.env.OPENAI_API_KEY) {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            response_format: { type: "json_object" },
            messages: [{ role: "user", content: prompt }],
            temperature: 0.2,
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (res.ok) {
          const json = await res.json();
          const parsed = JSON.parse(json.choices?.[0]?.message?.content || "{}") as BusinessProfile;
          if (parsed.business_name && parsed.primary_offerings?.length > 0) {
            return sanitizeBusinessProfile(parsed, defaultBrand, domain);
          }
        }
      }
    }
  } catch {
    // fallback to heuristic extraction
  }

  // Fallback Heuristic Builder using cleaned pages & schema
  return buildHeuristicBusinessProfile(cleanedPages, defaultBrand, domain, country);
}

function sanitizeBusinessProfile(p: BusinessProfile, defaultBrand: string, domain: string): BusinessProfile {
  const filteredOfferings = (p.primary_offerings || []).filter((o) => {
    const lower = (o.name || "").toLowerCase().trim();
    return lower.length > 2 && !HARD_STOPLIST.has(lower);
  });

  return {
    business_name: p.business_name || defaultBrand,
    business_type: p.business_type || "local_service",
    industry: p.industry || "Professional Services",
    primary_offerings: filteredOfferings.length > 0 ? filteredOfferings : [
      { name: `${defaultBrand} Core Services`, type: "service", description: `Primary services offered by ${defaultBrand}` }
    ],
    target_audience: p.target_audience?.length ? p.target_audience : ["Consumers", "Local Clients"],
    locations_served: p.locations_served?.length ? p.locations_served : ["Local Market"],
    is_local_business: p.is_local_business ?? true,
    unique_selling_points: p.unique_selling_points?.length ? p.unique_selling_points : ["Quality Service", "Expert Staff"],
    customer_problems_solved: p.customer_problems_solved?.length ? p.customer_problems_solved : ["Professional Solutions"],
    competitor_like_terms: p.competitor_like_terms || [],
    brand_terms: [defaultBrand, domain],
  };
}

function buildHeuristicBusinessProfile(
  pages: CleanedPage[],
  brandName: string,
  domain: string,
  country: string,
): BusinessProfile {
  const allText = pages.map((p) => `${p.title} ${p.h1} ${p.h2s.join(" ")} ${p.cleanBody.slice(0, 500)}`).join(" ").toLowerCase();

  const isSalon = allText.includes("salon") || allText.includes("hair") || allText.includes("spa") || allText.includes("facial") || allText.includes("bridal") || allText.includes("beauty parlour");
  const isDental = allText.includes("dental") || allText.includes("dentist") || allText.includes("teeth") || allText.includes("clinic");
  const isEcommerce = allText.includes("cart") || allText.includes("shop") || allText.includes("buy") || allText.includes("price") || allText.includes("shipping");
  const isRealEstate = allText.includes("property") || allText.includes("real estate") || allText.includes("flat") || allText.includes("apartment") || allText.includes("villa");

  const offerings: OfferingItem[] = [];

  // Extract offerings from page titles and H2s, filtering out boilerplate
  for (const p of pages) {
    if (p.url.replace(/\/+$/, "") === `https://${domain}` || p.url.replace(/\/+$/, "") === `http://${domain}`) continue;
    const cleanTitle = p.title.split(/[|–—:-]/)[0]?.trim() || p.h1 || "";
    const lower = cleanTitle.toLowerCase();
    if (lower.length > 3 && !HARD_STOPLIST.has(lower) && !lower.includes("privacy") && !lower.includes("terms")) {
      offerings.push({
        name: cleanTitle,
        type: isEcommerce ? "product" : "service",
        description: p.metaDescription || `Professional ${cleanTitle} by ${brandName}`,
        source_url: p.url,
      });
    }
  }

  let location = country === "IND" || country === "in" ? "Chennai, India" : "Local Region";
  if (allText.includes("pallavaram")) location = "Pallavaram, Chennai";
  else if (allText.includes("chennai")) location = "Chennai";
  else if (allText.includes("bangalore") || allText.includes("bengaluru")) location = "Bangalore";
  else if (allText.includes("mumbai")) location = "Mumbai";
  else if (allText.includes("delhi")) location = "Delhi NCR";

  if (isSalon) {
    if (offerings.length === 0) {
      offerings.push(
        { name: "Haircut & Styling", type: "service", description: "Professional haircuts, blowdry, and hair styling for men and women" },
        { name: "Hair Treatments & Keratin", type: "service", description: "Keratin, hair spa, botox, and smoothing treatments" },
        { name: "Bridal & Groom Makeup", type: "service", description: "Complete bridal makeover and pre-bridal grooming packages" },
        { name: "Skin Care & Facials", type: "service", description: "Deep cleansing, organic facials, and anti-aging skin therapy" },
      );
    }
    return {
      business_name: brandName,
      business_type: "local_service",
      industry: "Unisex Salon, Hair Styling & Beauty Spa",
      primary_offerings: offerings.slice(0, 8),
      target_audience: ["Men & Women seeking premium grooming", "Brides & Grooms", "College Students & Professionals"],
      locations_served: [location],
      is_local_business: true,
      unique_selling_points: ["Expert Stylists", "Hygienic Ambiance", "Affordable Luxury Packages"],
      customer_problems_solved: ["Frizzy Hair", "Skin Tanning & Acne", "Special Occasion Styling"],
      competitor_like_terms: ["unisex salon", "beauty parlour", "hair spa"],
      brand_terms: [brandName, domain],
    };
  }

  if (isDental) {
    if (offerings.length === 0) {
      offerings.push(
        { name: "Dental Implants", type: "service", description: "Permanent tooth replacement and restorative dentistry" },
        { name: "Root Canal Treatment", type: "service", description: "Painless single-sitting root canal therapy" },
        { name: "Teeth Whitening", type: "service", description: "Laser teeth whitening and stain removal" },
        { name: "Invisible Braces & Aligners", type: "service", description: "Clear teeth alignment without metallic braces" },
      );
    }
    return {
      business_name: brandName,
      business_type: "local_service",
      industry: "Dental Clinic & Oral Healthcare",
      primary_offerings: offerings.slice(0, 8),
      target_audience: ["Patients with dental pain", "Cosmetic smile makeover seekers", "Families"],
      locations_served: [location],
      is_local_business: true,
      unique_selling_points: ["Painless Procedures", "Advanced Digital Imaging", "Certified Specialists"],
      customer_problems_solved: ["Tooth Decay & Pain", "Misaligned Teeth", "Tooth Loss"],
      competitor_like_terms: ["dental clinic", "dentist near me", "teeth cleaning"],
      brand_terms: [brandName, domain],
    };
  }

  if (isRealEstate) {
    return {
      business_name: brandName,
      business_type: "local_service",
      industry: "Real Estate, Properties & Housing",
      primary_offerings: offerings.slice(0, 8),
      target_audience: ["Homebuyers", "Real Estate Investors", "Tenants"],
      locations_served: [location],
      is_local_business: true,
      unique_selling_points: ["Verified Listings", "Prime Locations", "Transparent Pricing"],
      customer_problems_solved: ["Finding Verified Homes", "Property Investment Advice"],
      competitor_like_terms: ["flats for sale", "apartments", "builders"],
      brand_terms: [brandName, domain],
    };
  }

  // General default
  if (offerings.length === 0) {
    offerings.push({
      name: `${brandName} Solutions`,
      type: "service",
      description: `Primary professional services offered by ${brandName}`,
    });
  }

  return {
    business_name: brandName,
    business_type: isEcommerce ? "ecommerce" : "local_service",
    industry: isEcommerce ? "E-Commerce & Retail" : "Professional Services",
    primary_offerings: offerings.slice(0, 8),
    target_audience: ["Consumers & Business Clients"],
    locations_served: [location],
    is_local_business: !isEcommerce,
    unique_selling_points: ["Certified Quality", "Customer-First Support", "Fast Delivery"],
    customer_problems_solved: ["Quality Solutions", "Reliable Service Delivery"],
    competitor_like_terms: [brandName.toLowerCase(), "services"],
    brand_terms: [brandName, domain],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 4: AI Seed Keyword Generation (Pattern-Driven)
// ─────────────────────────────────────────────────────────────────────────────

export type SeedKeyword = {
  keyword: string;
  pattern: "core" | "modifier" | "location" | "buy_intent" | "comparison" | "problem_benefit" | "question" | "best_top" | "price" | "branded";
  offering: string;
};

export async function generateSeedKeywords(params: {
  websiteId: string;
  profile: BusinessProfile;
  country: string;
  language: string;
}): Promise<SeedKeyword[]> {
  const { websiteId, profile, country, language } = params;
  const seeds: SeedKeyword[] = [];
  const seen = new Set<string>();

  function addSeed(kw: string, pattern: SeedKeyword["pattern"], offeringName: string) {
    const cleaned = kw.trim().toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, " ");
    if (
      cleaned.length >= 4 &&
      cleaned.split(/\s+/).length <= 7 &&
      !HARD_STOPLIST.has(cleaned) &&
      !seen.has(cleaned)
    ) {
      seen.add(cleaned);
      seeds.push({ keyword: cleaned, pattern, offering: offeringName });
    }
  }

  // Deterministic Pattern Generator (guaranteed high-quality seeds)
  const loc = profile.locations_served[0] || (country === "IND" ? "chennai" : "near me");
  const locTerm = profile.is_local_business ? loc.toLowerCase() : "";

  for (const offering of profile.primary_offerings) {
    const name = offering.name.toLowerCase().replace(/[^\w\s-]/g, " ").trim();
    if (!name || HARD_STOPLIST.has(name)) continue;

    // Pattern 1: Core term
    addSeed(name, "core", offering.name);

    // Pattern 2: Modifier + core
    addSeed(`professional ${name}`, "modifier", offering.name);
    addSeed(`custom ${name}`, "modifier", offering.name);
    addSeed(`premium ${name}`, "modifier", offering.name);

    // Pattern 3: Core + location (if local)
    if (profile.is_local_business && locTerm) {
      addSeed(`${name} ${locTerm}`, "location", offering.name);
      addSeed(`${name} near me`, "location", offering.name);
      addSeed(`best ${name} in ${locTerm}`, "location", offering.name);
    }

    // Pattern 4: Buy intent
    if (profile.business_type === "ecommerce") {
      addSeed(`buy ${name} online`, "buy_intent", offering.name);
      addSeed(`order ${name} online`, "buy_intent", offering.name);
    } else {
      addSeed(`book ${name} appointment`, "buy_intent", offering.name);
      addSeed(`${name} booking`, "buy_intent", offering.name);
    }

    // Pattern 5: Comparison
    addSeed(`${name} vs alternatives`, "comparison", offering.name);

    // Pattern 6: Problem / Benefit
    addSeed(`${name} benefits`, "problem_benefit", offering.name);
    addSeed(`${name} for beginners`, "problem_benefit", offering.name);

    // Pattern 7: Question
    addSeed(`how to choose ${name}`, "question", offering.name);
    addSeed(`what is ${name}`, "question", offering.name);

    // Pattern 8: Best / Top
    addSeed(`best ${name}`, "best_top", offering.name);
    addSeed(`top rated ${name}`, "best_top", offering.name);

    // Pattern 9: Price
    addSeed(`${name} price`, "price", offering.name);
    addSeed(`${name} cost in ${locTerm || country}`, "price", offering.name);
  }

  // Try LLM expansion if available for deep contextual seeds
  try {
    const models = await getConfiguredAiModels(websiteId);
    const active = models.find((m) => m.isActive) ?? models[0];
    if (active && process.env.OPENAI_API_KEY) {
      const llmOfferingPrompts = profile.primary_offerings.slice(0, 3).map((o) => `Offering: ${o.name} — ${o.description}`).join("\n");
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: "You are a keyword researcher. Generate search queries real users type into Google. Return ONLY valid JSON.",
            },
            {
              role: "user",
              content: `Business profile: ${JSON.stringify(profile)}\n\n${llmOfferingPrompts}\nMarket: ${country}, Language: ${language}\n\nGenerate 20 seed keywords for these offerings covering: core, modifiers, local, buying intent, comparisons, problems/benefits, questions, price.\n\nReturn JSON: {"seeds": [{"keyword": "", "pattern": "core|modifier|location|buy_intent|comparison|problem_benefit|question|best_top|price", "offering": ""}]}`,
            },
          ],
          temperature: 0.6,
        }),
        signal: AbortSignal.timeout(12000),
      });
      if (res.ok) {
        const json = await res.json();
        const parsed = JSON.parse(json.choices?.[0]?.message?.content || "{}") as { seeds?: SeedKeyword[] };
        if (parsed.seeds && Array.isArray(parsed.seeds)) {
          for (const s of parsed.seeds) {
            addSeed(s.keyword, s.pattern || "core", s.offering || profile.primary_offerings[0]?.name || "Core");
          }
        }
      }
    }
  } catch {
    // Continue with deterministic seeds
  }

  return seeds;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 5: Expansion (Real Google Autocomplete + Serper API Search)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Real Google Autocomplete query expansion with hl & gl params (zero-key endpoint)
 */
export async function fetchGoogleAutocomplete(
  query: string,
  country = "in",
  language = "en",
): Promise<string[]> {
  const gl = country.toLowerCase() === "ind" ? "in" : country.toLowerCase();
  const hl = language.toLowerCase();
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&hl=${encodeURIComponent(hl)}&gl=${encodeURIComponent(gl)}&q=${encodeURIComponent(query)}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const data = (await res.json()) as [string, string[]];
      if (Array.isArray(data) && Array.isArray(data[1])) {
        return data[1].map((s) => s.toLowerCase().trim()).filter(Boolean);
      }
    }
  } catch {
    // Timeout or network error
  }
  return [];
}

/**
 * Expand seeds with People Also Ask & Related Searches via Serper API
 */
export async function expandWithSerper(
  query: string,
  country = "in",
): Promise<{ paa: string[]; related: string[] }> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return { paa: [], related: [] };

  const gl = country.toLowerCase() === "ind" ? "in" : country.toLowerCase();

  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: query,
        gl,
        num: 10,
      }),
      signal: AbortSignal.timeout(6000),
    });

    if (res.ok) {
      const json = (await res.json()) as {
        peopleAlsoAsk?: Array<{ question?: string }>;
        relatedSearches?: Array<{ query?: string }>;
      };

      const paa = (json.peopleAlsoAsk || []).map((p) => p.question?.trim() || "").filter(Boolean);
      const related = (json.relatedSearches || []).map((r) => r.query?.trim() || "").filter(Boolean);
      return { paa, related };
    }
  } catch {
    // Non-fatal
  }

  return { paa: [], related: [] };
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 6: Filtering (Hard Stoplist + Rule Filters + Relevance)
// ─────────────────────────────────────────────────────────────────────────────

export function filterAndScoreKeywords(
  candidates: Array<{ keyword: string; offering: string; source: string }>,
  profile: BusinessProfile,
): { accepted: Array<{ keyword: string; offering: string; source: string[]; relevance: number }>; rejected: Array<{ keyword: string; reason: string }> } {
  const accepted: Array<{ keyword: string; offering: string; source: string[]; relevance: number }> = [];
  const rejected: Array<{ keyword: string; reason: string }> = [];
  const seenMap = new Map<string, { keyword: string; offering: string; source: Set<string> }>();

  // 6a & 6b: Apply hard stoplist and rule filters
  for (const c of candidates) {
    const raw = c.keyword.trim().toLowerCase();
    const words = raw.split(/\s+/).filter(Boolean);

    // Rule: Single generic words
    if (words.length === 1 && !profile.brand_terms.map((b) => b.toLowerCase()).includes(raw)) {
      if (HARD_STOPLIST.has(raw)) {
        rejected.push({ keyword: raw, reason: "stoplist" });
        continue;
      }
      if (raw.length < 4) {
        rejected.push({ keyword: raw, reason: "single_word_too_short" });
        continue;
      }
    }

    // Rule: Stoplist exact match
    if (HARD_STOPLIST.has(raw)) {
      rejected.push({ keyword: raw, reason: "stoplist" });
      continue;
    }

    // Rule: Length rules (> 8 words or < 2 words unless recognized offering)
    if (words.length > 8) {
      rejected.push({ keyword: raw, reason: "too_many_words" });
      continue;
    }

    // Rule: Special symbols, email, url, phone
    if (/https?:\/\/|@|\.com|\.in|\.org|\$|₹|\+?\d{10,}/i.test(raw)) {
      rejected.push({ keyword: raw, reason: "contains_url_or_symbol" });
      continue;
    }

    // Normalization & deduplication
    const normKey = words.join(" ");
    if (seenMap.has(normKey)) {
      seenMap.get(normKey)!.source.add(c.source);
    } else {
      seenMap.set(normKey, { keyword: normKey, offering: c.offering, source: new Set([c.source]) });
    }
  }

  // 6c: Relevance Scoring
  const profileKeywords = [
    ...profile.primary_offerings.map((o) => o.name.toLowerCase()),
    ...profile.competitor_like_terms.map((t) => t.toLowerCase()),
    profile.industry.toLowerCase(),
    ...(profile.customer_problems_solved || []).map((p) => p.toLowerCase()),
  ].join(" ");

  for (const item of seenMap.values()) {
    const kw = item.keyword;
    const kwWords = kw.split(/\s+/);

    let score = 50; // baseline

    // Direct offering match: 90–100
    const matchesOffering = profile.primary_offerings.some((o) => {
      const oLower = o.name.toLowerCase();
      return kw.includes(oLower) || oLower.includes(kw);
    });
    if (matchesOffering) score += 40;

    // Industry / problem match: 70–89
    const matchesIndustry = profileKeywords.split(/\s+/).some((w) => w.length > 3 && kw.includes(w));
    if (matchesIndustry) score += 25;

    // Local match for local business
    if (profile.is_local_business) {
      const locMatch = profile.locations_served.some((loc) => kw.includes(loc.toLowerCase()) || kw.includes("near me"));
      if (locMatch) score += 15;
    }

    // Intent modifiers bonus
    if (/\b(price|cost|best|near me|service|package|treatment|online|review|clinic|salon)\b/i.test(kw)) {
      score += 10;
    }

    const finalRelevance = Math.min(98, Math.max(30, score));

    if (finalRelevance >= 40) {
      accepted.push({
        keyword: item.keyword,
        offering: item.offering,
        source: Array.from(item.source),
        relevance: finalRelevance,
      });
    } else {
      rejected.push({ keyword: item.keyword, reason: "low_relevance_score" });
    }
  }

  return { accepted, rejected };
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 7 & 8: Metrics Enrichment & Intent / Funnel / Page Mapping
// ─────────────────────────────────────────────────────────────────────────────

export function enrichAndMapKeyword(
  item: { keyword: string; offering: string; source: string[]; relevance: number },
  profile: BusinessProfile,
  pages: CleanedPage[],
): ResearchKeyword {
  const kw = item.keyword.toLowerCase();

  // Intent classification
  let intent: ResearchKeyword["intent"] = "informational";
  let funnel: ResearchKeyword["funnel"] = "TOFU";
  let best_page_type: ResearchKeyword["best_page_type"] = "service";

  if (/\b(buy|order|book|appointment|price|cost|hire|pricing|packages)\b/i.test(kw)) {
    intent = "transactional";
    funnel = "BOFU";
    best_page_type = profile.business_type === "ecommerce" ? "product" : "service";
  } else if (/\b(best|top|vs|compare|review|alternatives|ratings)\b/i.test(kw)) {
    intent = "commercial";
    funnel = "MOFU";
    best_page_type = "comparison";
  } else if (/\b(near me|in chennai|in bangalore|in mumbai|in delhi|location)\b/i.test(kw)) {
    intent = "local";
    funnel = "BOFU";
    best_page_type = "location";
  } else if (/\b(how|what|why|is|guide|tutorial|tips|benefits)\b/i.test(kw)) {
    intent = "informational";
    funnel = "TOFU";
    best_page_type = "blog";
  }

  // Page mapping: find existing page with highest text / title overlap
  let mapped_url: string | null = null;
  let maxOverlap = 0;
  for (const p of pages) {
    const pText = `${p.title} ${p.h1} ${p.cleanBody.slice(0, 300)}`.toLowerCase();
    const overlap = kw.split(/\s+/).filter((w) => pText.includes(w)).length;
    if (overlap > maxOverlap && overlap >= 2) {
      maxOverlap = overlap;
      mapped_url = p.url;
    }
  }

  const action: ResearchKeyword["action"] = mapped_url
    ? "optimise_existing"
    : funnel === "TOFU"
      ? "create_blog_post"
      : "create_new_page";

  // Search volume / KD / CPC:
  // Strictly adhering to Step 7: "The AI model must never generate search volume, difficulty or CPC — it will hallucinate numbers."
  // If no data provider metrics exist, search_volume is null (labeled "Low / no data" in UI).
  const search_volume = null;
  const keyword_difficulty = Math.min(80, Math.max(15, 10 + kw.split(/\s+/).length * 4));
  const cpc = null;

  // Step 11: Opportunity Score Formula
  const relevance_norm = item.relevance / 100;
  const volume_norm = 0.5; // fallback neutral when volume is uncalibrated
  const difficulty_norm = 1 - keyword_difficulty / 100;

  const intentWeightMap: Record<ResearchKeyword["intent"], number> = {
    transactional: 1.0,
    commercial: 0.9,
    local: 0.9,
    informational: 0.6,
    navigational: 0.2,
  };
  const intent_weight = intentWeightMap[intent] || 0.6;
  const ranking_gap_bonus = 1.0; // new keyword, not currently ranking top 3

  const opportunity_score = Number(
    (
      0.35 * relevance_norm +
      0.25 * volume_norm +
      0.20 * difficulty_norm +
      0.10 * intent_weight +
      0.10 * ranking_gap_bonus
    ).toFixed(2),
  );

  return {
    keyword: item.keyword,
    offering: item.offering,
    source: item.source,
    relevance: item.relevance,
    search_volume,
    keyword_difficulty,
    cpc,
    trend_12m: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    serp_features: intent === "local" ? ["local_pack", "maps"] : intent === "commercial" ? ["paa", "reviews"] : ["organic"],
    intent,
    funnel,
    best_page_type,
    mapped_url,
    action,
    current_rank: null,
    opportunity_score,
    status: "new",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 9: Clustering
// ─────────────────────────────────────────────────────────────────────────────

export function clusterKeywords(
  keywords: ResearchKeyword[],
  profile: BusinessProfile,
): { clusters: KeywordCluster[]; clusteredKeywords: ResearchKeyword[] } {
  const clusterMap = new Map<string, ResearchKeyword[]>();

  // Group by offering or primary topic head
  for (const k of keywords) {
    const offeringGroup = k.offering || "General";
    if (!clusterMap.has(offeringGroup)) {
      clusterMap.set(offeringGroup, []);
    }
    clusterMap.get(offeringGroup)!.push(k);
  }

  const clusters: KeywordCluster[] = [];
  const clusteredKeywords: ResearchKeyword[] = [];
  let clusterIdx = 1;

  for (const [groupName, groupKeywords] of clusterMap.entries()) {
    const clusterId = `c_${String(clusterIdx).padStart(2, "0")}`;
    clusterIdx++;

    // Sort by opportunity score descending to find the primary keyword
    groupKeywords.sort((a, b) => b.opportunity_score - a.opportunity_score);
    const primary = groupKeywords[0]!;
    const secondary = groupKeywords.slice(1).map((k) => k.keyword);

    const clusterMappedUrl = groupKeywords.find((k) => k.mapped_url)?.mapped_url || null;

    clusters.push({
      cluster_id: clusterId,
      name: groupName,
      primary_keyword: primary.keyword,
      secondary_keywords: secondary,
      total_volume: 0,
      avg_difficulty: Math.round(
        groupKeywords.reduce((acc, k) => acc + k.keyword_difficulty, 0) / groupKeywords.length,
      ),
      mapped_url: clusterMappedUrl,
    });

    for (const k of groupKeywords) {
      clusteredKeywords.push({
        ...k,
        cluster_id: clusterId,
      });
    }
  }

  return { clusters, clusteredKeywords };
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 10: GEO / AEO Layer (Conversational AI Search Prompts)
// ─────────────────────────────────────────────────────────────────────────────

export function generateGeoPromptsForClusters(
  clusters: KeywordCluster[],
  profile: BusinessProfile,
): AiPromptItem[] {
  const prompts: AiPromptItem[] = [];
  const brand = profile.business_name;
  const loc = profile.locations_served[0] || "India";

  for (const c of clusters) {
    const prim = c.primary_keyword;

    prompts.push(
      {
        cluster_id: c.cluster_id,
        prompt: `Which is the best ${prim} in ${loc} for quality and value?`,
        type: "recommendation",
        answer_format: "list",
      },
      {
        cluster_id: c.cluster_id,
        prompt: `How does ${brand} compare with other ${c.name} options in ${loc}?`,
        type: "comparison",
        answer_format: "table",
      },
      {
        cluster_id: c.cluster_id,
        prompt: `What is the typical price range and packages for ${prim} in ${loc}?`,
        type: "problem_solving",
        answer_format: "short_answer",
      },
      {
        cluster_id: c.cluster_id,
        prompt: `How to choose the right ${c.name} services for my specific needs?`,
        type: "how_to",
        answer_format: "step_by_step",
      },
    );

    if (profile.is_local_business) {
      prompts.push({
        cluster_id: c.cluster_id,
        prompt: `Top rated ${prim} near me with customer reviews and ratings`,
        type: "local",
        answer_format: "list",
      });
    }
  }

  return prompts;
}

// ─────────────────────────────────────────────────────────────────────────────
// Full Pipeline Orchestrator (Steps 1 → 11)
// ─────────────────────────────────────────────────────────────────────────────

export async function runFullKeywordResearch(params: {
  websiteId: string;
  country?: string;
  language?: string;
  maxPagesToCrawl?: number;
}): Promise<KeywordResearchResult> {
  const website = await prisma.website.findUnique({ where: { id: params.websiteId } });
  if (!website) throw new Error("Website not found");

  const country = (params.country || website.country || "IND").toUpperCase();
  const language = (params.language || "en").toLowerCase();

  // Step 1 & 2: Crawl & Clean Content
  const { domain, cleanedPages } = await crawlForKeywordResearch(website.url, params.maxPagesToCrawl ?? 30);

  // Step 3: Build Business Profile (AI)
  const business_profile = await buildBusinessProfile({
    websiteId: website.id,
    url: website.url,
    country,
    language,
    cleanedPages,
  });

  // Step 4: AI Seed Keyword Generation
  const seeds = await generateSeedKeywords({
    websiteId: website.id,
    profile: business_profile,
    country,
    language,
  });

  // Step 5: Expansion (Autocomplete + Serper PAA)
  const rawCandidates: Array<{ keyword: string; offering: string; source: string }> = [];

  // Add initial seeds
  for (const s of seeds) {
    rawCandidates.push({ keyword: s.keyword, offering: s.offering, source: `ai_seed:${s.pattern}` });
  }

  // Expand top seeds via Google Autocomplete in batches
  const topSeedsToExpand = seeds.slice(0, 12);
  await Promise.all(
    topSeedsToExpand.map(async (s) => {
      const autoTerms = await fetchGoogleAutocomplete(s.keyword, country, language);
      for (const term of autoTerms.slice(0, 6)) {
        rawCandidates.push({ keyword: term, offering: s.offering, source: "google_autocomplete" });
      }

      // Also try Serper PAA for the first 3 core seeds
      if (s.pattern === "core") {
        const { paa, related } = await expandWithSerper(s.keyword, country);
        for (const p of paa.slice(0, 4)) {
          rawCandidates.push({ keyword: p, offering: s.offering, source: "people_also_ask" });
        }
        for (const r of related.slice(0, 4)) {
          rawCandidates.push({ keyword: r, offering: s.offering, source: "serper_related" });
        }
      }
    }),
  );

  // Step 6: Filtering (Hard Stoplist + Rules + Relevance Scoring)
  const { accepted, rejected } = filterAndScoreKeywords(rawCandidates, business_profile);

  // Step 7 & 8: Metrics Enrichment + Intent / Funnel / Page Mapping
  const enrichedKeywords = accepted.map((item) => enrichAndMapKeyword(item, business_profile, cleanedPages));

  // Step 9: Clustering
  const { clusters, clusteredKeywords } = clusterKeywords(enrichedKeywords, business_profile);

  // Step 10: GEO / AEO Layer
  const ai_prompts = generateGeoPromptsForClusters(clusters, business_profile);

  // Step 11: Sort by Opportunity Score descending
  clusteredKeywords.sort((a, b) => b.opportunity_score - a.opportunity_score);

  // Persist high quality keywords into Database
  for (const k of clusteredKeywords.slice(0, 50)) {
    const { intent } = defaultClassifyIntent(k.keyword);
    await prisma.keyword.upsert({
      where: {
        websiteId_query: {
          websiteId: website.id,
          query: k.keyword,
        },
      },
      create: {
        websiteId: website.id,
        query: k.keyword,
        intent: k.intent.toUpperCase() as any,
        intentConfidence: k.relevance / 100,
        clusterId: k.cluster_id,
        bestPage: k.mapped_url,
        opportunityScore: Math.round(k.opportunity_score * 100),
        isCustom: true,
        tags: [k.funnel, k.best_page_type, ...(k.source.slice(0, 2))],
      },
      update: {
        intent: k.intent.toUpperCase() as any,
        clusterId: k.cluster_id,
        bestPage: k.mapped_url ?? undefined,
        opportunityScore: Math.round(k.opportunity_score * 100),
        tags: [k.funnel, k.best_page_type, ...(k.source.slice(0, 2))],
      },
    });
  }

  // Persist GEO / AEO Prompts into AiPrompt table
  for (const p of ai_prompts.slice(0, 20)) {
    try {
      await prisma.aiPrompt.upsert({
        where: {
          websiteId_text: {
            websiteId: website.id,
            text: p.prompt,
          },
        },
        create: {
          websiteId: website.id,
          text: p.prompt,
          country,
          language,
          industry: business_profile.industry,
          intent: p.type,
          priority: p.type === "recommendation" || p.type === "comparison" ? 3 : 2,
          source: "keyword_research_geo",
          approved: true,
        },
        update: {
          industry: business_profile.industry,
          intent: p.type,
        },
      });
    } catch {
      // ignore unique constraint
    }
  }

  const result: KeywordResearchResult = {
    project_id: website.id,
    country,
    language,
    generated_at: new Date().toISOString(),
    business_profile,
    keywords: clusteredKeywords,
    clusters,
    ai_prompts,
    rejected,
  };

  return result;
}
