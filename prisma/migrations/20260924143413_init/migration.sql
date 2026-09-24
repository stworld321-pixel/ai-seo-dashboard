-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "CmsType" AS ENUM ('WORDPRESS', 'SHOPIFY', 'WEBFLOW', 'NEXTJS', 'REACT', 'LARAVEL', 'CUSTOM', 'OTHER');

-- CreateEnum
CREATE TYPE "IntegrationKind" AS ENUM ('GSC', 'GA4', 'CMS', 'LLM');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('PENDING', 'ACTIVE', 'ERROR', 'REVOKED');

-- CreateEnum
CREATE TYPE "Intent" AS ENUM ('INFORMATIONAL', 'COMMERCIAL', 'TRANSACTIONAL', 'NAVIGATIONAL', 'LOCAL');

-- CreateEnum
CREATE TYPE "Trend" AS ENUM ('UP', 'FLAT', 'DOWN', 'NEW', 'LOST');

-- CreateEnum
CREATE TYPE "PageStatus" AS ENUM ('HEALTHY', 'OPTIMIZE', 'REFRESH', 'EXPAND', 'SUPPORTING', 'REDIRECT', 'INVESTIGATE', 'CANNIBALIZATION');

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('ARTICLE', 'FAQ', 'META_TITLE', 'META_DESCRIPTION', 'SCHEMA', 'INTERNAL_LINK', 'PRODUCT_COPY');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'QA_FAILED', 'AWAITING_APPROVAL', 'APPROVED', 'REJECTED', 'PUBLISHING', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "OpportunityType" AS ENUM ('QUICK_WIN', 'PAGE_TWO', 'CTR_GAP', 'DECLINING_KEYWORD', 'DECLINING_PAGE', 'CONTENT_DECAY', 'CONTENT_GAP', 'CANNIBALIZATION', 'INTERNAL_LINK', 'SCHEMA_MISSING', 'AEO_GAP', 'TECHNICAL');

-- CreateEnum
CREATE TYPE "OppStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'AWAITING_APPROVAL', 'DONE', 'DISMISSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO');

-- CreateEnum
CREATE TYPE "TaskState" AS ENUM ('QUEUED', 'RUNNING', 'WAITING_APPROVAL', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgMember" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',

    CONSTRAINT "OrgMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Website" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "cms" "CmsType" NOT NULL DEFAULT 'CUSTOM',
    "sitemapUrl" TEXT,
    "robotsUrl" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "country" TEXT NOT NULL DEFAULT 'IND',
    "language" TEXT NOT NULL DEFAULT 'en',
    "automationLevel" INTEGER NOT NULL DEFAULT 2,
    "gscProperty" TEXT,
    "ga4PropertyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Website_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "kind" "IntegrationKind" NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "secretCipher" BYTEA,
    "secretIv" BYTEA,
    "secretTag" BYTEA,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'PENDING',
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GscDaily" (
    "websiteId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "clicks" INTEGER NOT NULL,
    "impressions" INTEGER NOT NULL,
    "ctr" DOUBLE PRECISION NOT NULL,
    "position" DOUBLE PRECISION NOT NULL,
    "dataState" TEXT NOT NULL DEFAULT 'final',

    CONSTRAINT "GscDaily_pkey" PRIMARY KEY ("websiteId","date")
);

