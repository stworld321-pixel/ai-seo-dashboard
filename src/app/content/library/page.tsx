import Link from "next/link";
import { Card, CardHeader } from "@/components/card";
import { DataTable } from "@/components/data-table";
import { EmptyState, PageHeading } from "@/components/empty-state";
import { MetricCard } from "@/components/metric-card";
import { StatusBadge } from "@/components/badges";
import { TopBar } from "@/components/top-bar";
import { ContentLibraryRowActions } from "@/components/content-library-actions";
import { formatNumber, shortenUrl } from "@/lib/format";
import { prisma } from "@/server/db";
import { loadPageContext } from "@/server/services/page-context";

export const dynamic = "force-dynamic";

export default async function ContentLibraryPage(props: PageProps<"/content/library">) {
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
  const [contents, pageRecords] = await Promise.all([
    prisma.content.findMany({
      where: { websiteId: website.id },
      include: { versions: { select: { version: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.pageRecord.findMany({
      where: { websiteId: website.id },
      orderBy: { url: "asc" },
    }),
  ]);

  const awaitingApproval = contents.filter((c) => c.status === "AWAITING_APPROVAL").length;
  const approvedCount = contents.filter((c) => c.status === "APPROVED" || c.status === "PUBLISHED").length;

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
          title="Content Library"
          description="Versioned SEO drafts, title/meta rewrites, and audited CMS page records."
          action={
            <div className="flex gap-2">
              <Link
                href="/content/generator"
                className="rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary-fg)] hover:opacity-90"
              >
                New Draft / Brief
              </Link>
              <Link
                href="/content/optimizer"
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-surface-muted)]"
              >
                Open Optimizer
              </Link>
            </div>
          }
        />

        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard label="Content Artifacts" value={formatNumber(contents.length)} deltaLabel="versioned in DB" />
          <MetricCard label="Awaiting Approval" value={formatNumber(awaitingApproval)} deltaLabel="in approval queue" />
          <MetricCard label="Approved / Published" value={formatNumber(approvedCount)} deltaLabel="passed QA gate" />
          <MetricCard label="Tracked CMS Pages" value={formatNumber(pageRecords.length)} deltaLabel="audited URLs" />
        </section>

        <Card className="mt-6">
          <CardHeader
            title="Generated Drafts & On-Page Rewrites"
            subtitle={`${contents.length} items — every automated change is versioned and QA-gated`}
          />
          <DataTable
            rows={contents}
            getKey={(r) => r.id}
            empty="No drafts generated yet. Use the Blog Generator to create your first brief or draft."
            columns={[
              {
                key: "type",
                header: "Type",
                render: (r) => <StatusBadge status={r.type} tone="neutral" />,
              },
              {
                key: "title",
                header: "Proposed Title",
                render: (r) => <span className="font-medium">{r.title}</span>,
              },
              {
                key: "kw",
                header: "Primary Keyword",
                render: (r) => <span className="text-xs">{r.primaryKeyword ?? "—"}</span>,
              },
              {
                key: "qa",
                header: "QA Score",
                align: "right",
                render: (r) => {
                  const qa = r.qaReport as { score?: number } | null;
                  return <span className="font-mono text-xs">{qa?.score !== undefined ? `${qa.score}/100` : "—"}</span>;
                },
              },
              {
                key: "ver",
                header: "Versions",
                align: "right",
                render: (r) => <span className="font-mono text-xs">v{r.versions.length || 1}</span>,
              },
              {
                key: "status",
                header: "Status",
                render: (r) => (
                  <StatusBadge
                    status={r.status}
                    tone={
                      r.status === "APPROVED" || r.status === "PUBLISHED"
                        ? "success"
                        : r.status === "QA_FAILED" || r.status === "REJECTED"
                          ? "danger"
                          : "warning"
                    }
                  />
                ),
              },
              {
                key: "actions",
                header: "Actions",
                align: "right",
                render: (r) => (
                  <ContentLibraryRowActions content={r} websiteUrl={website.url} />
                ),
              },
            ]}
          />
        </Card>

        <Card className="mt-6">
          <CardHeader
            title="Audited CMS Page Records"
            subtitle={`${pageRecords.length} pages tracked in PageRecord`}
          />
          <DataTable
            rows={pageRecords}
            getKey={(r) => r.id}
            empty="No CMS page records stored yet"
            columns={[
              {
                key: "url",
                header: "URL",
                render: (r) => (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-xs text-[var(--color-info)] hover:underline"
                  >
                    {shortenUrl(r.url)}
                  </a>
                ),
              },
              {
                key: "title",
                header: "Current Title",
                render: (r) => <span className="text-xs font-medium">{r.title ?? "—"}</span>,
              },
              {
                key: "meta",
                header: "Meta Description",
                render: (r) => (
                  <span className="text-xs text-[var(--color-muted)]">
                    {r.metaDescription ? `${r.metaDescription.slice(0, 60)}...` : "Empty (no meta description)"}
                  </span>
                ),
              },
              {
                key: "status",
                header: "Status",
                render: (r) => (
                  <StatusBadge
                    status={r.status}
                    tone={r.status === "HEALTHY" ? "success" : r.status === "OPTIMIZE" ? "warning" : "neutral"}
                  />
                ),
              },
            ]}
          />
        </Card>
      </div>
    </>
  );
}
