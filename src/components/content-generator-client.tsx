"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/card";
import { StatusBadge } from "@/components/badges";
import type { ContentScoreReport } from "@/server/intelligence/content-scorer";
import type { ConfiguredAiModel } from "@/server/integrations/llm/provider";
import { detectNicheAndLocation } from "@/server/intelligence/content-scorer";

type OppOption = {
  id: string;
  type: string;
  keyword: string | null;
  targetUrl: string | null;
  priority: number;
};

function toTitleCase(str: string): string {
  return str
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function buildTitlePresets(kw: string, brandName: string = "Our Brand", websiteUrl: string = ""): string[] {
  const cap = toTitleCase(kw || "website design development");
  const { niche, capLocation } = detectNicheAndLocation(kw, brandName, websiteUrl);

  if (niche === "SALON_BEAUTY") {
    return [
      capLocation
        ? `${brandName} ${capLocation}: Top Hair, Beauty & Bridal Salon | Book Appointment`
        : `${cap}: Best Hair, Skin & Bridal Salon Services | ${brandName}`,
      `${cap}: Complete Service Menu, Packages & Price Guide | ${brandName}`,
      `Looking for ${cap}? Expert Stylists, Hair Spa & Bridal Makeover at ${brandName}`,
      `${cap}: Why ${brandName} Is the #1 Choice for Hair & Skin Care`,
    ];
  }

  if (niche === "DIGITAL_AGENCY") {
    return [
      capLocation
        ? `Top ${cap} Company in ${capLocation} | ${brandName}`
        : `${cap}: Best Agency Services & Growth Solutions | ${brandName}`,
      `Custom ${cap}: Complete Strategy, Process & ROI Guide | ${brandName}`,
      `Why Choose ${brandName} for High-Performance ${cap}`,
      `${cap}: Industry Best Practices & Conversion Solutions | ${brandName}`,
    ];
  }

  return [
    `${cap}: Complete Guide, Top Solutions & Best Practices | ${brandName}`,
    `What Is ${cap}? Key Benefits, Comparison & Expert FAQs | ${brandName}`,
    `Best ${cap} in India: Complete Buyer's & Service Guide | ${brandName}`,
    `${cap} vs Traditional Solutions: Comparison & Results by ${brandName}`,
  ];
}

export function ContentGeneratorClient({
  websiteId,
  websiteName = "Our Brand",
  websiteUrl = "https://example.com",
  aiModels,
  opportunities,
  initialKeyword,
}: {
  websiteId: string;
  websiteName?: string;
  websiteUrl?: string;
  aiModels: ConfiguredAiModel[];
  opportunities: OppOption[];
  initialKeyword?: string;
}) {
  const router = useRouter();
  const activeModel = aiModels.find((m) => m.isActive) ?? aiModels[0];

  const initialKw = initialKeyword || opportunities[0]?.keyword || "website design development";
  const [selectedOppId, setSelectedOppId] = useState<string>(
    initialKeyword ? "" : (opportunities[0]?.id ?? ""),
  );
  const [keyword, setKeyword] = useState<string>(initialKw);
  const [customTitle, setCustomTitle] = useState<string>(() => {
    const presets = buildTitlePresets(initialKw, websiteName, websiteUrl);
    return presets[0] || `${toTitleCase(initialKw)}: Complete Guide & Solutions | ${websiteName}`;
  });
  const [customSlug, setCustomSlug] = useState<string>("");
  const [secondaryInput, setSecondaryInput] = useState<string>(
    `best ${initialKw}, ${initialKw} price and reviews, how to choose ${initialKw}`,
  );
  const [type, setType] = useState<"ARTICLE" | "META_TITLE" | "FAQ">("ARTICLE");
  const [provider, setProvider] = useState<string>(activeModel?.provider ?? "openai");
  const [modelName, setModelName] = useState<string>(activeModel?.model ?? "gpt-4o");
  const [activeTab, setActiveTab] = useState<"preview" | "markdown" | "html" | "schema">("preview");
  const [loading, setLoading] = useState(false);
  const [publishingLive, setPublishingLive] = useState(false);
  const [copiedType, setCopiedType] = useState<string | null>(null);

  // Blog categories on the connected site, loaded on demand.
  const [categories, setCategories] = useState<Array<{ id: number; name: string; count: number }>>([]);
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [categoriesState, setCategoriesState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);

  // Empty means "publish immediately"; a future value hands scheduling to WordPress.
  const [scheduledAt, setScheduledAt] = useState("");

  const [result, setResult] = useState<{
    content: {
      id: string;
      title: string;
      slug: string | null;
      body: string | null;
      status: string;
      authorAgent: string | null;
      publishedUrl?: string | null;
    };
    metaDescription?: string;
    qaReport: ContentScoreReport;
    schemaJsonLd?: Record<string, unknown>;
    htmlPreview?: string;
    approvalId: string | null;
    modelUsed?: string;
    publishedLive?: {
      ok: boolean;
      id?: string;
      url?: string;
      slug?: string;
      status?: string;
      scheduledAt?: string | null;
      error?: string;
    } | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSelectOpportunity(oppId: string) {
    setSelectedOppId(oppId);
    const found = opportunities.find((o) => o.id === oppId);
    if (found?.keyword) {
      const kw = found.keyword;
      setKeyword(kw);
      const presets = buildTitlePresets(kw, websiteName, websiteUrl);
      setCustomTitle(presets[0] || `${toTitleCase(kw)}: Complete Guide | ${websiteName}`);
      setSecondaryInput(`best ${kw}, ${kw} reviews, ${websiteName} ${kw}`);
    }
  }

  function handleKeywordChange(nextKw: string) {
    setKeyword(nextKw);
    const presets = buildTitlePresets(nextKw, websiteName, websiteUrl);
    setCustomTitle(presets[0] || `${toTitleCase(nextKw)}: Complete Guide | ${websiteName}`);
  }

  function handleProviderSelect(nextProvider: string) {
    setProvider(nextProvider);
    const configured = aiModels.find((m) => m.provider === nextProvider);
    if (configured) {
      setModelName(configured.model);
    } else if (nextProvider === "openai") {
      setModelName("gpt-4o");
    } else if (nextProvider === "anthropic") {
      setModelName("claude-sonnet-4-5");
    } else if (nextProvider === "gemini") {
      setModelName("gemini-2.5-pro");
    } else {
      setModelName("openai/gpt-4o");
    }
  }

  function copyToClipboard(text: string, label: string) {
    void navigator.clipboard.writeText(text);
    setCopiedType(label);
    setTimeout(() => setCopiedType(null), 2500);
  }

  function downloadFile(content: string, filename: string, typeStr: string) {
    const blob = new Blob([content], { type: typeStr });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /** The datetime-local value is local wall time; send an absolute instant. */
  function scheduledAtIso(): string | undefined {
    if (!scheduledAt) return undefined;
    const d = new Date(scheduledAt);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }

  async function loadCategories() {
    if (categoriesState === "loading") return;
    setCategoriesState("loading");
    setCategoriesError(null);
    try {
      const res = await fetch(`/api/content/categories?website=${encodeURIComponent(websiteId)}`);
      const json = await res.json();
      if (!res.ok) {
        setCategoriesError(json.error?.message ?? "Could not load categories.");
        setCategoriesState("error");
        return;
      }
      setCategories(json.data?.categories ?? []);
      setCategoriesState("ready");
    } catch (err) {
      setCategoriesError(err instanceof Error ? err.message : "Could not load categories.");
      setCategoriesState("error");
    }
  }

  async function handleCreateCategory() {
    const name = newCategory.trim();
    if (!name || creatingCategory) return;
    setCreatingCategory(true);
    setCategoriesError(null);
    try {
      const res = await fetch("/api/content/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId, name }),
      });
      const json = await res.json();
      if (!res.ok) {
        setCategoriesError(json.error?.message ?? "Could not create the category.");
        return;
      }
      const created = json.data.category as { id: number; name: string };
      setCategories((prev) =>
        prev.some((c) => c.id === created.id) ? prev : [...prev, { ...created, count: 0 }],
      );
      setCategoryIds((prev) => (prev.includes(created.id) ? prev : [...prev, created.id]));
      setNewCategory("");
      setCategoriesState("ready");
    } catch (err) {
      setCategoriesError(err instanceof Error ? err.message : "Could not create the category.");
    } finally {
      setCreatingCategory(false);
    }
  }

  function toggleCategory(id: number) {
    setCategoryIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  async function runGenerate(publishLive: boolean) {
    setLoading(true);
    setError(null);
    try {
      const secondaryKeywords = secondaryInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch("/api/content/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteId,
          opportunityId: selectedOppId || undefined,
          keyword: keyword.trim(),
          customTitle: customTitle.trim() || undefined,
          customSlug: customSlug.trim() || undefined,
          secondaryKeywords,
          type,
          provider,
          model: modelName.trim(),
          publishLive,
          categoryIds: categoryIds.length ? categoryIds : undefined,
          scheduledAt: scheduledAtIso(),
        }),
      });
      const contentType = res.headers.get("content-type") || "";
      let json: { data?: any; error?: { message?: string } } = {};
      if (contentType.includes("application/json")) {
        json = await res.json();
      } else {
        const text = await res.text();
        throw new Error(
          res.ok
            ? "Unexpected server response"
            : `Server returned error (${res.status}): ${text.slice(0, 120)}`,
        );
      }

      if (!res.ok) {
        setError(json.error?.message ?? "Failed to generate content");
      } else {
        setResult(json.data);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate content");
    } finally {
      setLoading(false);
    }
  }

  async function handlePublishExistingLive() {
    if (!result?.content.id) return;
    setPublishingLive(true);
    setError(null);
    try {
      const res = await fetch("/api/content/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteId,
          contentId: result.content.id,
          publishLive: true,
          categoryIds: categoryIds.length ? categoryIds : undefined,
          scheduledAt: scheduledAtIso(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? "Failed to publish blog post to WordPress");
      } else if (json.data?.publishedLive) {
        setResult((prev) =>
          prev
            ? {
                ...prev,
                content: {
                  ...prev.content,
                  status: json.data.publishedLive.status === "future" ? "APPROVED" : "PUBLISHED",
                  publishedUrl: json.data.publishedLive.url,
                },
                publishedLive: json.data.publishedLive,
              }
            : prev,
        );
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish blog post to WordPress");
    } finally {
      setPublishingLive(false);
    }
  }

  const titlePresets = buildTitlePresets(keyword, websiteName, websiteUrl);
  const titleLen = customTitle.trim().length;
  const cleanSiteDomain = websiteUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "");

  return (
    <div className="grid gap-6 xl:grid-cols-12">
      <Card className="xl:col-span-5">
        <CardHeader
          title="SEO + AEO + GEO Blog & Brief Builder"
          subtitle={`Targeted for ${websiteName} (${cleanSiteDomain}) · High-CTR Page-1 formulas, Featured Snippets & AI citations`}
        />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void runGenerate(false);
          }}
          className="space-y-4 p-5"
        >
          <div className="flex flex-wrap gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)]/60 p-2.5 text-[11px]">
            <StatusBadge status="SEO · Page-1 Ready" tone="success" />
            <StatusBadge status="AEO · Featured Snippet + FAQ Schema" tone="info" />
            <StatusBadge status="GEO · AI Overviews & LLM Citations" tone="warning" />
          </div>

          {opportunities.length > 0 ? (
            <div>
              <label className="block text-xs font-medium text-[var(--color-muted)]">
                Seed from Tracked Opportunity / Keyword (Optional)
              </label>
              <select
                value={selectedOppId}
                onChange={(e) => handleSelectOpportunity(e.target.value)}
                className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
              >
                <option value="">Custom topic &amp; title...</option>
                {opportunities.map((o) => (
                  <option key={o.id} value={o.id}>
                    P{o.priority} [{o.type}] — {o.keyword ?? o.targetUrl}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div>
            <label className="block text-xs font-medium text-[var(--color-muted)]">
              Primary Focus Keyword (Target Search Term)
            </label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => handleKeywordChange(e.target.value)}
              required
              placeholder="e.g. salon mafia pallavaram, website design development"
              className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-[var(--color-muted)]">
                Custom Blog Title (H1 &amp; SERP Title)
              </label>
              <span
                className={`font-mono text-[11px] ${
                  titleLen >= 35 && titleLen <= 70
                    ? "text-[var(--color-success)]"
                    : "text-[var(--color-warning)]"
                }`}
              >
                {titleLen} chars (target 35–70)
              </span>
            </div>
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              required
              placeholder="Enter your custom blog title..."
              className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium"
            />
            <div className="mt-2 space-y-1">
              <p className="text-[11px] font-medium text-[var(--color-muted)]">
                Click a tailored Page-1 High-CTR Title Formula for {websiteName}:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {titlePresets.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCustomTitle(preset)}
                    className="rounded border border-[var(--color-border)] bg-[var(--color-surface-muted)]/70 px-2.5 py-1.5 text-left text-[11px] text-[var(--color-foreground)] transition hover:border-[var(--color-primary)] hover:bg-[var(--color-surface)]"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-[var(--color-muted)]">
                Secondary / LSI Keywords (comma-separated)
              </label>
              <input
                type="text"
                value={secondaryInput}
                onChange={(e) => setSecondaryInput(e.target.value)}
                placeholder="e.g. price, reviews, near me"
                className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-muted)]">
                Custom URL Slug (Optional)
              </label>
              <input
                type="text"
                value={customSlug}
                onChange={(e) => setCustomSlug(e.target.value)}
                placeholder="auto-generated-from-title"
                className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 font-mono text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-muted)]">
              Content Format
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as "ARTICLE" | "META_TITLE" | "FAQ")}
              className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
            >
              <option value="ARTICLE">
                Full Page-1 Blog Article (SEO + AEO Answer Box + GEO Matrix + FAQ Schema)
              </option>
              <option value="META_TITLE">On-Page Title &amp; Meta Rewrite</option>
              <option value="FAQ">People-Also-Ask (AEO) FAQ Block + Schema</option>
            </select>
          </div>

          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)]/50 p-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold">AI Provider &amp; Model</label>
              <Link
                href="/settings"
                className="text-[11px] font-medium text-[var(--color-primary)] hover:underline"
              >
                Configure in Settings →
              </Link>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              {(
                [
                  { id: "openai", label: "ChatGPT" },
                  { id: "anthropic", label: "Claude" },
                  { id: "gemini", label: "Gemini" },
                  { id: "custom", label: "Custom" },
                ] as const
              ).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleProviderSelect(p.id)}
                  className={`rounded border px-2 py-1.5 text-xs font-medium transition ${
                    provider === p.id
                      ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-fg)]"
                      : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)]"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="mt-2">
              <label className="block text-[11px] text-[var(--color-muted)]">
                Model ID to Use
              </label>
              <input
                type="text"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="e.g. gpt-4o, claude-sonnet-4-5, gemini-2.5-pro"
                className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 font-mono text-xs"
              />
            </div>
          </div>

          {/* Blog category + schedule: both apply to live publishing only. */}
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)]/40 p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Blog Category
              </label>
              {categoriesState === "idle" ? (
                <button
                  type="button"
                  onClick={() => void loadCategories()}
                  className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-[11px] font-medium hover:bg-[var(--color-surface-muted)]"
                >
                  Load from site
                </button>
              ) : (
                <span className="text-[11px] text-[var(--color-muted)]">
                  {categoriesState === "loading"
                    ? "Loading…"
                    : categoryIds.length > 0
                      ? `${categoryIds.length} selected`
                      : "Uncategorised"}
                </span>
              )}
            </div>

            {categoriesError ? (
              <p className="text-[11px] font-medium text-[var(--color-danger)]">{categoriesError}</p>
            ) : null}

            {categories.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {categories.map((c) => {
                  const on = categoryIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleCategory(c.id)}
                      aria-pressed={on}
                      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition ${
                        on
                          ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-fg)]"
                          : "border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-muted)]"
                      }`}
                    >
                      {c.name}
                      {c.count > 0 ? ` (${c.count})` : ""}
                    </button>
                  );
                })}
              </div>
            ) : null}

            <div className="flex gap-2">
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleCreateCategory();
                  }
                }}
                placeholder="Add a new category…"
                className="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs"
              />
              <button
                type="button"
                disabled={!newCategory.trim() || creatingCategory}
                onClick={() => void handleCreateCategory()}
                className="shrink-0 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--color-surface-muted)] disabled:opacity-50"
              >
                {creatingCategory ? "Adding…" : "Add"}
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Schedule Publish
              </label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs"
              />
              <p className="mt-1 text-[11px] text-[var(--color-muted)]">
                {scheduledAt
                  ? "WordPress will publish the post at this time."
                  : "Leave empty to publish immediately."}
              </p>
            </div>
          </div>

          {error ? <p className="text-xs font-medium text-[var(--color-danger)]">{error}</p> : null}

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-[var(--color-primary)] px-4 py-2.5 text-xs font-semibold text-[var(--color-primary-fg)] shadow-sm transition hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Generating Page-1 Article..." : "Generate Page-1 Article & Preview"}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => void runGenerate(true)}
              className="w-full rounded-md border border-[var(--color-success)] bg-[var(--color-success-bg)] px-4 py-2.5 text-xs font-semibold text-[var(--color-success)] shadow-sm transition hover:opacity-90 disabled:opacity-50"
            >
              {loading
                ? scheduledAt ? "Scheduling..." : "Publishing..."
                : scheduledAt ? "Generate & Schedule ↗" : "Generate & Publish Live ↗"}
            </button>
          </div>
        </form>
      </Card>

      <Card className="xl:col-span-7">
        <CardHeader
          title={result ? result.content.title : "Page-1 Output & Universal CMS Copy/Export"}
          subtitle={
            result
              ? `Score: ${result.qaReport.score}/100 · SEO: ${result.qaReport.seoScore}% · AEO: ${result.qaReport.aeoScore}% · GEO: ${result.qaReport.geoScore}% · ${result.qaReport.wordCount} words · Density: ${result.qaReport.keywordDensityPct}%`
              : "Generate an article on the left, then copy or preview it directly for ANY website or CMS."
          }
          action={
            result ? (
              <div className="flex flex-wrap items-center gap-2">
                {result.publishedLive?.ok && result.publishedLive.url ? (
                  <a
                    href={result.publishedLive.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md bg-[var(--color-success-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--color-success)] hover:underline"
                  >
                    {result.publishedLive.status === "future"
                      ? `Scheduled for ${new Date(result.publishedLive.scheduledAt ?? "").toLocaleString()} ↗`
                      : "Live on Website ↗"}
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled={publishingLive}
                    onClick={handlePublishExistingLive}
                    className="rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--color-primary-fg)] hover:opacity-90 disabled:opacity-50"
                  >
                    {publishingLive
                      ? scheduledAt ? "Scheduling..." : "Publishing..."
                      : scheduledAt ? "Schedule on WordPress ↗" : "Publish to WordPress ↗"}
                  </button>
                )}
                <StatusBadge
                  status={
                    result.publishedLive?.ok
                      ? result.publishedLive.status === "future"
                        ? "Scheduled"
                        : "Published Live"
                      : result.qaReport.qaPassed
                        ? `Page-1 Ready (${result.qaReport.score}/100)`
                        : "Needs Review"
                  }
                  tone={result.qaReport.qaPassed ? "success" : "warning"}
                />
              </div>
            ) : null
          }
        />

        {result ? (
          <div className="space-y-4 p-5">
            {/* Universal CMS Copy & Export Toolbar */}
            <div className="rounded-lg border border-[var(--color-primary)]/30 bg-[var(--color-surface-muted)]/70 p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[var(--color-foreground)]">
                  📋 Universal Copy &amp; Export (Paste into Any CMS, React, Webflow, Shopify or Custom Site):
                </span>
                {copiedType ? (
                  <span className="rounded bg-[var(--color-success)] px-2 py-0.5 text-xs font-bold text-white animate-pulse">
                    ✓ Copied {copiedType}!
                  </span>
                ) : null}
              </div>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => copyToClipboard(result.content.body ?? "", "Markdown")}
                  className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-foreground)] shadow-sm transition hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-muted)]"
                >
                  📄 Copy Markdown
                </button>
                <button
                  type="button"
                  onClick={() => copyToClipboard(result.htmlPreview ?? "", "Clean HTML")}
                  className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-foreground)] shadow-sm transition hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-muted)]"
                >
                  🌐 Copy HTML for CMS
                </button>
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(
                      `SEO Title: ${result.content.title}\nMeta Description: ${result.metaDescription ?? ""}\nFocus Keyword: ${keyword}`,
                      "Title & Meta",
                    )
                  }
                  className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-foreground)] shadow-sm transition hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-muted)]"
                >
                  🏷️ Copy Title &amp; Meta
                </button>
                <button
                  type="button"
                  onClick={() =>
                    downloadFile(
                      result.content.body ?? "",
                      `${result.content.slug || "article"}.md`,
                      "text/markdown",
                    )
                  }
                  className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-foreground)] shadow-sm transition hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-muted)]"
                >
                  ⬇️ Download .md
                </button>
                <button
                  type="button"
                  onClick={() =>
                    downloadFile(
                      result.htmlPreview ?? "",
                      `${result.content.slug || "article"}.html`,
                      "text/html",
                    )
                  }
                  className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-foreground)] shadow-sm transition hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-muted)]"
                >
                  ⬇️ Download .html
                </button>
              </div>
            </div>

            {/* Score Grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)]/50 p-3 text-center">
                <p className="text-[11px] font-medium uppercase text-[var(--color-muted)]">
                  Total Score
                </p>
                <p className="mt-1 text-2xl font-bold text-[var(--color-success)]">
                  {result.qaReport.score}/100
                </p>
              </div>
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)]/50 p-3 text-center">
                <p className="text-[11px] font-medium uppercase text-[var(--color-muted)]">
                  SEO Readiness
                </p>
                <p className="mt-1 text-2xl font-bold text-[var(--color-success)]">
                  {result.qaReport.seoScore}%
                </p>
              </div>
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)]/50 p-3 text-center">
                <p className="text-[11px] font-medium uppercase text-[var(--color-muted)]">
                  AEO (Snippet &amp; PAA)
                </p>
                <p className="mt-1 text-2xl font-bold text-[var(--color-info)]">
                  {result.qaReport.aeoScore}%
                </p>
              </div>
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)]/50 p-3 text-center">
                <p className="text-[11px] font-medium uppercase text-[var(--color-muted)]">
                  GEO (AI Citations)
                </p>
                <p className="mt-1 text-2xl font-bold text-[var(--color-primary)]">
                  {result.qaReport.geoScore}%
                </p>
              </div>
            </div>

            {/* Live SERP Google Snippet Preview */}
            {result.metaDescription ? (
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)]/30 p-3 text-xs">
                <p className="font-semibold text-[var(--color-muted)]">
                  Google Page-1 SERP Snippet Preview:
                </p>
                <p className="mt-1 text-sm font-semibold text-[#1a0dab] hover:underline cursor-pointer">
                  {result.content.title}
                </p>
                <p className="font-mono text-[11px] text-[#006621]">
                  {websiteUrl.replace(/\/+$/, "")}/{result.content.slug ?? ""}/
                </p>
                <p className="mt-0.5 text-xs text-[var(--color-foreground)]">
                  {result.metaDescription}
                </p>
              </div>
            ) : null}

            {/* Tab Navigation */}
            <div className="flex border-b border-[var(--color-border)] text-xs font-medium">
              <button
                type="button"
                onClick={() => setActiveTab("preview")}
                className={`border-b-2 px-4 py-2 ${
                  activeTab === "preview"
                    ? "border-[var(--color-primary)] text-[var(--color-primary)] font-semibold"
                    : "border-transparent text-[var(--color-muted)]"
                }`}
              >
                Formatted Live Preview
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("markdown")}
                className={`border-b-2 px-4 py-2 ${
                  activeTab === "markdown"
                    ? "border-[var(--color-primary)] text-[var(--color-primary)] font-semibold"
                    : "border-transparent text-[var(--color-muted)]"
                }`}
              >
                Markdown Source
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("html")}
                className={`border-b-2 px-4 py-2 ${
                  activeTab === "html"
                    ? "border-[var(--color-primary)] text-[var(--color-primary)] font-semibold"
                    : "border-transparent text-[var(--color-muted)]"
                }`}
              >
                HTML Output
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("schema")}
                className={`border-b-2 px-4 py-2 ${
                  activeTab === "schema"
                    ? "border-[var(--color-primary)] text-[var(--color-primary)] font-semibold"
                    : "border-transparent text-[var(--color-muted)]"
                }`}
              >
                AEO / GEO FAQ Schema
              </button>
            </div>

            {activeTab === "preview" && result.htmlPreview ? (
              <div
                className="prose prose-sm max-w-none rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-sm leading-relaxed space-y-4 shadow-inner"
                dangerouslySetInnerHTML={{ __html: result.htmlPreview }}
              />
            ) : activeTab === "html" && result.htmlPreview ? (
              <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
                <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed max-h-[600px] overflow-y-auto">
                  {result.htmlPreview}
                </pre>
              </div>
            ) : activeTab === "schema" && result.schemaJsonLd ? (
              <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
                <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed max-h-[600px] overflow-y-auto">
                  {JSON.stringify(result.schemaJsonLd, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
                <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed max-h-[600px] overflow-y-auto">
                  {result.content.body}
                </pre>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 px-6 py-12 text-sm text-[var(--color-muted)]">
            <p className="font-medium text-[var(--color-foreground)]">
              Built for Page-1 Rankings across Google Search (SEO), Answer Engines (AEO), and
              Generative AI (GEO):
            </p>
            <ul className="list-disc space-y-2 pl-5 text-xs">
              <li>
                <strong>Niche-Aware &amp; Location-Specific:</strong> Tailored specifically for{" "}
                <strong>{websiteName}</strong> with high-converting titles &amp; authentic local intent.
              </li>
              <li>
                <strong>Universal CMS Compatibility:</strong> Not connected to WordPress? Easily copy
                clean Markdown or HTML and paste it into Webflow, Shopify, Ghost, React, Next.js, or custom CMS.
              </li>
              <li>
                <strong>AEO Friendly (Featured Snippets &amp; Voice Search):</strong> 45-word Direct
                Answer Box right under H1 + People-Also-Ask FAQ section + automatic{" "}
                <code>Article</code> &amp; <code>FAQPage</code> JSON-LD Schema.
              </li>
              <li>
                <strong>GEO Friendly (Google AI Overviews, ChatGPT, Perplexity):</strong> Key Takeaways entity summary + comparison table designed for AI citations.
              </li>
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
}
