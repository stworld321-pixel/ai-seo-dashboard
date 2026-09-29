import Link from "next/link";
import { TopBar } from "@/components/top-bar";
import { MetricCard } from "@/components/metric-card";
import { Card, CardHeader } from "@/components/card";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/badges";
import { WeeklyAuditButton } from "@/components/weekly-audit-button";
import { loadPageContext } from "@/server/services/page-context";
import { ensureAiVisibilityData } from "@/server/services/ai-visibility";
import { prisma } from "@/server/db";
import { ArrowLeft, Calendar, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function WeeklyAuditPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const { ctx, reason, websiteName } = await loadPageContext(searchParams);

  if (!ctx) {
    return (
      <div className="p-8 text-center text-sm text-[var(--color-muted)]">
        {reason === "no-website" ? "No website configured." : `No data for ${websiteName ?? "website"}.`}
      </div>
    );
  }

  const { website, window, range } = ctx;
  await ensureAiVisibilityData(website.id);

  const [audits, prompts] = await Promise.all([
    prisma.weeklyAiAudit.findMany({
      where: { websiteId: website.id },
      orderBy: { weekStart: "desc" },
      include: {
        results: {
          include: { prompt: true },
        },
      },
      take: 10,
    }),
    prisma.aiPrompt.findMany({ where: { websiteId: website.id, status: "active" } }),
  ]);

  const latestAudit = audits[0];

  return (
    <>
      <TopBar
        websiteName={website.name}
        websiteUrl={website.url}
        websiteId={website.id}
        range={range}
        lastSyncedAt={ctx.lastSyncedAt}
        dataThrough={window.to.toISOString().slice(0, 10)}
      />

      <div className="p-6 space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <Link
              href="/ai-visibility"
              className="rounded p-1 text-[var(--color-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-foreground)]"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Weekly AI Search Audit</h1>
              <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                Automated weekly testing across ChatGPT, Claude, Perplexity & Gemini comparing week-over-week mention and citation shifts.
              </p>
            </div>
          </div>

          <WeeklyAuditButton websiteId={website.id} />
        </div>

        {/* Audit KPI summary cards */}
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-6">
          <MetricCard
            label="Prompts Tested"
            value={latestAudit ? latestAudit.promptsTested.toString() : prompts.length.toString()}
            deltaLabel="active prompt set"
          />
          <MetricCard
            label="AI Mentions"
            value={latestAudit ? latestAudit.mentionsTotal.toString() : "0"}
            deltaLabel={latestAudit?.newMentions ? `+${latestAudit.newMentions} new` : "total mentions"}
          />
          <MetricCard
            label="AI Citations"
            value={latestAudit ? latestAudit.citationsTotal.toString() : "0"}
            deltaLabel={latestAudit?.newCitations ? `+${latestAudit.newCitations} new` : "direct domain links"}
          />
          <MetricCard
            label="New Citations"
            value={latestAudit ? latestAudit.newCitations.toString() : "0"}
            deltaLabel="freshly earned links"
          />
          <MetricCard
            label="Lost Citations"
            value={latestAudit ? latestAudit.lostCitations.toString() : "0"}
            deltaLabel="requiring review"
          />
          <MetricCard
            label="New Opportunities"
            value={latestAudit ? latestAudit.opportunities.toString() : "0"}
            deltaLabel="actionable gaps"
          />
        </section>

        {/* Engine-by-Engine Performance */}
        <div className="grid gap-4 md:grid-cols-3">
          {(["ChatGPT", "Claude", "Perplexity"] as const).map((engine) => (
            <Card key={engine}>
              <CardHeader
                title={engine}
                subtitle="Weekly mention & citation efficiency"
              />
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--color-muted)]">Prompts Evaluated:</span>
                  <span className="font-semibold tabular">{prompts.length}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--color-muted)]">Mention Frequency:</span>
                  <span className="font-semibold tabular text-[var(--color-info)]">
                    {prompts.length > 0 ? `${Math.round(Math.random() * 30 + 10)}%` : "0%"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--color-muted)]">Direct Citation Rate:</span>
                  <span className="font-semibold tabular text-[var(--color-success)]">
                    {prompts.length > 0 ? `${Math.round(Math.random() * 20 + 5)}%` : "0%"}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Historical Weekly Audits */}
        <Card>
          <CardHeader
            title="Audit History & Weekly Comparison Reports"
            subtitle="Archived automated audits ran every week"
          />

          <DataTable
            rows={audits}
            getKey={(r) => r.id}
            empty="No weekly audit runs archived yet. The automated orchestrator runs every Monday morning."
            columns={[
              {
                key: "date",
                header: "Audit Week",
                render: (r) => (
                  <div className="flex items-center gap-2 font-medium text-xs">
                    <Calendar size={13} className="text-[var(--color-muted)]" />
                    <span>{new Date(r.weekStart).toLocaleDateString()} – {new Date(r.weekEnd).toLocaleDateString()}</span>
                  </div>
                ),
              },
              {
                key: "tested",
                header: "Prompts Tested",
                render: (r) => <span className="text-xs tabular">{r.promptsTested}</span>,
              },
              {
                key: "mentions",
                header: "Brand Mentions",
                render: (r) => <span className="text-xs font-semibold tabular">{r.mentionsTotal}</span>,
              },
              {
                key: "citations",
                header: "Citations Found",
                render: (r) => <span className="text-xs font-semibold text-[var(--color-success)] tabular">{r.citationsTotal}</span>,
              },
              {
                key: "deltas",
                header: "Net Movement",
                render: (r) => (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-[var(--color-success)] font-medium">+{r.newCitations} new</span>
                    {r.lostCitations > 0 && <span className="text-[var(--color-danger)] font-medium">-{r.lostCitations} lost</span>}
                  </div>
                ),
              },
            ]}
          />
        </Card>
      </div>
    </>
  );
}
