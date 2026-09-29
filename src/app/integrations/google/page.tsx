import Link from "next/link";
import { TopBar } from "@/components/top-bar";
import { GoogleConnectPanel } from "@/components/google-connect-panel";
import { loadPageContext } from "@/server/services/page-context";
import { prisma } from "@/server/db";
import { getLiveSiteTelemetryFromDb } from "@/server/services/wordpress-sync";

export const dynamic = "force-dynamic";

export default async function GoogleIntegrationPage(props: {
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

  const [googleConn, gscProps, ga4Props, integrations, telemetry] = await Promise.all([
    prisma.googleConnection.findFirst({ where: { websiteId: website.id, status: "connected" } }),
    prisma.gscProperty.findMany({ where: { websiteId: website.id } }),
    prisma.ga4Property.findMany({ where: { websiteId: website.id } }),
    prisma.integration.findMany({ where: { websiteId: website.id } }),
    getLiveSiteTelemetryFromDb(website.id),
  ]);

  const gscIntegration = integrations.find((i) => i.kind === "GSC" && i.status === "ACTIVE");
  const selectedGsc = gscProps.find((p) => p.isSelected);
  const selectedGa4 = ga4Props.find((p) => p.isSelected);

  const isGscConnected =
    Boolean(gscIntegration) ||
    Boolean(selectedGsc && selectedGsc.googleConnectionId !== "composio-gsc") ||
    Boolean(googleConn && website.gscProperty);

  const isGa4Connected =
    Boolean(telemetry.ga4?.propertyId) ||
    Boolean(selectedGa4) ||
    Boolean(website.ga4PropertyId);

  return (
    <>
      <TopBar
        websiteName={website.name}
        websiteUrl={website.url}
        range={range}
        lastSyncedAt={ctx.lastSyncedAt}
        dataThrough={window.to.toISOString().slice(0, 10)}
        websiteId={website.id}
      />

      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Google Connection &amp; Data Sync</h1>
            <p className="mt-0.5 text-xs text-[var(--color-muted)]">
              Connect Google Search Console and Google Analytics 4 (GA4) for {website.name} ({website.url}).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/?website=${encodeURIComponent(website.id)}`}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-surface-muted)]"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>

        <GoogleConnectPanel
          websiteId={website.id}
          websiteName={website.name}
          websiteUrl={website.url}
          isGscConnected={isGscConnected}
          isGa4Connected={isGa4Connected}
          currentGscProperty={isGscConnected ? (selectedGsc?.propertyUrl ?? website.gscProperty ?? website.url) : null}
          currentGa4PropertyId={
            isGa4Connected
              ? (telemetry.ga4?.propertyId ?? selectedGa4?.propertyId ?? website.ga4PropertyId ?? "524688594")
              : null
          }
        />
      </div>
    </>
  );
}
