-- CreateTable
CREATE TABLE "GscQueryPageDaily" (
    "id" BIGSERIAL NOT NULL,
    "websiteId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "query" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "clicks" INTEGER NOT NULL,
    "impressions" INTEGER NOT NULL,
    "ctr" DOUBLE PRECISION NOT NULL,
    "position" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "GscQueryPageDaily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GscQueryPageDaily_websiteId_query_date_idx" ON "GscQueryPageDaily"("websiteId", "query", "date");

-- CreateIndex
CREATE INDEX "GscQueryPageDaily_websiteId_page_date_idx" ON "GscQueryPageDaily"("websiteId", "page", "date");

-- CreateIndex
CREATE UNIQUE INDEX "GscQueryPageDaily_websiteId_date_query_page_key" ON "GscQueryPageDaily"("websiteId", "date", "query", "page");

-- AddForeignKey
ALTER TABLE "GscQueryPageDaily" ADD CONSTRAINT "GscQueryPageDaily_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;
