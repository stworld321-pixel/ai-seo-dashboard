# AI SEO Command Center — System Architecture

Autonomous SEO Intelligence & Growth Platform.

Design goal: `Connect website once → connect GSC/GA4 → AI analyzes → dashboard says exactly what
to do → agents execute repetitive work → approved content publishes → results measured → system
learns`.

## 1. Decisions locked for this build

| Concern | Decision | Why |
|---|---|---|
| Framework | Next.js 15 (App Router) + TypeScript | One deployable, RSC for data-heavy tables, API routes for backend |
| UI | Tailwind CSS + shadcn/ui + Recharts | Matches spec §39; shadcn gives us the premium SaaS feel without a component vendor lock |
| DB | PostgreSQL on **Neon** (serverless, hosted) | No local install; branchable DB for safe migrations |
| ORM | Prisma | Type-safe schema, migration history, matches spec |
| Cache/Queue | **Upstash Redis** + BullMQ-compatible queue (`@upstash/workflow` or node-worker) | Hosted, no local Redis daemon |
| Auth | Auth.js (NextAuth v5), credentials + Google | Session in DB, multi-tenant ready |
| GSC/GA4 data | **Composio connector** (Phase 1) → native Google OAuth (Phase 2) | Composio `ca_K9RLte-6XvMx` is already ACTIVE and verified against live data |
| AI provider | **Anthropic Claude API** behind a provider interface | Spec wants pluggable; interface now, one impl |
| Scheduler | Vercel Cron (prod) / node-cron worker (local) | Daily SEO agent at 08:00 site timezone |

Everything else is modular: a new CMS, data source, or agent is a new adapter registered in a map,
never a new branch in core code.

## 2. Layered view

```
┌───────────────────────────────────────────────────────────────────────┐
│ PRESENTATION   Next.js App Router                                     │
│  dashboard · keywords · pages · content · opportunities · automation  │
│  approvals · reports · settings          (RSC + shadcn/ui + Recharts) │
└──────────────┬────────────────────────────────────────────────────────┘
               │ typed server actions / REST (/api/*)
┌──────────────▼────────────────────────────────────────────────────────┐
│ APPLICATION    use-cases, permission checks, approval gating          │
│  services/{websites,gsc,ga4,keywords,content,opportunities,automation}│
└──────────────┬────────────────────────────────────────────────────────┘
               │
┌──────────────▼──────────────┐  ┌─────────────────────────────────────┐
│ INTELLIGENCE                │  │ AGENT RUNTIME                       │
│  opportunity engine         │◄─┤  orchestrator + 9 specialist agents │
│  scoring · clustering       │  │  task queue, state machine, logs    │
│  decay/cannibalization      │  │  tool-calling into services layer   │
│  health score               │  └───────────────┬─────────────────────┘
└──────────────┬──────────────┘                  │
               │                                 │
┌──────────────▼─────────────────────────────────▼─────────────────────┐
│ INTEGRATION ADAPTERS (all behind interfaces)                          │
│  SearchDataProvider: ComposioGSC | NativeGSC                          │
│  AnalyticsProvider:  ComposioGA4 | NativeGA4                          │
│  CmsProvider:        WordPress | Shopify | Webflow | Custom REST      │
│  LlmProvider:        Anthropic | (OpenAI)                             │
│  CrawlProvider:      internal fetcher (sitemap, robots, on-page)      │
└──────────────┬────────────────────────────────────────────────────────┘
               │
┌──────────────▼────────────────────────────────────────────────────────┐
│ DATA   Postgres (Neon) · Redis (Upstash) · encrypted secrets (AES-GCM)│
└───────────────────────────────────────────────────────────────────────┘
```

## 3. The closed learning loop (spec §37)

```
DATA ──► ANALYSIS ──► OPPORTUNITY ──► STRATEGY ──► CONTENT ──► OPTIMIZATION
                                                                    │
  LEARNING ◄── RESULT ◄── MONITOR ◄── PUBLISH ◄────────────────────┘
      │
      └──► writes back to: opportunity scoring weights, title/meta patterns,
           topic-cluster priorities, content format preferences
```

Concretely: every published/optimized artifact gets a `content_experiments` row capturing the
pre-change 28-day baseline (clicks, impressions, CTR, position). 14 and 28 days later the
Performance Agent compares actuals and writes a `learning_signals` row:

```
{ signal: "title_pattern:price_in_title", metric: "ctr", delta: +0.9pp, n: 6, confidence: 0.71 }
```

The Opportunity Engine multiplies its base priority score by learned weights from
`learning_signals` (bounded 0.7–1.4 so one lucky post can't dominate). That is the difference
between "AI that guesses" and "AI that learns from this website".

## 4. Multi-tenancy

`Organization → Website → (integrations, data, content, automations)`. Every intelligence table
carries `website_id`; every query is scoped by it at the service layer, never at the component
layer. One user can run 20 sites (spec §43.19) without cross-contamination of learning signals —
signals are per-website, with an optional org-level prior.

## 5. Data freshness strategy (spec §4 "do not repeatedly request unnecessary API data")

- GSC data is **final only after ~3 days**; we store `data_state` and never overwrite final rows
  with fresh ones.
- Sync is incremental: a `sync_cursors` row per (website, dataset) tracks the last complete date.
  Daily job pulls `[cursor-3d, today-1d]` and upserts on natural key.
- Dimension pulls are capped and paginated (`row_limit` 25k, `start_row` walk), one call per
  dimension set, not per keyword.
- Everything the dashboard renders comes from **our Postgres**, never a live API call. The UI is
  therefore fast and offline-capable, and quota is bounded to O(websites × dimensions) per day.

## 6. Safety rails baked into the architecture (spec §21, §42)

- Automation Level (1–5) is a column on `websites`, default **2**.
- Every mutating adapter call goes through `guard.requireApproval(action, level)`; destructive
  actions (delete page, redirect, canonical, robots.txt, sitewide schema, publish) are hard-gated
  regardless of level unless an explicit per-action override exists.
- All agent output is validated by the SEO QA Agent before it can reach an approval queue:
  duplicate/near-duplicate check (embedding cosine vs existing content), cannibalization check,
  fabricated-statistic check (any numeric claim must carry a source URL or be stripped), keyword
  density ceiling.
- No module can invent search volume, backlinks, or citations — there is no code path that
  generates a metric not traceable to GSC/GA4/crawl.

## 7. Repository layout

See `02-folder-structure.md`. Schema in `03-database-schema.md`, endpoints in `04-api.md`,
agents in `05-agent-architecture.md`, automation in `06-automation.md`, integrations in
`07-integrations.md`, UI in `08-dashboard-wireframe.md`, security in `09-security.md`, plan in
`10-mvp-plan.md`.
