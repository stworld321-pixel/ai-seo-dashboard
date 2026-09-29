import Link from "next/link";
import { Card, CardHeader } from "@/components/card";
import { EmptyState, PageHeading } from "@/components/empty-state";
import { StatusBadge } from "@/components/badges";
import { LiveSyncButton } from "@/components/live-sync-button";
import { WebsiteAddForm } from "@/components/website-add-form";
import { WebsiteCardActions } from "@/components/website-card-actions";
import { formatNumber, relativeTime } from "@/lib/format";
import { prisma } from "@/server/db";
import { listWebsites } from "@/server/services/dashboard";
import { getLiveSiteTelemetryFromDb } from "@/server/services/wordpress-sync";

export const dynamic = "force-dynamic";

const AUTOMATION_LABELS: Record<number, string> = {
  1: "Analysis only",
  2: "Recommendations",
  3: "Content drafts",
  4: "Auto-publish approved",
  5: "Fully automated",
};

export default async function WebsitesPage() {
  const websites = await listWebsites();

  if (websites.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          title="No websites yet"
          message="Connect your first website below to sync Search Console and WordPress data."
        />
        <Card className="mt-6">
          <CardHeader
            title="Connect a Website"
            subtitle="Encrypted AES-256-GCM credential storage + live WordPress & GSC sync"
          />
          <WebsiteAddForm />
        </Card>
      </div>
    );
  }

  const rows = await Promise.all(
    websites.map(async (w) => {
      const [dailyCount, queryCount, pageCount, cmsRecordCount, oppCount, cursors, telemetry] =
        await Promise.all([
          prisma.gscDaily.count({ where: { websiteId: w.id } }),
          prisma.gscQueryDaily.count({ where: { websiteId: w.id } }),
          prisma.gscPageDaily.count({ where: { websiteId: w.id } }),
          prisma.pageRecord.count({ where: { websiteId: w.id } }),
          prisma.opportunity.count({ where: { websiteId: w.id, status: "OPEN" } }),
          prisma.syncCursor.findMany({ where: { websiteId: w.id } }),
          getLiveSiteTelemetryFromDb(w.id),
        ]);
      const lastRun = cursors
        .map((c) => c.lastRunAt)
        .filter((d): d is Date => d !== null)
        .sort((a, b) => b.getTime() - a.getTime())[0];
      return {
        w,
        dailyCount,
        queryCount,
        pageCount,
        cmsRecordCount,
        oppCount,
        lastRun: lastRun ?? null,
        telemetry,
      };
    }),
  );

  return (
    <div className="p-6">
      <PageHeading
        title="Websites"
        description="Each website is an independent SEO project with its own isolated Search Console, technical issues, keywords, content opportunities, and AI Agent audits."
        action={<LiveSyncButton />}
      />

      <div className="space-y-4">
        {rows.map(({ w, dailyCount, queryCount, cmsRecordCount, oppCount, lastRun, telemetry }) => {
          const ga4Prop = telemetry.ga4?.propertyId ?? w.ga4PropertyId;
          const ga4Tag = telemetry.ga4?.measurementId;
          return (
            <Card key={w.id}>
              <CardHeader
                title={w.name}
                subtitle={w.url}
                action={
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge
                      status={`Level ${w.automationLevel} — ${AUTOMATION_LABELS[w.automationLevel] ?? "custom"}`}
                      tone={w.automationLevel >= 4 ? "warning" : "neutral"}
                    />
                    <WebsiteCardActions
                      websiteId={w.id}
                      websiteName={w.name}
                      websiteUrl={w.url}
                    />
                    <Link
                      href={`/settings?website=${encodeURIComponent(w.id)}`}
                      className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--color-surface-muted)]"
                    >
                      Configure
                    </Link>
                  </div>
                }
              />
              <div className="grid grid-cols-2 gap-px bg-[var(--color-border)] sm:grid-cols-4">
                <Stat label="Days of GSC data" value={formatNumber(dailyCount)} />
                <Stat label="Ranking queries" value={formatNumber(queryCount)} />
                <Stat label="Synced CMS pages" value={formatNumber(cmsRecordCount)} />
                <Stat label="Open opportunities" value={formatNumber(oppCount)} />
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 px-5 py-4 text-xs sm:grid-cols-4">
                <Field
                  label="CMS / Platform"
                  value={
                    w.cms === "WORDPRESS"
                      ? "WordPress (REST API + SEO)"
                      : w.cms === "SHOPIFY"
                        ? "Shopify"
                        : w.cms === "CUSTOM"
                          ? "Custom / Headless (AI Crawl)"
                          : w.cms
                  }
                />
                <Field label="GSC property" value={w.gscProperty ?? "not set"} mono />
                <Field
                  label="GA4 property"
                  value={
                    ga4Prop
                      ? `${ga4Prop}${ga4Tag ? ` (${ga4Tag})` : ""}`
                      : "not connected"
                  }
                  mono
                />
                <Field label="Last synced" value={relativeTime(lastRun)} />
                <Field label="Timezone" value={w.timezone} />
                <Field label="Country" value={w.country} />
                <Field label="Language" value={w.language} />
                <Field label="Created" value={w.createdAt.toISOString().slice(0, 10)} />
              </dl>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Connect Another Website"
          subtitle="Add a new WordPress, WooCommerce, Shopify, or custom site with AES-256-GCM encrypted credentials"
        />
        <WebsiteAddForm />
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--color-surface)] px-5 py-3">
      <p className="text-xs text-[var(--color-muted)]">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular">{value}</p>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[var(--color-muted)]">{label}</dt>
      <dd className={`mt-0.5 truncate font-medium ${mono ? "font-mono text-[11px]" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
