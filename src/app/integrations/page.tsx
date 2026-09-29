import Link from "next/link";
import { TopBar } from "@/components/top-bar";
import { IntegrationsHub } from "@/components/integrations-hub";
import { loadPageContext } from "@/server/services/page-context";
import { prisma } from "@/server/db";
import { getLiveSiteTelemetryFromDb } from "@/server/services/wordpress-sync";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage(props: {
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

  const [integrations, googleConn, gscProps, ga4Props, telemetry] = await Promise.all([
    prisma.integration.findMany({
      where: { websiteId: website.id },
      select: {
        id: true,
        provider: true,
        kind: true,
        status: true,
        config: true,
      },
    }),
    prisma.googleConnection.findFirst({
      where: { websiteId: website.id, status: "connected" },
    }),
    prisma.gscProperty.findMany({ where: { websiteId: website.id } }),
    prisma.ga4Property.findMany({ where: { websiteId: website.id } }),
    getLiveSiteTelemetryFromDb(website.id),
  ]);

  const gscIntegration = integrations.find((i) => i.kind === "GSC" && i.status === "ACTIVE");
  const ga4Integration = integrations.find((i) => i.kind === "GA4" && i.status === "ACTIVE");
  const selectedGsc = gscProps.find((p) => p.isSelected);
  const selectedGa4 = ga4Props.find((p) => p.isSelected);

  const isGscConnected =
    Boolean(gscIntegration) ||
    Boolean(selectedGsc && selectedGsc.googleConnectionId !== "composio-gsc") ||
    Boolean(googleConn && website.gscProperty);

  const isGa4Connected =
    Boolean(telemetry.ga4?.propertyId) ||
    Boolean(ga4Integration) ||
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

      <div className="p-6 md:p-8 space-y-8 max-w-5xl mx-auto">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center border-b border-[var(--color-border)] pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#111827] dark:text-[#F9FAFB]">
              Integrations
            </h1>
            <p className="mt-1 text-xs text-[#6B7280] dark:text-[var(--color-muted)]">
              Manage your connected publishing platforms, analytics tools, and AI messaging channels for{" "}
              <span className="font-semibold text-[#111827] dark:text-neutral-200">{website.name}</span> ({website.url}).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/?website=${encodeURIComponent(website.id)}`}
              className="rounded-lg border border-[#E5E7EB] bg-white px-3.5 py-2 text-xs font-semibold text-[#374151] hover:bg-[#F9FAFB] dark:border-[var(--color-border)] dark:bg-[var(--color-surface)] dark:text-neutral-200 transition-colors shadow-2xs"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>

        <IntegrationsHub
          websiteId={website.id}
          websiteName={website.name}
          websiteUrl={website.url}
          initialIntegrations={integrations.map((i) => ({
            id: i.id,
            provider: i.provider,
            kind: i.kind,
            status: i.status,
            config: (i.config as Record<string, unknown>) ?? {},
          }))}
          googleStatus={{
            isConnected: Boolean(googleConn || isGscConnected),
            email: googleConn?.email ?? null,
            isGscConnected,
            gscProperty: selectedGsc?.propertyUrl ?? website.gscProperty ?? (isGscConnected ? website.url : null),
            isGa4Connected,
            ga4PropertyId: telemetry.ga4?.propertyId ?? selectedGa4?.propertyId ?? website.ga4PropertyId ?? null,
          }}
        />
      </div>
    </>
  );
}
