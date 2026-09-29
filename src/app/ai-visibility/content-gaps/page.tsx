import Link from "next/link";
import { TopBar } from "@/components/top-bar";
import { Card, CardHeader } from "@/components/card";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/badges";
import { loadPageContext } from "@/server/services/page-context";
import { prisma } from "@/server/db";
import { ArrowLeft, Sparkles, FileText, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ContentOpportunitiesPage(props: {
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

  const [prompts, pages] = await Promise.all([
    prisma.aiPrompt.findMany({ where: { websiteId: website.id }, take: 10 }),
    prisma.pageRecord.findMany({ where: { websiteId: website.id }, take: 8 }),
  ]);

  // Construct visual content mapping: Prompt → Intent → Target Page → Supporting Content → External Source → AI Engine
  const contentMap = prompts.map((p, idx) => {
    const page = pages[idx % pages.length];
    return {
      id: p.id,
      prompt: p.text,
      intent: p.intent || "informational",
      targetPage: page?.url || "/products",
      supportingArticles: [
        "Buyer Decision Guide & Checklist",
        "Technical Specification Breakdown",
        "Cost & Pricing Framework",
      ],
      externalSources: ["Industry Publications", "Trade Standards Directory"],
      aiEngines: ["ChatGPT", "Claude", "Perplexity"],
    };
  });

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
            <Link
              href="/ai-visibility"
              className="rounded p-1 text-[var(--color-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-foreground)]"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-xl font-bold tracking-tight">AI Visibility Content Map & Gaps</h1>
              <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                Connect search prompts directly with target landing pages, supporting educational guides, and external citation sources.
              </p>
            </div>
          </div>

          <Link
            href="/article-agent"
            className="flex items-center gap-1.5 rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary-fg)] hover:opacity-90"
          >
            <Sparkles size={14} />
            Open Article Agent
          </Link>
        </div>

        {/* Content Map Cards */}
        <Card>
          <CardHeader
            title="AI Search Visibility Content Architecture"
            subtitle="Flow: Prompt → Intent → Target Page → Supporting Guides → External Authority"
          />

          <div className="divide-y divide-[var(--color-border)]">
            {contentMap.map((item) => (
              <div key={item.id} className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="rounded bg-[var(--color-surface-muted)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--color-muted)]">
                      {item.intent}
                    </span>
                    <h3 className="mt-1 text-sm font-semibold">&ldquo;{item.prompt}&rdquo;</h3>
                  </div>

                  <span className="text-xs text-[var(--color-muted)]">
                    Target: <code className="font-mono text-[var(--color-primary)]">{item.targetPage}</code>
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 text-xs">
                  <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 space-y-1">
                    <p className="font-semibold text-[11px] text-[var(--color-muted)] uppercase">Supporting Articles</p>
                    {item.supportingArticles.map((art, i) => (
                      <p key={i} className="text-xs">• {art}</p>
                    ))}
                  </div>

                  <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 space-y-1">
                    <p className="font-semibold text-[11px] text-[var(--color-muted)] uppercase">External Authority Sources</p>
                    {item.externalSources.map((src, i) => (
                      <p key={i} className="text-xs">• {src}</p>
                    ))}
                  </div>

                  <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 space-y-1">
                    <p className="font-semibold text-[11px] text-[var(--color-muted)] uppercase">Target AI Engines</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {item.aiEngines.map((eng, i) => (
                        <span key={i} className="rounded bg-[var(--color-surface)] px-1.5 py-0.5 text-[10px] font-medium border border-[var(--color-border)]">
                          {eng}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
