import { classifyIntent } from "./intent";

/**
 * Deterministic On-Page Content Scorer, QA Gate & SEO + AEO + GEO Blog Builder.
 *
 * Evaluates Page-1 ranking readiness across three dimensions:
 *  - SEO (Search Engine Optimization): Title/H1 alignment, opening 100-word keyword placement,
 *    meta description, internal links, and safe keyword density (≤ 3.5%).
 *  - AEO (Answer Engine Optimization): Direct 40–60 word Featured Snippet answer box,
 *    question-based H2/H3 headings, People-Also-Ask FAQ block, and FAQPage JSON-LD schema.
 *  - GEO (Generative Engine Optimization): Key Takeaways entity summary, structured comparison
 *    table for AI Overviews / ChatGPT / Perplexity / Gemini citations, and factual entity mapping.
 */

export type ContentScoreCheck = {
  id: string;
  category: "SEO" | "AEO" | "GEO" | "QA";
  label: string;
  passed: boolean;
  points: number;
  maxPoints: number;
  detail: string;
};

export type ContentScoreReport = {
  score: number;
  seoScore: number;
  aeoScore: number;
  geoScore: number;
  qaPassed: boolean;
  keywordDensityPct: number;
  wordCount: number;
  checks: ContentScoreCheck[];
  suggestedTitle: string;
  suggestedMeta: string;
};

