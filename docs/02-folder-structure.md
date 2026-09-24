# Folder Structure

```
ai-seo-command-center/
├── docs/                              # architecture (this folder)
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── app/
│   │   ├── (auth)/login/ · register/
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx             # sidebar + topbar shell
│   │   │   ├── page.tsx               # Dashboard + "What should I do today?"
│   │   │   ├── websites/
│   │   │   ├── performance/search-console/ · analytics/
│   │   │   ├── seo/keywords/ · opportunities/ · pages/ · technical/
│   │   │   ├── content/library/ · generator/ · optimizer/ · internal-links/ · schema/
│   │   │   ├── ai-search/aeo/ · geo/ · visibility/
│   │   │   ├── automation/daily-agent/ · blogs/ · workflows/ · activity/
│   │   │   ├── approvals/
│   │   │   ├── reports/
│   │   │   └── settings/websites/ · integrations/ · team/ · api-keys/
│   │   └── api/
│   │       ├── auth/[...nextauth]/
│   │       ├── websites/
│   │       ├── gsc/{performance,queries,pages,sync}/
│   │       ├── ga4/{performance,sync}/
│   │       ├── seo/{opportunities,issues,health}/
│   │       ├── content/{generate,optimize,publish}/
│   │       ├── internal-links/analyze/
│   │       ├── schema/generate/
│   │       ├── automation/{run,status}/
│   │       ├── approvals/[id]/{approve,reject}/
│   │       ├── agents/tasks/                # Hermes task API (spec §24)
│   │       └── cron/{daily-seo,sync}/       # scheduler entrypoints
│   ├── components/
│   │   ├── ui/                        # shadcn primitives
│   │   ├── metric-card.tsx  chart-card.tsx  data-table.tsx  status-badge.tsx
│   │   ├── opportunity-card.tsx  agent-status.tsx  approval-modal.tsx
│   │   ├── seo-issue-card.tsx  content-editor.tsx  automation-card.tsx
│   │   └── today-panel.tsx            # "WHAT SHOULD I DO TODAY?"
│   ├── server/
│   │   ├── services/                  # application layer (use cases)
│   │   │   ├── websites.ts  gsc.ts  ga4.ts  keywords.ts  pages.ts
│   │   │   ├── opportunities.ts  content.ts  internal-links.ts  schema.ts
│   │   │   ├── health-score.ts  approvals.ts  automation.ts  reports.ts
│   │   ├── intelligence/              # pure, testable analysis functions
│   │   │   ├── quick-wins.ts  page-two.ts  ctr-gaps.ts  decline.ts
│   │   │   ├── decay.ts  cannibalization.ts  clustering.ts  intent.ts
│   │   │   ├── scoring.ts             # priority score + learned weights
│   │   │   └── learning.ts            # signal extraction from experiments
│   │   ├── agents/
│   │   │   ├── orchestrator.ts
│   │   │   ├── seo-analyst.ts  keyword-strategist.ts  content-strategist.ts
│   │   │   ├── content-writer.ts  onpage.ts  technical.ts  qa.ts  performance.ts
│   │   │   ├── registry.ts  runner.ts  tools.ts
│   │   ├── integrations/
│   │   │   ├── search/{provider.ts,composio-gsc.ts,native-gsc.ts}
│   │   │   ├── analytics/{provider.ts,composio-ga4.ts,native-ga4.ts}
│   │   │   ├── cms/{provider.ts,wordpress.ts,shopify.ts,webflow.ts,custom.ts}
│   │   │   ├── llm/{provider.ts,anthropic.ts}
│   │   │   └── crawl/{fetcher.ts,onpage-parser.ts,sitemap.ts,robots.ts}
│   │   ├── queue/{queue.ts,workers/*.ts}
│   │   ├── db.ts  redis.ts  crypto.ts  guard.ts  logger.ts
│   └── lib/                           # shared client-safe utils, types, zod schemas
├── scripts/                           # one-off CLIs (backfill, sync, audit)
├── tests/{unit,integration,e2e}/
├── .claude/commands/                  # Claude Code slash commands (spec §25)
│   ├── seo-audit.md  content-audit.md  keyword-opportunities.md
│   ├── generate-blog.md  optimize-page.md  internal-links.md
│   ├── schema.md  technical-audit.md  gsc-sync.md  ga4-sync.md
└── .env.example
```

Rule: `app/` never imports from `integrations/` directly — only through `services/`.
`intelligence/` imports nothing but types (pure functions, unit-testable without a DB).
