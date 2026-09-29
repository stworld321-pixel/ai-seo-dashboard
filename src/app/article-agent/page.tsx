import { TopBar } from "@/components/top-bar";
import { ArticleAgentView } from "@/components/article-agent-view";
import { loadPageContext } from "@/server/services/page-context";
import { getArticleAgentPipelines } from "@/server/services/article-agent";

export const dynamic = "force-dynamic";

export default async function ArticleAgentPage(props: {
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

  const pipelines = await getArticleAgentPipelines(website.id);

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
        <ArticleAgentView websiteId={website.id} initialPipelines={pipelines} />
      </div>
    </>
  );
}
