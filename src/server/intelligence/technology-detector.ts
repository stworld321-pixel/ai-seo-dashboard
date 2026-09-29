import http from "node:http";
import https from "node:https";

/**
 * Multi-signal Website Technology Detector & SEO Analyzer.
 *
 * Inspects any website URL (WordPress, Shopify, Next.js, React, Laravel,
 * Django, Static HTML, etc.) without making CMS assumptions.
 *
 * Includes a resilient HTTPS/HTTP fallback (with redirect following and
 * clock-skew-tolerant TLS handling) so self-signed certificates, Let's Encrypt
 * chains on clock-skewed hosts, and CDN redirects never cause false
 * "Website is not reachable" errors.
 */

export type TechnologyAnalysisResult = {
  url: string;
  normalizedUrl: string;
  isReachable: boolean;
  httpStatus: number | null;
  isHttps: boolean;
  title: string | null;
  faviconUrl: string | null;
  detectedCms: string;
  detectedFramework: string;
  detectedHosting: string;
  hasSitemap: boolean;
  sitemapUrl: string | null;
  hasRobotsTxt: boolean;
  robotsUrl: string | null;
  hasSchema: boolean;
  schemaTypes: string[];
  hasGoogleAnalytics: boolean;
  gaMeasurementId: string | null;
  hasGoogleTagManager: boolean;
  gtmId: string | null;
  wordCount: number;
  headings: { h1: string[]; h2Count: number };
  error?: string;
};

const DEFAULT_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 AI-SEO-Crawler/1.0",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

async function fetchWithNodeTlsFallback(
  targetUrl: string,
  opts: { method?: "GET" | "HEAD"; timeoutMs?: number; maxRedirects?: number } = {},
): Promise<{
  ok: boolean;
  status: number;
  finalUrl: string;
  headers: Record<string, string>;
  body: string;
}> {
  const method = opts.method ?? "GET";
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const maxRedirects = opts.maxRedirects ?? 5;

  // 1. Try native fetch first
  try {
    const res = await fetch(targetUrl, {
      method,
      headers: DEFAULT_HEADERS,
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "follow",
    });
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      headers[k.toLowerCase()] = v;
    });
    const body = method === "HEAD" ? "" : await res.text().catch(() => "");
    return {
      ok: res.ok || res.status < 500,
      status: res.status,
      finalUrl: res.url || targetUrl,
      headers,
      body,
    };
  } catch {
    // Fall back to node:https / node:http with rejectUnauthorized: false
  }

  let currentUrl = targetUrl;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const parsed = new URL(currentUrl);
    const isSecure = parsed.protocol === "https:";
    const client = isSecure ? https : http;

    const response = await new Promise<{
      statusCode: number;
      headers: http.IncomingHttpHeaders;
      body: string;
    }>((resolve, reject) => {
      const req = client.request(
        currentUrl,
        {
          method,
          headers: DEFAULT_HEADERS,
          ...(isSecure ? { rejectUnauthorized: false } : {}),
          timeout: timeoutMs,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => {
            if (method !== "HEAD") chunks.push(Buffer.from(chunk));
          });
          res.on("end", () => {
            resolve({
              statusCode: res.statusCode ?? 500,
              headers: res.headers,
              body: Buffer.concat(chunks).toString("utf8"),
            });
          });
        },
      );
      req.on("error", reject);
      req.on("timeout", () => req.destroy(new Error("Request timed out")));
      req.end();
    });

    if (
      [301, 302, 303, 307, 308].includes(response.statusCode) &&
      response.headers.location &&
      hop < maxRedirects
    ) {
      currentUrl = new URL(response.headers.location, currentUrl).href;
      continue;
    }

    const flatHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(response.headers)) {
      if (typeof v === "string") flatHeaders[k.toLowerCase()] = v;
      else if (Array.isArray(v)) flatHeaders[k.toLowerCase()] = v.join(", ");
    }

    return {
      ok: response.statusCode >= 200 && response.statusCode < 500,
      status: response.statusCode,
      finalUrl: currentUrl,
      headers: flatHeaders,
      body: response.body,
    };
  }

  throw new Error("Too many redirects");
}

