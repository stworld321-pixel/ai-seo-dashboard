import { TopBar } from "@/components/top-bar";
import { RedditAgentView } from "@/components/reddit-agent-view";
import { FeatureLockedGate } from "@/components/feature-locked-gate";
import { loadPageContext } from "@/server/services/page-context";
import { getRedditOpportunities } from "@/server/services/reddit-agent";
import { checkFeatureAccess } from "@/server/services/credits";

export const dynamic = "force-dynamic";

export default async function RedditAgentPage(props: {
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
  const access = await checkFeatureAccess("redditAgent");

  if (!access.allowed) {
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
        <FeatureLockedGate
          featureName="Autonomous Reddit Opportunity Agent"
          featureDescription="Scan relevant subreddits for brand mentions, high-intent discussion threads, and organic citation opportunities with authentic AI response drafting."
          requiredPlan="Pro ⭐"
          price="$79/mo"
          benefits={[
            "Real-time subreddit keyword & intent monitoring",
            "Context-aware value-first response drafting",
            "Thread relevance scoring & sentiment analysis",
            "One-click direct reply or copy-paste workflow",
          ]}
          previewSnippet="Discovered 8 active threads in r/SEO and r/webdev discussing AI visibility. Generated 3 non-promotional, high-authority responses."
        />
      </>
    );
  }

  const opportunities = await getRedditOpportunities(website.id);

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

      <div className="p-6">
        <RedditAgentView websiteId={website.id} initialOpportunities={opportunities} />
      </div>
    </>
  );
}
