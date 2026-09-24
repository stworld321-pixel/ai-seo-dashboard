# Database Schema (PostgreSQL / Prisma)

Design notes up front:

- **Time-series tables are append-mostly and upserted on a natural key** so re-syncing a day is
  idempotent. Never `DELETE` then re-insert.
- GSC rows are stored at the grain Google gives us; we do **not** store a fake keyword↔page
  cross-join that Google never returned. `gsc_query_page_daily` exists only when we explicitly
  request the `["date","query","page"]` dimension set.
- Money/rates stored as `Decimal`, positions as `Float`, CTR as fraction (0.038) not percent.
- Every intelligence row records `evidence` JSON so the UI can always answer "why?" (spec §38).

## Core / tenancy

```prisma
model Organization { id String @id @default(cuid()) name String slug String @unique
  createdAt DateTime @default(now())
  users OrgMember[]  websites Website[] }

model User { id String @id @default(cuid()) email String @unique name String?
  passwordHash String?  image String?  createdAt DateTime @default(now())
  memberships OrgMember[]  sessions Session[]  approvals Approval[] }

model OrgMember { id String @id @default(cuid())
  orgId String  userId String  role Role @default(MEMBER)
  @@unique([orgId, userId]) }

enum Role { OWNER ADMIN MEMBER VIEWER }
```

## Website = SEO project

```prisma
model Website {
  id String @id @default(cuid())
  orgId String
  name String                    // "Lite Natures"
  url String                     // https://litenatures.in
  cms CmsType @default(CUSTOM)
  sitemapUrl String?
  robotsUrl String?
  timezone String @default("Asia/Kolkata")
  country String @default("IND")
  language String @default("en")
  automationLevel Int @default(2)   // 1..5, spec §21
  gscProperty String?               // "https://litenatures.in/" or "sc-domain:x"
  ga4PropertyId String?
  createdAt DateTime @default(now())

  integrations Integration[]  gscDaily GscDaily[]  gscQueryDaily GscQueryDaily[]
  gscPageDaily GscPageDaily[]  ga4Daily Ga4Daily[]  keywords Keyword[]
  pages PageRecord[]  content Content[]  opportunities Opportunity[]
  issues SeoIssue[]  automations AutomationRule[]  tasks AgentTask[]
  @@unique([orgId, url])
}

enum CmsType { WORDPRESS SHOPIFY WEBFLOW NEXTJS REACT LARAVEL CUSTOM OTHER }
```

## Integrations & secrets

```prisma
model Integration {
  id String @id @default(cuid())
  websiteId String
  kind IntegrationKind            // GSC | GA4 | CMS | LLM
  provider String                 // "composio" | "google" | "wordpress"
  externalId String?              // composio connected_account_id e.g. ca_K9RLte-6XvMx
  config Json                     // non-secret settings
  secretCipher Bytes?             // AES-256-GCM(JSON blob)
  secretIv Bytes?                 // per-record IV
  secretTag Bytes?
  status IntegrationStatus @default(PENDING)
  lastSyncAt DateTime?  lastError String?
  @@unique([websiteId, kind, provider])
}
enum IntegrationKind { GSC GA4 CMS LLM }
enum IntegrationStatus { PENDING ACTIVE ERROR REVOKED }
```

Secrets are never columns of plaintext. `crypto.ts` wraps AES-256-GCM with a key from
`ENCRYPTION_KEY`; the DB stores ciphertext + iv + tag only.

## Search Console time series

```prisma
model GscDaily {           // dimensions: [date]
  websiteId String  date DateTime  clicks Int  impressions Int
  ctr Float  position Float  dataState String @default("final")
  @@id([websiteId, date]) }

model GscQueryDaily {      // dimensions: [date, query]
  id BigInt @id @default(autoincrement())
  websiteId String  date DateTime  query String
  clicks Int  impressions Int  ctr Float  position Float
  @@unique([websiteId, date, query])
  @@index([websiteId, query, date])
  @@index([websiteId, date, impressions(sort: Desc)]) }

model GscPageDaily {       // dimensions: [date, page]
  id BigInt @id @default(autoincrement())
  websiteId String  date DateTime  page String
  clicks Int  impressions Int  ctr Float  position Float
  @@unique([websiteId, date, page])
  @@index([websiteId, page, date]) }

model GscQueryPageDaily {  // dimensions: [date, query, page] — opt-in, larger
  id BigInt @id @default(autoincrement())
  websiteId String  date DateTime  query String  page String
  clicks Int  impressions Int  ctr Float  position Float
  @@unique([websiteId, date, query, page])
  @@index([websiteId, query, date]) }

model GscDimensionDaily {  // country / device / searchAppearance
  id BigInt @id @default(autoincrement())
  websiteId String  date DateTime  dimension String  value String
  clicks Int  impressions Int  ctr Float  position Float
  @@unique([websiteId, date, dimension, value]) }

model SyncCursor {         // spec §4: no redundant API calls
  websiteId String  dataset String   // "gsc:date" | "gsc:query" | "ga4:landing"
  lastCompleteDate DateTime?  lastRunAt DateTime?  lastStatus String?
  @@id([websiteId, dataset]) }
```

