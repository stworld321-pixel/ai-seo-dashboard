# Agent Architecture

Nine agents (spec §23). Each is a **typed function with a tool allowlist**, not a free-roaming
chat loop. The orchestrator owns sequencing; specialists own judgment.

```
                      ┌─────────────────┐
                      │  ORCHESTRATOR   │  plans, sequences, budgets, retries
                      └────────┬────────┘
        ┌──────────────┬───────┼────────┬──────────────┬──────────────┐
        ▼              ▼       ▼        ▼              ▼              ▼
  SEO ANALYST   KEYWORD STRAT  CONTENT STRAT   ON-PAGE    TECHNICAL   PERFORMANCE
        │              │             │            │           │           │
        └──────────────┴──────┬──────┴────────────┴───────────┘           │
                              ▼                                           │
                       CONTENT WRITER ───► SEO QA AGENT ──► Approval ─────┘
                                              (hard gate)
```

## Contract

```ts
interface Agent<I, O> {
  name: string
  model: "claude-sonnet" | "claude-opus" | "none"   // "none" = deterministic code, no LLM
  tools: ToolName[]                                  // allowlist, enforced at runtime
  inputSchema: ZodSchema<I>
  outputSchema: ZodSchema<O>                         // invalid output = retry once, then FAIL
  run(input: I, ctx: AgentContext): Promise<O>
}
```

`AgentContext` carries `websiteId`, `automationLevel`, `budget` (token + wall-clock), `logger`,
and a `db` handle already scoped to the website. An agent that tries a tool outside its allowlist
throws — this is what stops a content agent from ever calling `cms.deletePage`.

## The nine

| # | Agent | Model | Does | Key tools |
|---|---|---|---|---|
| 1 | **SEO Analyst** | none + sonnet for narrative | Pull GSC/GA4 from DB, compute period-over-period deltas, find what moved and why | `db.query`, `intelligence.*` |
| 2 | **Keyword Strategist** | sonnet | Cluster queries (embeddings + lexical), classify intent, score opportunity | `db.query`, `llm.embed`, `intelligence.clustering` |
| 3 | **Content Strategist** | sonnet | Turn clusters+gaps into topic plan: pillar, supporting, FAQ, commercial. Produces briefs | `db.query`, `crawl.fetch`, `intelligence.gaps` |
| 4 | **Content Writer** | opus | Write article/FAQ/AEO blocks from a brief. Must cite sources for any factual claim | `llm.generate`, `crawl.fetch`, `db.readExistingContent` |
| 5 | **On-Page SEO** | sonnet | Titles, metas, headings, internal links, schema for a given URL | `crawl.onpage`, `db.query`, `schema.generate` |
| 6 | **Technical SEO** | none + sonnet | Indexation (URL Inspection), canonicals, sitemap, robots, 404s, redirects | `gsc.inspect`, `crawl.*` |
| 7 | **SEO QA** | sonnet | **Blocking gate.** Runs before anything reaches approval | `db.similarity`, `intelligence.cannibalization` |
| 8 | **Performance** | none | Measure experiments at +14/+28d, emit learning signals | `db.query`, `intelligence.learning` |
| 9 | **Orchestrator** | sonnet | Daily plan, task graph, dependency + budget management | task API only |

## SEO QA Agent — the rules it enforces (spec §14, §42)

Every check is pass/fail with a reason. Any CRITICAL fail sets `Content.status = QA_FAILED` and
the artifact cannot enter the approval queue.

1. **Near-duplicate** — cosine similarity vs existing site content > 0.86 → FAIL.
2. **Cannibalization** — target keyword already has a page ranking < 15 → FAIL (suggest optimize
   existing instead of new page).
3. **Fabricated facts** — every numeric/statistical claim must carry a source URL that resolves
   (HEAD 200) and whose page contains the number. Unsourced → claim stripped, WARN; >3 unsourced
   → FAIL.
4. **No fake authority** — regex + LLM check for invented expert names, awards, certifications.
5. **Keyword density** — primary keyword > 2.5% → FAIL.
6. **Intent match** — generated content type must match classified intent of the primary keyword.
7. **Internal links** — 2–8, all resolving to real site URLs, no repeated anchor to same target.
8. **Thin content** — below 60% of the median word count of top-performing site pages → WARN.
9. **Schema validity** — JSON-LD parses and validates against schema.org shape.
10. **Brand/tone** — matches website `config.tone`.

## Task state machine (spec §24)

```
QUEUED ──► RUNNING ──┬──► COMPLETED
                     ├──► WAITING_APPROVAL ──► (approve) ──► RUNNING ──► COMPLETED
                     │                        └─(reject)──► CANCELLED
                     └──► FAILED ──► (retry policy: 2 attempts, exp backoff) ──► QUEUED
```

## Hermes integration (spec §24)

Hermes drives the platform through one stable contract — `POST /api/agents/tasks`:

```json
{ "websiteId": "web_...", "agent": "orchestrator", "kind": "analyze_website_performance",
  "input": { "range": "28d" } }
```

returns

```json
{ "taskId": "tsk_...", "state": "queued" }
```

and when complete:

```json
{ "state": "completed",
  "output": { "priority": "high", "issues": [], "opportunities": [],
              "recommended_actions": [], "content_opportunities": [] } }
```

Hermes polls `GET /api/agents/tasks/:id`, surfaces `WAITING_APPROVAL` to the human, and calls
`/api/approvals/:id/approve` once cleared. Hermes never writes to the DB directly — the task API
is the whole surface, which keeps the guardrails in one place.

## Claude Code integration (spec §25)

`.claude/commands/*.md` define repo-local slash commands that run against the dev server and
codebase: `/seo-audit`, `/content-audit`, `/keyword-opportunities`, `/generate-blog`,
`/optimize-page`, `/internal-links`, `/schema`, `/technical-audit`, `/gsc-sync`, `/ga4-sync`.
Each command is a prompt + a script in `scripts/` so it works headless too.

## Cost control

- Deterministic code does the math; LLMs only do judgment and language. The entire opportunity
  engine runs with **zero** LLM calls.
- Per-website daily token budget in `AutomationRule.config.budget`; the orchestrator stops
  queueing when 80% is consumed and reports it rather than silently truncating work.
- Prompt caching for the site-context block (brand, tone, existing titles) reused by every writer
  call.
