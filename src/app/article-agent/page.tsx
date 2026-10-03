import { TopBar } from "@/components/top-bar";
import { ArticleAgentView } from "@/components/article-agent-view";
import { FeatureLockedGate } from "@/components/feature-locked-gate";
import { loadPageContext } from "@/server/services/page-context";
import { getArticleAgentPipelines } from "@/server/services/article-agent";
import { checkFeatureAccess } from "@/server/services/credits";

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
  const access = await checkFeatureAccess("articleAgent");

  if (!access.allowed) {
    return (
      <>
        <TopBar
          websiteName={website.name}
          websiteUrl={website.url}
          range={range}
          lastSyncedAt={ctx.lastSyncedAt}
          dataThrough={window.to.toISOString().slice(0, 10)}
        />
        <FeatureLockedGate
          featureName="AI Content Writer Agent"
          featureDescription="Generate 30+ strategy-led, SEO-optimized, schema-enriched long-form article drafts per month with automatic internal link injection and direct CMS publishing."
          requiredPlan={access.requiredPlan}
          price={access.price}
          benefits={[
            "Minimum 30 articles/month with multi-model editorial tone",
            "Strategy-led article drafts anchored on your positioning & ICP",
            "Automated internal & external citation graph linking",
            "Direct 1-click publishing to WordPress, Shopify & Webflow",
          ]}
          previewSnippet="AI Content Writer Agent active: Drafted complete 2,800-word comprehensive guide with 14 FAQ schema items and 6 internal anchor links."
        />
      </>
    );
  }

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
