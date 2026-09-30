/**
 * Content Cleaner & Main-Content Extractor
 *
 * Implements Step 2 of the Keyword Research Specification:
 * - Strips navigation, headers, footers, sidebars, cookie banners, menus, forms, scripts, styles.
 * - Removes recurring text blocks that appear on >50% of crawled pages (killing persistent menus & footers).
 * - Extracts JSON-LD schema (Product, Service, LocalBusiness, Organization).
 * - Returns clean, substantive body text per page.
 */

import { decodeHtmlEntities } from "@/server/services/ai-site-auditor";

export type CleanedPage = {
  url: string;
  title: string;
  metaDescription: string | null;
  h1: string;
  h2s: string[];
  h3s: string[];
  cleanBody: string;
  schemaTypes: string[];
  schemas: any[];
  wordCount: number;
};

// Patterns representing structural / navigation / boilerplate elements
const STRUCTURAL_TAG_PATTERNS = [
  /<script[\s\S]*?<\/script>/gi,
  /<style[\s\S]*?<\/style>/gi,
  /<noscript[\s\S]*?<\/noscript>/gi,
  /<svg[\s\S]*?<\/svg>/gi,
  /<nav[\s\S]*?<\/nav>/gi,
  /<header[\s\S]*?<\/header>/gi,
  /<footer[\s\S]*?<\/footer>/gi,
  /<aside[\s\S]*?<\/aside>/gi,
  /<form[\s\S]*?<\/form>/gi,
  /<dialog[\s\S]*?<\/dialog>/gi,
  /<iframe[\s\S]*?<\/iframe>/gi,
];

// Classes or IDs commonly used for navigation, menus, cookie notices, widgets
const BOILERPLATE_CONTAINER_PATTERNS = [
  /<div[^>]*class=["'][^"']*\b(menu|nav|navbar|header|footer|site-footer|site-header|cookie|consent|sidebar|widget|breadcrumb|modal|popup|banner)\b[^"']*["'][\s\S]*?<\/div>/gi,
  /<section[^>]*class=["'][^"']*\b(menu|nav|navbar|header|footer|cookie|consent|sidebar|widget|breadcrumb)\b[^"']*["'][\s\S]*?<\/section>/gi,
  /<ul[^>]*class=["'][^"']*\b(menu|nav|navbar|links|social-icons|breadcrumb)\b[^"']*["'][\s\S]*?<\/ul>/gi,
];

/**
 * Strips HTML tags and normalizes whitespace
 */
export function stripHtmlTags(html: string): string {
  if (!html) return "";
  const noTags = html.replace(/<[^>]+>/g, " ");
  return decodeHtmlEntities(noTags).replace(/\s+/g, " ").trim();
}

/**
 * Extracts structured JSON-LD schemas
 */
export function extractJsonLdSchemas(html: string): { types: string[]; data: any[] } {
  const types: string[] = [];
  const data: any[] = [];
  if (!html) return { types, data };

  const matches = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const m of matches) {
    try {
      const raw = m[1]?.trim();
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (!item) continue;
        data.push(item);
        if (item["@type"]) {
          const tList = Array.isArray(item["@type"]) ? item["@type"] : [item["@type"]];
          for (const t of tList) {
            if (typeof t === "string" && !types.includes(t)) types.push(t);
          }
        }
        if (item["@graph"] && Array.isArray(item["@graph"])) {
          for (const g of item["@graph"]) {
            if (g && g["@type"]) {
              const tList = Array.isArray(g["@type"]) ? g["@type"] : [g["@type"]];
              for (const t of tList) {
                if (typeof t === "string" && !types.includes(t)) types.push(t);
              }
            }
          }
        }
      }
    } catch {
      // ignore JSON parse error in malformed LD+JSON
    }
  }

  return { types, data };
}

/**
 * Cleans an individual page's HTML by stripping structural elements.
 */
export function cleanRawHtml(html: string): string {
  if (!html) return "";

  let working = html;

  // 1. Remove comments
  working = working.replace(/<!--[\s\S]*?-->/g, " ");

  // 2. Remove standard structural tags
  for (const pattern of STRUCTURAL_TAG_PATTERNS) {
    working = working.replace(pattern, " ");
  }

  // 3. Remove common boilerplate containers
  for (const pattern of BOILERPLATE_CONTAINER_PATTERNS) {
    working = working.replace(pattern, " ");
  }

  // 4. Strip remaining HTML tags and decode entities
  return stripHtmlTags(working);
}

/**
 * Removes recurring sentences/paragraphs that appear across more than 50% of pages.
 * This eliminates persistent menu bars, disclaimers, or copyright texts on bad themes.
 */
export function stripRecurringCrossPageBlocks(pages: string[]): string[] {
  if (pages.length <= 1) return pages;

  // Break each page into sentence / segment chunks
  const pageChunks = pages.map((pageText) => {
    return pageText
      .split(/[.!?\n|•]+/)
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length >= 20 && s.split(/\s+/).length >= 3);
  });

  // Count occurrences of each segment across pages
  const segmentPageCount = new Map<string, number>();
  for (const chunks of pageChunks) {
    const uniqueInPage = new Set(chunks);
    for (const chunk of uniqueInPage) {
      segmentPageCount.set(chunk, (segmentPageCount.get(chunk) ?? 0) + 1);
    }
  }

  // Identify boilerplate segments present in >50% of pages
  const threshold = Math.max(2, Math.floor(pages.length * 0.5));
  const boilerplateSegments = new Set<string>();
  for (const [segment, count] of segmentPageCount.entries()) {
    if (count >= threshold) {
      boilerplateSegments.add(segment);
    }
  }

  // Strip these boilerplate segments from each page
  return pages.map((pageText) => {
    let clean = pageText;
    for (const bp of boilerplateSegments) {
      const escaped = bp.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "gi");
      clean = clean.replace(regex, " ");
    }
    return clean.replace(/\s+/g, " ").trim();
  });
}

/**
 * Cleans and extracts content from an array of raw page HTMLs.
 */
export function cleanPagesContent(
  rawPages: Array<{
    url: string;
    html: string;
    title?: string | null;
    h1?: string | null;
    metaDescription?: string | null;
    h2s?: string[];
    h3s?: string[];
  }>,
): CleanedPage[] {
  if (!rawPages || rawPages.length === 0) return [];

  const initialCleaned = rawPages.map((p) => {
    const rawClean = cleanRawHtml(p.html);
    const { types: schemaTypes, data: schemas } = extractJsonLdSchemas(p.html);
    const title = (p.title || "").trim();
    const h1 = (p.h1 || "").trim();
    const metaDescription = p.metaDescription?.trim() || null;
    const h2s = p.h2s || [];
    const h3s = p.h3s || [];

    return {
      url: p.url,
      title,
      metaDescription,
      h1,
      h2s,
      h3s,
      rawClean,
      schemaTypes,
      schemas,
    };
  });

  // Strip recurring cross-page text blocks (>50% frequency)
  const bodies = initialCleaned.map((p) => p.rawClean);
  const refinedBodies = stripRecurringCrossPageBlocks(bodies);

  return initialCleaned.map((p, idx) => {
    const cleanBody = refinedBodies[idx] || p.rawClean;
    const wordCount = cleanBody ? cleanBody.split(/\s+/).length : 0;
    return {
      url: p.url,
      title: p.title,
      metaDescription: p.metaDescription,
      h1: p.h1,
      h2s: p.h2s,
      h3s: p.h3s,
      cleanBody,
      schemaTypes: p.schemaTypes,
      schemas: p.schemas,
      wordCount,
    };
  });
}
