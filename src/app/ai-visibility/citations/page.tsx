import Link from "next/link";
import { TopBar } from "@/components/top-bar";
import { MetricCard } from "@/components/metric-card";
import { Card, CardHeader } from "@/components/card";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/badges";
import { loadPageContext } from "@/server/services/page-context";
import { ensureAiVisibilityData } from "@/server/services/ai-visibility";
import { prisma } from "@/server/db";
import { Link2, ExternalLink, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AiCitationsPage(props: {
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

  const [promptRuns, citationOpps] = await Promise.all([
    prisma.aiPromptRun.findMany({
      where: { websiteId: website.id, response: { not: null } },
      include: { prompt: true },
      orderBy: { runAt: "desc" },
    }),
    prisma.citationOpportunity.findMany({
      where: { websiteId: website.id },
      orderBy: { detectedAt: "desc" },
    }),
  ]);

  // Deduplicate to latest run per prompt per engine to reflect current observable state
  const latestRunsMap = new Map<string, (typeof promptRuns)[number]>();
  for (const r of promptRuns) {
    const key = `${r.promptId}-${r.engine.toLowerCase()}`;
    if (!latestRunsMap.has(key)) {
      latestRunsMap.set(key, r);
    }
  }
  const currentRuns = Array.from(latestRunsMap.values());

  // Aggregate cited domains
  const domainCitationCounts = new Map<string, { count: number; sampleUrls: string[]; prompts: Set<string> }>();
  for (const r of currentRuns) {
    for (const d of r.sourceDomains) {
      const existing = domainCitationCounts.get(d) || { count: 0, sampleUrls: [], prompts: new Set() };
      existing.count++;
      if (r.citationUrl && !existing.sampleUrls.includes(r.citationUrl)) {
        existing.sampleUrls.push(r.citationUrl);
      }
      if (r.prompt?.text) {
        existing.prompts.add(r.prompt.text);
      }
      domainCitationCounts.set(d, existing);
    }
  }

  const sortedDomains = Array.from(domainCitationCounts.entries()).map(([domain, data]) => ({
    domain,
    citationsCount: data.count,
    promptsCount: data.prompts.size,
    sampleUrls: data.sampleUrls,
  })).sort((a, b) => b.citationsCount - a.citationsCount);

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
          <div>
            <h1 className="text-xl font-bold tracking-tight">AI Citation Tracker</h1>
            <p className="mt-0.5 text-xs text-[var(--color-muted)]">
              Discover which external industry publications, standards bodies, and trade websites are repeatedly cited by AI answer engines.
            </p>
          </div>

          <Link
            href="/ai-visibility/citation-gaps"
            className="flex items-center gap-1.5 rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary-fg)] hover:opacity-90"
          >
            <Link2 size={14} />
            View Citation Gaps <ArrowRight size={14} />
          </Link>
        </div>

        {/* Top Metric Cards */}
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard
            label="Total Source Domains"
            value={sortedDomains.length.toString()}
            deltaLabel="frequently cited sources"
            hint="Count of unique 3rd-party domains cited by AI engines across your tracked topics."
          />
          <MetricCard
            label="Direct Brand Citations"
            value={promptRuns.filter((r) => r.citationFound).length.toString()}
            deltaLabel="direct domain links"
            hint="Number of observed citations pointing directly to your monitored website."
          />
          <MetricCard
            label="Authority Opportunities"
            value={citationOpps.length.toString()}
            deltaLabel="unlocked citation leads"
            hint="Authoritative industry hubs identified by Citation Agent for outreach."
          />
          <MetricCard
            label="Citation Rate"
            value={`${promptRuns.length > 0 ? Math.round((promptRuns.filter((r) => r.citationFound).length / promptRuns.length) * 100) : 0}%`}
            deltaLabel="of collected responses"
            hint="Observed citation inclusion rate among tested responses."
          />
        </section>

        {/* Top Cited Domains Table */}
        <Card>
          <CardHeader
            title="Most Cited Domains Across Tracked Prompts"
            subtitle="Authoritative publications and sources AI engines rely on when answering questions in your niche"
          />

          <DataTable
            rows={sortedDomains}
            getKey={(r) => r.domain}
            empty="No citation data collected yet. Run prompt tests under Prompt Tracker to build citation graph."
            columns={[
              {
                key: "domain",
                header: "Cited Source Domain",
                render: (r) => (
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold">{r.domain}</span>
                    <a href={`https://${r.domain}`} target="_blank" rel="noreferrer" className="text-[var(--color-muted)] hover:text-[var(--color-foreground)]">
                      <ExternalLink size={12} />
                    </a>
                  </div>
                ),
              },
              {
                key: "count",
                header: "Times Cited",
                render: (r) => <span className="font-semibold text-sm tabular">{r.citationsCount}</span>,
              },
              {
                key: "prompts",
                header: "Prompts Referencing Source",
                render: (r) => <span className="text-xs text-[var(--color-muted)]">{r.promptsCount} queries</span>,
              },
              {
                key: "status",
                header: "Brand Presence",
                render: (r) => {
                  const isMonitoredDomain = r.domain.toLowerCase().includes(new URL(website.url).hostname.replace(/^www\./, "").toLowerCase());
                  return isMonitoredDomain ? (
                    <StatusBadge status="Monitored Brand" tone="positive" />
                  ) : (
                    <StatusBadge status="3rd-Party Authority" tone="neutral" />
                  );
                },
              },
            ]}
          />
        </Card>

        {/* Citation Opportunities from Citation Agent */}
        <Card>
          <CardHeader
            title="Authoritative Citation Opportunities (Citation Agent)"
            subtitle="Verified trade publications, standards bodies, and reputable directories for genuine editorial inclusion"
          />

          <div className="divide-y divide-[var(--color-border)]">
            {citationOpps.length > 0 ? (
              citationOpps.map((opp) => (
                <div key={opp.id} className="p-4 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold font-mono">{opp.targetDomain}</h4>
                      <StatusBadge status={opp.status} tone={opp.status === "acquired" ? "positive" : "warning"} />
                    </div>
                    <p className="text-xs text-[var(--color-foreground)]">{opp.whyRelevant}</p>
                    <p className="text-[11px] text-[var(--color-muted)]"><strong>Action:</strong> {opp.action}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-xs text-[var(--color-muted)]">
                No custom citation opportunities saved yet. Citation Agent periodically populates recommendations.
              </div>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
