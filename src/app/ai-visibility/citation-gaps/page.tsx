import Link from "next/link";
import { TopBar } from "@/components/top-bar";
import { Card, CardHeader } from "@/components/card";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/badges";
import { loadPageContext } from "@/server/services/page-context";
import { prisma } from "@/server/db";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { CitationGapsClientView } from "@/components/citation-gaps-client-view";

export const dynamic = "force-dynamic";

export default async function CitationGapsPage(props: {
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

  const prompts = await prisma.aiPrompt.findMany({
    where: { websiteId: website.id },
    include: {
      runs: {
        orderBy: { runAt: "desc" },
      },
    },
  });

  // Calculate gaps: prompts where competitors were mentioned or cited, but our brand was not
  const gaps = [];
  for (const p of prompts) {
    const latestRun = p.runs[0];
    if (latestRun && (!latestRun.brandMentioned || !latestRun.citationFound)) {
      const topSource = latestRun.sourceDomains[0] || "Industry trade portal";
      const competitor = latestRun.competitorsMentioned[0] || "Top Competitors";

      gaps.push({
        id: p.id,
        promptText: p.text,
        intent: p.intent,
        priority: p.priority,
        status: p.status || "active",
        competitorCited: competitor,
        citedSource: topSource,
        brandStatus: latestRun.brandMentioned ? "Mentioned only (No link)" : "Not mentioned",
        missingEntity: "Authoritative product facts & verified manufacturer certification data",
        recommendedContent: `Create dedicated guide answering "${p.text}" with comparison tables`,
        recommendedExternalAuthority: `Pursue listing / editorial reference on ${topSource}`,
      });
    }
  }

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
        <div className="flex items-center gap-3">
          <Link
            href="/ai-visibility/citations"
            className="rounded p-1 text-[var(--color-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-foreground)]"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight">AI Citation Gaps</h1>
            <p className="mt-0.5 text-xs text-[var(--color-muted)]">
              Identify search prompts where competitors and 3rd-party sources are cited while your brand is missing.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader
            title="Observed Citation Gaps & Recovery Actions"
            subtitle="Prioritized recommendations to earn direct citations in AI answer engines"
          />

          <div className="p-4">
            <CitationGapsClientView initialGaps={gaps} />
          </div>
        </Card>
      </div>
    </>
  );
}
