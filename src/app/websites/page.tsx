import { Card, CardHeader } from "@/components/card";
import { DataTable } from "@/components/data-table";
import { EmptyState, PageHeading } from "@/components/empty-state";
import { StatusBadge } from "@/components/badges";
import { formatNumber, relativeTime } from "@/lib/format";
import { prisma } from "@/server/db";
import { listWebsites } from "@/server/services/dashboard";

export const dynamic = "force-dynamic";

const AUTOMATION_LABELS: Record<number, string> = {
  1: "Analysis only",
  2: "Recommendations",
  3: "Content drafts",
  4: "Auto-publish approved",
  5: "Fully automated",
};

/**
 * Website management. Creation is currently done by the sync script rather
 * than a form — the connection flow needs auth and encrypted credential entry,
 * which is Phase 1's remaining work. This page shows real connected state
 * instead of a form that would not yet work end to end.
 */
export default async function WebsitesPage() {
  const websites = await listWebsites();

  if (websites.length === 0) {
    return (
      <EmptyState
        title="No websites yet"
        message="Run the sync script to create a website and pull its Search Console data."
      />
    );
  }

  const rows = await Promise.all(
    websites.map(async (w) => {
      const [dailyCount, queryCount, pageCount, oppCount, cursors] = await Promise.all([
        prisma.gscDaily.count({ where: { websiteId: w.id } }),
        prisma.gscQueryDaily.count({ where: { websiteId: w.id } }),
        prisma.gscPageDaily.count({ where: { websiteId: w.id } }),
        prisma.opportunity.count({ where: { websiteId: w.id, status: "OPEN" } }),
        prisma.syncCursor.findMany({ where: { websiteId: w.id } }),
      ]);
      const lastRun = cursors
        .map((c) => c.lastRunAt)
        .filter((d): d is Date => d !== null)
        .sort((a, b) => b.getTime() - a.getTime())[0];
      return { w, dailyCount, queryCount, pageCount, oppCount, lastRun: lastRun ?? null };
    }),
  );

  return (
    <div className="p-6">
      <PageHeading
        title="Websites"
        description="Each website is an independent SEO project with its own data, opportunities and automation level."
      />

      <div className="space-y-4">
        {rows.map(({ w, dailyCount, queryCount, pageCount, oppCount, lastRun }) => (
          <Card key={w.id}>
            <CardHeader
              title={w.name}
              subtitle={w.url}
              action={
                <StatusBadge
                  status={`Level ${w.automationLevel} — ${AUTOMATION_LABELS[w.automationLevel] ?? "custom"}`}
                  tone={w.automationLevel >= 4 ? "warning" : "neutral"}
                />
              }
            />
            <div className="grid grid-cols-2 gap-px bg-[var(--color-border)] sm:grid-cols-4">
              <Stat label="Days of data" value={formatNumber(dailyCount)} />
              <Stat label="Query rows" value={formatNumber(queryCount)} />
              <Stat label="Page rows" value={formatNumber(pageCount)} />
              <Stat label="Open opportunities" value={formatNumber(oppCount)} />
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 px-5 py-4 text-xs sm:grid-cols-4">
              <Field label="CMS" value={w.cms.toLowerCase()} />
              <Field label="GSC property" value={w.gscProperty ?? "not set"} mono />
              <Field label="GA4 property" value={w.ga4PropertyId ?? "not connected"} />
              <Field label="Last synced" value={relativeTime(lastRun)} />
              <Field label="Timezone" value={w.timezone} />
              <Field label="Country" value={w.country} />
              <Field label="Language" value={w.language} />
              <Field label="Created" value={w.createdAt.toISOString().slice(0, 10)} />
            </dl>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader title="Adding a website" subtitle="Connection UI is not built yet" />
        <div className="px-5 py-4 text-sm text-[var(--color-muted)]">
          <p>
            Websites are currently created by the sync script, which also connects Search
            Console through Composio and pulls the first 30 days of data:
          </p>
          <pre className="mt-3 rounded-md bg-[var(--color-surface-muted)] p-3 text-xs">
            npm run sync:lite
          </pre>
          <p className="mt-3">
            A form-based flow needs authentication and encrypted credential storage — the
            crypto layer exists (<code className="font-mono">src/server/crypto.ts</code>), the
            UI does not.
          </p>
        </div>
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
