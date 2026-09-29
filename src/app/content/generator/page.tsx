import { EmptyState, PageHeading } from "@/components/empty-state";
import { TopBar } from "@/components/top-bar";
import { ContentGeneratorClient } from "@/components/content-generator-client";
import { getDefaultWebsite, getOpportunities } from "@/server/services/dashboard";
import { loadPageContext } from "@/server/services/page-context";
import { getConfiguredAiModels } from "@/server/integrations/llm/provider";

export const dynamic = "force-dynamic";

export default async function ContentGeneratorPage(props: PageProps<"/content/generator">) {
  const searchParams = await props.searchParams;
  const { ctx, reason } = await loadPageContext(searchParams);

  let website = ctx?.website ?? null;
  if (!website) {
    website = await getDefaultWebsite(
      typeof searchParams.website === "string" ? searchParams.website : undefined,
    );
  }

  if (!website) {
    return (
      <EmptyState
        title="No website connected"
        message="Please add or connect a website first to generate AI content."
      />
    );
  }

  const keywordParam =
    typeof searchParams.keyword === "string"
      ? searchParams.keyword
      : typeof searchParams.q === "string"
        ? searchParams.q
        : undefined;

  const [opps, aiModels] = await Promise.all([
    getOpportunities(website.id),
    getConfiguredAiModels(website.id),
  ]);

  return (
    <>
      <TopBar
        websiteName={website.name}
        websiteUrl={website.url}
        range={ctx?.range ?? "28d"}
        lastSyncedAt={ctx?.lastSyncedAt ?? null}
        dataThrough={ctx?.window.to.toISOString().slice(0, 10) ?? null}
      />

      <div className="p-6">
        <PageHeading
          title="Blog & Brief Generator (SEO · AEO · GEO Page-1 Engine)"
          description="Generate custom-titled, Page-1 ready blog articles with Featured Snippet Answer Boxes (AEO), AI Overview Comparison Matrices (GEO), internal product links, FAQPage JSON-LD Schema, and 1-click live WordPress publishing."
        />

        <ContentGeneratorClient
          websiteId={website.id}
          websiteName={website.name}
          websiteUrl={website.url}
          initialKeyword={keywordParam}
          aiModels={aiModels}
          opportunities={opps.map((o) => ({
            id: o.id,
            type: o.type,
            keyword: o.keyword,
            targetUrl: o.targetUrl,
            priority: o.priority,
          }))}
        />
      </div>
    </>
  );
}