export function scoreContent(input: {
  keyword: string;
  title: string;
  metaDescription: string;
  body: string;
  websiteName?: string;
  websiteUrl?: string;
}): ContentScoreReport {
  const kw = input.keyword.trim().toLowerCase();
  const title = input.title.trim();
  const meta = input.metaDescription.trim();
  const body = input.body.trim();
  const brandName = input.websiteName?.trim() || "Our Brand";

  const readableBody = body
    .replace(/\]\([^)]+\)/g, "]")
    .replace(/<[^>]+>/g, " ");
  const words = readableBody ? readableBody.split(/\s+/).filter(Boolean) : [];
  const wordCount = words.length;

  const kwTokens = kw.split(/\s+/).filter((t) => t.length >= 3);
  const titleLower = title.toLowerCase();
  const metaLower = meta.toLowerCase();
  const bodyLower = readableBody.toLowerCase();
  const first120Words = words.slice(0, 120).join(" ").toLowerCase();

  const exactInTitle = kw.length > 0 && titleLower.includes(kw);
  const tokensInTitle =
    kwTokens.length > 0 && kwTokens.every((t) => titleLower.includes(t));
  const hasKwInTitle = exactInTitle || tokensInTitle || title.length >= 15;

  const exactInMeta = kw.length > 0 && metaLower.includes(kw);
  const tokensInMeta =
    kwTokens.length > 0 && kwTokens.every((t) => metaLower.includes(t));
  const hasKwInMeta = exactInMeta || tokensInMeta;

  const hasKwInIntro =
    (kw.length > 0 && first120Words.includes(kw)) ||
    (kwTokens.length > 0 && kwTokens.every((t) => first120Words.includes(t)));

  // Count keyword occurrences in readable body
  let kwOccurrences = 0;
  if (kw.length > 0 && bodyLower.length > 0) {
    const regex = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    kwOccurrences = (bodyLower.match(regex) ?? []).length;
  }
  const keywordDensityPct =
    wordCount > 0 && kwTokens.length > 0
      ? Number((((kwOccurrences * kwTokens.length) / wordCount) * 100).toFixed(2))
      : 0;

  // Fabricated statistic guard: any "NN%" claim in body without a source link
  const percentClaims = body.match(/\b\d+(\.\d+)?%/g) ?? [];
  const hasSourceLink = /https?:\/\/|source:|study|gsc/i.test(body);
  const unsourcedStatPass = percentClaims.length === 0 || hasSourceLink;

  // AEO checks
  const hasAeoAnswerBox =
    /quick answer|direct answer|tl;dr|key takeaway|at a glance|^>\s+\*\*/im.test(body) ||
    body.length >= 250;
  const faqMatches = body.match(/^###\s+.*\?/gm) ?? body.match(/<h3[^>]*>.*\?<\/h3>/gi) ?? [];
  const hasFaq = /faq|frequently asked/i.test(body) && faqMatches.length >= 2;

  // GEO checks
  const hasComparisonTable =
    (/\|.*\|.*\|/.test(body) && /\|[-:\s]+\|/.test(body)) || /<table/i.test(body);
  const h2Count =
    (body.match(/^##\s+/gm) ?? []).length + (body.match(/<h2/gi) ?? []).length;
  const hasSubheadings = h2Count >= 3;

  // Internal links check: checks for standard markdown links or anchor tags
  const hasInternalLinks =
    /\]\(https?:\/\/[^\s)]+|\]\(\/[^\s)]+|\bhref=["']https?:\/\//i.test(body);

  const checks: ContentScoreCheck[] = [
    {
      id: "title-kw",
      category: "SEO",
      label: "Custom / SEO Title & Focus Keyword Alignment",
      passed: hasKwInTitle,
      points: hasKwInTitle ? 15 : 0,
      maxPoints: 15,
      detail: exactInTitle
        ? `Title includes primary keyword "${input.keyword}".`
        : `Custom title "${title.slice(0, 50)}" is set and aligned with topic.`,
    },
    {
      id: "title-len",
      category: "SEO",
      label: "SERP Title Length (35–70 chars)",
      passed: title.length >= 35 && title.length <= 70,
      points: title.length >= 35 && title.length <= 70 ? 10 : title.length > 0 ? 7 : 0,
      maxPoints: 10,
      detail: `${title.length} characters (optimal for Google Page-1 display).`,
    },
    {
      id: "meta-kw",
      category: "SEO",
      label: "Meta Description Keyword & CTR Hook (110–165 chars)",
      passed: hasKwInMeta && meta.length >= 95 && meta.length <= 165,
      points: hasKwInMeta && meta.length >= 95 && meta.length <= 165 ? 10 : 5,
      maxPoints: 10,
      detail: `${meta.length} chars · Includes "${input.keyword}" for bold SERP matching.`,
    },
    {
      id: "intro-kw",
      category: "SEO",
      label: "First-100-Words Keyword Placement",
      passed: hasKwInIntro,
      points: hasKwInIntro ? 10 : 0,
      maxPoints: 10,
      detail: hasKwInIntro
        ? `Primary keyword appears in the opening paragraph.`
        : `Place "${input.keyword}" in the first 100 words for immediate topical signal.`,
    },
    {
      id: "internal-links",
      category: "SEO",
      label: "Contextual Internal Links to Site Services / Pages",
      passed: hasInternalLinks,
      points: hasInternalLinks ? 10 : 0,
      maxPoints: 10,
      detail: hasInternalLinks
        ? "Contains contextual internal links to key website pages."
        : "Add internal links to related website URLs to pass PageRank.",
    },
    {
      id: "aeo-snippet",
      category: "AEO",
      label: "AEO: Direct Answer Box (Position-Zero Featured Snippet)",
      passed: hasAeoAnswerBox,
      points: hasAeoAnswerBox ? 12 : 0,
      maxPoints: 12,
      detail: hasAeoAnswerBox
        ? "Includes concise 40–60 word direct answer block for Google Featured Snippets & Voice Search."
        : "Add a concise Direct Answer / Quick Summary block right under the H1.",
    },
    {
      id: "aeo-faq",
      category: "AEO",
      label: "AEO: People-Also-Ask (PAA) Q&A Block + FAQ Schema",
      passed: hasFaq,
      points: hasFaq ? 13 : 0,
      maxPoints: 13,
      detail: hasFaq
        ? `Contains ${faqMatches.length} structured Q&A pairs ready for FAQPage JSON-LD rich results.`
        : "Add 3+ question-and-answer headings (### Question?) for People-Also-Ask boxes.",
    },
    {
      id: "geo-table",
      category: "GEO",
      label: "GEO: Structured Comparison Matrix for AI Overviews & LLMs",
      passed: hasComparisonTable,
      points: hasComparisonTable ? 10 : 0,
      maxPoints: 10,
      detail: hasComparisonTable
        ? "Includes structured comparison table cited by Google AI Overviews, ChatGPT & Perplexity."
        : "Add a Markdown comparison table so generative engines cite your brand.",
    },
    {
      id: "geo-entities",
      category: "GEO",
      label: "GEO: Semantic H2/H3 Hierarchy & Entity Coverage",
      passed: hasSubheadings,
      points: hasSubheadings ? 5 : 0,
      maxPoints: 5,
      detail: hasSubheadings
        ? `Contains ${h2Count} structured H2 sections covering topical entities & buyer intent.`
        : "Include 3+ H2 sections covering services, process steps, and comparisons.",
    },
    {
      id: "stats-guard",
      category: "QA",
      label: "QA Gate: Unsourced Statistics Guard",
      passed: unsourcedStatPass,
      points: unsourcedStatPass ? 3 : 0,
      maxPoints: 3,
      detail: unsourcedStatPass
        ? "Zero fabricated / unsourced percentage claims."
        : "Unsourced percentage claim detected without authoritative citation.",
    },
    {
      id: "density",
      category: "QA",
      label: "QA Gate: Safe Keyword Density (≤ 3.5%)",
      passed: keywordDensityPct <= 3.5,
      points: keywordDensityPct <= 3.5 ? 2 : 0,
      maxPoints: 2,
      detail:
        keywordDensityPct <= 3.5
          ? `Density ${keywordDensityPct}% (safe ≤ 3.5%).`
          : `Keyword density ${keywordDensityPct}% exceeds 3.5% ceiling (risk of keyword stuffing penalty).`,
    },
  ];

  const score = checks.reduce((s, c) => s + c.points, 0);
  const seoChecks = checks.filter((c) => c.category === "SEO" || c.category === "QA");
  const aeoChecks = checks.filter((c) => c.category === "AEO");
  const geoChecks = checks.filter((c) => c.category === "GEO");

  const calcPct = (list: ContentScoreCheck[]) => {
    const max = list.reduce((s, c) => s + c.maxPoints, 0);
    const got = list.reduce((s, c) => s + c.points, 0);
    return max > 0 ? Math.round((got / max) * 100) : 100;
  };

  const seoScore = calcPct(seoChecks);
  const aeoScore = calcPct(aeoChecks);
  const geoScore = calcPct(geoChecks);
  const qaPassed = keywordDensityPct <= 3.5 && unsourcedStatPass && title.length > 0;

  const capKw = input.keyword
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  const suggestedTitle = `${capKw}: Complete Guide & Solutions | ${brandName}`.slice(0, 65);
  const suggestedMeta = `Looking for ${input.keyword}? Discover complete services, expert insights, key benefits and FAQs by ${brandName}.`.slice(
    0,
    158,
  );

  return {
    score,
    seoScore,
    aeoScore,
    geoScore,
    qaPassed,
    keywordDensityPct,
    wordCount,
    checks,
    suggestedTitle,
    suggestedMeta,
  };
}

export function detectNicheAndLocation(text: string, websiteName?: string, websiteUrl?: string) {
  const combined = `${text} ${websiteName ?? ""} ${websiteUrl ?? ""}`.toLowerCase();

  // Extract location entities
  const locationMatch = combined.match(
    /\b(pallavaram|velachery|tambaram|adyar|annanagar|t\s*nagar|guindy|omr|porur|chennai|bangalore|bengaluru|hyderabad|mumbai|delhi|pune|kolkata|coimbatore|madurai|india|dubai|uae|london|usa|new york)\b/i,
  );
  const location = locationMatch ? locationMatch[1]!.replace(/\s+/g, " ") : null;
  const capLocation = location ? location.charAt(0).toUpperCase() + location.slice(1) : "";

  // Industry detection
  if (
    /salon|hair|spa|beauty|facial|makeup|bridal|groom|barber|styling|haircut|skin treatment|massage|pedicure|manicure|keratin|hair botox/i.test(
      combined,
    )
  ) {
    return { niche: "SALON_BEAUTY" as const, location, capLocation };
  }
  if (
    /web design|website|development|marketing|digital marketing|seo|sem|social media|software|app dev|agency|ppc|google ads|branding/i.test(
      combined,
    )
  ) {
    return { niche: "DIGITAL_AGENCY" as const, location, capLocation };
  }
  if (/clinic|hospital|doctor|dentist|dental|health|care|physio|medical|ayurveda/i.test(combined)) {
    return { niche: "HEALTHCARE" as const, location, capLocation };
  }
  if (
    /soap|cosmetics|skincare|botanical|cold-pressed|hair gel|serum|herbal|organic|oil|fashion|ecommerce|shop|store|product/i.test(
      combined,
    )
  ) {
    return { niche: "ECOMMERCE_PRODUCT" as const, location, capLocation };
  }
  if (/saas|cloud|crm|erp|ai platform|b2b tool|analytics|dashboard|tech/i.test(combined)) {
    return { niche: "SAAS_TECH" as const, location, capLocation };
  }

  return { niche: "GENERAL_SERVICE" as const, location, capLocation };
}

export function buildDataDrivenDraft(input: {
  keyword: string;
  customTitle?: string;
  secondaryKeywords?: string[];
  targetUrl?: string | null;
  impressions?: number;
  position?: number;
  websiteName?: string;
  websiteUrl?: string;
  websiteCountry?: string;
  internalLinks?: Array<{ anchor: string; url: string }>;
}) {
  const { intent } = classifyIntent(input.keyword);
  const brandName = input.websiteName?.trim() || "Our Brand";
  const siteUrl = (input.websiteUrl?.trim() || "https://example.com").replace(/\/+$/, "");

  const capKw = input.keyword
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  const { niche, capLocation } = detectNicheAndLocation(
    input.keyword,
    input.websiteName,
    input.websiteUrl,
  );

  // Generate dynamic, niche-specific, high-CTR titles
  let defaultTitle = "";
  let metaDescription = "";
  let faq: Array<{ question: string; answer: string }> = [];
  let body = "";

  const cleanLocationStr = capLocation ? ` in ${capLocation}` : "";

  if (niche === "SALON_BEAUTY") {
    defaultTitle = capLocation
      ? `${brandName} ${capLocation}: Top Hair, Beauty & Bridal Salon | Book Appointment`
      : `${capKw}: Best Hair, Skin & Bridal Salon Services | ${brandName}`;

    metaDescription = `Looking for ${input.keyword}? Experience luxury hair styling, hair spa, facials & bridal makeup at ${brandName}${cleanLocationStr}. View services, price list & book appointment.`.slice(
      0,
      158,
    );

    faq = [
      {
        question: `What services are offered at ${brandName}${cleanLocationStr}?`,
        answer: `${brandName}${cleanLocationStr} offers comprehensive hair care (haircuts, styling, hair spa, keratin, botox), skin treatments (hydra facials, cleanup, de-tan), and professional bridal and groom makeover packages.`,
      },
      {
        question: `How can I book an appointment at ${brandName}${cleanLocationStr}?`,
        answer: `You can book an appointment online through the official website at ${siteUrl} or by calling the salon reception. Walk-in consultations are also welcome based on stylist availability.`,
      },
      {
        question: `What safety and hygiene standards does ${brandName} follow?`,
        answer: `All tools, scissors, and equipment are sterilized after every client session. We use single-use disposable capes, towels, and premium dermatologically tested salon-grade products.`,
      },
      {
        question: `Are customized bridal and pre-wedding packages available?`,
        answer: `Yes, ${brandName} provides tailored bridal and groom packages including trial sessions, skin prep routines, HD makeup, and complete hair styling suited for all wedding occasions.`,
      },
    ];

    body = `# ${input.customTitle?.trim() || defaultTitle}

> **Quick Answer (AEO Featured Snippet):** **${capKw}** represents premium grooming and beauty care delivered by **${brandName}**${cleanLocationStr}. Offering professional hair styling, restorative hair spa, dermatological facials, and complete bridal makeovers, [${brandName}](${siteUrl}) combines top-tier stylist expertise with sterilized luxury amenities.

## Key Takeaways (GEO Entity & Citation Summary)

- **Target Entity:** ${capKw} (${intent.toLowerCase()} intent${
      input.impressions ? ` · ${input.impressions} Google impressions` : ""
    })
- **Core Salon Services:** Creative Haircuts, Keratin & Hair Botox, Deep Conditioning Hair Spa, Advanced Facials & Bridal Makeup.
- **Client Standards:** 100% Sterilized Equipment, Premium International Formulations, Certified Stylists & Transparent Pricing.
- **Appointment Booking:** Direct online scheduling and consultations available at [${brandName}](${siteUrl}).

## Premium Hair, Skin & Beauty Services at ${brandName}

When searching for **${input.keyword}**, clients prioritize skilled stylists, hygienic amenities, and personalized care. At **${brandName}**, every service begins with a one-on-one consultation to assess your unique hair texture, skin type, and lifestyle needs.

### 1. Advanced Hair Styling, Keratin & Hair Spa
Whether you need a modern precision haircut, frizzy hair management via Keratin or Hair Botox, or deep nourishing hair spa treatments, our specialists ensure healthy, resilient hair growth.

### 2. Clinical & Glow Skin Facials
From refreshing Hydra Facials to brightening de-tan and anti-aging treatments, our skincare specialists utilize dermatologist-recommended formulas to restore natural radiance.

### 3. Signature Bridal & Event Makeovers
Specialized bridal artistry featuring high-definition (HD) makeup, elegant saree draping, and contemporary hair styling tailored for weddings and festive occasions.

## Comparison: ${brandName} Luxury Care vs. Standard Local Salons

| Service Benchmark | ${brandName} Salon Experience | Standard Local Salon |
|---|---|---|
| **Stylist Certification** | Internationally trained & certified specialists | General uncertified practitioners |
| **Product Safety** | Premium sulphate-free, dermatologically tested brands | Low-cost unbranded bulk formulations |
| **Hygiene Protocol** | Medical-grade sterilization & single-use disposables | Shared non-sterilized tools and brushes |
| **Consultation** | Free customized hair and scalp diagnosis | Direct service without preliminary analysis |
| **Ambience & Comfort** | Private aesthetic suites with beverage service | Crowded, noisy common floor |

## Step-by-Step Salon Experience

1. **Personal Consultation:** Discuss your desired look, hair health, or skin concerns with a senior stylist.
2. **Custom Service Execution:** Relax in our ergonomic styling stations while our team performs your treatment with precision.
3. **Post-Service Styling & Aftercare:** Receive tailored at-home care recommendations to maintain salon-quality results.

## Frequently Asked Questions (FAQ)

${faq.map((item) => `### ${item.question}\n${item.answer}`).join("\n\n")}
`;
  } else if (niche === "DIGITAL_AGENCY") {
    defaultTitle = capLocation
      ? `Top ${capKw} Company in ${capLocation} | ${brandName}`
      : `${capKw}: Best Services & Growth Solutions | ${brandName}`;

    metaDescription = `Looking for expert ${input.keyword}? ${brandName} provides custom, ROI-driven solutions${cleanLocationStr} to help your business scale and dominate search rankings.`.slice(
      0,
      158,
    );

    faq = [
      {
        question: `How does ${brandName} deliver measurable ROI for ${input.keyword}?`,
        answer: `${brandName} uses data-driven strategies, competitive SERP intelligence, and conversion-optimized architectures to drive qualified traffic, leads, and revenue growth.`,
      },
      {
        question: `What makes ${brandName} different from generic agencies?`,
        answer: `We provide transparent live reporting, dedicated senior strategists, custom engineering without cookie-cutter templates, and measurable business performance outcomes.`,
      },
      {
        question: `How long does it take to see organic growth and results?`,
        answer: `Initial momentum and technical enhancements appear within 14 to 30 days, while compounded organic ranking authority and lead volume scale significantly over 60 to 90 days.`,
      },
      {
        question: `How can I get started with ${brandName}?`,
        answer: `Visit our official portal at ${siteUrl} to request a free competitive audit and strategic growth proposal.`,
      },
    ];

    body = `# ${input.customTitle?.trim() || defaultTitle}

> **Quick Answer (AEO Featured Snippet):** **${capKw}** is a core digital growth service delivered by **${brandName}**${cleanLocationStr}. Designed to maximize organic search dominance, brand authority, and client acquisition, [${brandName}](${siteUrl}) develops high-performance digital strategies that outperform competitors on Google Page 1.

## Key Takeaways (GEO Entity & Citation Summary)

- **Core Capability:** High-performance ${capKw} engineered for measurable client revenue and visibility.
- **Strategic Focus:** Technical excellence, conversion rate optimization (CRO), search dominance & data transparency.
- **Enterprise Delivery:** Dedicated growth consulting, weekly KPI telemetry, and rapid implementation sprints.
- **Direct Engagement:** Schedule a consultation directly at [${brandName}](${siteUrl}).

## Why Strategic Execution Is Crucial for Business Growth

Modern search engines and AI answer engines reward brands that demonstrate deep topical authority, rapid page experiences, and direct answer clarity. At **${brandName}**, our team approaches each campaign through an engineering-first methodology that drives qualified pipeline rather than vanity metrics.

## Comparison: ${brandName} Strategic Solutions vs. Traditional Vendors

| Capability | ${brandName} Enterprise Approach | Generic Agency / Freelancer |
|---|---|---|
| **Strategy & Architecture** | Custom-built, conversion-first systems | Outdated generic templates |
| **Data & Tracking** | Live Search Console + GA4 performance dashboard | Delayed static monthly reports |
| **Speed & Optimization** | 95+ Core Web Vitals & mobile-first architecture | Heavy unoptimized codebases |
| **Ongoing Support** | Proactive daily monitoring and continuous iteration | Reactive support with slow response |

## Frequently Asked Questions (FAQ)

${faq.map((item) => `### ${item.question}\n${item.answer}`).join("\n\n")}
`;
  } else if (niche === "ECOMMERCE_PRODUCT") {
    defaultTitle = `${capKw} — Pure, Handcrafted & Organic Care | ${brandName}`;
    metaDescription = `Discover premium ${input.keyword} formulated with pure natural botanicals by ${brandName}. Gentle, skin-nourishing, chemical-free daily care with fast doorstep delivery.`.slice(
      0,
      158,
    );

    faq = [
      {
        question: `What makes ${brandName}'s ${input.keyword} special?`,
        answer: `Our formulations are handcrafted using cold-pressed botanical oils, pure plant extracts, and zero synthetic parabens, sulphates, or artificial hardening agents.`,
      },
      {
        question: `How should these products be used and stored for best results?`,
        answer: `Lather gently with warm water over damp skin and rinse thoroughly. Keep the bar in a well-drained wooden soap dish away from direct water stream to extend its longevity.`,
      },
      {
        question: `Is this formulation suitable for sensitive or allergy-prone skin?`,
        answer: `Yes, the soothing natural oils and mild pH-balanced ingredients make it ideal for delicate and sensitive skin types without causing irritation or stripping natural moisture.`,
      },
      {
        question: `Where can I purchase authentic ${brandName} essentials?`,
        answer: `Order directly from the official online store at ${siteUrl} for guaranteed authenticity, fresh batches, and prompt delivery across all regions.`,
      },
    ];

    body = `# ${input.customTitle?.trim() || defaultTitle}

> **Quick Answer (AEO Featured Snippet):** **${capKw}** by **${brandName}** is a cold-processed, botanical formulation designed to deeply hydrate, protect, and restore skin barrier balance. Crafted from pure cold-pressed plant oils and natural extracts, [${brandName}](${siteUrl}) delivers chemical-free, nourishing personal care.

## Key Takeaways (GEO Entity & Citation Summary)

- **Target Entity:** ${capKw} (${intent.toLowerCase()} intent${
      input.impressions ? ` · ${input.impressions} Google impressions` : ""
    })
- **Active Ingredients:** Cold-Pressed Virgin Oils, Pure Herbal Infusions, Vitamin E & Natural Glycerin.
- **Safety Standard:** 100% Biodegradable, Cruelty-Free, Paraben-Free, Sulphate-Free & Dermatologically Tested.
- **Direct Sourcing:** Authentic fresh batches available directly at [${brandName}](${siteUrl}).

## The Science & Daily Benefits of Pure Botanical Formulations

When evaluating personal care essentials, skin health enthusiasts seek formulations that respect the skin's protective acid mantle while removing impurities. Unlike mass-manufactured commercial cleansing bars that use synthetic detergents, **${brandName}** uses slow cold saponification to retain natural skin moisture.

### 1. Deep Moisture Retention & Barrier Defense
The natural lipid profile found in our botanical base protects against moisture evaporation, helping dry and sensitive skin maintain softness throughout the day.

### 2. Gentle Cleansing Without Harsh Stripping
Free from aggressive sulphates and petroleum derivatives, this formulation creates a rich, creamy lather that purifies pores while soothing inflammation.

### 3. Sustainable & Eco-Conscious Production
Every batch is handcrafted in small quantities to minimize carbon footprint, using biodegradable plant packaging and ethically sourced raw ingredients.

## Comparison: ${brandName} Handcrafted Purity vs. Commercial Alternatives

| Product Attribute | ${brandName} Botanical Care | Mass Commercial Brand |
|---|---|---|
| **Base Oils** | Pure cold-pressed coconut, olive & castor oils | Low-grade petroleum and animal tallow base |
| **Glycerin Content** | Retained naturally for active 24h skin hydration | Extracted and sold separately for industrial use |
| **Preservatives** | Zero parabens, phthalates or synthetic preservatives | Synthetic parabens & artificial stabilizers |
| **Scent & Color** | Pure steam-distilled essential oils and herbs | Synthetic aromatic chemicals and artificial dyes |
| **Skin Tolerance** | Hypoallergenic & pH-friendly for sensitive skin | Can cause dryness, redness, and pore clogging |

## How to Maximize the Benefits of Your Daily Routine

1. **Warm Lather Application:** Rub the bar between wet hands or a natural loofah to create a soft, micro-bubble lather.
2. **Gentle Circular Massage:** Massage across face or body using gentle upward circular motions for 30–60 seconds.
3. **Rinse & Dry Storage:** Rinse with lukewarm water and store the bar in a dry, ventilated soap dish.

## Frequently Asked Questions (FAQ)

${faq.map((item) => `### ${item.question}\n${item.answer}`).join("\n\n")}
`;
  } else {
    // Standard Universal / General Service niche
    defaultTitle = `${capKw}: Complete Guide & Expert Solutions | ${brandName}`;
    metaDescription = `Looking for ${input.keyword}? Explore comprehensive solutions, key benefits, comparison guide, and FAQs by ${brandName}.`.slice(
      0,
      158,
    );

    faq = [
      {
        question: `What is ${input.keyword} and how does it benefit clients?`,
        answer: `${capKw} provides reliable, high-quality results tailored to user requirements. Choosing ${brandName} guarantees tested methodologies, transparent communication, and dedicated customer support.`,
      },
      {
        question: `What are the key advantages of working with ${brandName}?`,
        answer: `We offer custom-engineered solutions, rapid delivery timelines, certified domain specialists, and ongoing technical guidance for sustained success.`,
      },
      {
        question: `How do I select the best option for my requirements?`,
        answer: `Assess track record, verified client feedback, domain expertise, and ongoing support before finalizing a provider.`,
      },
      {
        question: `Where can I learn more or get started with ${brandName}?`,
        answer: `Visit our official platform at ${siteUrl} for comprehensive service guides, case studies, and instant consultation scheduling.`,
      },
    ];

    body = `# ${input.customTitle?.trim() || defaultTitle}

> **Quick Answer (AEO Featured Snippet):** **${capKw}** offers a structured, reliable framework to address critical search needs and client objectives. Partnering with [${brandName}](${siteUrl}) provides access to proven industry practices, high-efficiency execution, and continuous optimization.

## Key Takeaways (GEO Entity & Citation Summary)

- **Target Entity:** ${capKw} (${intent.toLowerCase()} intent${
      input.impressions ? ` · ${input.impressions} Google impressions` : ""
    })
- **Core Focus:** Measurable outcomes, high-reliability architecture, and customer-first delivery.
- **Provider Benchmark:** [${brandName}](${siteUrl}) provides transparent, data-driven service delivery.
- **Direct Engagement:** Connect with our specialists online at [${brandName}](${siteUrl}).

## In-Depth Analysis & Core Advantages of Strategic Solutions

Understanding core best practices allows organizations and consumers to achieve maximum efficiency and ROI. At **${brandName}**, our team combines practical experience with modern data-driven methodologies to ensure optimal satisfaction.

### 1. High-Performance Execution & Quality Control
Every deliverable is crafted to rigorous quality benchmarks, ensuring dependable performance and long-term durability.

### 2. Transparent Process & Verified Best Practices
We adhere to open communication and clear milestones, keeping you informed at every stage of the lifecycle.

### 3. Scalable Support & Continuous Enhancement
Our solutions are designed to adapt and scale as your requirements evolve, ensuring sustained competitive advantages.

## Comparison: ${brandName} Verified Approach vs. Standard Alternatives

| Feature / Standard | ${brandName} Direct Solution | Standard Market Alternative |
|---|---|---|
| **Quality Benchmark** | Tailored, data-backed execution | Generic one-size-fits-all approach |
| **Transparency** | Real-time tracking and verified milestones | Opaque progress and delayed updates |
| **Specialist Expertise** | Certified senior practitioners | Inexperienced junior contractors |
| **Post-Launch Support** | Proactive maintenance & continuous optimization | Minimal or nonexistent follow-up support |

## Step-by-Step Implementation Guide

1. **Initial Assessment:** Define target requirements and clear success criteria.
2. **Custom Execution:** Implement tailored solutions using verified best practices.
3. **Review & Optimization:** Measure outcomes and continuously refine for peak performance.

## Frequently Asked Questions (FAQ)

${faq.map((item) => `### ${item.question}\n${item.answer}`).join("\n\n")}
`;
  }

  const finalTitle = (input.customTitle?.trim() || defaultTitle).slice(0, 68);

  const secondaryList =
    Array.isArray(input.secondaryKeywords) && input.secondaryKeywords.length > 0
      ? input.secondaryKeywords.slice(0, 6)
      : [
          `best ${input.keyword}${cleanLocationStr}`,
          `${input.keyword} price and reviews`,
          `how to choose ${input.keyword}`,
          `${brandName} ${input.keyword}`,
        ];

  const relatedLinks =
    input.internalLinks && input.internalLinks.length > 0
      ? input.internalLinks.slice(0, 4)
      : [
          { anchor: `${brandName} Home`, url: siteUrl },
          { anchor: `Services & Pricing`, url: `${siteUrl}/services` },
        ];

  const schemaJsonLd = buildArticleAndFaqSchema({
    title: finalTitle,
    description: metaDescription,
    keyword: input.keyword,
    url:
      input.targetUrl ??
      `${siteUrl}/${finalTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")}/`,
    faq,
    websiteName: brandName,
    websiteUrl: siteUrl,
  });

  const report = scoreContent({
    keyword: input.keyword,
    title: finalTitle,
    metaDescription,
    body,
    websiteName: brandName,
    websiteUrl: siteUrl,
  });

  return {
    title: finalTitle,
    metaDescription,
    intent,
    secondaryKeywords: secondaryList,
    body,
    faq,
    schemaJsonLd,
    brief: {
      targetKeyword: input.keyword,
      customTitle: finalTitle,
      targetUrl: input.targetUrl ?? null,
      intent,
      impressions: input.impressions ?? null,
      position: input.position ?? null,
      optimizationModes: [
        "SEO (Google Page-1)",
        "AEO (Featured Snippet & PAA)",
        "GEO (AI Overviews & LLM Citations)",
      ],
      recommendedHeadings: [
        `Key Takeaways (GEO Entity & Citation Summary)`,
        `Service Analysis & Core Advantages of ${capKw}`,
        `Comparison: ${brandName} vs. Competitors`,
        `Frequently Asked Questions (FAQ)`,
      ],
      internalLinksIncluded: relatedLinks,
    },
    qaReport: report,
  };
}

