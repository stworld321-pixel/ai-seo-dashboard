import { Card, CardHeader } from "@/components/card";
import { EmptyState, PageHeading } from "@/components/empty-state";
import { MetricCard } from "@/components/metric-card";
import { StatusBadge } from "@/components/badges";
import { TopBar } from "@/components/top-bar";
import { DailyAgentClient } from "@/components/daily-agent-client";
import { formatNumber } from "@/lib/format";
import { prisma } from "@/server/db";
import { loadPageContext } from "@/server/services/page-context";

export const dynamic = "force-dynamic";

const WORKFLOW_STEPS = [
  { step: "1. SYNC", desc: "Pull incremental GSC (date, query, page, query+page, country, device) from cursor" },
  { step: "2. RECONCILE", desc: "Upsert time-series rows and refresh 28-day Keyword & PageRecord rollups" },
  { step: "3. ANALYZE", desc: "Compute period-over-period deltas when baseline coverage is complete" },
  { step: "4. DETECT", desc: "Run deterministic Opportunity Engine (Quick Wins, Page Two, CTR Gap, Decline, Cannibalization)" },
  { step: "5. HEALTH", desc: "Compute SEO Health Score with renormalized category weights and linked issues" },
  { step: "6. PLAN", desc: "Select type-diverse top 5 actions for 'What should I do today?'" },
  { step: "7. QA & GATE", desc: "Validate drafts against density/statistic rules and queue in Approvals" },
];

export default async function DailyAgentPage(props: PageProps<"/automation/daily-agent">) {
  const searchParams = await props.searchParams;
  const { ctx, reason, websiteName } = await loadPageContext(searchParams);

  if (reason === "no-website") {
    return <EmptyState title="No website connected" message="Add a website and sync data first." />;
  }
  if (!ctx) {
    return (
      <EmptyState
        title={`${websiteName} has no data yet`}
        message="No Search Console rows have been synced for this website."
      />
    );
  }

  const { website, window, range } = ctx;
  const [rules, runs, tasks] = await Promise.all([
    prisma.automationRule.findMany({ where: { websiteId: website.id } }),
    prisma.automationRun.findMany({
      where: { websiteId: website.id },
      orderBy: { startedAt: "desc" },
      take: 10,
    }),
    prisma.agentTask.findMany({
      where: { websiteId: website.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const activeRules = rules.filter((r) => r.enabled).length;

  return (
    <>
      <TopBar
        websiteName={website.name}
        websiteUrl={website.url}
        range={range}
        lastSyncedAt={ctx.lastSyncedAt}
        dataThrough={window.to.toISOString().slice(0, 10)}
      />

      <div className="p-6">
        <PageHeading
          title="Daily SEO Agent"
          description="Autonomous daily SEO workflow and scheduled rule execution. Destructive or live CMS changes are hard-gated by the approval system at every automation level."
        />

        <section className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard
            label="Automation Level"
            value={`Level ${website.automationLevel}`}
            deltaLabel="1=Analysis .. 5=Autonomous"
          />
          <MetricCard
            label="Active Rules"
            value={`${activeRules} / ${rules.length}`}
            deltaLabel="scheduled cron jobs"
          />
          <MetricCard
            label="Completed Runs"
            value={formatNumber(runs.length)}
            deltaLabel="recorded in DB"
          />
          <MetricCard
            label="Agent Tasks"
            value={formatNumber(tasks.length)}
            deltaLabel="completed tasks"
          />
        </section>

        <DailyAgentClient websiteId={website.id} rules={rules} />

        <Card className="mt-6">
          <CardHeader
            title="Daily Workflow Architecture (08:00 Site Local Time)"
            subtitle="Each step executes deterministically and logs to AutomationRun + AgentLog"
            action={<StatusBadge status={`Timezone: Asia/Kolkata`} tone="neutral" />}
          />
          <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
            {WORKFLOW_STEPS.map((s) => (
              <div
                key={s.step}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)]/40 p-3.5"
              >
                <p className="font-mono text-xs font-semibold text-[var(--color-primary)]">
                  {s.step}
                </p>
                <p className="mt-1 text-xs text-[var(--color-muted)]">{s.desc}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
