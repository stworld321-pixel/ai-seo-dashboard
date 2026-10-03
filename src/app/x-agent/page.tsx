import { TopBar } from "@/components/top-bar";
import { loadPageContext } from "@/server/services/page-context";
import { getXOpportunities } from "@/server/services/x-agent";
import { XAgentView } from "@/components/x-agent-view";
import { FeatureLockedGate } from "@/components/feature-locked-gate";
import { checkFeatureAccess } from "@/server/services/credits";

export const dynamic = "force-dynamic";

export default async function XInfluencerAgentPage(props: {
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
  const access = await checkFeatureAccess("xAgent");

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
          featureName="X / Twitter Agent"
          featureDescription="Generate 30+ to 60+ high-engagement posts, thread drafts, and contextual audience discussions per month to expand your brand authority on X."
          requiredPlan={access.requiredPlan}
          price={access.price}
          benefits={[
            "Minimum 30 to 60 posts/month & viral thread drafts",
            "Contextual engagement drafts & industry discussion replies",
            "Audience resonance and niche hashtag optimization",
            "1-Click live posting via connected X Developer API",
          ]}
          previewSnippet="X Agent active: Generated 3 viral thread concepts & 5 contextual discussion drafts ready for approval."
        />
      </>
    );
  }

  const opportunities = await getXOpportunities(website.id);

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
        <XAgentView websiteId={website.id} initialOpportunities={opportunities} />
      </div>
    </>
  );
}
