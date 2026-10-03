import Link from "next/link";
import { TopBar } from "@/components/top-bar";
import { MetricCard } from "@/components/metric-card";
import { Card, CardHeader } from "@/components/card";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/badges";
import { PromptAddForm } from "@/components/prompt-add-form";
import { PromptRunButton } from "@/components/prompt-run-button";
import { AiAuditRunner } from "@/components/ai-audit-runner";
import { loadPageContext } from "@/server/services/page-context";
import { ensureAiVisibilityData } from "@/server/services/ai-visibility";
import { prisma } from "@/server/db";
import { ArrowLeft, CheckCircle, XCircle } from "lucide-react";

import { PromptsTableClient } from "@/components/prompts-table-client";

export const dynamic = "force-dynamic";

export default async function PromptsTrackerPage(props: {
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

  const prompts = await prisma.aiPrompt.findMany({
    where: { websiteId: website.id },
    include: {
      runs: {
        orderBy: { runAt: "desc" },
        take: 4,
      },
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });

  const activeCount = prompts.filter((p) => p.status === "active").length;
  const highPriorityCount = prompts.filter((p) => p.priority === 3).length;
  const approvedCount = prompts.filter((p) => p.approved).length;
  const discoveredCount = prompts.filter((p) => p.source !== "manual").length;

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
              <h1 className="text-xl font-bold tracking-tight">AI Prompt Tracker & Discovery</h1>
              <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                Manage questions and search prompts monitored across ChatGPT, Claude, Perplexity & Gemini.
              </p>
            </div>
          </div>

          <AiAuditRunner websiteId={website.id} />
        </div>

        {/* Metric Cards */}
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard label="Total Tracked Prompts" value={prompts.length.toString()} deltaLabel={`${activeCount} active`} />
          <MetricCard label="High Priority Prompts" value={highPriorityCount.toString()} deltaLabel="core buyer queries" />
          <MetricCard label="Approved Prompts" value={approvedCount.toString()} deltaLabel={`${prompts.length - approvedCount} pending review`} />
          <MetricCard label="AI Discovered Prompts" value={discoveredCount.toString()} deltaLabel="from GSC + catalog" />
        </section>

        {/* Add / Discover Prompts Form */}
        <PromptAddForm websiteId={website.id} />

        {/* Tracked Prompts Table */}
        <Card>
          <CardHeader
            title="Tracked Prompts Library"
            subtitle={`${prompts.length} prompts configured for automated testing and historical citation tracking`}
          />

          <div className="p-4">
            <PromptsTableClient initialPrompts={prompts} websiteId={website.id} />
          </div>
        </Card>
      </div>
    </>
  );
}
