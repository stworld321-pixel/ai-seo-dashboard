import { TopBar } from "@/components/top-bar";
import { GeoAgentView } from "@/components/geo-agent-view";
import { FeatureLockedGate } from "@/components/feature-locked-gate";
import { loadPageContext } from "@/server/services/page-context";
import { ensureAiVisibilityData } from "@/server/services/ai-visibility";
import { runGeoDiagnostics } from "@/server/intelligence/geo-engine";
import { checkFeatureAccess } from "@/server/services/credits";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function GeoAgentPage(props: {
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
  const access = await checkFeatureAccess("geoAgent");

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
          featureName="Autonomous GEO Agent"
          featureDescription="Generative Engine Optimization (GEO) monitors local, regional, and national citation prominence across Google AI Overviews, Perplexity, and ChatGPT Search to bridge local entity gaps."
          requiredPlan="Pro ⭐"
          price="$79/mo"
          benefits={[
            "Hyperlocal AI citation & multi-city entity detection",
            "Automated schema & NAP consistency recommendations",
            "Regional competitor gap analysis & prompt auditing",
            "One-click sync to WordPress and regional landing pages",
          ]}
          previewSnippet="Detected 12 regional citation gaps across target cities. Generated localized schema markup & directory entity anchors."
        />
      </>
    );
  }

  await ensureAiVisibilityData(website.id);

  let geoOpps = await prisma.geoOpportunity.findMany({
    where: { websiteId: website.id },
    include: { prompt: true },
    orderBy: [{ priority: "desc" }, { detectedAt: "desc" }],
  });

  const hasOutdatedDummyData = geoOpps.some(
    (o) =>
      (o.title.toLowerCase().includes("botanical") || o.description.toLowerCase().includes("botanical")) &&
      !website.name.toLowerCase().includes("botanical") &&
      !website.url.toLowerCase().includes("botanical") &&
      !website.name.toLowerCase().includes("skincare"),
  );

  if (geoOpps.length === 0 || hasOutdatedDummyData) {
    await runGeoDiagnostics(website.id);
    geoOpps = await prisma.geoOpportunity.findMany({
      where: { websiteId: website.id },
      include: { prompt: true },
      orderBy: [{ priority: "desc" }, { detectedAt: "desc" }],
    });
  }

  const initialOpportunities = geoOpps.map((o) => ({
    id: o.id,
    title: o.title,
    gapType: o.gapType,
    description: o.description,
    recommendation: o.recommendation,
    priority: o.priority,
    status: o.status,
    prompt: o.prompt ? { text: o.prompt.text } : null,
  }));

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
        <GeoAgentView websiteId={website.id} initialOpportunities={initialOpportunities} />
      </div>
    </>
  );
}
