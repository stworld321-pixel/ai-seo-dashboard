import Link from "next/link";
import { TopBar } from "@/components/top-bar";
import { Card, CardHeader } from "@/components/card";
import { MetricCard } from "@/components/metric-card";
import { StatusBadge } from "@/components/badges";
import { loadPageContext } from "@/server/services/page-context";
import { prisma } from "@/server/db";
import { Bot, Sparkles, Target, FileText, MessageSquare, Globe, Link2, ArrowRight, Play } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AgentsDashboardPage(props: {
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

  const [tasks, logs] = await Promise.all([
    prisma.agentTask.findMany({ where: { websiteId: website.id }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.agentLog.findMany({ where: { websiteId: website.id }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);

  const agents = [
    {
      name: "SEO Agent",
      slug: "seo-agent",
      icon: Target,
      status: "Active",
      description: "Combines Search Console keywords and CTR curves with modern AI prompt targets.",
      lastRun: "Today, 09:30 AM",
      tasksCompleted: 48,
      tasksPending: 3,
      errors: 0,
      nextRun: "Tomorrow, 09:00 AM",
      href: "/seo-agent",
    },
    {
      name: "GEO Agent",
      slug: "geo-agent",
      icon: Bot,
      status: "Active",
      description: "Diagnoses generative engine responses, entity structuring gaps, and comparison tables.",
      lastRun: "Today, 10:15 AM",
      tasksCompleted: 32,
      tasksPending: 2,
      errors: 0,
      nextRun: "Tomorrow, 10:00 AM",
      href: "/geo-agent",
    },
    {
      name: "Citation Agent",
      slug: "citation-agent",
      icon: Link2,
      status: "Active",
      description: "Identifies authoritative publications, trade bodies, and directories feeding AI training graphs.",
      lastRun: "Yesterday, 04:00 PM",
      tasksCompleted: 19,
      tasksPending: 1,
      errors: 0,
      nextRun: "In 2 days",
      href: "/ai-visibility/citations",
    },
    {
      name: "Article Agent",
      slug: "article-agent",
      icon: FileText,
      status: "Active",
      description: "Synthesizes answer-first content briefs and articles with structured schema and QA gates.",
      lastRun: "Today, 11:45 AM",
      tasksCompleted: 14,
      tasksPending: 4,
      errors: 0,
      nextRun: "In 1 day",
      href: "/article-agent",
    },
    {
      name: "Reddit Agent",
      slug: "reddit-agent",
      icon: MessageSquare,
      status: "Active",
      description: "Monitors organic community discussions and prepares non-spam engineering draft advice.",
      lastRun: "Today, 08:00 AM",
      tasksCompleted: 22,
      tasksPending: 2,
      errors: 0,
      nextRun: "Tomorrow, 08:00 AM",
      href: "/reddit-agent",
    },
    {
      name: "X Influencer Agent",
      slug: "x-agent",
      icon: Globe,
      status: "Active",
      description: "Maps verified industry creators and drafts high-context collaboration outreach.",
      lastRun: "Yesterday, 02:30 PM",
      tasksCompleted: 11,
      tasksPending: 1,
      errors: 0,
      nextRun: "In 3 days",
      href: "/x-agent",
    },
  ];

  return (
    <>
      <TopBar
        websiteName={website.name}
        websiteUrl={website.url}
        range={range}
        lastSyncedAt={ctx.lastSyncedAt}
        dataThrough={window.to.toISOString().slice(0, 10)}
      />

      <div className="p-6 space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-xl font-bold tracking-tight">AI SEO Orchestrator &amp; Agent Activity</h1>
            <p className="mt-0.5 text-xs text-[var(--color-muted)]">
              Coordinated multi-agent workflow managing traditional SEO, generative search optimization, and digital authority.
            </p>
          </div>

          <Link
            href="/agents/tasks"
            className="flex items-center gap-1.5 rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary-fg)] hover:opacity-90"
          >
            View Task Queue ({tasks.length}) <ArrowRight size={14} />
          </Link>
        </div>

        {/* Orchestrator Master Workflow Strip */}
        <Card>
          <CardHeader
            title="Hermes Multi-Agent Orchestrator Pipeline"
            subtitle="Autonomous synchronization cycle executed across all specialized agents"
          />
          <div className="p-5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="rounded bg-[var(--color-surface-muted)] px-2.5 py-1 font-medium">GSC Data</span>
            <span>→</span>
            <span className="rounded bg-[var(--color-surface-muted)] px-2.5 py-1 font-medium">SEO Agent</span>
            <span>→</span>
            <span className="rounded bg-[var(--color-surface-muted)] px-2.5 py-1 font-medium">Prompt Discovery</span>
            <span>→</span>
            <span className="rounded bg-[var(--color-surface-muted)] px-2.5 py-1 font-medium">AI Visibility</span>
            <span>→</span>
            <span className="rounded bg-[var(--color-surface-muted)] px-2.5 py-1 font-medium">GEO Agent</span>
            <span>→</span>
            <span className="rounded bg-[var(--color-surface-muted)] px-2.5 py-1 font-medium">Citation Agent</span>
            <span>→</span>
            <span className="rounded bg-[var(--color-surface-muted)] px-2.5 py-1 font-medium">Article Agent</span>
            <span>→</span>
            <span className="rounded bg-amber-500/10 text-amber-600 px-2.5 py-1 font-semibold">Human Approval</span>
            <span>→</span>
            <span className="rounded bg-green-500/10 text-[var(--color-success)] px-2.5 py-1 font-semibold">Weekly Audit</span>
          </div>
        </Card>

        {/* Agent Cards Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => {
            const Icon = agent.icon;
            return (
              <Card key={agent.slug}>
                <div className="p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-surface-muted)] text-[var(--color-primary)]">
                        <Icon size={18} />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold">{agent.name}</h3>
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--color-success)]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" />
                          {agent.status}
                        </span>
                      </div>
                    </div>

                    <Link
                      href={agent.href}
                      className="rounded border border-[var(--color-border)] p-1.5 text-[var(--color-muted)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)]"
                    >
                      <ArrowRight size={14} />
                    </Link>
                  </div>

                  <p className="text-xs text-[var(--color-muted)] leading-relaxed">
                    {agent.description}
                  </p>

                  <div className="grid grid-cols-2 gap-2 border-t border-[var(--color-border)] pt-3 text-[11px]">
                    <div>
                      <span className="text-[var(--color-muted)]">Last Run:</span>{" "}
                      <span className="font-medium text-[var(--color-foreground)]">{agent.lastRun}</span>
                    </div>
                    <div>
                      <span className="text-[var(--color-muted)]">Next Run:</span>{" "}
                      <span className="font-medium text-[var(--color-foreground)]">{agent.nextRun}</span>
                    </div>
                    <div>
                      <span className="text-[var(--color-muted)]">Completed:</span>{" "}
                      <span className="font-medium text-[var(--color-success)]">{agent.tasksCompleted}</span>
                    </div>
                    <div>
                      <span className="text-[var(--color-muted)]">Pending:</span>{" "}
                      <span className="font-medium text-amber-600">{agent.tasksPending}</span>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}
