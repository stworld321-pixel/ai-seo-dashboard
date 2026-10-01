-- AlterTable
ALTER TABLE "Keyword" ADD COLUMN     "isCustom" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastCheckedAt" TIMESTAMP(3),
ADD COLUMN     "liveRank" DOUBLE PRECISION,
ADD COLUMN     "liveRankUrl" TEXT,
ADD COLUMN     "serpData" JSONB,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "targetPosition" INTEGER,
ADD COLUMN     "targetUrl" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "creditsRemaining" INTEGER NOT NULL DEFAULT 5000,
ADD COLUMN     "creditsTotal" INTEGER NOT NULL DEFAULT 5000,
ADD COLUMN     "isAdmin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "plan" TEXT NOT NULL DEFAULT 'STARTER',
ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'USER',
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "Website" ADD COLUMN     "faviconUrl" TEXT,
ADD COLUMN     "framework" TEXT,
ADD COLUMN     "hosting" TEXT,
ADD COLUMN     "lastCrawledAt" TIMESTAMP(3),
ADD COLUMN     "lastGa4SyncAt" TIMESTAMP(3),
ADD COLUMN     "lastGscSyncAt" TIMESTAMP(3),
ADD COLUMN     "publishingType" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN     "technology" TEXT;

-- CreateTable
CREATE TABLE "AiPrompt" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "country" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "location" TEXT,
    "industry" TEXT,
    "intent" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 2,
    "status" TEXT NOT NULL DEFAULT 'active',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "approved" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiPrompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiPromptRun" (
    "id" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "response" TEXT,
    "brandMentioned" BOOLEAN,
    "brandPosition" INTEGER,
    "citationFound" BOOLEAN,
    "citationUrl" TEXT,
    "citationDomain" TEXT,
    "competitorsMentioned" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sourceDomains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mentionContext" TEXT,
    "sentiment" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "collectionMethod" TEXT NOT NULL DEFAULT 'api',
    "errorMessage" TEXT,

    CONSTRAINT "AiPromptRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiCompetitor" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiCompetitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeoOpportunity" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "promptId" TEXT,
    "engine" TEXT,
    "gapType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 2,
    "status" TEXT NOT NULL DEFAULT 'open',
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeoOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CitationOpportunity" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "targetDomain" TEXT NOT NULL,
    "targetUrl" TEXT,
    "whyRelevant" TEXT NOT NULL,
    "authorityNotes" TEXT,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'identified',
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CitationOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntityNode" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "pageUrl" TEXT,
    "schemaType" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntityNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntityRelationship" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,

    CONSTRAINT "EntityRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RedditOpportunity" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "subreddit" TEXT NOT NULL,
    "postUrl" TEXT NOT NULL,
    "postTitle" TEXT NOT NULL,
    "question" TEXT,
    "topic" TEXT,
    "relevance" TEXT NOT NULL DEFAULT 'relevant',
    "engagement" INTEGER NOT NULL DEFAULT 0,
    "postedAt" TIMESTAMP(3),
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'new',
    "draftResponse" TEXT,
    "approvedAt" TIMESTAMP(3),
    "postedUrl" TEXT,

    CONSTRAINT "RedditOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XOpportunity" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "creatorHandle" TEXT NOT NULL,
    "postUrl" TEXT,
    "topic" TEXT NOT NULL,
    "relevance" TEXT NOT NULL DEFAULT 'relevant',
    "audienceNotes" TEXT,
    "whyRelevant" TEXT,
    "suggestedAction" TEXT,
    "draftContent" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyAiAudit" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "weekEnd" DATE NOT NULL,
    "promptsTested" INTEGER NOT NULL DEFAULT 0,
    "mentionsTotal" INTEGER NOT NULL DEFAULT 0,
    "citationsTotal" INTEGER NOT NULL DEFAULT 0,
    "newMentions" INTEGER NOT NULL DEFAULT 0,
    "lostMentions" INTEGER NOT NULL DEFAULT 0,
    "newCitations" INTEGER NOT NULL DEFAULT 0,
    "lostCitations" INTEGER NOT NULL DEFAULT 0,
    "opportunities" INTEGER NOT NULL DEFAULT 0,
    "summary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyAiAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyAiAuditResult" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "brandMentioned" BOOLEAN,
    "citationFound" BOOLEAN,
    "prevMentioned" BOOLEAN,
    "prevCitation" BOOLEAN,
    "changed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "WeeklyAiAuditResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleConnection" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "email" TEXT,
    "encryptedAccessToken" BYTEA,
    "encryptedRefreshToken" BYTEA,
    "tokenIv" BYTEA,
    "tokenTag" BYTEA,
    "tokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'connected',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GscProperty" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "googleConnectionId" TEXT NOT NULL,
    "propertyUrl" TEXT NOT NULL,
    "propertyType" TEXT NOT NULL DEFAULT 'URL_PREFIX',
    "permissionLevel" TEXT,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "GscProperty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ga4Property" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "googleConnectionId" TEXT NOT NULL,
    "accountId" TEXT,
    "propertyId" TEXT NOT NULL,
    "propertyName" TEXT,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "Ga4Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishingConnection" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "encryptedSecret" BYTEA,
    "secretIv" BYTEA,
    "secretTag" BYTEA,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastPublishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublishingConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiPrompt_websiteId_status_idx" ON "AiPrompt"("websiteId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AiPrompt_websiteId_text_key" ON "AiPrompt"("websiteId", "text");