-- CreateTable
CREATE TABLE "GscQueryDaily" (
    "id" BIGSERIAL NOT NULL,
    "websiteId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "query" TEXT NOT NULL,
    "clicks" INTEGER NOT NULL,
    "impressions" INTEGER NOT NULL,
    "ctr" DOUBLE PRECISION NOT NULL,
    "position" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "GscQueryDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GscPageDaily" (
    "id" BIGSERIAL NOT NULL,
    "websiteId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "page" TEXT NOT NULL,
    "clicks" INTEGER NOT NULL,
    "impressions" INTEGER NOT NULL,
    "ctr" DOUBLE PRECISION NOT NULL,
    "position" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "GscPageDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GscDimensionDaily" (
    "id" BIGSERIAL NOT NULL,
    "websiteId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "dimension" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "clicks" INTEGER NOT NULL,
    "impressions" INTEGER NOT NULL,
    "ctr" DOUBLE PRECISION NOT NULL,
    "position" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "GscDimensionDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncCursor" (
    "websiteId" TEXT NOT NULL,
    "dataset" TEXT NOT NULL,
    "lastCompleteDate" DATE,
    "lastRunAt" TIMESTAMP(3),
    "lastStatus" TEXT,

    CONSTRAINT "SyncCursor_pkey" PRIMARY KEY ("websiteId","dataset")
);

-- CreateTable
CREATE TABLE "Keyword" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "intent" "Intent",
    "intentConfidence" DOUBLE PRECISION,
    "clusterId" TEXT,
    "bestPage" TEXT,
    "clicks28" INTEGER NOT NULL DEFAULT 0,
    "impressions28" INTEGER NOT NULL DEFAULT 0,
    "ctr28" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "position28" DOUBLE PRECISION,
    "clicksPrev28" INTEGER NOT NULL DEFAULT 0,
    "positionPrev28" DOUBLE PRECISION,
    "trend" "Trend" NOT NULL DEFAULT 'FLAT',
    "opportunityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Keyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageRecord" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "metaDescription" TEXT,
    "h1" TEXT,
    "wordCount" INTEGER,
    "lastCrawledAt" TIMESTAMP(3),
    "lastModifiedAt" TIMESTAMP(3),
    "indexState" TEXT,
    "canonical" TEXT,
    "isOrphan" BOOLEAN NOT NULL DEFAULT false,
    "contentScore" INTEGER,
    "contentScoreDetail" JSONB,
    "status" "PageStatus" NOT NULL DEFAULT 'HEALTHY',

    CONSTRAINT "PageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Content" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "pageId" TEXT,
    "type" "ContentType" NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT,
    "primaryKeyword" TEXT,
    "secondaryKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "intent" "Intent",
    "brief" JSONB,
    "body" TEXT,
    "faq" JSONB,
    "schemaJson" JSONB,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "qaReport" JSONB,
    "authorAgent" TEXT,
    "cmsExternalId" TEXT,
    "publishedUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "Content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentVersion" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "diffSummary" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "type" "OpportunityType" NOT NULL,
    "targetUrl" TEXT,
    "keyword" TEXT,
    "priority" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "estimatedClicks" DOUBLE PRECISION,
    "why" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "recommendation" JSONB NOT NULL,
    "status" "OppStatus" NOT NULL DEFAULT 'OPEN',
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoIssue" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "title" TEXT NOT NULL,
    "detail" JSONB NOT NULL,
    "url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeoIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthScoreSnapshot" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "total" INTEGER NOT NULL,
    "breakdown" JSONB NOT NULL,

    CONSTRAINT "HealthScoreSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalLinkSuggestion" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "anchor" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'suggested',
    "appliedAt" TIMESTAMP(3),

    CONSTRAINT "InternalLinkSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentTask" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "agent" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB,
    "state" "TaskState" NOT NULL DEFAULT 'QUEUED',
    "parentId" TEXT,
    "runId" TEXT,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentLog" (
    "id" BIGSERIAL NOT NULL,
    "websiteId" TEXT NOT NULL,
    "taskId" TEXT,
    "agent" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "schedule" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRun" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "summary" JSONB,
    "taskIds" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "AutomationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "riskLevel" "Severity" NOT NULL,
    "payload" JSONB NOT NULL,
    "diff" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requestedBy" TEXT NOT NULL,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentExperiment" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "contentId" TEXT,
    "url" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL,
    "baseline" JSONB NOT NULL,
    "measured14" JSONB,
    "measured28" JSONB,
    "outcome" TEXT,
    "attributes" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "ContentExperiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningSignal" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "signal" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "delta" DOUBLE PRECISION NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "OrgMember_orgId_userId_key" ON "OrgMember"("orgId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Website_orgId_url_key" ON "Website"("orgId", "url");

-- CreateIndex
CREATE UNIQUE INDEX "Integration_websiteId_kind_provider_key" ON "Integration"("websiteId", "kind", "provider");

-- CreateIndex
CREATE INDEX "GscQueryDaily_websiteId_query_date_idx" ON "GscQueryDaily"("websiteId", "query", "date");

-- CreateIndex
CREATE INDEX "GscQueryDaily_websiteId_date_impressions_idx" ON "GscQueryDaily"("websiteId", "date", "impressions" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "GscQueryDaily_websiteId_date_query_key" ON "GscQueryDaily"("websiteId", "date", "query");

-- CreateIndex
CREATE INDEX "GscPageDaily_websiteId_page_date_idx" ON "GscPageDaily"("websiteId", "page", "date");

-- CreateIndex
CREATE UNIQUE INDEX "GscPageDaily_websiteId_date_page_key" ON "GscPageDaily"("websiteId", "date", "page");

-- CreateIndex
CREATE INDEX "GscDimensionDaily_websiteId_dimension_date_idx" ON "GscDimensionDaily"("websiteId", "dimension", "date");

-- CreateIndex
CREATE UNIQUE INDEX "GscDimensionDaily_websiteId_date_dimension_value_key" ON "GscDimensionDaily"("websiteId", "date", "dimension", "value");

-- CreateIndex
CREATE INDEX "Keyword_websiteId_opportunityScore_idx" ON "Keyword"("websiteId", "opportunityScore" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Keyword_websiteId_query_key" ON "Keyword"("websiteId", "query");

-- CreateIndex
CREATE UNIQUE INDEX "PageRecord_websiteId_url_key" ON "PageRecord"("websiteId", "url");

-- CreateIndex
CREATE INDEX "Content_websiteId_status_idx" ON "Content"("websiteId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ContentVersion_contentId_version_key" ON "ContentVersion"("contentId", "version");

-- CreateIndex
CREATE INDEX "Opportunity_websiteId_status_score_idx" ON "Opportunity"("websiteId", "status", "score" DESC);

-- CreateIndex
CREATE INDEX "Opportunity_websiteId_type_idx" ON "Opportunity"("websiteId", "type");

-- CreateIndex
CREATE INDEX "SeoIssue_websiteId_category_status_idx" ON "SeoIssue"("websiteId", "category", "status");

-- CreateIndex
CREATE UNIQUE INDEX "HealthScoreSnapshot_websiteId_date_key" ON "HealthScoreSnapshot"("websiteId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "InternalLinkSuggestion_websiteId_sourceUrl_targetUrl_anchor_key" ON "InternalLinkSuggestion"("websiteId", "sourceUrl", "targetUrl", "anchor");

-- CreateIndex
CREATE INDEX "AgentTask_websiteId_state_createdAt_idx" ON "AgentTask"("websiteId", "state", "createdAt");

-- CreateIndex
CREATE INDEX "AgentLog_websiteId_createdAt_idx" ON "AgentLog"("websiteId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Approval_websiteId_status_idx" ON "Approval"("websiteId", "status");

-- CreateIndex
CREATE INDEX "ContentExperiment_websiteId_appliedAt_idx" ON "ContentExperiment"("websiteId", "appliedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LearningSignal_websiteId_signal_metric_key" ON "LearningSignal"("websiteId", "signal", "metric");

-- CreateIndex
CREATE INDEX "Notification_websiteId_readAt_idx" ON "Notification"("websiteId", "readAt");

-- AddForeignKey
ALTER TABLE "OrgMember" ADD CONSTRAINT "OrgMember_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgMember" ADD CONSTRAINT "OrgMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Website" ADD CONSTRAINT "Website_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GscDaily" ADD CONSTRAINT "GscDaily_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GscQueryDaily" ADD CONSTRAINT "GscQueryDaily_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GscPageDaily" ADD CONSTRAINT "GscPageDaily_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GscDimensionDaily" ADD CONSTRAINT "GscDimensionDaily_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncCursor" ADD CONSTRAINT "SyncCursor_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Keyword" ADD CONSTRAINT "Keyword_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageRecord" ADD CONSTRAINT "PageRecord_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Content" ADD CONSTRAINT "Content_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Content" ADD CONSTRAINT "Content_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "PageRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentVersion" ADD CONSTRAINT "ContentVersion_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoIssue" ADD CONSTRAINT "SeoIssue_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthScoreSnapshot" ADD CONSTRAINT "HealthScoreSnapshot_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalLinkSuggestion" ADD CONSTRAINT "InternalLinkSuggestion_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentTask" ADD CONSTRAINT "AgentTask_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentLog" ADD CONSTRAINT "AgentLog_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRun" ADD CONSTRAINT "AutomationRun_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AutomationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRun" ADD CONSTRAINT "AutomationRun_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentExperiment" ADD CONSTRAINT "ContentExperiment_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentExperiment" ADD CONSTRAINT "ContentExperiment_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningSignal" ADD CONSTRAINT "LearningSignal_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;