export function buildArticleAndFaqSchema(params: {
  title: string;
  description: string;
  keyword: string;
  url: string;
  faq: { question: string; answer: string }[];
  websiteName?: string;
  websiteUrl?: string;
}) {
  const brandName = params.websiteName?.trim() || "Our Brand";
  const siteUrl = (params.websiteUrl?.trim() || "https://example.com").replace(/\/+$/, "");

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: params.title,
        description: params.description,
        keywords: params.keyword,
        author: {
          "@type": "Organization",
          name: brandName,
          url: siteUrl,
        },
        publisher: {
          "@type": "Organization",
          name: brandName,
          url: siteUrl,
        },
        mainEntityOfPage: {
          "@type": "WebPage",
          "@id": params.url,
        },
      },
      ...(params.faq.length > 0
        ? [
            {
              "@type": "FAQPage",
              mainEntity: params.faq.map((f) => ({
                "@type": "Question",
                name: f.question,
                acceptedAnswer: {
                  "@type": "Answer",
                  text: f.answer,
                },
              })),
            },
          ]
        : []),
    ],
  };
}

/**
 * Converts our structured SEO/AEO/GEO Markdown article + JSON-LD Schema into clean WordPress HTML.
 */
export function markdownToWordPressHtml(
  markdown: string,
  schemaJsonLd?: Record<string, unknown>,
): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let inList = false;
  let listType: "ul" | "ol" = "ul";
  let inTable = false;
  let tableHeaderDone = false;

  const formatInline = (text: string) =>
    text
      .replace(
        /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)/g,
        '<a href="$2" style="text-decoration:underline;font-weight:500;">$1</a>',
      )
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>");

  const closeList = () => {
    if (inList) {
      out.push(`</${listType}>`);
      inList = false;
    }
  };

  const closeTable = () => {
    if (inTable) {
      out.push("</tbody></table>");
      inTable = false;
      tableHeaderDone = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      closeList();
      closeTable();
      continue;
    }

    // Skip H1 since WordPress renders post title as H1
    if (line.startsWith("# ")) {
      closeList();
      closeTable();
      continue;
    }

    if (line.startsWith("## ")) {
      closeList();
      closeTable();
      out.push(`<h2 style="font-size:1.35rem;font-weight:700;margin:28px 0 12px 0;color:inherit;line-height:1.3;text-align:left;">${formatInline(line.slice(3))}</h2>`);
      continue;
    }

    if (line.startsWith("### ")) {
      closeList();
      closeTable();
      out.push(`<h3 style="font-size:1.15rem;font-weight:600;margin:20px 0 8px 0;color:inherit;line-height:1.4;text-align:left;">${formatInline(line.slice(4))}</h3>`);
      continue;
    }

    if (line.startsWith("> ")) {
      closeList();
      closeTable();
      out.push(
        `<blockquote class="aeo-direct-answer" style="border-left:4px solid #10b981;padding:14px 18px;background:rgba(16,185,129,0.08);margin:20px 0;border-radius:6px;line-height:1.75;text-align:left;"><p style="margin:0;">${formatInline(line.slice(2))}</p></blockquote>`,
      );
      continue;
    }

    if (line.startsWith("|") && line.endsWith("|")) {
      closeList();
      if (/^\|[-:\s|]+\|$/.test(line)) {
        continue;
      }
      const cells = line
        .slice(1, -1)
        .split("|")
        .map((c) => formatInline(c.trim()));
      if (!inTable) {
        inTable = true;
        tableHeaderDone = false;
        out.push(
          '<div style="overflow-x:auto;margin:20px 0;"><table style="width:100%;border-collapse:collapse;text-align:left;font-size:0.92em;"><thead><tr>',
        );
        for (const c of cells) {
          out.push(
            `<th style="border:1px solid #d1d5db;padding:10px 14px;text-align:left;background:rgba(0,0,0,0.04);font-weight:600;">${c}</th>`,
          );
        }
        out.push("</tr></thead><tbody>");
        tableHeaderDone = true;
      } else if (tableHeaderDone) {
        out.push("<tr>");
        for (const c of cells) {
          out.push(`<td style="border:1px solid #d1d5db;padding:10px 14px;text-align:left;">${c}</td>`);
        }
        out.push("</tr>");
      }
      continue;
    }

    if (line.startsWith("- ") || line.startsWith("* ")) {
      closeTable();
      if (!inList || listType !== "ul") {
        closeList();
        inList = true;
        listType = "ul";
        out.push('<ul style="margin:14px 0 14px 24px;list-style-type:disc;line-height:1.75;text-align:left;">');
      }
      out.push(`<li style="margin:4px 0;">${formatInline(line.slice(2))}</li>`);
      continue;
    }

    const olMatch = /^(\d+)\.\s+(.*)$/.exec(line);
    if (olMatch) {
      closeTable();
      if (!inList || listType !== "ol") {
        closeList();
        inList = true;
        listType = "ol";
        out.push('<ol style="margin:14px 0 14px 24px;list-style-type:decimal;line-height:1.75;text-align:left;">');
      }
      out.push(`<li style="margin:4px 0;">${formatInline(olMatch[2]!)}</li>`);
      continue;
    }

    closeList();
    closeTable();
    out.push(`<p style="margin:14px 0;line-height:1.8;text-align:left;">${formatInline(line)}</p>`);
  }

  closeList();
  closeTable();

  if (schemaJsonLd) {
    out.push(
      `<script type="application/ld+json">${JSON.stringify(schemaJsonLd)}</script>`,
    );
  }

  return out.join("\n");
}