-- CreateIndex
CREATE INDEX "AiPromptRun_promptId_runAt_idx" ON "AiPromptRun"("promptId", "runAt" DESC);

-- CreateIndex
CREATE INDEX "AiPromptRun_websiteId_engine_runAt_idx" ON "AiPromptRun"("websiteId", "engine", "runAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "AiCompetitor_websiteId_domain_key" ON "AiCompetitor"("websiteId", "domain");

-- CreateIndex
CREATE INDEX "GeoOpportunity_websiteId_status_idx" ON "GeoOpportunity"("websiteId", "status");

-- CreateIndex
CREATE INDEX "CitationOpportunity_websiteId_status_idx" ON "CitationOpportunity"("websiteId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EntityNode_websiteId_name_type_key" ON "EntityNode"("websiteId", "name", "type");

-- CreateIndex
CREATE UNIQUE INDEX "EntityRelationship_sourceId_targetId_relationship_key" ON "EntityRelationship"("sourceId", "targetId", "relationship");

-- CreateIndex
CREATE INDEX "RedditOpportunity_websiteId_status_idx" ON "RedditOpportunity"("websiteId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RedditOpportunity_websiteId_postUrl_key" ON "RedditOpportunity"("websiteId", "postUrl");

-- CreateIndex
CREATE INDEX "XOpportunity_websiteId_status_idx" ON "XOpportunity"("websiteId", "status");

-- CreateIndex
CREATE INDEX "WeeklyAiAudit_websiteId_weekStart_idx" ON "WeeklyAiAudit"("websiteId", "weekStart" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyAiAudit_websiteId_weekStart_key" ON "WeeklyAiAudit"("websiteId", "weekStart");

-- CreateIndex
CREATE INDEX "WeeklyAiAuditResult_auditId_idx" ON "WeeklyAiAuditResult"("auditId");

-- CreateIndex
CREATE INDEX "GoogleConnection_websiteId_status_idx" ON "GoogleConnection"("websiteId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "GscProperty_websiteId_propertyUrl_key" ON "GscProperty"("websiteId", "propertyUrl");

-- CreateIndex
CREATE UNIQUE INDEX "Ga4Property_websiteId_propertyId_key" ON "Ga4Property"("websiteId", "propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "PublishingConnection_websiteId_type_key" ON "PublishingConnection"("websiteId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");

-- CreateIndex
CREATE INDEX "Keyword_websiteId_isCustom_idx" ON "Keyword"("websiteId", "isCustom");

-- AddForeignKey
ALTER TABLE "AiPrompt" ADD CONSTRAINT "AiPrompt_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiPromptRun" ADD CONSTRAINT "AiPromptRun_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "AiPrompt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiPromptRun" ADD CONSTRAINT "AiPromptRun_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiCompetitor" ADD CONSTRAINT "AiCompetitor_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeoOpportunity" ADD CONSTRAINT "GeoOpportunity_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeoOpportunity" ADD CONSTRAINT "GeoOpportunity_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "AiPrompt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CitationOpportunity" ADD CONSTRAINT "CitationOpportunity_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityNode" ADD CONSTRAINT "EntityNode_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityRelationship" ADD CONSTRAINT "EntityRelationship_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "EntityNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityRelationship" ADD CONSTRAINT "EntityRelationship_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "EntityNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RedditOpportunity" ADD CONSTRAINT "RedditOpportunity_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XOpportunity" ADD CONSTRAINT "XOpportunity_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyAiAudit" ADD CONSTRAINT "WeeklyAiAudit_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyAiAuditResult" ADD CONSTRAINT "WeeklyAiAuditResult_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "WeeklyAiAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyAiAuditResult" ADD CONSTRAINT "WeeklyAiAuditResult_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "AiPrompt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleConnection" ADD CONSTRAINT "GoogleConnection_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GscProperty" ADD CONSTRAINT "GscProperty_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GscProperty" ADD CONSTRAINT "GscProperty_googleConnectionId_fkey" FOREIGN KEY ("googleConnectionId") REFERENCES "GoogleConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ga4Property" ADD CONSTRAINT "Ga4Property_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ga4Property" ADD CONSTRAINT "Ga4Property_googleConnectionId_fkey" FOREIGN KEY ("googleConnectionId") REFERENCES "GoogleConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishingConnection" ADD CONSTRAINT "PublishingConnection_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

