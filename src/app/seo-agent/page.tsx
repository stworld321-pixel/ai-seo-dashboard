import { TopBar } from "@/components/top-bar";
import { SeoAgentClientView } from "@/components/seo-agent-client-view";
import { loadPageContext } from "@/server/services/page-context";
import { getUnifiedSearchAiBridges } from "@/server/services/seo-agent";

export const dynamic = "force-dynamic";

export default async function SeoAgentPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const { ctx, reason, websiteName } = await loadPageContext(searchParams);

  if (!ctx) {
    return (
      <div className="p-8 text-center text-sm text-[var(--color-muted)]">
        {reason === "no-website"
          ? "No website configured. Please add a website to start using the SEO Agent."
          : `No data for ${websiteName ?? "website"}.`}
      </div>
    );
  }

  const { website, window, range } = ctx;
  const bridges = await getUnifiedSearchAiBridges(website.id);

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
        <SeoAgentClientView
          websiteId={website.id}
          websiteName={website.name}
          websiteUrl={website.url}
          initialBridges={bridges}
        />
      </div>
    </>
  );
}
