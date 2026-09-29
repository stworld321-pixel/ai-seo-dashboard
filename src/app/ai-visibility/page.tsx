import Link from "next/link";
import { TopBar } from "@/components/top-bar";
import { MetricCard } from "@/components/metric-card";
import { Card, CardHeader } from "@/components/card";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/badges";
import { PromptRunButton } from "@/components/prompt-run-button";
import { AiAuditRunner } from "@/components/ai-audit-runner";
import { loadPageContext } from "@/server/services/page-context";
import {
  getAiVisibilityMetrics,
  getEngineComparison,
  getWhatShouldIDoNext,
} from "@/server/services/ai-visibility";
import { Sparkles, ArrowRight, Bot, Link2, ExternalLink, MessageSquare } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AiVisibilityPage(props: {
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
  const [metrics, comparison, recommendations] = await Promise.all([
    getAiVisibilityMetrics(website.id),
    getEngineComparison(website.id),
    getWhatShouldIDoNext(website.id),
  ]);

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
        {/* Page Heading & Live Audit Action Toolbar */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-xl font-bold tracking-tight">AI Search Visibility & Authority</h1>
            <p className="mt-0.5 text-xs text-[var(--color-muted)]">
              Track how your brand appears across ChatGPT, Claude, Perplexity & Gemini. Measures observable citations, mentions, and source inclusion.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <AiAuditRunner websiteId={website.id} />
            <Link
              href="/ai-visibility/prompts"
              className="flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)]"
            >
              <Sparkles size={14} className="text-[var(--color-primary)]" />
              Manage Prompts
            </Link>
            <Link
              href="/ai-visibility/audit"
              className="flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)]"
            >
              Weekly Audit
            </Link>
          </div>
        </div>

        {/* Top Metric Cards */}
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <MetricCard
            label="AI Visibility"
            value={`${metrics.visibilityScore}%`}
            deltaLabel="responses with brand/url"
            hint={metrics.visibilityDefinition}
          />
          <MetricCard
            label="AI Citations"
            value={metrics.totalCitations.toString()}
            deltaLabel={metrics.weeklyChange.citationsDelta !== 0 ? `${metrics.weeklyChange.citationsDelta > 0 ? "+" : ""}${metrics.weeklyChange.citationsDelta} vs last audit` : "observed source links"}
            hint={metrics.citationDefinition}
          />
          <MetricCard
            label="Brand Mentions"
            value={metrics.brandMentions.toString()}
            deltaLabel={metrics.weeklyChange.mentionsDelta !== 0 ? `${metrics.weeklyChange.mentionsDelta > 0 ? "+" : ""}${metrics.weeklyChange.mentionsDelta} vs last audit` : "total text mentions"}
            hint={metrics.mentionDefinition}
          />
          <MetricCard
            label="Prompts Tracked"
            value={metrics.promptsTracked.toString()}
            deltaLabel="active queries"
            hint="Count of search questions being monitored across AI engines."
          />
          <MetricCard
            label="Prompt Coverage"
            value={`${metrics.promptCoverage}%`}
            deltaLabel="prompts with test runs"
            hint={metrics.coverageDefinition}
          />
          <MetricCard
            label="Source Mentions"
            value={metrics.sourceMentions.toString()}
            deltaLabel="unique cited domains"
            hint={metrics.sourceDefinition}
          />
          <MetricCard
            label="Weekly Delta"
            value={`${metrics.weeklyChange.visibilityDelta >= 0 ? "+" : ""}${metrics.weeklyChange.visibilityDelta}%`}
            deltaLabel="visibility change"
            hint="Change in observed AI visibility percentage compared to the previous weekly audit."
          />
        </section>

        {/* "WHAT SHOULD I DO NEXT?" Recommendation Panel */}
        <Card>
          <CardHeader
            title="WHAT SHOULD I DO NEXT?"
            subtitle="Prioritized actions synthesized by GEO, Citation, SEO, and Social Intelligence agents."
            action={
              <Link href="/agents" className="flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline">
                View Agent Activity <ArrowRight size={12} />
              </Link>
            }
          />
          <div className="divide-y divide-[var(--color-border)]">
            {recommendations.map((rec) => {
              const actionHref =
                rec.agent === "GEO Agent"
                  ? "/geo-agent"
                  : rec.agent === "Citation Agent"
                  ? "/ai-visibility/citations"
                  : rec.agent === "Reddit Agent"
                  ? "/reddit-agent"
                  : rec.agent === "X Influencer Agent"
                  ? "/x-agent"
                  : "/content/writer";

              return (
                <div key={rec.id} className="p-4 hover:bg-[var(--color-surface-muted)] transition-colors">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-[var(--color-surface-muted)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--color-primary)]">
                          {rec.agent}
                        </span>
                        <StatusBadge
                          status={rec.priority}
                          tone={rec.priority === "HIGH" ? "danger" : rec.priority === "MEDIUM" ? "warning" : "neutral"}
                        />
                        <h4 className="text-sm font-semibold">{rec.title}</h4>
                      </div>
                      <p className="text-xs text-[var(--color-foreground)]">{rec.reason}</p>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--color-muted)]">
                        <span><strong>Evidence:</strong> {rec.evidence}</span>
                        {rec.affectedPrompt && <span>· <strong>Prompt:</strong> &ldquo;{rec.affectedPrompt}&rdquo;</span>}
                      </div>
                    </div>

                    <div className="shrink-0">
                      <Link
                        href={actionHref}
                        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-primary)]/40 bg-[var(--color-primary)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-[var(--color-primary-fg)] transition-all"
                      >
                        <span>{rec.action}</span>
                        <ArrowRight size={12} />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Engine Comparison Table */}
        <Card>
          <CardHeader
            title="AI Engine Comparison Matrix"
            subtitle="Observable mentions and source citations across ChatGPT, Claude, Perplexity & Gemini."
            action={
              <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[var(--color-success)]" /> Cited</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[var(--color-info)]" /> Mentioned</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[var(--color-muted)]" /> Not Mentioned</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> Unavailable</span>
              </div>
            }
          />

          <DataTable
            rows={comparison}
            getKey={(r) => r.promptId}
            empty="No prompts tracked yet. Click 'Auto-Discover Prompts' or 'Manage Prompts' above to start tracking."
            columns={[
              {
                key: "prompt",
                header: "Tracked Prompt",
                render: (r) => (
                  <div className="space-y-0.5">
                    <Link
                      href={`/ai-visibility/prompts/${r.promptId}`}
                      className="font-medium hover:text-[var(--color-primary)] hover:underline"
                    >
                      {r.promptText}
                    </Link>
                    <div className="flex items-center gap-1.5 text-[10px] text-[var(--color-muted)]">
                      <span className="uppercase">{r.intent}</span>
                      <span>·</span>
                      <span>Priority {r.priority === 3 ? "High" : r.priority === 2 ? "Med" : "Low"}</span>
                    </div>
                  </div>
                ),
              },
              {
                key: "chatgpt",
                header: "ChatGPT",
                render: (r) => renderEngineBadge(r.chatgpt),
              },
              {
                key: "claude",
                header: "Claude",
                render: (r) => renderEngineBadge(r.claude),
              },
              {
                key: "perplexity",
                header: "Perplexity",
                render: (r) => renderEngineBadge(r.perplexity),
              },
              {
                key: "gemini",
                header: "Gemini",
                render: (r) => renderEngineBadge(r.gemini),
              },
              {
                key: "action",
                header: "Action",
                align: "right",
                render: (r) => (
                  <PromptRunButton
                    promptId={r.promptId}
                    websiteId={website.id}
                    promptText={r.promptText}
                  />
                ),
              },
            ]}
          />
        </Card>

        {/* Quick Navigation to specialized AI modules */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/geo-agent"
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 hover:border-[var(--color-primary)] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Bot className="text-[var(--color-primary)]" size={18} />
              <h3 className="text-sm font-semibold">GEO Agent</h3>
            </div>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Generative Engine Optimization — diagnose missing entities, comparison gaps, and factual schema.
            </p>
          </Link>

          <Link
            href="/ai-visibility/citations"
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 hover:border-[var(--color-primary)] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Link2 className="text-[var(--color-primary)]" size={18} />
              <h3 className="text-sm font-semibold">AI Citations</h3>
            </div>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Discover which external industry publications and trade sources are repeatedly cited by AI models.
            </p>
          </Link>

          <Link
            href="/reddit-agent"
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 hover:border-[var(--color-primary)] transition-colors"
          >
            <div className="flex items-center gap-2">
              <MessageSquare className="text-[var(--color-primary)]" size={18} />
              <h3 className="text-sm font-semibold">Reddit Agent</h3>
            </div>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Find organic Reddit discussions referenced by AI answer engines and prepare helpful draft responses.
            </p>
          </Link>

          <Link
            href="/ai-visibility/entity"
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 hover:border-[var(--color-primary)] transition-colors"
          >
            <div className="flex items-center gap-2">
              <ExternalLink className="text-[var(--color-primary)]" size={18} />
              <h3 className="text-sm font-semibold">Entity Authority</h3>
            </div>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Build and inspect your brand entity graph and missing product relationships.
            </p>
          </Link>
        </section>
      </div>
    </>
  );
}

function renderEngineBadge(cell: {
  status: "cited" | "mentioned" | "not_mentioned" | "unavailable" | "error";
  position?: number | null;
  sourceUrl?: string | null;
}) {
  switch (cell.status) {
    case "cited":
      return (
        <span className="inline-flex items-center gap-1 rounded bg-green-500/10 px-2 py-0.5 text-xs font-semibold text-[var(--color-success)]">
          Cited {cell.position ? `#${cell.position}` : ""}
        </span>
      );
    case "mentioned":
      return (
        <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-[var(--color-info)]">
          Mentioned {cell.position ? `#${cell.position}` : ""}
        </span>
      );
    case "not_mentioned":
      return (
        <span className="inline-flex items-center gap-1 rounded bg-[var(--color-surface-muted)] px-2 py-0.5 text-xs text-[var(--color-muted)]">
          Not Mentioned
        </span>
      );
    case "unavailable":
      return (
        <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600">
          Unavailable
        </span>
      );
    case "error":
      return (
        <span className="inline-flex items-center gap-1 rounded bg-red-500/10 px-2 py-0.5 text-xs text-[var(--color-danger)]">
          Error
        </span>
      );
  }
}
