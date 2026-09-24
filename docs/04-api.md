# API Architecture

Conventions: REST under `/api`, all responses `{ data, meta }` or `{ error: { code, message,
details } }`. Every route resolves `websiteId` from query/body and authorizes via org membership.
Mutations are idempotent where possible (`Idempotency-Key` header on generate/publish).
Zod schemas in `src/lib/schemas/` are the single source of truth, shared by route handler and
client.

## Websites & integrations

```
GET    /api/websites                        list (org-scoped)
POST   /api/websites                        {name,url,cms,sitemapUrl,robotsUrl,timezone}
GET    /api/websites/:id
PATCH  /api/websites/:id                    incl. automationLevel (1-5)
DELETE /api/websites/:id                    requires confirm token

GET    /api/websites/:id/integrations
POST   /api/websites/:id/integrations       {kind,provider,config,secrets}  → secrets encrypted
POST   /api/integrations/:id/test           live probe, returns sample row
DELETE /api/integrations/:id

GET    /api/integrations/gsc/properties     list verified properties for the connection
GET    /api/integrations/ga4/properties
```

## Search Console

```
GET  /api/gsc/performance?websiteId&range=28d|7d|90d|6m|12m|custom&from&to
     → { totals:{clicks,impressions,ctr,position}, previous:{...}, series:[{date,...}] }
GET  /api/gsc/queries?websiteId&range&limit&offset&sort&minImpressions&positionMin&positionMax
GET  /api/gsc/pages?websiteId&range&...
GET  /api/gsc/dimensions?websiteId&dimension=country|device|searchAppearance&range
GET  /api/gsc/keyword/:query?websiteId&range      single-keyword drilldown
POST /api/gsc/sync                                {websiteId, from?, to?, datasets?[]}
GET  /api/gsc/sync/status?websiteId
POST /api/gsc/inspect                             {websiteId, url} → index status
```

## Analytics (GA4)

```
GET  /api/ga4/performance?websiteId&range
GET  /api/ga4/landing-pages?websiteId&range
GET  /api/ga4/dimensions?websiteId&dimension=source|medium|country|device&range
POST /api/ga4/sync
GET  /api/blended/page-value?websiteId&range     keyword→page→sessions→conversions→revenue
```

## SEO intelligence

```
GET  /api/seo/opportunities?websiteId&type&status&limit
     → [{id,type,priority,score,keyword,targetUrl,potentialClicks,evidence,recommendation}]
POST /api/seo/opportunities/recompute            {websiteId}
PATCH/api/seo/opportunities/:id                  {status:"dismissed"|"in_progress"}
GET  /api/seo/issues?websiteId&category&severity
GET  /api/seo/health?websiteId                   score + per-category breakdown + causes
GET  /api/seo/today?websiteId                    the "What should I do today?" action list
GET  /api/keywords?websiteId&intent&trend&...    keyword intelligence table
GET  /api/pages?websiteId&status&...             page intelligence table
GET  /api/seo/cannibalization?websiteId
GET  /api/seo/clusters?websiteId                 topical clusters + gap analysis
```

## Content

```
POST /api/content/brief                 {websiteId, keyword|opportunityId} → SEO brief
POST /api/content/generate              {websiteId, briefId|keyword, length, tone, audience}
POST /api/content/optimize              {websiteId, url|pageId} → scored report + fixes
POST /api/content/:id/qa                run SEO QA Agent explicitly
GET  /api/content?websiteId&status
GET  /api/content/:id                   incl. versions + qaReport
PATCH/api/content/:id                   edit body/title/meta
POST /api/content/:id/publish           → gated by automationLevel + Approval
POST /api/content/:id/rollback          {version}

POST /api/internal-links/analyze        {websiteId} → suggestions
POST /api/internal-links/:id/apply      approval-gated CMS write
POST /api/schema/generate               {websiteId, url|contentId, type?} → JSON-LD + validation
POST /api/schema/apply                  approval-gated
POST /api/aeo/analyze                   {websiteId, url} → answer-block/entity coverage report
```

## Automation, agents, approvals

```
GET  /api/automation/rules?websiteId
POST /api/automation/rules              {kind, schedule, config, enabled}
PATCH/api/automation/rules/:id
POST /api/automation/run                {websiteId, ruleId|kind} → runId
GET  /api/automation/status?websiteId   current + last runs
GET  /api/automation/runs/:id

POST /api/agents/tasks                  {websiteId, agent, kind, input}  ← Hermes entrypoint
GET  /api/agents/tasks?websiteId&state
GET  /api/agents/tasks/:id              {state, output, logs}
POST /api/agents/tasks/:id/cancel

GET  /api/approvals?websiteId&status
POST /api/approvals/:id/approve         {note?}
POST /api/approvals/:id/reject          {note}

GET  /api/activity?websiteId&limit      unified agent + automation log feed
GET  /api/notifications?websiteId
GET  /api/reports/:kind?websiteId&range  kind=weekly|monthly|custom → JSON or ?format=pdf
```

## Cron entrypoints (server-to-server, `CRON_SECRET` bearer)

```
POST /api/cron/sync          all websites due for sync
POST /api/cron/daily-seo     daily agent per website at local 08:00
POST /api/cron/measure       content experiments at +14d / +28d → learning signals
```

## Error codes

`UNAUTHORIZED` `FORBIDDEN` `NOT_FOUND` `VALIDATION_FAILED` `INTEGRATION_ERROR`
`QUOTA_EXCEEDED` `APPROVAL_REQUIRED` `QA_FAILED` `CMS_WRITE_FAILED` `RATE_LIMITED`.

`APPROVAL_REQUIRED` is a first-class 409 response carrying the created `approvalId` — the client
opens `ApprovalModal` instead of treating it as a failure.
