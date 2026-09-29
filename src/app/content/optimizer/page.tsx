import { EmptyState, PageHeading } from "@/components/empty-state";
import { TopBar } from "@/components/top-bar";
import { ContentOptimizerClient } from "@/components/content-optimizer-client";
import { prisma } from "@/server/db";
import { getOpportunities } from "@/server/services/dashboard";
import { loadPageContext } from "@/server/services/page-context";

export const dynamic = "force-dynamic";

export default async function ContentOptimizerPage(props: PageProps<"/content/optimizer">) {
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

  const { website, window, range } = ctx;
  const [pageRecords, opps] = await Promise.all([
    prisma.pageRecord.findMany({ where: { websiteId: website.id }, orderBy: { url: "asc" } }),
    getOpportunities(website.id),
  ]);

  const kwByUrl = new Map<string, string>();
  for (const o of opps) {
    if (o.targetUrl && o.keyword && !kwByUrl.has(o.targetUrl)) {
      kwByUrl.set(o.targetUrl, o.keyword);
    }
  }

  const pageOptions = pageRecords.map((p) => {
    const fallbackKw =
      new URL(p.url).pathname
        .replace(/\/+$/, "")
        .split("/")
        .pop()
        ?.replace(/-/g, " ") || "natural soap";
    return {
      url: p.url,
      title: p.title,
      metaDescription: p.metaDescription,
      keyword: kwByUrl.get(p.url) ?? fallbackKw,
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

      <div className="p-6">
        <PageHeading
          title="On-Page SEO Optimizer"
          description="Audit and optimize Rank Math SEO titles, meta descriptions, and body copy against target keywords."
        />

        <ContentOptimizerClient websiteId={website.id} pages={pageOptions} />
      </div>
    </>
  );
}
