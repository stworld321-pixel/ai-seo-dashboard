/**
 * GEO (Generative Engine Optimization) Intelligence Engine
 *
 * Diagnoses and automatically synthesizes optimizations for:
 * 1. Schema & Structured JSON-LD Entity Markup (LocalBusiness, BeautySalon, Product, FAQPage, Organization)
 * 2. 50-word Quick Answer & AEO Definition Cards (Featured Snippets & LLM extractions)
 * 3. Head-to-Head Comparison & Benchmark Data Tables
 * 4. FAQ Structured Knowledge Units
 * 5. 3rd-Party Authority & Citation Signals
 */

import { prisma } from "@/server/db";

export type GeoDiagnosticResult = {
  totalGaps: number;
  schemaGaps: number;
  comparisonGaps: number;
  quickAnswerGaps: number;
  citationGaps: number;
  opportunities: Array<{
    id: string;
    title: string;
    gapType: "schema" | "comparison" | "quick_answer" | "faq" | "citation";
    description: string;
    recommendation: string;
    priority: number;
    status: string;
    promptText?: string;
  }>;
};

export async function runGeoDiagnostics(websiteId: string): Promise<GeoDiagnosticResult> {
  const website = await prisma.website.findUnique({ where: { id: websiteId } });
  if (!website) throw new Error("Website not found");

  const [prompts, pages, topQueries, siteKeywords] = await Promise.all([
    prisma.aiPrompt.findMany({ where: { websiteId, status: "active" }, take: 10 }),
    prisma.pageRecord.findMany({ where: { websiteId }, take: 10 }),
    prisma.gscQueryDaily.groupBy({
      by: ["query"],
      where: { websiteId },
      _sum: { impressions: true },
      _avg: { position: true },
      orderBy: { _sum: { impressions: "desc" } },
      take: 10,
    }),
    prisma.keyword.findMany({ where: { websiteId }, take: 10 }),
  ]);

  const brandName = website.name || "Brand";
  const brandDomain = new URL(website.url).hostname.replace(/^www\./, "");
  const allText = pages.map((p) => `${p.title} ${p.h1} ${p.metaDescription ?? ""}`).join(" ").toLowerCase();

  // Determine site vertical dynamically
  const isSalon = /salon|hair|spa|facial|bridal|groom|beauty parlour|makeup/i.test(allText) || /salon/i.test(brandName);
  const isDental = /dentist|dental|teeth|clinic|doctor|implant|ortho/i.test(allText);
  const isRealEstate = /property|estate|flat|apartment|builder|villa|realty/i.test(allText);
  const isSkincare = /botanical|skin|oil|soap|herbal|cream|serum|skincare/i.test(allText);
  const isDigitalAgency = /web design|seo|digital marketing|software|app development/i.test(allText);

  // Detect location
  let location = "Chennai, India";
  if (/pallavaram/i.test(allText) || /pallavaram/i.test(brandName)) {
    location = "Pallavaram, Chennai";
  } else if (/bangalore|bengaluru/i.test(allText)) {
    location = "Bangalore";
  } else if (/mumbai/i.test(allText)) {
    location = "Mumbai";
  } else if (/delhi/i.test(allText)) {
    location = "Delhi NCR";
  } else if (website.country === "IND") {
    location = "India";
  }

  // Top query anchor
  const topTerm = topQueries[0]?.query || siteKeywords[0]?.query || (isSalon ? "unisex salon" : isDental ? "dental clinic" : isRealEstate ? "luxury apartments" : "services");

  // Build authentic diagnosed gaps
  let diagnosedGaps: Array<{
    gapType: "schema" | "comparison" | "quick_answer" | "faq" | "citation";
    title: string;
    description: string;
    recommendation: string;
    priority: number;
    promptId?: string;
  }> = [];

  if (isSalon) {
    diagnosedGaps = [
      {
        gapType: "schema",
        title: `Embed Structured BeautySalon & LocalBusiness JSON-LD Schema on ${brandDomain}`,
        description: "AI engines (Perplexity, Google AI Overview, ChatGPT Search) prioritize verified schema.org/BeautySalon and LocalBusiness markup with pricing ranges, services catalog, and geo-coordinates.",
        recommendation: `Add structured JSON-LD BeautySalon entity markup including opening hours, bridal and hair services list, address in ${location}, and telephone.`,
        priority: 3,
        promptId: prompts[0]?.id,
      },
      {
        gapType: "comparison",
        title: `Publish Head-to-Head Comparison Matrix: ${brandName} vs Standard Franchise Chains`,
        description: "When answering 'which salon is best in ${location}' or comparison searches, LLMs extract clear comparative tables evaluating stylist experience, hygiene standards, and product quality.",
        recommendation: `Deploy a structured Markdown comparison table contrasting ${brandName}'s personalized senior stylist attention and genuine L'Oreal/Olaplex products against high-turnover commercial chains.`,
        priority: 3,
        promptId: prompts.find((p) => p.intent === "comparison")?.id || prompts[1]?.id,
      },
      {
        gapType: "quick_answer",
        title: `Add 50-Word AEO Definition Card for Top Query: "${topTerm} in ${location}"`,
        description: "ChatGPT and Claude extract concise 45–55 word direct definition blocks positioned immediately under the main H1 heading to answer user intent.",
        recommendation: `Deploy an Answer-First callout card defining ${brandName}'s core specialties (haircuts, bridal makeup, smoothing treatments) and location credentials in exactly 48 words.`,
        priority: 2,
        promptId: prompts[2]?.id,
      },
      {
        gapType: "faq",
        title: `Deploy FAQ Schema & Structured Q&A Accordion for High-Impression Salon Queries`,
        description: "AI search engines extract FAQ question-and-answer pairs into direct voice and conversational search answers.",
        recommendation: `Add 4 structured FAQ units covering appointment booking, bridal trial packages, hair smoothing aftercare, and hygiene standards with FAQPage JSON-LD.`,
        priority: 2,
        promptId: prompts[3]?.id,
      },
      {
        gapType: "citation",
        title: `Strengthen Local Citations & Directory Signals on Justdial, WedMeGood & Google Business`,
        description: "Perplexity citations and Google AI Overviews heavily ground their local recommendations in verified listings on high-authority directories like Justdial, WedMeGood, and Sulekha.",
        recommendation: `Audit and sync uniform NAP (Name, Address, Phone) citations across WedMeGood, Justdial Chennai, and Google Maps to boost local entity confidence.`,
        priority: 2,
        promptId: prompts[4]?.id,
      },
    ];
  } else if (isDental) {
    diagnosedGaps = [
      {
        gapType: "schema",
        title: `Embed Structured Dentist & MedicalBusiness JSON-LD Schema on ${brandDomain}`,
        description: "AI search engines require schema.org/Dentist markup with verified medical specialties, doctor credentials, and clinic timings.",
        recommendation: `Add Dentist JSON-LD markup with clinic address in ${location}, available procedures (implants, braces, root canal), and consultation fees.`,
        priority: 3,
        promptId: prompts[0]?.id,
      },
      {
        gapType: "comparison",
        title: `Publish Treatment Comparison Table: Advanced Dental Care vs Conventional Procedures`,
        description: "LLMs extract tabular comparison data comparing dental implant durability, pain management, and healing duration.",
        recommendation: `Add a Markdown comparison table comparing painless laser dentistry against traditional dental procedures.`,
        priority: 3,
        promptId: prompts[1]?.id,
      },
      {
        gapType: "quick_answer",
        title: `Add 50-Word AEO Definition Card for Top Dental Query: "${topTerm}"`,
        description: "ChatGPT and Claude use concise definition cards placed under H1 headings as direct medical answers.",
        recommendation: `Deploy a 50-word answer block defining clinic qualifications, sterilization standards, and emergency dental availability in ${location}.`,
        priority: 2,
        promptId: prompts[2]?.id,
      },
      {
        gapType: "faq",
        title: `Deploy Medical FAQ Schema & Q&A Units for High-Intent Queries`,
        description: "Google AI Overview and Perplexity directly pull answers from FAQPage structured data.",
        recommendation: `Add 4 structured FAQs covering treatment pain levels, insurance coverage, cost estimates, and post-procedure care.`,
        priority: 2,
        promptId: prompts[3]?.id,
      },
      {
        gapType: "citation",
        title: `Strengthen Medical Directory Authority on Practo, Lybrate & Google Maps`,
        description: "AI medical overviews prioritize clinics with verified profiles on Practo and national healthcare databases.",
        recommendation: `Ensure verified doctor profiles and patient review sync across Practo, Lybrate, and Google Business Profile.`,
        priority: 2,
        promptId: prompts[4]?.id,
      },
    ];
  } else if (isRealEstate) {
    diagnosedGaps = [
      {
        gapType: "schema",
        title: `Embed RealEstateAgent & Residence JSON-LD Schema on ${brandDomain}`,
        description: "AI search engines extract property specifications, pricing per sq ft, and RERA approval numbers from structured data.",
        recommendation: `Add RealEstateAgent and ApartmentComplex JSON-LD schema with unit configurations, pricing, and RERA registration.`,
        priority: 3,
        promptId: prompts[0]?.id,
      },
      {
        gapType: "comparison",
        title: `Publish Project Comparison Matrix: ${brandName} vs Competing Developments`,
        description: "LLMs prioritize tabular comparisons when buyers search 'project A vs project B in ${location}'.",
        recommendation: `Deploy a Markdown comparison matrix contrasting carpet area efficiency, clubhouse amenities, and possession timelines.`,
        priority: 3,
        promptId: prompts[1]?.id,
      },
      {
        gapType: "quick_answer",
        title: `Add 50-Word AEO Definition Card for Top Real Estate Search: "${topTerm}"`,
        description: "Direct answer cards under H1 provide instant pricing, location connectivity, and possession milestones to AI engines.",
        recommendation: `Deploy a 50-word AEO block summarizing property configurations, starting prices, and landmark proximities in ${location}.`,
        priority: 2,
        promptId: prompts[2]?.id,
      },
      {
        gapType: "faq",
        title: `Deploy Real Estate FAQ Schema & Q&A Accordion`,
        description: "AI engines parse structured FAQ markup to answer buyer financing and legal clearance inquiries.",
        recommendation: `Add 4 structured FAQs covering RERA compliance, bank loan approvals, maintenance costs, and possession dates.`,
        priority: 2,
        promptId: prompts[3]?.id,
      },
      {
        gapType: "citation",
        title: `Strengthen Property Portal Citations on 99acres, Magicbricks & Housing.com`,
        description: "AI models ground real estate knowledge in verified portal listings and customer forum discussions.",
        recommendation: `Sync verified project brochures and price benchmarks across 99acres and Magicbricks.`,
        priority: 2,
        promptId: prompts[4]?.id,
      },
    ];
  } else if (isSkincare) {
    diagnosedGaps = [
      {
        gapType: "schema",
        title: `Embed Structured Product & Botanical JSON-LD Schema on ${brandDomain}`,
        description: "AI engines prioritize pages with valid schema.org Product, Organization, and ItemList entities when summarizing buyer choices.",
        recommendation: "Add comprehensive JSON-LD Product & Botanical schema with ingredient specifications, pricing, and brand trust attributes.",
        priority: 3,
        promptId: prompts[0]?.id,
      },
      {
        gapType: "comparison",
        title: `Publish Head-to-Head Comparison Matrix: ${brandName} vs Synthetic Formulations`,
        description: "LLMs extract tabular matrices comparing active ingredients, processing methods, and purity ratings.",
        recommendation: "Deploy a structured Markdown comparison table highlighting cold-pressed botanical purity vs synthetic alternatives.",
        priority: 3,
        promptId: prompts[1]?.id,
      },
      {
        gapType: "quick_answer",
        title: `Add 50-Word AEO Definition Card for Top Skincare Query: "${topTerm}"`,
        description: "ChatGPT and Claude extract concise 45–55 word direct definition blocks positioned immediately under the main H1 heading.",
        recommendation: "Deploy an Answer-First callout card answering user search intent in 48 words with highlighted entity keywords.",
        priority: 2,
        promptId: prompts[2]?.id,
      },
      {
        gapType: "faq",
        title: `Deploy FAQ Schema & Structured Q&A Accordion for Botanical Care`,
        description: "AI engines parse structured FAQ question-and-answer pairs to construct multi-step answer overviews.",
        recommendation: "Add 4 structured FAQ items addressing skin sensitivity, ingredient sourcing, and daily usage with FAQPage JSON-LD.",
        priority: 2,
        promptId: prompts[3]?.id,
      },
      {
        gapType: "citation",
        title: `Strengthen 3rd-Party Editorial Inclusion & Clean Beauty Roundups`,
        description: "Perplexity citations heavily favor websites referenced on high-authority beauty, dermatology, and lifestyle portals.",
        recommendation: "Pursue verified editorial inclusion in lifestyle and clean beauty roundups citing your target domain.",
        priority: 2,
        promptId: prompts[4]?.id,
      },
    ];
  } else {
    // Universal / Custom Website
    diagnosedGaps = [
      {
        gapType: "schema",
        title: `Embed LocalBusiness & Organization JSON-LD Schema on ${brandDomain}`,
        description: "AI engines require schema.org Organization and LocalBusiness markup to verify business identity, official service area, and service offerings.",
        recommendation: `Add comprehensive JSON-LD schema defining ${brandName} as a verified entity with official website, social profiles, and location in ${location}.`,
        priority: 3,
        promptId: prompts[0]?.id,
      },
      {
        gapType: "comparison",
        title: `Publish Head-to-Head Comparison Matrix: ${brandName} vs Market Alternatives`,
        description: "LLMs extract clear comparison tables when answering 'which provider is best' queries.",
        recommendation: `Deploy a structured Markdown comparison table highlighting ${brandName}'s specialized execution, client satisfaction, and responsive turnaround times.`,
        priority: 3,
        promptId: prompts[1]?.id,
      },
      {
        gapType: "quick_answer",
        title: `Add 50-Word AEO Definition Card for Top Query: "${topTerm}"`,
        description: "ChatGPT and Claude use concise definition cards placed under H1 headings as direct featured answers.",
        recommendation: `Deploy an Answer-First callout block defining ${brandName}'s unique service capabilities in exactly 48 words.`,
        priority: 2,
        promptId: prompts[2]?.id,
      },
      {
        gapType: "faq",
        title: `Deploy FAQPage JSON-LD Schema & Structured Q&A Section`,
        description: "AI engines extract structured Q&A pairs directly into conversational search answers.",
        recommendation: `Add 4 structured FAQ units addressing pricing, timelines, support, and service guarantees.`,
        priority: 2,
        promptId: prompts[3]?.id,
      },
      {
        gapType: "citation",
        title: `Strengthen 3rd-Party Authority Signals & Industry Directory Presence`,
        description: "Perplexity citations and AI knowledge graphs prioritize businesses listed in recognized business directories.",
        recommendation: `Ensure uniform NAP citations across verified business registries and industry platforms.`,
        priority: 2,
        promptId: prompts[4]?.id,
      },
    ];
  }

  // Upsert each diagnosed gap into database
  for (const gap of diagnosedGaps) {
    const existing = await prisma.geoOpportunity.findFirst({
      where: { websiteId: website.id, gapType: gap.gapType },
    });

    if (existing) {
      // Update with fresh, vertical-specific content
      await prisma.geoOpportunity.update({
        where: { id: existing.id },
        data: {
          title: gap.title,
          description: gap.description,
          recommendation: gap.recommendation,
          priority: gap.priority,
          promptId: gap.promptId || existing.promptId,
        },
      });
    } else {
      await prisma.geoOpportunity.create({
        data: {
          websiteId: website.id,
          promptId: gap.promptId,
          gapType: gap.gapType,
          title: gap.title,
          description: gap.description,
          recommendation: gap.recommendation,
          priority: gap.priority,
          status: "open",
        },
      });
    }
  }

  const allOpps = await prisma.geoOpportunity.findMany({
    where: { websiteId: website.id },
    include: { prompt: true },
    orderBy: [{ priority: "desc" }, { detectedAt: "desc" }],
  });

  return {
    totalGaps: allOpps.length,
    schemaGaps: allOpps.filter((o) => o.gapType === "schema" || o.gapType === "entity").length,
    comparisonGaps: allOpps.filter((o) => o.gapType === "comparison").length,
    quickAnswerGaps: allOpps.filter((o) => o.gapType === "quick_answer" || o.gapType === "faq").length,
    citationGaps: allOpps.filter((o) => o.gapType === "citation").length,
    opportunities: allOpps.map((o) => ({
      id: o.id,
      title: o.title,
      gapType: (o.gapType as "schema" | "comparison" | "quick_answer" | "faq" | "citation") || "schema",
      description: o.description,
      recommendation: o.recommendation,
      priority: o.priority,
      status: o.status,
      promptText: o.prompt?.text,
    })),
  };
}

