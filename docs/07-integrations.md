# Integration Architecture (GSC · GA4 · CMS · LLM)

Every external system sits behind an interface in `src/server/integrations/`. Swapping Composio
for native Google OAuth is a one-line registry change, not a refactor.

## SearchDataProvider

```ts
interface SearchDataProvider {
  listProperties(): Promise<{ siteUrl: string; permissionLevel: string }[]>
  query(p: {
    siteUrl: string; startDate: string; endDate: string
    dimensions: ("date"|"query"|"page"|"country"|"device"|"searchAppearance")[]
    rowLimit?: number; startRow?: number; dataState?: "final"|"all"
  }): Promise<SearchRow[]>                       // {keys[], clicks, impressions, ctr, position}
  inspectUrl(p: { siteUrl: string; inspectionUrl: string }): Promise<UrlInspection>
  listSitemaps(siteUrl: string): Promise<Sitemap[]>
  submitSitemap(siteUrl: string, feedpath: string): Promise<void>   // approval-gated
}
```

### Phase 1 impl: `ComposioGscProvider` — verified working

Connected account `ca_K9RLte-6XvMx`, org `digito2412_workspace`. Tool slugs in use:

| Interface method | Composio tool |
|---|---|
| `listProperties` | `GOOGLE_SEARCH_CONSOLE_LIST_SITES` |
| `query` | `GOOGLE_SEARCH_CONSOLE_SEARCH_ANALYTICS_QUERY` |
| `inspectUrl` | `GOOGLE_SEARCH_CONSOLE_INSPECT_URL` |
| `listSitemaps` | `GOOGLE_SEARCH_CONSOLE_LIST_SITEMAPS` |
| `submitSitemap` | `GOOGLE_SEARCH_CONSOLE_SUBMIT_SITEMAP` |

Live-verified behaviour to code against (from litenatures.in, Aug 27–Sep 21 2026):

- `start_date`/`end_date` are required; `row_limit` ≤ 25 000, paginate with `start_row`, stop
  when `rows < row_limit`.
- Response shape: `{ successful, data: { rows: [{keys:[], clicks, ctr, impressions, position}],
  responseAggregationType } }`. **`rows` may be absent entirely** on no data — treat as `[]`.
- Data for the last ~2–3 days is missing/partial under `data_state: final`. Our sync therefore
  re-pulls a 3-day trailing window every run and upserts.
- Position is a float average, CTR a fraction. Country codes are ISO-3 lowercase (`ind`, `usa`).
- `INSPECT_URL` intermittently 500s → retryable with backoff; `verdict: NEUTRAL` with
  `*_UNSPECIFIED` fields is a valid answer, not a parse error.

Retries: 3 attempts, exponential backoff, jitter; per-website concurrency 1 to respect quota.

### Phase 2 impl: `NativeGscProvider`

Google OAuth (`webmasters.readonly` + `webmasters` for sitemap writes), refresh token stored
encrypted in `Integration.secretCipher`. Same interface, so nothing above it changes.

## AnalyticsProvider (GA4)

```ts
interface AnalyticsProvider {
  listProperties(): Promise<{ propertyId: string; displayName: string }[]>
  runReport(p: { propertyId: string; startDate: string; endDate: string
                 dimensions: string[]; metrics: string[]; limit?: number }): Promise<Ga4Row[]>
}
```

Metrics pulled: `totalUsers, newUsers, sessions, engagedSessions, conversions, totalRevenue,
engagementRate`. Dimensions: `date, landingPagePlusQueryString, sessionSource, sessionMedium,
country, deviceCategory`. Organic split via `sessionDefaultChannelGroup = "Organic Search"`.

**Blending with GSC** (spec §5): GSC gives keyword→page, GA4 gives page→sessions/conversions/
revenue. We join on normalized URL (strip protocol, trailing slash, query params, lowercase host)
and expose `/api/blended/page-value`. Keyword-level revenue is **attributed, not measured** — the
UI labels it as such. No fabricated precision.

## CmsProvider

```ts
interface CmsProvider {
  capabilities(): { canCreate: boolean; canUpdate: boolean; canUpdateMeta: boolean
                    canInjectSchema: boolean; canEditLinks: boolean }
  listContent(p): Promise<CmsItem[]>
  getContent(id): Promise<CmsItem>
  createDraft(item): Promise<{ id: string; url?: string }>
  updateContent(id, patch): Promise<void>
  publish(id): Promise<{ url: string }>
}
```

| CMS | Transport | Auth | Notes |
|---|---|---|---|
| WordPress | REST `/wp-json/wp/v2` | Application Password | schema via post meta or Rank Math/Yoast fields when detected |
| Shopify | Admin GraphQL | Custom app token | blogs/articles + product SEO fields |
| Webflow | Data API v2 | Site token | CMS collection items |
| Custom/Next/React/Laravel | Generic REST adapter | Bearer/HMAC | user maps fields once in settings |

Every CMS write is preceded by a read of current state, stored as a `ContentVersion` — so every
automated change is reversible via `/api/content/:id/rollback`. No adapter exposes a delete
method at all; deletion is deliberately not implementable by an agent.

## LlmProvider

```ts
interface LlmProvider {
  generate(p: { system: string; messages: Msg[]; maxTokens: number
                schema?: ZodSchema; cacheKey?: string }): Promise<{ text|object, usage }>
  embed(texts: string[]): Promise<number[][]>
}
```
Phase 1: `AnthropicProvider` (Claude). Structured outputs enforced by tool-use + Zod validation;
one retry on schema violation, then task FAILS rather than persisting malformed output.
Embeddings: local `@xenova/transformers` MiniLM to avoid a second vendor for similarity checks.

## CrawlProvider

Polite internal crawler: respects robots.txt, 1 req/s per host, caches by ETag. Extracts title,
meta, H1–H3, word count, internal/external links, images+alt, existing JSON-LD, publish/modified
dates. Feeds PageRecord, internal-link engine, AEO analysis, and content scoring.