## GA4

```prisma
model Ga4Daily {
  websiteId String  date DateTime
  users Int  newUsers Int  sessions Int  engagedSessions Int
  organicUsers Int  organicSessions Int  conversions Int
  revenue Decimal @db.Decimal(14,2)  engagementRate Float
  @@id([websiteId, date]) }

model Ga4LandingPageDaily {
  id BigInt @id @default(autoincrement())
  websiteId String  date DateTime  landingPage String
  sessions Int  organicSessions Int  users Int  conversions Int
  revenue Decimal @db.Decimal(14,2)  engagementRate Float
  @@unique([websiteId, date, landingPage]) }

model Ga4DimensionDaily {   // source / medium / country / device
  id BigInt @id @default(autoincrement())
  websiteId String  date DateTime  dimension String  value String
  sessions Int  users Int  conversions Int
  @@unique([websiteId, date, dimension, value]) }
```

## Derived intelligence

```prisma
model Keyword {
  id String @id @default(cuid())
  websiteId String  query String
  intent Intent?                 // classified, with confidence
  intentConfidence Float?
  clusterId String?
  bestPage String?               // page most often serving this query
  clicks28 Int @default(0) impressions28 Int @default(0)
  ctr28 Float @default(0) position28 Float?
  clicksPrev28 Int @default(0) positionPrev28 Float?
  trend Trend @default(FLAT)
  opportunityScore Float @default(0)
  updatedAt DateTime @updatedAt
  @@unique([websiteId, query])
  @@index([websiteId, opportunityScore(sort: Desc)]) }

enum Intent { INFORMATIONAL COMMERCIAL TRANSACTIONAL NAVIGATIONAL LOCAL }
enum Trend  { UP FLAT DOWN NEW LOST }

model KeywordCluster {
  id String @id @default(cuid())
  websiteId String  label String  pillarKeyword String
  pillarContentId String?  size Int  totalImpressions Int
  createdAt DateTime @default(now()) }

model PageRecord {                 // a URL on the site (crawled + measured)
  id String @id @default(cuid())
  websiteId String  url String
  title String?  metaDescription String?  h1 String?
  wordCount Int?  lastCrawledAt DateTime?  lastModifiedAt DateTime?
  indexState String?               // from URL Inspection
  canonical String?  isOrphan Boolean @default(false)
  contentScore Int?                // 0-100 with breakdown in contentScoreDetail
  contentScoreDetail Json?
  status PageStatus @default(HEALTHY)
  @@unique([websiteId, url]) }

enum PageStatus { HEALTHY OPTIMIZE REFRESH EXPAND SUPPORTING REDIRECT INVESTIGATE CANNIBALIZATION }
```

## Content lifecycle

```prisma
model Content {
  id String @id @default(cuid())
  websiteId String  pageId String?
  type ContentType                // ARTICLE | PRODUCT_COPY | FAQ | META | SCHEMA
  title String  slug String?
  primaryKeyword String?  secondaryKeywords String[]
  intent Intent?  brief Json?  body String?  faq Json?  schemaJson Json?
  status ContentStatus @default(DRAFT)
  qaReport Json?                  // SEO QA Agent output; blocks publish on fail
  authorAgent String?             // which agent produced it
  createdAt DateTime @default(now())  publishedAt DateTime?
  cmsExternalId String?  publishedUrl String?
  versions ContentVersion[]  experiments ContentExperiment[] }

enum ContentType { ARTICLE FAQ META_TITLE META_DESCRIPTION SCHEMA INTERNAL_LINK PRODUCT_COPY }
enum ContentStatus { DRAFT QA_FAILED AWAITING_APPROVAL APPROVED REJECTED PUBLISHING PUBLISHED FAILED }

model ContentVersion {
  id String @id @default(cuid()) contentId String  version Int
  body String  diffSummary String?  createdBy String  createdAt DateTime @default(now())
  @@unique([contentId, version]) }
```

## Opportunities, issues, recommendations

