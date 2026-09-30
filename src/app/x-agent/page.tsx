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
          featureName="Autonomous X (Twitter) Influencer Agent"
          featureDescription="Identify trending industry conversations, key influencer threads, and brand mentions on X with automatic engagement drafting."
          requiredPlan="Pro ⭐"
          price="$79/mo"
          benefits={[
            "Real-time X hashtag & influencer trend tracking",
            "Context-aware high-engagement reply drafting",
            "Direct posting via OAuth 2.0 PKCE or copy-paste",
            "Brand citation analytics & impression tracking",
          ]}
          previewSnippet="Detected 14 high-traffic threads on AI search indexing. Drafted 4 authoritative quotes with relevant website citation anchors."
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