export async function analyzeWebsiteUrl(rawUrl: string): Promise<TechnologyAnalysisResult> {
  let targetUrl = rawUrl.trim();
  if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
    targetUrl = `https://${targetUrl}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return createFailedResult(rawUrl, "Invalid URL format.");
  }

  let origin = parsed.origin;
  let normalizedUrl = `${origin}/`;
  let isHttps = parsed.protocol === "https:";

  let html = "";
  let responseHeaders: Record<string, string> = {};
  let httpStatus: number | null = null;
  let isReachable = false;

  try {
    const res = await fetchWithNodeTlsFallback(normalizedUrl, {
      method: "GET",
      timeoutMs: 15_000,
    });
    httpStatus = res.status;
    isReachable = res.ok;
    responseHeaders = res.headers;
    html = res.body;
    try {
      const finalParsed = new URL(res.finalUrl);
      origin = finalParsed.origin;
      normalizedUrl = `${origin}/`;
      isHttps = finalParsed.protocol === "https:";
    } catch {
      // Keep original normalizedUrl
    }
  } catch (httpsErr: unknown) {
    // Try http:// fallback if https:// failed completely
    if (isHttps) {
      try {
        const httpFallbackUrl = `http://${parsed.host}/`;
        const res = await fetchWithNodeTlsFallback(httpFallbackUrl, {
          method: "GET",
          timeoutMs: 12_000,
        });
        httpStatus = res.status;
        isReachable = res.ok;
        responseHeaders = res.headers;
        html = res.body;
        origin = `http://${parsed.host}`;
        normalizedUrl = httpFallbackUrl;
        isHttps = false;
      } catch {
        return createFailedResult(
          normalizedUrl,
          httpsErr instanceof Error ? httpsErr.message : "Website unreachable or connection timed out.",
        );
      }
    } else {
      return createFailedResult(
        normalizedUrl,
        httpsErr instanceof Error ? httpsErr.message : "Website unreachable or connection timed out.",
      );
    }
  }

  // 1. Title & Favicon
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch
    ? titleMatch[1]!
        .replace(/&#8211;|&ndash;/g, "–")
        .replace(/&#8212;|&mdash;/g, "—")
        .replace(/&amp;/g, "&")
        .replace(/\s+/g, " ")
        .trim()
    : parsed.hostname;

  const faviconMatch = html.match(
    /<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i,
  );
  let faviconUrl: string | null = null;
  if (faviconMatch && faviconMatch[1]) {
    try {
      faviconUrl = new URL(faviconMatch[1], normalizedUrl).href;
    } catch {
      faviconUrl = `${origin}/favicon.ico`;
    }
  } else {
    faviconUrl = `${origin}/favicon.ico`;
  }

  // 2. Framework Detection
  let detectedFramework = "Static HTML / Custom";
  const lowerHtml = html.toLowerCase();
  const headersStr = Object.entries(responseHeaders)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n")
    .toLowerCase();

  if (
    lowerHtml.includes('id="__next"') ||
    lowerHtml.includes("/_next/static/") ||
    lowerHtml.includes("__next_data__") ||
    headersStr.includes("x-nextjs-page")
  ) {
    detectedFramework = "Next.js";
  } else if (lowerHtml.includes("/_nuxt/") || lowerHtml.includes('id="__nuxt"')) {
    detectedFramework = "Nuxt.js";
  } else if (
    lowerHtml.includes("react-root") ||
    lowerHtml.includes("data-reactroot") ||
    lowerHtml.includes("reactdom") ||
    lowerHtml.includes("react.production.min.js")
  ) {
    detectedFramework = "React";
  } else if (lowerHtml.includes("vue.js") || lowerHtml.includes("data-v-")) {
    detectedFramework = "Vue.js";
  } else if (lowerHtml.includes("ng-version") || lowerHtml.includes("ng-app")) {
    detectedFramework = "Angular";
  } else if (
    headersStr.includes("laravel") ||
    (lowerHtml.includes("csrf-token") && headersStr.includes("php"))
  ) {
    detectedFramework = "Laravel (PHP)";
  } else if (headersStr.includes("django") || lowerHtml.includes("csrfmiddlewaretoken")) {
    detectedFramework = "Django (Python)";
  } else if (
    lowerHtml.includes("/wp-content/") ||
    lowerHtml.includes("/wp-includes/") ||
    headersStr.includes("php")
  ) {
    detectedFramework = "PHP / WordPress";
  } else if (headersStr.includes("express") || headersStr.includes("x-powered-by: nodejs")) {
    detectedFramework = "Node.js";
  }

  // 3. CMS Detection
  let detectedCms = "None / Custom";
  if (
    lowerHtml.includes("/wp-content/") ||
    lowerHtml.includes("/wp-includes/") ||
    lowerHtml.includes('name="generator" content="wordpress')
  ) {
    detectedCms = lowerHtml.includes("woocommerce") ? "WordPress (WooCommerce)" : "WordPress";
  } else if (
    lowerHtml.includes("cdn.shopify.com") ||
    lowerHtml.includes("shopify.com") ||
    headersStr.includes("x-shopify-stage")
  ) {
    detectedCms = "Shopify";
  } else if (lowerHtml.includes("wix.com") || lowerHtml.includes("wix-warmup-data")) {
    detectedCms = "Wix";
  } else if (lowerHtml.includes("webflow.com") || lowerHtml.includes("data-wf-page")) {
    detectedCms = "Webflow";
  } else if (lowerHtml.includes("squarespace.com")) {
    detectedCms = "Squarespace";
  } else if (
    lowerHtml.includes("drupal.js") ||
    lowerHtml.includes('name="generator" content="drupal')
  ) {
    detectedCms = "Drupal";
  } else if (lowerHtml.includes("mage/cookies.js") || lowerHtml.includes("magento")) {
    detectedCms = "Magento";
  }

  // 4. Hosting / CDN Detection
  let detectedHosting = "Standard Server / Cloud";
  if (headersStr.includes("x-vercel-id") || headersStr.includes("vercel")) {
    detectedHosting = "Vercel";
  } else if (headersStr.includes("cf-ray") || headersStr.includes("cloudflare")) {
    detectedHosting = "Cloudflare";
  } else if (headersStr.includes("x-nf-request-id") || headersStr.includes("netlify")) {
    detectedHosting = "Netlify";
  } else if (
    headersStr.includes("awselb") ||
    headersStr.includes("amazons3") ||
    headersStr.includes("cloudfront")
  ) {
    detectedHosting = "AWS";
  } else if (detectedCms.startsWith("Shopify") || headersStr.includes("shopify")) {
    detectedHosting = "Shopify Cloud";
  } else if (headersStr.includes("wpe-backend") || headersStr.includes("wpengine")) {
    detectedHosting = "WP Engine";
  } else if (headersStr.includes("kinsta")) {
    detectedHosting = "Kinsta";
  } else if (headersStr.includes("litespeed") || headersStr.includes("hostinger")) {
    detectedHosting = "LiteSpeed / Hostinger";
  }

  // 5. Check robots.txt and sitemap.xml / sitemap_index.xml in parallel
  const robotsUrl = `${origin}/robots.txt`;
  let sitemapUrl = `${origin}/sitemap.xml`;

  let hasRobotsTxt = false;
  let hasSitemap = false;

  await Promise.all([
    fetchWithNodeTlsFallback(robotsUrl, { method: "GET", timeoutMs: 6_000 })
      .then((r) => {
        hasRobotsTxt = r.status >= 200 && r.status < 400;
        if (r.body.toLowerCase().includes("sitemap:")) {
          hasSitemap = true;
          const smMatch = r.body.match(/Sitemap:\s*(https?:\/\/[^\s]+)/i);
          if (smMatch?.[1]) sitemapUrl = smMatch[1].trim();
        }
      })
      .catch(() => {}),
    fetchWithNodeTlsFallback(sitemapUrl, { method: "HEAD", timeoutMs: 6_000 })
      .then((r) => {
        if (r.status >= 200 && r.status < 400) hasSitemap = true;
      })
      .catch(() => {}),
    fetchWithNodeTlsFallback(`${origin}/sitemap_index.xml`, { method: "HEAD", timeoutMs: 6_000 })
      .then((r) => {
        if (r.status >= 200 && r.status < 400) {
          hasSitemap = true;
          sitemapUrl = `${origin}/sitemap_index.xml`;
        }
      })
      .catch(() => {}),
  ]);

  if (!hasSitemap && lowerHtml.includes("sitemap")) {
    hasSitemap = true;
  }

  // 6. Schema & Structured Data Detection
  const schemaMatches = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  const schemaTypes: string[] = [];
  for (const m of schemaMatches) {
    try {
      const json = JSON.parse(m[1]!) as {
        "@type"?: string;
        "@graph"?: Array<{ "@type"?: string }>;
      };
      if (json["@type"] && !schemaTypes.includes(json["@type"])) {
        schemaTypes.push(json["@type"]);
      }
      if (Array.isArray(json["@graph"])) {
        for (const g of json["@graph"]) {
          if (g["@type"] && !schemaTypes.includes(g["@type"])) schemaTypes.push(g["@type"]);
        }
      }
    } catch {
      // ignore parsing error
    }
  }
  const hasSchema = schemaTypes.length > 0 || /itemscope|itemtype=/i.test(html);

  // 7. Google Analytics & GTM Detection
  const gaMatch = html.match(/\b(G-[A-Z0-9]{6,12}|GT-[A-Z0-9]{6,12})\b/i);
  const gaMeasurementId = gaMatch ? gaMatch[1]! : null;
  const hasGoogleAnalytics =
    Boolean(gaMeasurementId) ||
    lowerHtml.includes("gtag('config'") ||
    lowerHtml.includes("google-analytics.com/analytics.js") ||
    lowerHtml.includes("google-site-kit");

  const gtmMatch = html.match(/\b(GTM-[A-Z0-9]{4,10})\b/i);
  const gtmId = gtmMatch ? gtmMatch[1]! : null;
  const hasGoogleTagManager =
    Boolean(gtmId) || lowerHtml.includes("googletagmanager.com/gtm.js");

  // 8. Headings and basic content metrics
  const h1Matches = Array.from(html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)).map((m) =>
    m[1]!.replace(/<[^>]+>/g, "").trim(),
  );
  const h2Count = Array.from(html.matchAll(/<h2[^>]*>/gi)).length;
  const plainText = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ");
  const wordCount = plainText.split(/\s+/).filter(Boolean).length;

  return {
    url: targetUrl,
    normalizedUrl,
    isReachable,
    httpStatus,
    isHttps,
    title,
    faviconUrl,
    detectedCms,
    detectedFramework,
    detectedHosting,
    hasSitemap,
    sitemapUrl: hasSitemap ? sitemapUrl : null,
    hasRobotsTxt,
    robotsUrl: hasRobotsTxt ? robotsUrl : null,
    hasSchema,
    schemaTypes: schemaTypes.length > 0 ? schemaTypes : hasSchema ? ["Structured Microdata"] : [],
    hasGoogleAnalytics,
    gaMeasurementId,
    hasGoogleTagManager,
    gtmId,
    wordCount,
    headings: { h1: h1Matches, h2Count },
  };
}

function createFailedResult(url: string, error: string): TechnologyAnalysisResult {
  return {
    url,
    normalizedUrl: url,
    isReachable: false,
    httpStatus: null,
    isHttps: url.startsWith("https://"),
    title: null,
    faviconUrl: null,
    detectedCms: "Unknown",
    detectedFramework: "Unknown",
    detectedHosting: "Unknown",
    hasSitemap: false,
    sitemapUrl: null,
    hasRobotsTxt: false,
    robotsUrl: null,
    hasSchema: false,
    schemaTypes: [],
    hasGoogleAnalytics: false,
    gaMeasurementId: null,
    hasGoogleTagManager: false,
    gtmId: null,
    wordCount: 0,
    headings: { h1: [], h2Count: 0 },
    error,
  };
}
