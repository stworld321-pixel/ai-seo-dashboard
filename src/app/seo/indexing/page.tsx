import { EmptyState } from "@/components/empty-state";
import { TopBar } from "@/components/top-bar";
import { IndexingPanel } from "@/components/indexing-panel";
import { loadPageContext } from "@/server/services/page-context";
import { collectIndexCandidates } from "@/server/integrations/google/indexing";

export const dynamic = "force-dynamic";

export default async function IndexingPage(props: PageProps<"/seo/indexing">) {
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

  const { website, window, range, lastSyncedAt } = ctx;
  const candidates = await collectIndexCandidates(website.id);

  return (
    <>
      <TopBar
        websiteName={website.name}
        websiteUrl={website.url}
        range={range}
        lastSyncedAt={lastSyncedAt}
        dataThrough={window.to.toISOString().slice(0, 10)}
        websiteId={website.id}
      />

      <div className="space-y-6 p-6">
        {candidates.length === 0 ? (
          <EmptyState
            title="No URLs to index yet"
            message="Crawl the site or sync Search Console so there are URLs to check."
            command="npm run audit"
          />
        ) : (
          <IndexingPanel websiteId={website.id} candidates={candidates} />
        )}
      </div>
    </>
  );
}
