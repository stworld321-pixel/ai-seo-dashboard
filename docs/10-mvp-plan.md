# MVP Implementation Plan

Build order follows spec §40/§41. Each module ends with tests run and errors fixed before the
next starts. No phase is "done" until it works against **real litenatures.in data**.

## Phase 1 — Foundation (current)

| # | Deliverable | Done when |
|---|---|---|
| 1.1 | Next.js 15 + TS + Tailwind + shadcn scaffold, design tokens | `pnpm dev` renders themed shell |
| 1.2 | Prisma schema + migration on Neon | `prisma migrate dev` clean; `prisma studio` shows tables |
| 1.3 | Auth.js (credentials + Google), org/user seeding | register → login → session persists |
| 1.4 | Website CRUD + `/settings/websites`, encrypted Integration storage | litenatures.in created; secret round-trips encrypted |
| 1.5 | `ComposioGscProvider` + sync jobs (date/query/page/country/device) | 28d of real rows in Postgres, idempotent re-run |
| 1.6 | Dashboard: KPI cards, traffic chart, range switcher | numbers match GSC exactly (0 clicks / 584 imp / 25.2) |
| 1.7 | Opportunity Engine v1: QUICK_WIN, PAGE_TWO, CTR_GAP | surfaces "coconut milk soap" p8.8 as P1 |
| 1.8 | "What should I do today?" panel | 5 ranked actions with evidence |

Exit criteria: log in → add website → connect GSC → see real data → see real opportunities.

## Phase 2 — Intelligence
GA4 OAuth + sync · native Google OAuth for GSC · keyword intelligence page (intent
classification, clustering, trend) · page intelligence · decline/decay/cannibalization detectors ·
SEO Health Score with linked issues · notifications.

## Phase 3 — Content
Content library from crawl · brief generator · article generator (Claude) · SEO QA Agent gate ·
content optimizer with scored report · internal linking engine · schema generator · ContentEditor
with live scoring.

## Phase 4 — Autonomy
Agent runtime + 9 agents · task API for Hermes · approval system + ApprovalModal · automation
rules + scheduler · daily SEO agent · blog automation with caps · CMS publish adapters
(WordPress first) · activity log.

## Phase 5 — Advantage
AEO/GEO module · competitor intelligence · advanced reporting/PDF · **learning system**
(experiments → signals → scoring weights) · multi-site rollups · query-table partitioning.

## Testing strategy

- **Unit** (vitest): every function in `intelligence/` with fixture data — including the real
  litenatures.in JSON already saved at `docs/sample-gsc-litenatures.json`. Edge cases that
  actually occur there: zero clicks sitewide, absent `rows`, positions > 50, single-impression
  queries.
- **Integration**: services against a Neon branch DB; Composio provider against recorded
  fixtures (nock) plus one opt-in live smoke test.
- **E2E** (Playwright): register → add site → connect → sync → dashboard shows expected numbers →
  opportunity appears → generate title → approval flow.
- **Guardrail tests** (non-negotiable): QA agent rejects a near-duplicate; guard blocks
  `page.delete` at level 5; unsourced statistic is stripped; publish without approval returns 409.

## Environment

```
DATABASE_URL=            # Neon pooled connection
DIRECT_URL=              # Neon direct, for migrations
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
ENCRYPTION_KEY=          # base64 32 bytes
ANTHROPIC_API_KEY=
COMPOSIO_API_KEY=        # phase 1 GSC/GA4
CRON_SECRET=
```

## What you need to supply before Phase 1 can finish

1. **Neon** connection strings (free tier, 2 min at neon.tech) — blocks 1.2 onward.
2. **Upstash Redis** REST URL + token — needed from Phase 4, optional in Phase 1.
3. **ANTHROPIC_API_KEY** — needed from Phase 3.
4. **COMPOSIO_API_KEY** — for server-side GSC calls (the CLI is already authenticated locally,
   but the app needs its own key).

Until Neon exists, Phase 1 runs against a local Prisma SQLite shadow for schema iteration; the
schema is written Postgres-first (`Bytes`, `String[]`, `Decimal`) so the switch is a datasource
change plus one migration.
