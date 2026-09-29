import { Card, CardHeader } from "@/components/card";
import { DataTable } from "@/components/data-table";
import { EmptyState, PageHeading } from "@/components/empty-state";
import { MetricCard } from "@/components/metric-card";
import { StatusBadge } from "@/components/badges";
import { TopBar } from "@/components/top-bar";
import { ApprovalActions } from "@/components/approval-actions";
import { formatNumber, relativeTime, shortenUrl } from "@/lib/format";
import { prisma } from "@/server/db";
import { loadPageContext } from "@/server/services/page-context";

export const dynamic = "force-dynamic";

export default async function ActivityPage(props: PageProps<"/automation/activity">) {
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
  const [approvals, runs, logs] = await Promise.all([
    prisma.approval.findMany({
      where: { websiteId: website.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.automationRun.findMany({
      where: { websiteId: website.id },
      orderBy: { startedAt: "desc" },
      take: 15,
    }),
    prisma.agentLog.findMany({
      where: { websiteId: website.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  const pendingApprovals = approvals.filter((a) => a.status === "pending").length;
  const approvedCount = approvals.filter((a) => a.status === "approved").length;

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
          title="Activity & Approvals Queue"
          description="Human-in-the-loop approval gate for CMS writes, alongside the audit log of every automation run and specialist agent action."
        />

        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard
            label="Pending Approvals"
            value={formatNumber(pendingApprovals)}
            deltaLabel="awaiting human decision"
          />
          <MetricCard
            label="Approved Changes"
            value={formatNumber(approvedCount)}
            deltaLabel="cleared for CMS write"
          />
          <MetricCard
            label="Automation Runs"
            value={formatNumber(runs.length)}
            deltaLabel="recorded executions"
          />
          <MetricCard
            label="Agent Log Events"
            value={formatNumber(logs.length)}
            deltaLabel="audit trail entries"
          />
        </section>

        <Card className="mt-6">
          <CardHeader
            title="Approval Queue (CMS & On-Page Changes)"
            subtitle="Side-by-side proposed changes requiring approval before publishing"
          />
          <DataTable
            rows={approvals}
            getKey={(r) => r.id}
            empty="No approval requests yet"
            columns={[
              {
                key: "action",
                header: "Action",
                render: (r) => <span className="font-mono text-xs font-medium">{r.action}</span>,
              },
              {
                key: "risk",
                header: "Risk",
                render: (r) => (
                  <StatusBadge
                    status={r.riskLevel}
                    tone={
                      r.riskLevel === "CRITICAL" || r.riskLevel === "HIGH"
                        ? "danger"
                        : r.riskLevel === "MEDIUM"
                          ? "warning"
                          : "neutral"
                    }
                  />
                ),
              },
              {
                key: "target",
                header: "Target / Proposed Change",
                render: (r) => {
                  const p = (r.payload ?? {}) as {
                    title?: string;
                    seoTitle?: string;
                    keyword?: string;
                    targetUrl?: string;
                  };
                  return (
                    <div className="space-y-0.5 text-xs">
                      <p className="font-medium">{p.title ?? p.seoTitle ?? r.entityId}</p>
                      <p className="text-[var(--color-muted)]">
                        Keyword: {p.keyword ?? "—"}
                        {p.targetUrl ? ` · URL: ${shortenUrl(p.targetUrl)}` : ""}
                      </p>
                    </div>
                  );
                },
              },
              {
                key: "by",
                header: "Requested By",
                render: (r) => <span className="font-mono text-xs">{r.requestedBy}</span>,
              },
              {
                key: "status",
                header: "Status",
                render: (r) => (
                  <StatusBadge
                    status={r.status}
                    tone={
                      r.status === "approved"
                        ? "success"
                        : r.status === "rejected"
                          ? "danger"
                          : "warning"
                    }
                  />
                ),
              },
              {
                key: "decide",
                header: "Decision",
                align: "right",
                render: (r) => <ApprovalActions approvalId={r.id} status={r.status} />,
              },
            ]}
          />
        </Card>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader title="Recent Automation Runs" subtitle={`${runs.length} runs`} />
            <DataTable
              rows={runs}
              getKey={(r) => r.id}
              empty="No automation runs recorded yet"
              columns={[
                {
                  key: "status",
                  header: "Status",
                  render: (r) => (
                    <StatusBadge
                      status={r.status}
                      tone={r.status === "completed" ? "success" : "warning"}
                    />
                  ),
                },
                {
                  key: "summary",
                  header: "Run Summary",
                  render: (r) => {
                    const s = (r.summary ?? {}) as {
                      opportunitiesDetected?: number;
                      healthScore?: number;
                      queriesAnalyzed?: number;
                    };
                    return (
                      <span className="text-xs">
                        {s.queriesAnalyzed ?? 0} queries · {s.opportunitiesDetected ?? 0} opps · Health{" "}
                        {s.healthScore ?? "—"}/100
                      </span>
                    );
                  },
                },
                {
                  key: "when",
                  header: "Executed",
                  align: "right",
                  render: (r) => (
                    <span className="text-xs text-[var(--color-muted)]">
                      {relativeTime(r.startedAt)}
                    </span>
                  ),
                },
              ]}
            />
          </Card>

          <Card>
            <CardHeader title="Agent Audit Log" subtitle="Chronological trace" />
            <DataTable
              rows={logs}
              getKey={(r, i) => `${String(r.id)}-${i}`}
              empty="No agent logs recorded yet"
              columns={[
                {
                  key: "agent",
                  header: "Agent",
                  render: (r) => <span className="font-mono text-xs font-medium">{r.agent}</span>,
                },
                {
                  key: "msg",
                  header: "Message",
                  render: (r) => <span className="text-xs">{r.message}</span>,
                },
                {
                  key: "time",
                  header: "Time",
                  align: "right",
                  render: (r) => (
                    <span className="text-xs text-[var(--color-muted)]">
                      {relativeTime(r.createdAt)}
                    </span>
                  ),
                },
              ]}
            />
          </Card>
        </div>
      </div>
    </>
  );
}
