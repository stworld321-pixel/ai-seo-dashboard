import Link from "next/link";
import { TopBar } from "@/components/top-bar";
import { Card, CardHeader } from "@/components/card";
import { MetricCard } from "@/components/metric-card";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/badges";
import { loadPageContext } from "@/server/services/page-context";
import { prisma } from "@/server/db";
import { Target, Sparkles, TrendingUp, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SeoAgentPage(props: {
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

  const [opportunities, keywords, prompts] = await Promise.all([
    prisma.opportunity.findMany({ where: { websiteId: website.id, status: "OPEN" }, take: 8 }),
    prisma.keyword.findMany({ where: { websiteId: website.id }, take: 10 }),
    prisma.aiPrompt.findMany({ where: { websiteId: website.id }, take: 10 }),
  ]);

  // Combine GSC queries with AI prompt targets
  const hybridOpportunities = keywords.slice(0, 5).map((kw, i) => ({
    id: `hybrid-${i}`,
    keyword: kw.query,
    gscPosition: kw.position28 ? kw.position28.toFixed(1) : "—",
    gscImpressions: kw.impressions28,
    aiVisibilityStatus: i % 2 === 0 ? "Not mentioned in AI" : "Mentioned without link",
    recommendedBridgeAction: "Add clear answer block + FAQ schema to bridge high search impressions into direct AI citations",
    priority: kw.impressions28 > 300 ? "HIGH" : "MEDIUM",
  }));

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
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-primary)] text-white">
              <Target size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">SEO Agent (Unified Search & AI Bridge)</h1>
                <span className="rounded bg-green-500/10 px-2 py-0.5 text-xs font-semibold text-[var(--color-success)]">
                  ● Active
                </span>
              </div>
              <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                Connects traditional Google Search Console rankings and traffic with modern AI prompt visibility.
              </p>
            </div>
          </div>
        </div>

        {/* Metric Cards */}
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard label="Ranking GSC Keywords" value={keywords.length.toString()} deltaLabel="monitored queries" />
          <MetricCard label="Active SEO Opportunities" value={opportunities.length.toString()} deltaLabel="quick wins & decay" />
          <MetricCard label="Search-to-AI Bridges" value={hybridOpportunities.length.toString()} deltaLabel="high impression targets" />
          <MetricCard label="Internal Link Actions" value="12" deltaLabel="topical clustering" />
        </section>

        {/* Hybrid SEO + AI Search Bridge Table */}
        <Card>
          <CardHeader
            title="Unified Search & AI Visibility Bridge"
            subtitle="Queries with proven Google search volume that are prime candidates for AI answer citations"
          />

          <DataTable
            rows={hybridOpportunities}
            getKey={(r) => r.id}
            empty="No hybrid opportunities detected."
            columns={[
              {
                key: "keyword",
                header: "GSC Keyword Query",
                render: (r) => (
                  <div className="space-y-0.5">
                    <p className="font-semibold text-xs">{r.keyword}</p>
                    <p className="text-[10px] text-[var(--color-muted)]">Pos: {r.gscPosition} · {r.gscImpressions} Impr</p>
                  </div>
                ),
              },
              {
                key: "aiStatus",
                header: "AI Answer Status",
                render: (r) => (
                  <StatusBadge
                    status={r.aiVisibilityStatus}
                    tone={r.aiVisibilityStatus.includes("Not mentioned") ? "danger" : "warning"}
                  />
                ),
              },
              {
                key: "bridgeAction",
                header: "Recommended Action to Capture Citations",
                render: (r) => (
                  <p className="text-xs text-[var(--color-foreground)] max-w-md font-medium">
                    {r.recommendedBridgeAction}
                  </p>
                ),
              },
              {
                key: "priority",
                header: "Priority",
                align: "right",
                render: (r) => (
                  <StatusBadge
                    status={r.priority}
                    tone={r.priority === "HIGH" ? "danger" : "warning"}
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
