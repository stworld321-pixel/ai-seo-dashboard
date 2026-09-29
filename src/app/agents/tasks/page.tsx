import Link from "next/link";
import { TopBar } from "@/components/top-bar";
import { Card, CardHeader } from "@/components/card";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/badges";
import { loadPageContext } from "@/server/services/page-context";
import { prisma } from "@/server/db";
import { ArrowLeft, Clock, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AgentTasksPage(props: {
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

  const tasks = await prisma.agentTask.findMany({
    where: { websiteId: website.id },
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  const displayTasks = tasks.length > 0 ? tasks : [
    {
      id: "task-1",
      agent: "GEO Agent",
      kind: "entity-gap-analysis",
      websiteId: website.id,
      state: "COMPLETED",
      createdAt: new Date(),
      input: { prompt: "Best TMT bars in Tamil Nadu" },
    },
    {
      id: "task-2",
      agent: "Article Agent",
      kind: "generate-brief",
      websiteId: website.id,
      state: "WAITING_APPROVAL",
      createdAt: new Date(),
      input: { topic: "Fe 500 vs Fe 500D comparison" },
    },
    {
      id: "task-3",
      agent: "Reddit Agent",
      kind: "draft-helpful-response",
      websiteId: website.id,
      state: "WAITING_APPROVAL",
      createdAt: new Date(),
      input: { subreddit: "Construction", post: "IS 1786 steel grades" },
    },
    {
      id: "task-4",
      agent: "SEO Agent",
      kind: "bridge-gsc-to-ai-prompts",
      websiteId: website.id,
      state: "COMPLETED",
      createdAt: new Date(),
      input: { queriesCount: 15 },
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
        <div className="flex items-center gap-3">
          <Link
            href="/agents"
            className="rounded p-1 text-[var(--color-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-foreground)]"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Agent Task Queue</h1>
            <p className="mt-0.5 text-xs text-[var(--color-muted)]">
              Real-time asynchronous execution queue for autonomous analysis, drafting, and optimization tasks.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader
            title="Active & Historical Agent Tasks"
            subtitle="Statuses: Queued, Running, Awaiting Approval, Completed, Failed"
          />

          <DataTable
            rows={displayTasks as Array<{
              id: string;
              agent: string;
              kind: string;
              state: string;
              createdAt: Date;
              input: unknown;
              startedAt?: Date | null;
              finishedAt?: Date | null;
              error?: string | null;
            }>}
            getKey={(r) => r.id}
            empty="No agent tasks in queue."
            columns={[
              {
                key: "agent",
                header: "Agent",
                render: (r) => (
                  <span className="font-semibold text-xs text-[var(--color-primary)]">
                    {r.agent}
                  </span>
                ),
              },
              {
                key: "kind",
                header: "Task Operation",
                render: (r) => (
                  <div className="space-y-0.5">
                    <p className="font-mono text-xs text-[var(--color-foreground)]">{r.kind}</p>
                    <p className="text-[10px] text-[var(--color-muted)]">{JSON.stringify(r.input)}</p>
                  </div>
                ),
              },
              {
                key: "created",
                header: "Created",
                render: (r) => (
                  <span className="text-xs text-[var(--color-muted)]">
                    {new Date(r.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                ),
              },
              {
                key: "status",
                header: "Status",
                render: (r) => {
                  switch (r.state) {
                    case "COMPLETED":
                      return <StatusBadge status="Completed" tone="positive" />;
                    case "WAITING_APPROVAL":
                      return <StatusBadge status="Awaiting Approval" tone="warning" />;
                    case "RUNNING":
                      return <StatusBadge status="Running" tone="info" />;
                    case "FAILED":
                      return <StatusBadge status="Failed" tone="danger" />;
                    default:
                      return <StatusBadge status="Queued" tone="neutral" />;
                  }
                },
              },
              {
                key: "action",
                header: "Action",
                align: "right",
                render: (r) => (
                  r.state === "WAITING_APPROVAL" ? (
                    <Link
                      href="/automation/activity"
                      className="rounded bg-[var(--color-primary)] px-2.5 py-1 text-xs font-medium text-[var(--color-primary-fg)] hover:opacity-90"
                    >
                      Review Approval
                    </Link>
                  ) : (
                    <span className="text-xs text-[var(--color-muted)]">—</span>
                  )
                ),
              },
            ]}
          />
        </Card>
      </div>
    </>
  );
}
