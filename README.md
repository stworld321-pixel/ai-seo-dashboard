# AI SEO Command Center

Autonomous SEO Intelligence & Growth Platform.

> Connect a website once → connect GSC/GA4 → AI analyzes everything → the dashboard tells you
> exactly what to do → agents execute repetitive SEO work → approved content publishes →
> results are measured → the system improves.

## Status

**Phase 1 in progress.** Architecture complete; intelligence core built and tested against real
Google Search Console data.

| Area | State |
|---|---|
| Architecture docs (12 deliverables) | done — `docs/` |
| Next.js 16 + TS + Tailwind 4 scaffold | done |
| Opportunity engine (6 detectors, zero LLM) | done, 24 tests green |
| Site-fitted CTR curve | done |
| Prisma schema / DB | designed, not migrated (needs Neon URL) |
| Auth, website CRUD, sync jobs | not started |
| Dashboard UI | not started |
| Agents, automation, approvals | not started |

## Quick start

```bash
npm install
npx vitest run                   # 24 tests against real litenatures.in GSC data
npx tsx scripts/demo-engine.ts   # see the engine's output on that data
npm run dev
```

## Documentation

| Doc | Contents |
|---|---|
| [01-system-architecture](docs/01-system-architecture.md) | layers, learning loop, multi-tenancy, data freshness |
| [02-folder-structure](docs/02-folder-structure.md) | full tree and import rules |
| [03-database-schema](docs/03-database-schema.md) | 30+ models, index strategy |
| [04-api](docs/04-api.md) | every endpoint |
| [05-agent-architecture](docs/05-agent-architecture.md) | 9 agents, QA gate, Hermes/Claude Code contracts |
| [06-automation-and-opportunity-engine](docs/06-automation-and-opportunity-engine.md) | daily workflow, detection algorithms, health score |
| [07-integrations](docs/07-integrations.md) | GSC / GA4 / CMS / LLM adapters |
| [08-dashboard-wireframe](docs/08-dashboard-wireframe.md) | design tokens, screens, components |
| [09-security](docs/09-security.md) | encryption, guard layer, injection defense |
| [10-mvp-plan](docs/10-mvp-plan.md) | 5 phases, test strategy, required env vars |

## The rule this codebase enforces hardest

**No invented numbers.** litenatures.in has zero clicks in the last 28 days, so no CTR curve can
be fitted — the engine returns `null` for estimated clicks and explains why, rather than borrowing
an industry benchmark to manufacture a plausible-looking "potential traffic" figure. The CTR_GAP
detector disables itself entirely without a fitted curve. Tests assert this.

The same principle runs through the design: no fake search volume, no fabricated backlinks, no
unsourced statistics in generated content, and no CMS delete method for an agent to call.

## What's needed to continue

1. Neon Postgres connection strings (`DATABASE_URL`, `DIRECT_URL`)
2. `COMPOSIO_API_KEY` for server-side GSC calls
3. `ANTHROPIC_API_KEY` (Phase 3+)
4. Upstash Redis credentials (Phase 4+)