```prisma
model Opportunity {
  id String @id @default(cuid())
  websiteId String
  type OpportunityType
  targetUrl String?  keyword String?
  priority Int                    // 1..5 shown in UI
  score Float                     // raw computed score, drives ordering
  potentialClicks Float?          // modelled from CTR curve — labelled as an estimate
  evidence Json                   // {impressions, position, ctr, siteAvgCtrAtPos, deltas...}
  recommendation Json             // structured actions
  status OppStatus @default(OPEN)
  detectedAt DateTime @default(now())  resolvedAt DateTime?
  @@index([websiteId, status, score(sort: Desc)]) }

enum OpportunityType {
  QUICK_WIN PAGE_TWO CTR_GAP DECLINING_KEYWORD DECLINING_PAGE CONTENT_DECAY
  CONTENT_GAP CANNIBALIZATION INTERNAL_LINK SCHEMA_MISSING AEO_GAP TECHNICAL }
enum OppStatus { OPEN IN_PROGRESS AWAITING_APPROVAL DONE DISMISSED EXPIRED }

model SeoIssue {
  id String @id @default(cuid())
  websiteId String  category String      // technical|content|keywords|internal-linking|ctr|indexation|schema|aeo
  severity Severity  title String  detail Json  url String?
  status String @default("open")  detectedAt DateTime @default(now()) }
enum Severity { CRITICAL HIGH MEDIUM LOW INFO }

model HealthScoreSnapshot {
  id String @id @default(cuid())
  websiteId String  date DateTime  total Int
  breakdown Json                  // per-category score + the issues that cost points
  @@unique([websiteId, date]) }

model InternalLinkSuggestion {
  id String @id @default(cuid())
  websiteId String  sourceUrl String  targetUrl String
  anchor String  reason String  confidence Float
  status String @default("suggested")   // suggested|approved|rejected|applied
  appliedAt DateTime?
  @@unique([websiteId, sourceUrl, targetUrl, anchor]) }
```

## Agents, automation, approvals, learning

```prisma
model AgentTask {
  id String @id @default(cuid())
  websiteId String  agent String            // "orchestrator" | "content-writer" | ...
  kind String  input Json  output Json?
  state TaskState @default(QUEUED)          // spec §24
  parentId String?  runId String?
  error String?  startedAt DateTime? finishedAt DateTime?
  createdAt DateTime @default(now())
  @@index([websiteId, state, createdAt]) }
enum TaskState { QUEUED RUNNING WAITING_APPROVAL COMPLETED FAILED CANCELLED }

model AgentLog {
  id BigInt @id @default(autoincrement())
  taskId String?  websiteId String  agent String  level String
  message String  data Json?  createdAt DateTime @default(now())
  @@index([websiteId, createdAt(sort: Desc)]) }

model AutomationRule {
  id String @id @default(cuid())
  websiteId String  name String  kind String     // daily-seo | blog-generation | ctr-optimizer
  enabled Boolean @default(false)
  schedule String                                 // cron expr in website timezone
  config Json                                     // blogsPerDay, length, tone, audience...
  lastRunAt DateTime?  nextRunAt DateTime? }

model AutomationRun {
  id String @id @default(cuid())
  ruleId String  websiteId String  startedAt DateTime @default(now())
  finishedAt DateTime?  status String  summary Json?  taskIds String[] }

model Approval {
  id String @id @default(cuid())
  websiteId String  entityType String    // content | internal_link | schema | technical_change
  entityId String  action String         // publish | apply | delete | redirect
  riskLevel Severity  payload Json  diff Json?
  status String @default("pending")      // pending|approved|rejected|expired
  requestedBy String  decidedById String? decidedAt DateTime?  note String?
  @@index([websiteId, status]) }

model ContentExperiment {               // the learning loop's measurement unit
  id String @id @default(cuid())
  websiteId String  contentId String?  url String
  changeType String                      // new_article|title_rewrite|meta_rewrite|refresh|internal_links|schema
  appliedAt DateTime
  baseline Json                          // 28d pre metrics
  measured14 Json?  measured28 Json?
  outcome String?                        // win|loss|neutral|inconclusive
  attributes Json                        // {titlePattern:"price_in_title", wordCount:1500, hasFaq:true,...}
}

model LearningSignal {
  id String @id @default(cuid())
  websiteId String  signal String        // "title_pattern:price_in_title"
  metric String                          // ctr | position | clicks
  delta Float  sampleSize Int  confidence Float
  weight Float @default(1.0)             // clamped 0.7..1.4, multiplies opportunity score
  updatedAt DateTime @updatedAt
  @@unique([websiteId, signal, metric]) }

model Notification {
  id String @id @default(cuid())
  websiteId String  type String  severity Severity
  title String  body String  data Json?
  readAt DateTime?  createdAt DateTime @default(now()) }
```

## Index strategy

Hot paths and their indexes:

| Query | Index |
|---|---|
| 28-day trend chart | `GscDaily` PK `(websiteId, date)` — range scan |
| Top queries by impressions in window | `GscQueryDaily(websiteId, date, impressions DESC)` |
| Single keyword history | `GscQueryDaily(websiteId, query, date)` |
| Page history / decay detection | `GscPageDaily(websiteId, page, date)` |
| Opportunity list | `Opportunity(websiteId, status, score DESC)` |
| Approval inbox | `Approval(websiteId, status)` |
| Activity feed | `AgentLog(websiteId, createdAt DESC)` |

`GscQueryDaily` is the growth table (~56 queries × 365 days ≈ 20k rows/yr for litenatures.in; a
large site with 50k queries/day needs partitioning by month — noted as a Phase 5 task, with
`@@map` ready for declarative partitioning).
