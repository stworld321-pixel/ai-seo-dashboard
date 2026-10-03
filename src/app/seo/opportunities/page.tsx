import { Card, CardHeader } from "@/components/card";
import { EmptyState, PageHeading } from "@/components/empty-state";
import { MetricCard } from "@/components/metric-card";
import { TodayPanel, type ActionItem } from "@/components/today-panel";
import { TopBar } from "@/components/top-bar";
import { formatNumber } from "@/lib/format";
import { loadPageContext } from "@/server/services/page-context";
import { prisma } from "@/server/db";
import { isBrandQuery } from "@/server/intelligence/opportunity-engine";
import { Search, Sparkles, Filter, X } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Every detected opportunity, filterable by status, segment (Product/Service vs Brand), and type.
 * Each opportunity is directly actionable and implementable with AI.
 */
export default async function OpportunitiesPage(props: PageProps<"/seo/opportunities">) {
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

  const statusFilter =
    typeof searchParams.status === "string"
      ? (searchParams.status.toUpperCase() as "OPEN" | "IN_PROGRESS" | "DONE" | "DISMISSED" | "ALL")
      : "OPEN";

  const scopeFilter =
    typeof searchParams.scope === "string"
      ? (searchParams.scope.toUpperCase() as "NON_BRAND" | "BRAND" | "ALL")
      : "NON_BRAND";

  const typeFilter = typeof searchParams.type === "string" ? searchParams.type : null;
  const searchKw = typeof searchParams.q === "string" ? searchParams.q.toLowerCase().trim() : "";

  // Derive brand terms for this website
  const brandName = website.name?.trim() || "";
  const brandTerms: string[] = [];
  if (brandName) {
    brandTerms.push(brandName);
    brandTerms.push(brandName.replace(/\s+/g, ""));
    brandTerms.push(brandName.replace(/\b2\b/g, "to"));
    brandTerms.push(brandName.replace(/\b2\b/g, "to").replace(/\s+/g, ""));
    brandTerms.push(brandName.replace(/\b2\b/g, "two"));
    brandTerms.push(brandName.replace(/\b2\b/g, "two").replace(/\s+/g, ""));
  }
  if (website.url) {
    try {
      const u = new URL(website.url.startsWith("http") ? website.url : `https://${website.url}`);
      const host = u.hostname.replace(/^www\./, "");
      const domainName = host.split(".")[0];
      if (domainName) {
        brandTerms.push(domainName);
        brandTerms.push(host);
      }
    } catch {}
  }

  const allOpps = await prisma.opportunity.findMany({
    where: { websiteId: website.id },
    orderBy: [{ priority: "asc" }, { score: "desc" }],
  });

  const isBrandOpp = (o: (typeof allOpps)[number]) => {
    const ev = (o.evidence ?? {}) as Record<string, unknown>;
    if (typeof ev.isBrand === "boolean") return ev.isBrand;
    return isBrandQuery(o.keyword ?? undefined, brandTerms);
  };

  const nonBrandCount = allOpps.filter((o) => !isBrandOpp(o)).length;
  const brandCount = allOpps.filter((o) => isBrandOpp(o)).length;

  const filteredByScope = allOpps.filter((o) => {
    const isBrand = isBrandOpp(o);
    if (scopeFilter === "NON_BRAND") return !isBrand;
    if (scopeFilter === "BRAND") return isBrand;
    return true;
  });

  const filteredByStatus =
    statusFilter === "ALL"
      ? filteredByScope
      : filteredByScope.filter((o) => o.status === statusFilter);

  const filteredByType = typeFilter
    ? filteredByStatus.filter((o) => o.type === typeFilter)
    : filteredByStatus;

  const visible = searchKw
    ? filteredByType.filter(
        (o) =>
          (o.keyword && o.keyword.toLowerCase().includes(searchKw)) ||
          (o.targetUrl && o.targetUrl.toLowerCase().includes(searchKw)) ||
          o.why.toLowerCase().includes(searchKw),
      )
    : filteredByType;

  const counts = {
    open: filteredByScope.filter((o) => o.status === "OPEN").length,
    inProgress: filteredByScope.filter((o) => o.status === "IN_PROGRESS" || o.status === "AWAITING_APPROVAL").length,
    done: filteredByScope.filter((o) => o.status === "DONE").length,
    dismissed: filteredByScope.filter((o) => o.status === "DISMISSED").length,
    total: filteredByScope.length,
    nonBrand: nonBrandCount,
    brand: brandCount,
  };

  const byPriority = {
    p1: filteredByStatus.filter((o) => o.priority === 1).length,
    p2: filteredByStatus.filter((o) => o.priority === 2).length,
    p3plus: filteredByStatus.filter((o) => o.priority >= 3).length,
  };

  const types = [...new Set(filteredByStatus.map((o) => o.type))];

  const actions: ActionItem[] = visible.map((o) => ({
    id: o.id,
    type: o.type,
    priority: o.priority,
    keyword: o.keyword,
    targetUrl: o.targetUrl,
    estimatedClicks: o.estimatedClicks,
    why: o.why,
    evidence: o.evidence as Record<string, unknown>,
    recommendation: o.recommendation as { action: string; detail?: string }[],
    status: o.status,
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
        <PageHeading
          title="Opportunities &amp; Implementations"
          description="High-ROI product, service, and organic search opportunities with 1-click AI implementation into WordPress &amp; CMS."
        />

        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard label="Actionable Opportunities" value={formatNumber(counts.open)} deltaLabel={scopeFilter === "NON_BRAND" ? "products & services" : "ready to act"} />
          <MetricCard label="In Progress / Approvals" value={formatNumber(counts.inProgress)} deltaLabel="queued" />
          <MetricCard label="Implemented" value={formatNumber(counts.done)} deltaLabel="completed" />
          <MetricCard label="Priority 1 Backlog" value={formatNumber(byPriority.p1)} deltaLabel="high impact" />
        </section>

        {/* Scope Segmentation Bar: Products & Services vs Brand */}
        <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-2xs">
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
            <span className="text-[11px] uppercase tracking-wider text-[var(--color-muted)] font-bold px-2 py-1 flex items-center gap-1">
              <Sparkles size={13} className="text-[var(--color-primary)]" />
              Focus:
            </span>
            <a
              href={`/seo/opportunities?range=${range}&status=${statusFilter}&scope=NON_BRAND${searchKw ? `&q=${encodeURIComponent(searchKw)}` : ""}`}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 transition-all ${
                scopeFilter === "NON_BRAND"
                  ? "bg-[var(--color-primary)] text-white shadow-xs font-bold"
                  : "border border-[var(--color-border)] bg-[var(--color-surface-muted)]/50 text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)]"
              }`}
            >
              <span>🌱 Products &amp; Services ({counts.nonBrand})</span>
              {scopeFilter === "NON_BRAND" && <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px]">Active</span>}
            </a>

            <a
              href={`/seo/opportunities?range=${range}&status=${statusFilter}&scope=BRAND${searchKw ? `&q=${encodeURIComponent(searchKw)}` : ""}`}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 transition-all ${
                scopeFilter === "BRAND"
                  ? "bg-[var(--color-primary)] text-white shadow-xs font-bold"
                  : "border border-[var(--color-border)] bg-[var(--color-surface-muted)]/50 text-[var(--color-muted)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)]"
              }`}
            >
              <span>🏢 Brand Navigational ({counts.brand})</span>
            </a>

            <a
              href={`/seo/opportunities?range=${range}&status=${statusFilter}&scope=ALL${searchKw ? `&q=${encodeURIComponent(searchKw)}` : ""}`}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 transition-all ${
                scopeFilter === "ALL"
                  ? "bg-[var(--color-primary)] text-white shadow-xs font-bold"
                  : "border border-[var(--color-border)] bg-[var(--color-surface-muted)]/50 text-[var(--color-muted)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)]"
              }`}
            >
              <span>All ({allOpps.length})</span>
            </a>
          </div>

          {/* Quick Search Input */}
          <form method="GET" action="/seo/opportunities" className="relative flex-1 sm:max-w-xs">
            <input type="hidden" name="range" value={range} />
            <input type="hidden" name="status" value={statusFilter} />
            <input type="hidden" name="scope" value={scopeFilter} />
            {typeFilter && <input type="hidden" name="type" value={typeFilter} />}
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[var(--color-muted)]" />
            <input
              type="text"
              name="q"
              defaultValue={searchKw}
              placeholder="Search product / service keywords..."
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/40 pl-8 pr-8 py-1.5 text-xs text-[var(--color-foreground)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] focus:outline-none"
            />
            {searchKw && (
              <a
                href={`/seo/opportunities?range=${range}&status=${statusFilter}&scope=${scopeFilter}`}
                className="absolute right-2.5 top-2 text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                title="Clear search"
              >
                <X size={14} />
              </a>
            )}
          </form>
        </div>

        {/* Status Filter Tabs */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] pb-3 text-xs font-medium">
          <a
            href={`/seo/opportunities?range=${range}&status=OPEN&scope=${scopeFilter}${searchKw ? `&q=${encodeURIComponent(searchKw)}` : ""}`}
            className={`rounded-md px-3 py-1.5 transition-colors ${
              statusFilter === "OPEN"
                ? "bg-[var(--color-primary)] text-[var(--color-primary-fg)] font-semibold"
                : "border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            }`}
          >
            Open ({counts.open})
          </a>
          <a
            href={`/seo/opportunities?range=${range}&status=IN_PROGRESS&scope=${scopeFilter}${searchKw ? `&q=${encodeURIComponent(searchKw)}` : ""}`}
            className={`rounded-md px-3 py-1.5 transition-colors ${
              statusFilter === "IN_PROGRESS"
                ? "bg-[var(--color-primary)] text-[var(--color-primary-fg)] font-semibold"
                : "border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            }`}
          >
            In Progress / Approvals ({counts.inProgress})
          </a>
          <a
            href={`/seo/opportunities?range=${range}&status=DONE&scope=${scopeFilter}${searchKw ? `&q=${encodeURIComponent(searchKw)}` : ""}`}
            className={`rounded-md px-3 py-1.5 transition-colors ${
              statusFilter === "DONE"
                ? "bg-[var(--color-primary)] text-[var(--color-primary-fg)] font-semibold"
                : "border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            }`}
          >
            Implemented ({counts.done})
          </a>
          <a
            href={`/seo/opportunities?range=${range}&status=DISMISSED&scope=${scopeFilter}${searchKw ? `&q=${encodeURIComponent(searchKw)}` : ""}`}
            className={`rounded-md px-3 py-1.5 transition-colors ${
              statusFilter === "DISMISSED"
                ? "bg-[var(--color-primary)] text-[var(--color-primary-fg)] font-semibold"
                : "border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            }`}
          >
            Dismissed ({counts.dismissed})
          </a>
          <a
            href={`/seo/opportunities?range=${range}&status=ALL&scope=${scopeFilter}${searchKw ? `&q=${encodeURIComponent(searchKw)}` : ""}`}
            className={`rounded-md px-3 py-1.5 transition-colors ${
              statusFilter === "ALL"
                ? "bg-[var(--color-primary)] text-[var(--color-primary-fg)] font-semibold"
                : "border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            }`}
          >
            All ({counts.total})
          </a>
        </div>

        {/* Type Filter Sub-chips */}
        {types.length > 1 ? (
          <div className="mt-4 flex flex-wrap gap-1 text-xs">
            <a
              href={`/seo/opportunities?range=${range}&status=${statusFilter}&scope=${scopeFilter}${searchKw ? `&q=${encodeURIComponent(searchKw)}` : ""}`}
              className={`rounded px-2 py-1 ${!typeFilter ? "bg-[var(--color-primary)]/20 text-[var(--color-primary)] font-semibold" : "border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"}`}
            >
              All Types ({filteredByStatus.length})
            </a>
            {types.map((t) => (
              <a
                key={t}
                href={`/seo/opportunities?range=${range}&status=${statusFilter}&scope=${scopeFilter}&type=${t}${searchKw ? `&q=${encodeURIComponent(searchKw)}` : ""}`}
                className={`rounded px-2 py-1 ${typeFilter === t ? "bg-[var(--color-primary)]/20 text-[var(--color-primary)] font-semibold" : "border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"}`}
              >
                {t.replace(/_/g, " ").toLowerCase()} ({filteredByStatus.filter((o) => o.type === t).length})
              </a>
            ))}
          </div>
        ) : null}

        <div className="mt-6">
          {actions.length > 0 ? (
            <TodayPanel actions={actions} />
          ) : (
            <Card>
              <CardHeader title="No opportunities in this view" />
              <div className="px-5 py-10 text-center text-sm text-[var(--color-muted)]">
                {searchKw
                  ? `No opportunities found matching "${searchKw}". Try another keyword or clear the search.`
                  : "No opportunities match the selected status and type filters."}
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
