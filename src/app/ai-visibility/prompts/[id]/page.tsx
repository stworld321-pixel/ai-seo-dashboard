import Link from "next/link";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/top-bar";
import { Card, CardHeader } from "@/components/card";
import { StatusBadge } from "@/components/badges";
import { PromptRunButton } from "@/components/prompt-run-button";
import { loadPageContext } from "@/server/services/page-context";
import { prisma } from "@/server/db";
import { ArrowLeft, ExternalLink, Calendar, MessageSquare, Globe, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PromptDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const { ctx } = await loadPageContext(searchParams);

  const prompt = await prisma.aiPrompt.findUnique({
    where: { id: params.id },
    include: {
      website: true,
      runs: {
        orderBy: { runAt: "desc" },
      },
      geoOpps: true,
    },
  });

  if (!prompt) {
    notFound();
  }

  const website = prompt.website;

  // Group latest run per engine
  const latestRunsByEngine = new Map<string, typeof prompt.runs[0]>();
  for (const run of prompt.runs) {
    if (!latestRunsByEngine.has(run.engine)) {
      latestRunsByEngine.set(run.engine, run);
    }
  }

  // Related reddit / x opportunities
  const [redditOpps, xOpps, pages] = await Promise.all([
    prisma.redditOpportunity.findMany({ where: { websiteId: website.id }, take: 3 }),
    prisma.xOpportunity.findMany({ where: { websiteId: website.id }, take: 3 }),
    prisma.pageRecord.findMany({ where: { websiteId: website.id }, take: 4 }),
  ]);

  return (
    <>
      {ctx && (
        <TopBar
          websiteName={website.name}
          websiteUrl={website.url}
          range={ctx.range}
          lastSyncedAt={ctx.lastSyncedAt}
          dataThrough={ctx.window.to.toISOString().slice(0, 10)}
        />
      )}

      <div className="p-6 space-y-6">
        {/* Header Navigation */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <Link
              href="/ai-visibility/prompts"
              className="rounded p-1 text-[var(--color-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-foreground)]"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <StatusBadge
                  status={prompt.intent || "informational"}
                  tone="neutral"
                />
                <StatusBadge
                  status={`Priority ${prompt.priority}`}
                  tone={prompt.priority === 3 ? "danger" : "warning"}
                />
                <span className="text-xs text-[var(--color-muted)]">Source: {prompt.source}</span>
              </div>
              <h1 className="mt-1 text-xl font-bold tracking-tight">&ldquo;{prompt.text}&rdquo;</h1>
            </div>
          </div>

          <PromptRunButton promptId={prompt.id} websiteId={website.id} promptText={prompt.text} />
        </div>

        {/* Engine-by-Engine Live Observations */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(["chatgpt", "claude", "perplexity", "gemini"] as const).map((engine) => {
            const run = latestRunsByEngine.get(engine);
            return (
              <Card key={engine}>
                <CardHeader
                  title={
                    engine === "chatgpt"
                      ? "ChatGPT (OpenAI)"
                      : engine === "claude"
                      ? "Claude (Anthropic)"
                      : engine === "perplexity"
                      ? "Perplexity AI"
                      : "Google AI Overview"
                  }
                  subtitle={run ? `Tested on ${new Date(run.runAt).toLocaleDateString()}` : "Not tested yet"}
                />
                <div className="p-4 space-y-3">
                  {run ? (
                    <>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className={`rounded px-2 py-0.5 font-semibold ${run.brandMentioned ? "bg-blue-500/10 text-[var(--color-info)]" : "bg-[var(--color-surface-muted)] text-[var(--color-muted)]"}`}>
                          Brand Mentioned: {run.brandMentioned ? "Yes" : "No"}
                        </span>
                        <span className={`rounded px-2 py-0.5 font-semibold ${run.citationFound ? "bg-green-500/10 text-[var(--color-success)]" : "bg-[var(--color-surface-muted)] text-[var(--color-muted)]"}`}>
                          Citation: {run.citationFound ? "Yes" : "No"}
                        </span>
                        {run.brandPosition && (
                          <span className="rounded bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-600">
                            Observed Pos: #{run.brandPosition}
                          </span>
                        )}
                      </div>

                      {run.citationUrl && (
                        <div className="text-xs">
                          <span className="text-[var(--color-muted)]">Cited URL:</span>{" "}
                          <a href={run.citationUrl} target="_blank" rel="noreferrer" className="text-[var(--color-primary)] hover:underline font-mono break-all">
                            {run.citationUrl}
                          </a>
                        </div>
                      )}

                      {run.sourceDomains && run.sourceDomains.length > 0 && (
                        <div className="text-xs text-[var(--color-muted)]">
                          <span>Source Domains:</span>{" "}
                          <span className="font-mono text-[var(--color-foreground)]">
                            {run.sourceDomains.slice(0, 3).join(", ")}
                          </span>
                        </div>
                      )}

                      <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 text-xs leading-relaxed max-h-48 overflow-y-auto font-mono">
                        {run.response || run.errorMessage || "No response text."}
                      </div>
                    </>
                  ) : (
                    <div className="py-6 text-center text-xs text-[var(--color-muted)]">
                      No run data collected yet. Click &ldquo;Test AI&rdquo; above to run.
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        {/* AI Gap Analysis & Recommendations */}
        <Card>
          <CardHeader
            title="AI Answer Gap Analysis"
            subtitle="Comparing brand website content vs top cited sources across AI models"
          />
          <div className="p-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-[var(--color-border)] p-4 bg-[var(--color-surface-muted)]">
                <h4 className="text-xs font-semibold uppercase text-[var(--color-muted)]">Key Missing Entities & Data Points</h4>
                <ul className="mt-2 space-y-1.5 text-xs text-[var(--color-foreground)]">
                  <li>• Concise 40-word direct definition block answering &ldquo;{prompt.text}&rdquo;</li>
                  <li>• Structured comparison table highlighting technical parameters and standards</li>
                  <li>• Organization and Product Schema with explicit manufacturer attributes</li>
                  <li>• Verifiable 3rd-party industry references and trade publication citations</li>
                </ul>
              </div>

              <div className="rounded-lg border border-[var(--color-border)] p-4 bg-[var(--color-surface-muted)]">
                <h4 className="text-xs font-semibold uppercase text-[var(--color-primary)]">Recommended Actions (GEO Agent)</h4>
                <ul className="mt-2 space-y-1.5 text-xs text-[var(--color-foreground)]">
                  <li>• Publish a dedicated buyer guide answering &ldquo;{prompt.text}&rdquo;</li>
                  <li>• Strengthen internal anchor links from top landing pages to relevant topic guides</li>
                  <li>• Pursue editorial citation on authoritative industry portals</li>
                  <li>• Add structured FAQ markup matching exact user search phrasing</li>
                </ul>
              </div>
            </div>
          </div>
        </Card>

        {/* Historical Timeline */}
        <Card>
          <CardHeader
            title="Prompt Run History Timeline"
            subtitle="Historical timeline of observed mentions, citations, and engine responses"
          />
          <div className="p-5">
            {prompt.runs.length > 0 ? (
              <div className="relative border-l border-[var(--color-border)] pl-6 space-y-4 ml-3">
                {prompt.runs.map((r) => (
                  <div key={r.id} className="relative">
                    <span className="absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-[var(--color-surface)] bg-[var(--color-primary)]" />
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-semibold uppercase">{r.engine}</span>
                      <span>·</span>
                      <span className="text-[var(--color-muted)] flex items-center gap-1">
                        <Calendar size={12} /> {new Date(r.runAt).toLocaleString()}
                      </span>
                      <span>·</span>
                      <span className={r.citationFound ? "text-[var(--color-success)] font-medium" : r.brandMentioned ? "text-[var(--color-info)] font-medium" : "text-[var(--color-muted)]"}>
                        {r.citationFound ? "Cited + Mentioned" : r.brandMentioned ? "Mentioned" : "Not Mentioned"}
                      </span>
                    </div>
                    {r.mentionContext && (
                      <p className="mt-1 text-xs text-[var(--color-muted)] italic">&ldquo;{r.mentionContext}&rdquo;</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--color-muted)]">No historical runs recorded for this prompt yet.</p>
            )}
          </div>
        </Card>

        {/* Supporting Pages and Community Discussions */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader title="Related Target Pages" subtitle="Website pages supporting this prompt topic" />
            <div className="divide-y divide-[var(--color-border)]">
              {pages.map((p) => (
                <div key={p.id} className="p-3 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-medium">{p.title || p.url}</p>
                    <p className="text-[var(--color-muted)] font-mono text-[11px]">{p.url}</p>
                  </div>
                  <a href={p.url} target="_blank" rel="noreferrer" className="text-[var(--color-muted)] hover:text-[var(--color-foreground)]">
                    <ExternalLink size={14} />
                  </a>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Community Intelligence" subtitle="Related Reddit discussions & X conversations" />
            <div className="divide-y divide-[var(--color-border)]">
              {redditOpps.map((r) => (
                <div key={r.id} className="p-3 text-xs space-y-0.5">
                  <div className="flex items-center gap-1.5 font-medium text-[var(--color-primary)]">
                    <MessageSquare size={13} /> r/{r.subreddit}
                  </div>
                  <p className="text-[var(--color-foreground)]">{r.postTitle}</p>
                </div>
              ))}
              {xOpps.map((x) => (
                <div key={x.id} className="p-3 text-xs space-y-0.5">
                  <div className="flex items-center gap-1.5 font-medium text-sky-600">
                    <Globe size={13} /> @{x.creatorHandle}
                  </div>
                  <p className="text-[var(--color-foreground)]">{x.topic}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
