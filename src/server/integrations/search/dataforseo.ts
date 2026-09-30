import https from "node:https";

export interface DataForSeoCitationReference {
  type: string;
  position?: string;
  source?: string;
  domain: string;
  url: string;
  title: string;
  text?: string;
}

export interface DataForSeoAiOverview {
  found: boolean;
  markdown?: string;
  references: DataForSeoCitationReference[];
  sourceDomains: string[];
  rawItems?: any[];
}

export interface DataForSeoOrganicResult {
  rank: number;
  rankAbsolute: number;
  domain: string;
  title: string;
  url: string;
  snippet: string;
}

export interface DataForSeoSerpResponse {
  query: string;
  location: string;
  language: string;
  aiOverview: DataForSeoAiOverview;
  organic: DataForSeoOrganicResult[];
  peopleAlsoAsk: Array<{ question: string; snippet?: string; url?: string }>;
  relatedSearches: string[];
  totalResultsCount?: number;
}

/**
 * Clean and normalize API authorization token for DataForSEO
 */
function getDataForSeoAuthHeader(): string | null {
  const envKey =
    process.env.DATAFORSEO_API_KEY?.trim() ||
    process.env.DATAFORSEO_KEY?.trim();

  if (envKey) {
    if (envKey.startsWith("Basic ")) return envKey;
    if (envKey.includes(":")) {
      return `Basic ${Buffer.from(envKey).toString("base64")}`;
    }
    return `Basic ${envKey}`;
  }

  const login = process.env.DATAFORSEO_LOGIN?.trim();
  const password = process.env.DATAFORSEO_PASSWORD?.trim();
  if (login && password) {
    return `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`;
  }

  return null;
}

/**
 * Map country code or name to DataForSEO location name/code
 */
export function resolveDataForSeoLocation(countryInput?: string | null): { location_name: string } {
  const c = (countryInput || "US").trim().toUpperCase();
  const map: Record<string, string> = {
    IN: "India",
    IND: "India",
    US: "United States",
    USA: "United States",
    UK: "United Kingdom",
    GB: "United Kingdom",
    CA: "Canada",
    CAN: "Canada",
    AU: "Australia",
    AUS: "Australia",
    AE: "United Arab Emirates",
    UAE: "United Arab Emirates",
    SG: "Singapore",
    SGP: "Singapore",
    DE: "Germany",
    DEU: "Germany",
    FR: "France",
    FRA: "France",
    SA: "Saudi Arabia",
    SAU: "Saudi Arabia",
    MY: "Malaysia",
    MYS: "Malaysia",
    NZ: "New Zealand",
    NZL: "New Zealand",
  };

  const name = map[c] || "United States";
  return { location_name: name };
}

/**
 * Fetch live Google SERP and Google AI Overview citations from DataForSEO
 */
export async function fetchDataForSeoAiOverviewAndSerp(
  query: string,
  options: {
    countryCode?: string | null;
    language?: string;
    depth?: number;
    timeoutMs?: number;
  } = {},
): Promise<DataForSeoSerpResponse | null> {
  const authHeader = getDataForSeoAuthHeader();
  if (!authHeader) return null;

  const loc = resolveDataForSeoLocation(options.countryCode);
  const lang = options.language || "en";
  const depth = options.depth || 100;

  const payload = JSON.stringify([
    {
      keyword: query,
      location_name: loc.location_name,
      language_code: lang,
      device: "desktop",
      depth,
      load_async_ai_overview: true,
    },
  ]);

  return new Promise((resolve) => {
    try {
      const req = https.request(
        "https://api.dataforseo.com/v3/serp/google/organic/live/advanced",
        {
          method: "POST",
          rejectUnauthorized: false,
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
          },
          timeout: options.timeoutMs || 25000,
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            try {
              if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
                resolve(null);
                return;
              }

              const json = JSON.parse(data) as {
                status_code?: number;
                tasks?: Array<{
                  result?: Array<{
                    items_count?: number;
                    items?: any[];
                  }>;
                }>;
              };

              const result = json.tasks?.[0]?.result?.[0];
              if (!result || !Array.isArray(result.items)) {
                resolve(null);
                return;
              }

              const items = result.items;

              // 1. Extract AI Overview & Citations
              const aiItem = items.find((i) => i.type === "ai_overview");
              const references: DataForSeoCitationReference[] = [];
              const sourceDomainsSet = new Set<string>();

              if (aiItem) {
                const rawRefs = Array.isArray(aiItem.references) ? aiItem.references : [];
                for (const ref of rawRefs) {
                  const url = ref.url || ref.link || "";
                  let domain = ref.domain || "";
                  if (!domain && url) {
                    try {
                      domain = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
                    } catch {
                      domain = url;
                    }
                  } else {
                    domain = domain.replace(/^www\./, "").toLowerCase();
                  }

                  if (domain) sourceDomainsSet.add(domain);

                  references.push({
                    type: ref.type || "ai_overview_reference",
                    position: ref.position,
                    source: ref.source,
                    domain,
                    url,
                    title: ref.title || ref.source || "Citation Source",
                    text: ref.text || ref.snippet,
                  });
                }
              }

              const aiOverview: DataForSeoAiOverview = {
                found: Boolean(aiItem),
                markdown: aiItem?.markdown,
                references,
                sourceDomains: Array.from(sourceDomainsSet),
                rawItems: aiItem?.items,
              };

              // 2. Extract Organic rankings
              const organic: DataForSeoOrganicResult[] = items
                .filter((i) => i.type === "organic")
                .map((o, idx) => {
                  const url = o.url || "";
                  let domain = o.domain || "";
                  if (!domain && url) {
                    try {
                      domain = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
                    } catch {
                      domain = url;
                    }
                  }
                  return {
                    rank: o.rank_group ?? idx + 1,
                    rankAbsolute: o.rank_absolute ?? idx + 1,
                    domain: domain.replace(/^www\./, "").toLowerCase(),
                    title: o.title || "",
                    url,
                    snippet: o.description || o.snippet || "",
                  };
                });

              // 3. Extract People Also Ask
              const paaItems: Array<{ question: string; snippet?: string; url?: string }> = [];
              for (const i of items) {
                if (i.type === "people_also_ask" && Array.isArray(i.items)) {
                  for (const p of i.items) {
                    paaItems.push({
                      question: p.title || p.question || "",
                      snippet: p.description || p.snippet || "",
                      url: p.url,
                    });
                  }
                }
              }

              // 4. Extract Related Searches
              const relatedSearches: string[] = [];
              const relItem = items.find((i) => i.type === "related_searches");
              if (relItem && Array.isArray(relItem.items)) {
                for (const r of relItem.items) {
                  if (typeof r === "string") relatedSearches.push(r);
                  else if (r?.keyword || r?.title) relatedSearches.push(r.keyword || r.title);
                }
              }

              resolve({
                query,
                location: loc.location_name,
                language: lang,
                aiOverview,
                organic,
                peopleAlsoAsk: paaItems,
                relatedSearches,
                totalResultsCount: result.items_count,
              });
            } catch {
              resolve(null);
            }
          });
        },
      );

      req.on("error", () => resolve(null));
      req.on("timeout", () => {
        req.destroy();
        resolve(null);
      });

      req.write(payload);
      req.end();
    } catch {
      resolve(null);
    }
  });
}
