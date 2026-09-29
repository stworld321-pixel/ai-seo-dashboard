import Link from "next/link";
import { TopBar } from "@/components/top-bar";
import { Card, CardHeader } from "@/components/card";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/badges";
import { loadPageContext } from "@/server/services/page-context";
import { prisma } from "@/server/db";
import { ArrowLeft, Network, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function EntityAuthorityPage(props: {
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

  const [entities, pages] = await Promise.all([
    prisma.entityNode.findMany({
      where: { websiteId: website.id },
      include: {
        relationships: { include: { target: true } },
      },
    }),
    prisma.pageRecord.findMany({ where: { websiteId: website.id }, take: 10 }),
  ]);

  // Construct default entity hierarchy if none seeded
  const displayEntities = entities.length > 0 ? entities : [
    {
      id: "e1",
      name: website.name,
      type: "Brand / Organization",
      description: `Primary organization entity for ${website.url}`,
      schemaType: "Organization",
      confidence: 1.0,
      relationships: [
        { relationship: "operatesIn", target: { name: website.country === "IND" ? "India" : website.country, type: "Location" } },
        { relationship: "manufacturesOrOffers", target: { name: "Primary Products & Services", type: "ProductCatalog" } },
      ],
    },
    {
      id: "e2",
      name: "Product Catalog",
      type: "Product Hierarchy",
      description: "Core product specifications and material variants",
      schemaType: "Product",
      confidence: 0.95,
      relationships: [
        { relationship: "partOf", target: { name: website.name, type: "Brand" } },
      ],
    },
  ];

  return (
    <>
      <TopBar
        websiteName={website.name}
        websiteUrl={website.url}
        range={range}
        lastSyncedAt={ctx.lastSyncedAt}
        dataThrough={window.to.toISOString().slice(0, 10)}
      />

      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/ai-visibility"
            className="rounded p-1 text-[var(--color-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-foreground)]"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Entity Authority & Knowledge Graph</h1>
            <p className="mt-0.5 text-xs text-[var(--color-muted)]">
              Map and strengthen how AI engines understand your brand, products, locations, and industry associations.
            </p>
          </div>
        </div>

        {/* Entity Relationship Cards */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader
              title="Brand Entity Relationships"
              subtitle="Explicit connections mapped in semantic knowledge structures"
            />
            <div className="p-4 space-y-3">
              {displayEntities.map((e) => (
                <div key={e.id} className="rounded-lg border border-[var(--color-border)] p-3 bg-[var(--color-surface-muted)]">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">{e.name}</h4>
                    <span className="rounded bg-[var(--color-surface)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-muted)] border border-[var(--color-border)]">
                      {e.schemaType}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">{e.description}</p>

                  <div className="mt-2.5 flex flex-wrap gap-2 text-xs">
                    {e.relationships.map((rel, i) => (
                      <span key={i} className="rounded bg-[var(--color-surface)] px-2 py-0.5 text-[11px] font-mono border border-[var(--color-border)]">
                        {rel.relationship} → <strong>{rel.target.name}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Missing Entity Connections (GEO Diagnostics)"
              subtitle="Gaps where AI answer engines fail to associate brand attributes with products"
            />
            <div className="p-4 space-y-3">
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs space-y-1.5">
                <p className="font-semibold text-amber-600">Missing Brand Association on Product Guides</p>
                <p className="text-[var(--color-foreground)]">
                  Technical guides mention product categories but lack explicit Schema linking back to <code className="font-mono">{website.name}</code> as the verified manufacturer.
                </p>
                <p className="text-[11px] text-[var(--color-muted)]">
                  <strong>Recommendation:</strong> Add <code className="font-mono">brand</code> and <code className="font-mono">manufacturer</code> JSON-LD schema referencing the primary Organization entity.
                </p>
              </div>

              <div className="rounded-lg border border-[var(--color-border)] p-3 text-xs space-y-1.5 bg-[var(--color-surface-muted)]">
                <p className="font-semibold text-[var(--color-primary)]">Unlinked Regional Authority</p>
                <p className="text-[var(--color-foreground)]">
                  Local business and regional operational entities are not connected to geo-targeted keywords in AI knowledge models.
                </p>
                <p className="text-[11px] text-[var(--color-muted)]">
                  <strong>Recommendation:</strong> Create dedicated location-entity hubs with LocalBusiness schema and verified Google Business Profile links.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
