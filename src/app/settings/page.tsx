import Link from "next/link";
import { Card, CardHeader } from "@/components/card";
import { DataTable } from "@/components/data-table";
import { EmptyState, PageHeading } from "@/components/empty-state";
import { StatusBadge } from "@/components/badges";
import { TopBar } from "@/components/top-bar";
import { SettingsClient } from "@/components/settings-client";
import { relativeTime } from "@/lib/format";
import { prisma } from "@/server/db";
import { getDefaultWebsite } from "@/server/services/dashboard";
import { loadPageContext } from "@/server/services/page-context";
import { getConfiguredAiModels } from "@/server/integrations/llm/provider";

export const dynamic = "force-dynamic";

export default async function SettingsPage(props: PageProps<"/settings">) {
  const searchParams = await props.searchParams;
  const { ctx } = await loadPageContext(searchParams);
  const website = await getDefaultWebsite(
    typeof searchParams.website === "string" ? searchParams.website : undefined,
  );

  if (!website) {
    return (
      <div className="p-6 max-w-lg mx-auto text-center pt-20">
        <EmptyState
          title="No website connected"
          message="Please connect a website in your workspace to manage its settings and API integrations."
        />
        <div className="mt-4 flex justify-center">
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-[var(--color-primary-hover)] transition-colors"
          >
            Add Website Now
          </Link>
        </div>
      </div>
    );
  }

  const [integrations, aiModels] = await Promise.all([
    prisma.integration.findMany({
      where: { websiteId: website.id },
      orderBy: { createdAt: "asc" },
    }),
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
          title="Settings, AI Models & Integrations"
          description="Configure AI models (ChatGPT, Claude, Gemini), manage autonomy guardrails, and store AES-256-GCM encrypted integration credentials."
        />

        <SettingsClient website={website} initialAiModels={aiModels} />

        <Card className="mt-6">
          <CardHeader
            title="Connected Integration Adapters"
            subtitle={`${integrations.length} adapters registered for ${website.name}`}
          />
          <DataTable
            rows={integrations}
            getKey={(r) => r.id}
            empty="No integrations registered yet"
            columns={[
              {
                key: "kind",
                header: "Kind",
                render: (r) => <span className="font-mono text-xs font-semibold">{r.kind}</span>,
              },
              {
                key: "provider",
                header: "Provider",
                render: (r) => <span className="text-xs capitalize">{r.provider}</span>,
              },
              {
                key: "model",
                header: "Target / Model",
                render: (r) => {
                  const cfg = (r.config ?? {}) as { model?: string; siteUrl?: string; propertyUrl?: string };
                  return (
                    <span className="font-mono text-xs text-[var(--color-muted)]">
                      {cfg.model ?? r.externalId ?? cfg.siteUrl ?? cfg.propertyUrl ?? "—"}
                    </span>
                  );
                },
              },
              {
                key: "status",
                header: "Status",
                render: (r) => (
                  <StatusBadge
                    status={r.status}
                    tone={
                      r.status === "ACTIVE"
                        ? "success"
                        : r.status === "ERROR"
                          ? "danger"
                          : "warning"
                    }
                  />
                ),
              },
              {
                key: "enc",
                header: "Secret Storage",
                render: (r) => (
                  <span className="font-mono text-xs text-[var(--color-muted)]">
                    {r.secretCipher ? "AES-256-GCM Encrypted" : "CLI / Public Read"}
                  </span>
                ),
              },
              {
                key: "sync",
                header: "Last Updated",
                align: "right",
                render: (r) => (
                  <span className="text-xs text-[var(--color-muted)]">
                    {relativeTime(r.lastSyncAt ?? r.createdAt)}
                  </span>
                ),
              },
            ]}
          />
        </Card>
      </div>
    </>
  );
}