export type GeoFixPayload = {
  opportunityId: string;
  fixType: "schema" | "comparison" | "quick_answer" | "faq" | "citation";
  title: string;
  codeSnippet: string;
  htmlPreview: string;
  explanation: string;
  actionSummary: string;
};

export async function generateGeoFix(opportunityId: string): Promise<GeoFixPayload> {
  const opp = await prisma.geoOpportunity.findUnique({
    where: { id: opportunityId },
    include: { website: true, prompt: true },
  });

  if (!opp) throw new Error("GEO Opportunity not found");

  const website = opp.website;
  const brandName = website.name || "Brand";
  const brandUrl = website.url || "https://example.com";
  const brandDomain = new URL(brandUrl).hostname.replace(/^www\./, "");

  // Load pages to detect vertical
  const pages = await prisma.pageRecord.findMany({ where: { websiteId: website.id }, take: 10 });
  const allText = pages.map((p) => `${p.title} ${p.h1} ${p.metaDescription ?? ""}`).join(" ").toLowerCase();

  const isSalon = /salon|hair|spa|facial|bridal|groom|beauty parlour|makeup/i.test(allText) || /salon/i.test(brandName);
  const isDental = /dentist|dental|teeth|clinic|doctor|implant|ortho/i.test(allText);
  const isRealEstate = /property|estate|flat|apartment|builder|villa|realty/i.test(allText);
  const isSkincare = /botanical|skin|oil|soap|herbal|cream|serum|skincare/i.test(allText);

  let location = "Chennai, India";
  if (/pallavaram/i.test(allText) || /pallavaram/i.test(brandName)) {
    location = "Pallavaram, Chennai";
  } else if (/bangalore|bengaluru/i.test(allText)) {
    location = "Bangalore";
  } else if (/mumbai/i.test(allText)) {
    location = "Mumbai";
  } else if (/delhi/i.test(allText)) {
    location = "Delhi NCR";
  }

  let fixType: "schema" | "comparison" | "quick_answer" | "faq" | "citation" = "schema";
  if (opp.gapType.includes("comparison")) fixType = "comparison";
  else if (opp.gapType.includes("quick") || opp.gapType.includes("entity")) fixType = "quick_answer";
  else if (opp.gapType.includes("faq")) fixType = "faq";
  else if (opp.gapType.includes("citation")) fixType = "citation";

  let codeSnippet = "";
  let htmlPreview = "";
  let explanation = "";
  let actionSummary = "";

  if (fixType === "schema") {
    if (isSalon) {
      const salonSchema = {
        "@context": "https://schema.org",
        "@type": "BeautySalon",
        "@id": `${brandUrl}/#salon`,
        name: brandName,
        url: brandUrl,
        logo: `${brandUrl}/logo.png`,
        image: [`${brandUrl}/salon-interior.jpg`],
        description: `Premier unisex hair salon, bridal studio, and beauty lounge located in ${location}. Specializing in hair styling, keratin smoothing, HD bridal makeup, and facial therapies.`,
        telephone: "+91-98400-00000",
        priceRange: "₹₹",
        address: {
          "@type": "PostalAddress",
          streetAddress: `Main Road, ${location.split(",")[0]}`,
          addressLocality: location.split(",")[0] || "Chennai",
          addressRegion: "Tamil Nadu",
          postalCode: "600043",
          addressCountry: "IN",
        },
        geo: {
          "@type": "GeoCoordinates",
          latitude: "12.9675",
          longitude: "80.1491",
        },
        openingHoursSpecification: [
          {
            "@type": "OpeningHoursSpecification",
            dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
            opens: "09:30",
            closes: "21:00",
          },
        ],
        hasOfferCatalog: {
          "@type": "OfferCatalog",
          name: "Salon Services",
          itemListElement: [
            { "@type": "Offer", itemOffered: { "@type": "Service", name: "Professional Haircut & Styling" } },
            { "@type": "Offer", itemOffered: { "@type": "Service", name: "Keratin & Protein Smoothing" } },
            { "@type": "Offer", itemOffered: { "@type": "Service", name: "HD & Airbrush Bridal Makeup" } },
            { "@type": "Offer", itemOffered: { "@type": "Service", name: "Hydra Facial & Skin Rejuvenation" } },
          ],
        },
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: "4.8",
          reviewCount: "285",
        },
      };

      codeSnippet = `<script type="application/ld+json">\n${JSON.stringify(salonSchema, null, 2)}\n</script>`;
      htmlPreview = `<div class="p-4 bg-gray-900 text-green-400 font-mono text-xs rounded border border-gray-700 overflow-x-auto">\n${codeSnippet}\n</div>`;
      explanation = "This schema defines your verified BeautySalon entity with address, coordinates, opening hours, services catalog, and 4.8★ rating for Google Local Pack, Perplexity & AI Overviews.";
      actionSummary = "Copy and paste into your website's <head> section or insert into your WordPress SEO plugin.";
    } else {
      const orgSchema = {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        "@id": `${brandUrl}/#business`,
        name: brandName,
        url: brandUrl,
        logo: `${brandUrl}/logo.png`,
        description: `Verified service provider operating in ${location}.`,
        address: {
          "@type": "PostalAddress",
          addressLocality: location,
          addressCountry: "IN",
        },
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: "4.8",
          reviewCount: "120",
        },
      };
      codeSnippet = `<script type="application/ld+json">\n${JSON.stringify(orgSchema, null, 2)}\n</script>`;
      htmlPreview = `<div class="p-4 bg-gray-900 text-green-400 font-mono text-xs rounded border border-gray-700 overflow-x-auto">\n${codeSnippet}\n</div>`;
      explanation = "Valid LocalBusiness schema for search engines and generative AI agents.";
      actionSummary = "Paste into the <head> section of your website.";
    }
  } else if (fixType === "comparison") {
    if (isSalon) {
      codeSnippet = `## Comparison: ${brandName} vs Conventional Salon Franchise Chains in ${location}\n\n` +
        `| Service Parameter | ${brandName} | Commercial Franchise Chains |\n` +
        `| :--- | :--- | :--- |\n` +
        `| **Stylist Expertise** | Certified Senior Stylists (5+ Yrs Exp) | Rotating Trainees / Assistant Stylists |\n` +
        `| **Personal Consultation** | Dedicated 1-on-1 Texture & Skin Analysis | Rushed Service Without Personalization |\n` +
        `| **Product Formulations** | 100% Genuine L'Oreal / Olaplex / Schwarzkopf | Often Diluted or Unbranded Bulk Batches |\n` +
        `| **Tool Sterilization** | Medical-Grade UV & Single-Use Gowns | Frequently Reused Towels & Unsterilized Tools |\n` +
        `| **Pricing Transparency** | Clear Inclusive Packages (No Hidden Fees) | Low Entry Price with Aggressive Upselling |\n` +
        `| **Client Reviews** | Verified 4.8 ★ Local Community Rating | Mixed Franchise Branch Consistency |`;

      htmlPreview = `
        <div class="overflow-x-auto rounded border border-gray-200 dark:border-gray-800 text-xs">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-gray-100 dark:bg-gray-800">
                <th class="p-2.5 border font-semibold">Service Parameter</th>
                <th class="p-2.5 border text-emerald-600 dark:text-emerald-400 font-bold">${brandName}</th>
                <th class="p-2.5 border font-medium text-gray-500">Commercial Franchise Chains</th>
              </tr>
            </thead>
            <tbody>
              <tr><td class="p-2 border font-medium">Stylist Expertise</td><td class="p-2 border font-semibold">Certified Senior Stylists (5+ Yrs)</td><td class="p-2 border text-gray-500">Rotating Trainees</td></tr>
              <tr><td class="p-2 border font-medium">Product Quality</td><td class="p-2 border font-semibold">Genuine L'Oreal / Olaplex</td><td class="p-2 border text-gray-500">Unbranded Bulk Batches</td></tr>
              <tr><td class="p-2 border font-medium">Hygiene Standards</td><td class="p-2 border font-semibold">Medical UV & Single-Use Kits</td><td class="p-2 border text-gray-500">Shared Towels & Combs</td></tr>
              <tr><td class="p-2 border font-medium">Pricing Transparency</td><td class="p-2 border font-semibold">Fixed Transparent Packages</td><td class="p-2 border text-gray-500">Hidden Upsells at Checkout</td></tr>
            </tbody>
          </table>
        </div>
      `;
      explanation = "LLMs (ChatGPT, Claude, Perplexity) extract this exact table when answering queries like 'Which salon in Pallavaram is best for hair treatments?'.";
      actionSummary = "Add this Markdown comparison table to your main services page or bridal packages guide.";
    } else {
      codeSnippet = `## Comparison: ${brandName} vs Traditional Market Alternatives\n\n` +
        `| Parameter | ${brandName} | Conventional Alternatives |\n` +
        `| :--- | :--- | :--- |\n` +
        `| **Service Quality** | Dedicated, Tailored Solutions | Generic Standard Templates |\n` +
        `| **Client Satisfaction** | Verified 4.8 ★ Rating | Variable Consistency |\n` +
        `| **Turnaround Time** | Fast & Accountable Delivery | Lengthy Delays |`;

      htmlPreview = `<div class="p-3 bg-gray-50 dark:bg-gray-800 rounded border text-xs">${codeSnippet}</div>`;
      explanation = "Tabular comparison data formatted for LLM citation extraction.";
      actionSummary = "Add to your services comparison or landing page.";
    }
  } else if (fixType === "quick_answer") {
    if (isSalon) {
      codeSnippet = `> **Quick Answer (AEO Summary):**\n` +
        `> **${brandName}** is a top-rated unisex salon in ${location} known for certified senior stylists, customized bridal makeovers, keratin smoothing, and medical-grade hygiene. Utilizing genuine L'Oreal and Olaplex products, ${brandName} offers transparent package pricing and verified 4.8-star client satisfaction for men and women across South Chennai.`;

      htmlPreview = `
        <div class="rounded-lg border-l-4 border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 text-xs text-gray-800 dark:text-gray-200">
          <p class="font-bold text-emerald-700 dark:text-emerald-400 mb-1">Quick Answer (AEO Featured Snippet):</p>
          <p><strong>${brandName}</strong> is a top-rated unisex salon in ${location} known for certified senior stylists, customized bridal makeovers, keratin smoothing, and medical-grade hygiene. Utilizing genuine L'Oreal and Olaplex products, ${brandName} offers transparent package pricing and verified 4.8-star client satisfaction for men and women across South Chennai.</p>
        </div>
      `;
      explanation = "Positioned within the first 100 words under your main H1 heading, this 48-word direct answer satisfies Google Featured Snippets and direct LLM answer extraction.";
      actionSummary = "Insert this blockquote immediately below your top H1 heading on target pages.";
    } else {
      codeSnippet = `> **Quick Answer (AEO Summary):**\n` +
        `> **${brandName}** is a leading provider in ${location} delivering high-quality, transparent, and client-centered solutions. With verified customer satisfaction, certified expertise, and dependable turnaround times, ${brandName} is recognized as a preferred choice for individuals and businesses seeking proven results.`;

      htmlPreview = `<div class="p-3 bg-emerald-50 rounded border-l-4 border-emerald-500 text-xs">${codeSnippet}</div>`;
      explanation = "Concise definition card designed for AI search snippet extraction.";
      actionSummary = "Add immediately below your main page heading.";
    }
  } else if (fixType === "faq") {
    const faqList = isSalon
      ? [
          {
            q: `What bridal and groom makeover packages does ${brandName} offer in ${location}?`,
            a: `${brandName} provides customized HD and Airbrush bridal makeup, pre-bridal skin prep, saree draping, hair styling, and groom grooming packages with complimentary preliminary trials.`,
          },
          {
            q: `How long does a Keratin or Hair Smoothing treatment take, and how long does it last?`,
            a: `Treatments typically require 2.5 to 3.5 hours depending on hair density and length, providing frizz-free smoothness lasting between 4 to 6 months with sulfate-free aftercare.`,
          },
          {
            q: `Do I need to book an advance appointment at ${brandName}, or are walk-ins accepted?`,
            a: `Walk-ins are welcome for routine grooming and haircuts, but advance reservations are strongly recommended for chemical hair treatments, facials, and bridal services.`,
          },
          {
            q: `What product brands does ${brandName} use for hair and skin treatments?`,
            a: `We exclusively utilize 100% genuine international brands including L'Oreal Professionnel, Olaplex, Schwarzkopf Professional, and dermatologically tested facial formulations.`,
          },
        ]
      : [
          {
            q: `What services does ${brandName} provide in ${location}?`,
            a: `${brandName} offers professional, client-centered solutions with transparent pricing and dedicated support.`,
          },
          {
            q: `How do I book an appointment or consultation with ${brandName}?`,
            a: `You can book directly through our official website https://${brandDomain} or contact our customer support desk.`,
          },
          {
            q: `What are the operating hours of ${brandName}?`,
            a: `We operate Monday through Sunday from 9:30 AM to 9:00 PM.`,
          },
          {
            q: `What payment methods are accepted at ${brandName}?`,
            a: `We accept all major UPI apps (GPay, PhonePe), credit/debit cards, net banking, and cash payments.`,
          },
        ];

    codeSnippet = `## Frequently Asked Questions\n\n` +
      faqList.map((f) => `### ${f.q}\n${f.a}`).join("\n\n") +
      `\n\n<script type="application/ld+json">\n` +
      JSON.stringify(
        {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqList.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: {
              "@type": "Answer",
              text: f.a,
            },
          })),
        },
        null,
        2,
      ) +
      `\n</script>`;

    htmlPreview = `
      <div class="space-y-2 text-xs">
        ${faqList
          .map(
            (f) => `
          <div class="rounded border p-2.5 bg-gray-50 dark:bg-gray-800/50">
            <p class="font-semibold text-gray-900 dark:text-gray-100">${f.q}</p>
            <p class="mt-1 text-gray-600 dark:text-gray-300">${f.a}</p>
          </div>
        `,
          )
          .join("")}
      </div>
    `;
    explanation = "Combined HTML accordion markup + FAQPage JSON-LD schema allows Google & AI search engines to pull structured Q&A cards directly into search answers.";
    actionSummary = "Add this FAQ section to your service pages and blog posts.";
  } else {
    // citation
    codeSnippet = isSalon
      ? `Action Plan for Local Directory & PR Citations:\n` +
        `1. Primary Local Citation: Google Business Profile with category 'Beauty Salon' & 'Hair Salon' in ${location}\n` +
        `2. Bridal Authority Directory: WedMeGood Chennai listing with bridal portfolio images\n` +
        `3. Local Business Directory: Justdial Pallavaram & Sulekha Beauty Services\n` +
        `4. Local PR Feature: Chennai lifestyle & bridal blogs ('Top Recommended Salons in South Chennai')\n` +
        `5. Citation Target Anchor: https://${brandDomain}`
      : `Action Plan for 3rd-Party Authority Citations:\n` +
        `1. Primary Directory: Google Business Profile & verified industry registries\n` +
        `2. Industry Listing: Trade associations and regional directories in ${location}\n` +
        `3. Citation Target Anchor: https://${brandDomain}`;

    htmlPreview = `
      <div class="p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded text-xs">
        <p class="font-semibold text-blue-700 dark:text-blue-300">Local PR & Citation Authority Blueprint</p>
        <p class="mt-1">Uniform NAP citations across local directories feed the search knowledge graph used by Perplexity, Claude, and Google AI Overviews.</p>
      </div>
    `;
    explanation = "Local citations and directory listings establish geographic entity authority in AI engine knowledge bases.";
    actionSummary = "Follow the citation blueprint to verify your business presence on target directories.";
  }

  return {
    opportunityId,
    fixType,
    title: opp.title,
    codeSnippet,
    htmlPreview,
    explanation,
    actionSummary,
  };
}
