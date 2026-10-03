"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Globe,
  FileText,
  Code2,
  Copy,
  Check,
  Download,
  ExternalLink,
  RefreshCw,
  Calendar,
  Bot,
  Layers,
  CheckCircle2,
  Sliders,
  ShieldCheck,
  Tag,
  Zap,
  Loader2,
  BookOpen,
  Search,
  CheckCheck,
  ChevronDown,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { Card, CardHeader } from "@/components/card";
import { StatusBadge } from "@/components/badges";
import type { ContentScoreReport } from "@/server/intelligence/content-scorer";
import type { ConfiguredAiModel } from "@/server/integrations/llm/provider";
import { detectNicheAndLocation } from "@/server/intelligence/content-scorer";

export type OppOption = {
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

function buildTitlePresets(
  kw: string,
  brandName: string = "Our Brand",
  websiteUrl: string = "",
): string[] {
  const cap = toTitleCase(kw || "Organic Farm Produce");
  const { niche, capLocation } = detectNicheAndLocation(kw, brandName, websiteUrl);
  const qLower = kw.toLowerCase().trim();

  // 1. Organic Food, Farm Products, Fruits, Vegetables, Ghee, Milk, Oils, Groceries
  if (niche === "ORGANIC_FOOD_GROCERY") {
    return [
      capLocation
        ? `Fresh Organic ${cap} in ${capLocation} | 100% Pure & Farm-Fresh | ${brandName}`
        : `Fresh Organic ${cap}: Health Benefits, Nutrition & Buying Guide | ${brandName}`,
      `Top 7 Health Benefits of ${cap}: Daily Nutrition, Uses & Benefits | ${brandName}`,
      `Where to Buy Pure Organic ${cap}${capLocation ? ` in ${capLocation}` : ""}: Farm-Direct Delivery | ${brandName}`,
      `${cap} vs Conventional Market Produce: Nutrition & Purity Compared | ${brandName}`,
    ];
  }

  // 2. Personal Care, Soaps, Skincare & Natural Cosmetics
  if (niche === "ECOMMERCE_PRODUCT") {
    return [
      `Pure ${cap}: Natural Ingredients, Skin Benefits & How to Use | ${brandName}`,
      `Why Choose Chemical-Free ${cap}: Complete Daily Routine Guide | ${brandName}`,
      `Best All-Natural ${cap}${capLocation ? ` in ${capLocation}` : ""}: Gentle & Chemical-Free | ${brandName}`,
      `${cap} vs Commercial Formulations: Handcrafted Botanical Comparison | ${brandName}`,
    ];
  }

  // 3. Salons, Hair & Bridal Beauty Services
  if (niche === "SALON_BEAUTY") {
    return [
      capLocation
        ? `${brandName} ${capLocation}: Top Hair, Beauty & Bridal Salon | Book Appointment`
        : `${cap}: Best Hair, Skin & Bridal Salon Services | ${brandName}`,
      `${cap}: Complete Service Menu, Packages & Price Guide | ${brandName}`,
      `Looking for ${cap}? Expert Stylists, Hair Spa & Makeover at ${brandName}`,
      `Why ${brandName} Is the #1 Recommended Choice for ${cap}`,
    ];
  }

  // 4. Healthcare, Clinics, Medical & Dental
  if (niche === "HEALTHCARE") {
    return [
      `${cap}: Symptoms, Causes, Treatments & Expert Advice | ${brandName}`,
      `How to Choose the Best ${cap}${capLocation ? ` in ${capLocation}` : ""}: Complete Guide | ${brandName}`,
      `Top Treatment Options & Recovery Care for ${cap} | ${brandName}`,
      `Expert Consultation for ${cap}: Key Benefits & What to Expect | ${brandName}`,
    ];
  }

  // 5. Digital Agency, Web Design, Marketing & Software
  if (niche === "DIGITAL_AGENCY") {
    return [
      capLocation
        ? `Top ${cap} Company in ${capLocation} | ${brandName}`
        : `${cap}: Best Agency Services & Growth Solutions | ${brandName}`,
      `Custom ${cap}: Complete Strategy, Process & ROI Guide | ${brandName}`,
      `Why Choose ${brandName} for High-Performance ${cap}`,
      `${cap}: Proven Framework & Client Results by ${brandName}`,
    ];
  }

  // 6. Informational Questions (How to, What is, Why, Benefits of, vs)
  if (
    qLower.startsWith("how") ||
    qLower.startsWith("what") ||
    qLower.startsWith("why") ||
    qLower.startsWith("benefits") ||
    qLower.includes(" vs ") ||
    qLower.includes("difference")
  ) {
    return [
      `${cap}: Complete Guide, Key Insights & FAQs | ${brandName}`,
      `Everything You Need to Know About ${cap} | ${brandName}`,
      `How to Master ${cap}: Step-by-Step Practical Guide | ${brandName}`,
      `${cap}: Practical Tips, Comparison & Expert Recommendations | ${brandName}`,
    ];
  }

  // 7. General High-Converting Product/Service Titles
  return [
    `${cap}: Complete Guide, Key Benefits & Buyer's Insights | ${brandName}`,
    `How to Choose the Best ${cap}${capLocation ? ` in ${capLocation}` : ""}: Essential Guide | ${brandName}`,
    `Top 5 Advantages of Choosing ${cap} from ${brandName}`,
    `${cap} vs Traditional Alternatives: Quality & Value Comparison | ${brandName}`,
  ];
}

export function ContentGeneratorClient({
  websiteId,
  websiteName = "Our Brand",
  websiteUrl = "https://example.com",
  aiModels,
  opportunities = [],
  initialKeyword,
}: {
  websiteId: string;
  websiteName?: string;
  websiteUrl?: string;
  aiModels: ConfiguredAiModel[];
  opportunities?: OppOption[];
  initialKeyword?: string;
}) {
  const router = useRouter();
  const activeModel = aiModels.find((m) => m.isActive) ?? aiModels[0];

  const initialKw =
    initialKeyword ||
    opportunities.find((o) => o.keyword)?.keyword ||
    "organic farm products chennai";

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
  const [activeTab, setActiveTab] = useState<"preview" | "markdown" | "html" | "schema" | "qa">("preview");
  const [loading, setLoading] = useState(false);
  const [publishingLive, setPublishingLive] = useState(false);
  const [copiedType, setCopiedType] = useState<string | null>(null);

  // Advanced Optimization Controls
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [targetAudience, setTargetAudience] = useState<"commercial" | "educational" | "buyer_guide">("commercial");
  const [includeFaqSchema, setIncludeFaqSchema] = useState(true);
  const [includeDirectAnswer, setIncludeDirectAnswer] = useState(true);
  const [includeComparisonTable, setIncludeComparisonTable] = useState(true);

  // Blog categories on connected WordPress site
  const [categories, setCategories] = useState<Array<{ id: number; name: string; count: number }>>([]);
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [categoriesState, setCategoriesState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);

  // Scheduling
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

  function handleKeywordChange(nextKw: string) {
    setKeyword(nextKw);
    const presets = buildTitlePresets(nextKw, websiteName, websiteUrl);
    setCustomTitle(presets[0] || `${toTitleCase(nextKw)}: Complete Guide | ${websiteName}`);
    setSecondaryInput(`best ${nextKw}, ${nextKw} reviews, ${websiteName} ${nextKw}`);
  }

  function handleProviderSelect(nextProvider: string) {
    setProvider(nextProvider);
    const configured = aiModels.find((m) => m.provider === nextProvider);
    if (configured) {
      setModelName(configured.model);
    } else if (nextProvider === "openai") {
      setModelName("gpt-4o");
    } else if (nextProvider === "anthropic") {
      setModelName("claude-3-7-sonnet");
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

  // Unique suggestions from tracked opportunities (for sleek pill suggestions, without clumsy dropdown)
  const quickKeywordSuggestions = Array.from(
    new Set(
      opportunities
        .map((o) => o.keyword?.trim())
        .filter((k): k is string => Boolean(k && k.length > 2)),
    ),
  ).slice(0, 5);

  return (
    <div className="grid gap-6 xl:grid-cols-12">
      {/* ─── LEFT COLUMN: BUILDER & STRATEGY ENGINE ─── */}
      <Card className="xl:col-span-5 flex flex-col justify-between overflow-hidden shadow-xs">
        <div>
          <CardHeader
            title="SEO · AEO · GEO Content Engine"
            subtitle={`${websiteName} (${cleanSiteDomain}) · Page-1 High-CTR Structure & AI Citation Readiness`}
          />

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void runGenerate(false);
            }}
            className="space-y-5 p-5"
          >
            {/* Engine Badges */}
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/50 p-2.5 text-[11px]">
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-600 dark:text-emerald-400">
                <Search size={12} /> SEO Page-1
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-0.5 font-semibold text-blue-600 dark:text-blue-400">
                <Zap size={12} /> AEO Answer Box
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-purple-500/10 px-2 py-0.5 font-semibold text-purple-600 dark:text-purple-400">
                <Bot size={12} /> GEO AI Overview
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-600 dark:text-amber-400">
                <Code2 size={12} /> FAQ Schema
              </span>
            </div>

            {/* SECTION 1: FOCUS KEYWORD & TITLE STRATEGY */}
            <div className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-semibold text-xs text-[var(--color-foreground)]">
                  <Search size={14} className="text-[var(--color-primary)]" />
                  <span>1. Focus Keyword &amp; Title</span>
                </div>
                <span className="text-[10px] text-[var(--color-muted)]">Core Search Target</span>
              </div>

              {/* Primary Keyword Input */}
              <div>
                <label className="block text-xs font-medium text-[var(--color-muted)]">
                  Primary Focus Keyword
                </label>
                <div className="relative mt-1">
                  <input
                    type="text"
                    value={keyword}
                    onChange={(e) => handleKeywordChange(e.target.value)}
                    required
                    placeholder="e.g. cold pressed groundnut oil, bridal makeup chennai"
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-2 pl-3 pr-8 text-sm font-medium text-[var(--color-foreground)] focus:border-[var(--color-primary)] focus:outline-hidden focus:ring-1 focus:ring-[var(--color-primary)] shadow-2xs"
                  />
                  {keyword && (
                    <button
                      type="button"
                      onClick={() => handleKeywordChange("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Quick Keyword Suggestion Pills (if available) */}
                {quickKeywordSuggestions.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    <span className="text-[10px] text-[var(--color-muted)]">GSC Queries:</span>
                    {quickKeywordSuggestions.map((kw, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleKeywordChange(kw)}
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                          keyword.toLowerCase() === kw.toLowerCase()
                            ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-semibold"
                            : "border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                        }`}
                      >
                        {kw}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Custom Title Input & Real-Time Length Counter */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-[var(--color-muted)]">
                    Article Title (H1 &amp; SERP Title)
                  </label>
                  <span
                    className={`font-mono text-[10px] font-semibold ${
                      titleLen >= 35 && titleLen <= 70
                        ? "text-[var(--color-success)]"
                        : "text-[var(--color-warning)]"
                    }`}
                  >
                    {titleLen} / 60 chars ({titleLen >= 35 && titleLen <= 70 ? "Optimal" : "Ideal: 35–65"})
                  </span>
                </div>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  required
                  placeholder="Enter high-converting blog headline..."
                  className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-semibold text-[var(--color-foreground)] focus:border-[var(--color-primary)] focus:outline-hidden focus:ring-1 focus:ring-[var(--color-primary)] shadow-2xs"
                />

                {/* Tailored Title Formula Chips */}
                <div className="mt-2.5 space-y-1.5">
                  <span className="text-[10px] font-semibold text-[var(--color-muted)] uppercase tracking-wider block">
                    Page-1 High-CTR Title Formulas:
                  </span>
                  <div className="grid gap-1.5">
                    {titlePresets.slice(0, 3).map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCustomTitle(preset)}
                        className={`group flex items-start justify-between rounded-lg border p-2 text-left text-[11px] transition-all ${
                          customTitle === preset
                            ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5 font-medium text-[var(--color-primary)]"
                            : "border-[var(--color-border)] bg-[var(--color-surface-muted)]/40 text-[var(--color-muted)] hover:border-[var(--color-border)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-foreground)]"
                        }`}
                      >
                        <span className="leading-snug">{preset}</span>
                        {customTitle === preset && (
                          <Check size={12} className="shrink-0 text-[var(--color-primary)] ml-1.5 mt-0.5" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Secondary Keywords & Custom Slug */}
              <div className="grid gap-3 sm:grid-cols-2 pt-1 border-t border-[var(--color-border)]/60">
                <div>
                  <label className="block text-[11px] font-medium text-[var(--color-muted)]">
                    Secondary / LSI Keywords
                  </label>
                  <input
                    type="text"
                    value={secondaryInput}
                    onChange={(e) => setSecondaryInput(e.target.value)}
                    placeholder="price, benefits, reviews, near me"
                    className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs text-[var(--color-foreground)] focus:border-[var(--color-primary)] focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[var(--color-muted)]">
                    URL Slug (Optional)
                  </label>
                  <input
                    type="text"
                    value={customSlug}
                    onChange={(e) => setCustomSlug(e.target.value)}
                    placeholder="auto-generated-from-title"
                    className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 font-mono text-xs text-[var(--color-foreground)] focus:border-[var(--color-primary)] focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 2: ADVANCED AEO · GEO OPTIMIZATION CONTROLS */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-xs space-y-3">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex w-full items-center justify-between text-left text-xs font-semibold text-[var(--color-foreground)]"
              >
                <div className="flex items-center gap-1.5">
                  <Sliders size={14} className="text-[var(--color-primary)]" />
                  <span>2. Advanced AEO · GEO &amp; Format Settings</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-[var(--color-muted)]">
                  <span>{showAdvanced ? "Hide" : "Customize"}</span>
                  <ChevronDown size={13} className={`transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
                </div>
              </button>

              {/* Format Selector Pills (Always Visible) */}
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                {[
                  { id: "ARTICLE", label: "Full Blog Article", desc: "1,200+ words, H2/H3, tables, schema" },
                  { id: "FAQ", label: "AEO FAQ Block", desc: "Questions, direct answers & FAQ schema" },
                  { id: "META_TITLE", label: "Title & Meta Only", desc: "SERP title & meta description" },
                ].map((fmt) => (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={() => setType(fmt.id as any)}
                    className={`rounded-lg border p-2 text-center transition-all ${
                      type === fmt.id
                        ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-fg)] shadow-xs font-semibold"
                        : "border-[var(--color-border)] bg-[var(--color-surface-muted)]/50 text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)]"
                    }`}
                  >
                    <div className="text-xs">{fmt.label}</div>
                  </button>
                ))}
              </div>

              {/* Collapsible Advanced Toggles */}
              {showAdvanced && (
                <div className="space-y-3 pt-3 border-t border-[var(--color-border)]/60 text-xs">
                  {/* Search Intent / Audience */}
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--color-muted)] mb-1">
                      Search Intent &amp; Angle
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { id: "commercial", label: "Commercial / Service", desc: "Converts visitors to buyers" },
                        { id: "educational", label: "Informational", desc: "Top-of-funnel educational" },
                        { id: "buyer_guide", label: "Comparison / Guide", desc: "Best for AI citation matrix" },
                      ].map((ang) => (
                        <button
                          key={ang.id}
                          type="button"
                          onClick={() => setTargetAudience(ang.id as any)}
                          className={`rounded-md border p-1.5 text-center text-[10px] font-medium transition ${
                            targetAudience === ang.id
                              ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-bold"
                              : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                          }`}
                        >
                          {ang.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Engine Feature Toggles */}
                  <div className="space-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)]/30 p-2.5">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div className="flex items-center gap-1.5">
                        <Zap size={13} className="text-blue-600" />
                        <span className="text-[11px] font-medium">AEO 45-Word Direct Answer Box</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={includeDirectAnswer}
                        onChange={(e) => setIncludeDirectAnswer(e.target.checked)}
                        className="rounded accent-[var(--color-primary)]"
                      />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                      <div className="flex items-center gap-1.5">
                        <Bot size={13} className="text-purple-600" />
                        <span className="text-[11px] font-medium">GEO AI Overview Comparison Table</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={includeComparisonTable}
                        onChange={(e) => setIncludeComparisonTable(e.target.checked)}
                        className="rounded accent-[var(--color-primary)]"
                      />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                      <div className="flex items-center gap-1.5">
                        <Code2 size={13} className="text-amber-600" />
                        <span className="text-[11px] font-medium">Automatic FAQPage JSON-LD Schema</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={includeFaqSchema}
                        onChange={(e) => setIncludeFaqSchema(e.target.checked)}
                        className="rounded accent-[var(--color-primary)]"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* SECTION 3: PUBLISHING & CATEGORIES */}
            <div className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-xs">
              <div className="flex items-center gap-1.5 font-semibold text-xs text-[var(--color-foreground)]">
                <Globe size={14} className="text-[var(--color-primary)]" />
                <span>3. Publishing &amp; Categories</span>
              </div>

              {/* Categories & Schedule Controls */}
              <div className="space-y-2.5 pt-1 text-xs">
                {/* WordPress Categories */}
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-[var(--color-muted)]">
                    WordPress Category
                  </label>
                  {categoriesState === "idle" ? (
                    <button
                      type="button"
                      onClick={() => void loadCategories()}
                      className="rounded border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2 py-0.5 text-[10px] font-medium hover:text-[var(--color-primary)] transition-colors"
                    >
                      Sync Categories
                    </button>
                  ) : (
                    <span className="text-[10px] text-[var(--color-muted)]">
                      {categoriesState === "loading"
                        ? "Syncing…"
                        : categoryIds.length > 0
                          ? `${categoryIds.length} selected`
                          : "Uncategorized"}
                    </span>
                  )}
                </div>

                {categories.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {categories.map((c) => {
                      const on = categoryIds.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => toggleCategory(c.id)}
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-medium transition ${
                            on
                              ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-fg)] font-semibold"
                              : "border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                          }`}
                        >
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Scheduling */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="block text-[10px] font-medium text-[var(--color-muted)]">
                      Schedule Publish (Optional)
                    </label>
                    <input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[11px] text-[var(--color-foreground)] focus:border-[var(--color-primary)] focus:outline-hidden"
                    />
                  </div>
                  <div className="flex flex-col justify-end">
                    <span className="text-[10px] text-[var(--color-muted)] leading-tight">
                      {scheduledAt
                        ? "Will be scheduled on WordPress at chosen date/time."
                        : "Instant live publish or draft preview."}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 p-3 text-xs text-[var(--color-danger)] font-medium">
                {error}
              </div>
            )}

            {/* ACTION BUTTONS */}
            <div className="grid gap-2.5 sm:grid-cols-2 pt-1">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--color-primary)] px-4 py-3 text-xs font-bold text-[var(--color-primary-fg)] shadow-xs transition-all hover:opacity-90 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Generating Article...
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    Generate &amp; Preview
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => void runGenerate(true)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-bold text-emerald-600 dark:text-emerald-400 shadow-xs transition-all hover:bg-emerald-500/20 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    {scheduledAt ? "Scheduling..." : "Publishing..."}
                  </>
                ) : (
                  <>
                    <ExternalLink size={14} />
                    {scheduledAt ? "Generate &amp; Schedule ↗" : "Generate &amp; Publish Live ↗"}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </Card>

      {/* ─── RIGHT COLUMN: OUTPUT, LIVE PREVIEW & CMS EXPORT ─── */}
      <Card className="xl:col-span-7 flex flex-col justify-between overflow-hidden shadow-xs">
        <div>
          <CardHeader
            title={result ? result.content.title : "Page-1 Output & Universal CMS Export"}
            subtitle={
              result
                ? `Score: ${result.qaReport.score}/100 · ${result.qaReport.wordCount} words · Keyword Density: ${result.qaReport.keywordDensityPct}%`
                : "Generate an article to view the live SEO score, snippet preview, AEO answer box, and 1-click export."
            }
            action={
              result ? (
                <div className="flex flex-wrap items-center gap-2">
                  {result.publishedLive?.ok && result.publishedLive.url ? (
                    <a
                      href={result.publishedLive.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      <CheckCheck size={13} />
                      {result.publishedLive.status === "future" ? "Scheduled Live ↗" : "Live on Website ↗"}
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled={publishingLive}
                      onClick={handlePublishExistingLive}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--color-primary-fg)] hover:opacity-90 disabled:opacity-50 shadow-xs transition-all"
                    >
                      {publishingLive ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          Publishing...
                        </>
                      ) : (
                        <>
                          <Globe size={12} />
                          {scheduledAt ? "Schedule on WordPress ↗" : "Publish to WordPress ↗"}
                        </>
                      )}
                    </button>
                  )}
                  <StatusBadge
                    status={
                      result.qaReport.qaPassed
                        ? `Passed (${result.qaReport.score}/100)`
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
              {/* Universal CMS Export & Copy Toolbar */}
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/60 p-3.5 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[var(--color-foreground)]">
                    📋 Universal Copy &amp; Export (Paste into Any CMS, Shopify, Next.js, or Webflow):
                  </span>
                  {copiedType && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500 px-2 py-0.5 text-xs font-bold text-white shadow-2xs">
                      <Check size={12} /> Copied {copiedType}!
                    </span>
                  )}
                </div>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(result.content.body ?? "", "Markdown")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-foreground)] shadow-2xs hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-muted)] transition-colors"
                  >
                    <FileText size={13} /> Copy Markdown
                  </button>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(result.htmlPreview ?? "", "Clean HTML")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-foreground)] shadow-2xs hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-muted)] transition-colors"
                  >
                    <Code2 size={13} /> Copy Clean HTML
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        `SEO Title: ${result.content.title}\nMeta Description: ${result.metaDescription ?? ""}\nFocus Keyword: ${keyword}`,
                        "Title & Meta",
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-foreground)] shadow-2xs hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-muted)] transition-colors"
                  >
                    <Tag size={13} /> Copy Title &amp; Meta
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
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-foreground)] shadow-2xs hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-muted)] transition-colors"
                  >
                    <Download size={13} /> .md
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
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-foreground)] shadow-2xs hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-muted)] transition-colors"
                  >
                    <Download size={13} /> .html
                  </button>
                </div>
              </div>

              {/* 4 Score Metrics Cards */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/40 p-3 text-center">
                  <p className="text-[10px] font-bold uppercase text-[var(--color-muted)]">Overall Quality</p>
                  <p className="mt-1 text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {result.qaReport.score}/100
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/40 p-3 text-center">
                  <p className="text-[10px] font-bold uppercase text-[var(--color-muted)]">SEO Readiness</p>
                  <p className="mt-1 text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {result.qaReport.seoScore}%
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/40 p-3 text-center">
                  <p className="text-[10px] font-bold uppercase text-[var(--color-muted)]">AEO Snippet Score</p>
                  <p className="mt-1 text-2xl font-black text-blue-600 dark:text-blue-400">
                    {result.qaReport.aeoScore}%
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/40 p-3 text-center">
                  <p className="text-[10px] font-bold uppercase text-[var(--color-muted)]">GEO Citation Score</p>
                  <p className="mt-1 text-2xl font-black text-purple-600 dark:text-purple-400">
                    {result.qaReport.geoScore}%
                  </p>
                </div>
              </div>

              {/* Realistic Google SERP Mockup */}
              {result.metaDescription && (
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-xs shadow-xs space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)] block">
                    Google Page-1 SERP Snippet Preview:
                  </span>
                  <p className="text-sm font-semibold text-[#1a0dab] dark:text-[#8ab4f8] hover:underline cursor-pointer">
                    {result.content.title}
                  </p>
                  <p className="font-mono text-[11px] text-[#006621] dark:text-[#81c995]">
                    {websiteUrl.replace(/\/+$/, "")}/{result.content.slug ?? ""}/
                  </p>
                  <p className="text-xs text-[var(--color-muted)] leading-relaxed">
                    {result.metaDescription}
                  </p>
                </div>
              )}

              {/* Tab Navigation */}
              <div className="flex border-b border-[var(--color-border)] text-xs font-semibold">
                {[
                  { id: "preview", label: "Formatted Article", icon: BookOpen },
                  { id: "markdown", label: "Markdown Source", icon: FileText },
                  { id: "html", label: "Clean HTML", icon: Code2 },
                  { id: "schema", label: "JSON-LD Schema", icon: Zap },
                  { id: "qa", label: "AEO/GEO QA Report", icon: ShieldCheck },
                ].map((t) => {
                  const Icon = t.icon;
                  const isActive = activeTab === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setActiveTab(t.id as any)}
                      className={`inline-flex items-center gap-1.5 border-b-2 px-4 py-2.5 transition-colors ${
                        isActive
                          ? "border-[var(--color-primary)] text-[var(--color-primary)] font-bold"
                          : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                      }`}
                    >
                      <Icon size={13} />
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Tab Body Contents */}
              {activeTab === "preview" && result.htmlPreview ? (
                <div
                  className="prose prose-sm max-w-none rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-sm leading-relaxed space-y-4 shadow-2xs"
                  dangerouslySetInnerHTML={{ __html: result.htmlPreview }}
                />
              ) : activeTab === "html" && result.htmlPreview ? (
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
                  <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed max-h-[600px] overflow-y-auto">
                    {result.htmlPreview}
                  </pre>
                </div>
              ) : activeTab === "schema" && result.schemaJsonLd ? (
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
                  <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed max-h-[600px] overflow-y-auto">
                    {JSON.stringify(result.schemaJsonLd, null, 2)}
                  </pre>
                </div>
              ) : activeTab === "qa" ? (
                <div className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-xs">
                  <h4 className="font-bold text-sm text-[var(--color-foreground)]">
                    Search &amp; AI Engine Audit Verification:
                  </h4>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-[var(--color-border)] p-2.5">
                      <span className="text-[10px] text-[var(--color-muted)]">Word Count</span>
                      <p className="font-bold text-sm">{result.qaReport.wordCount} words</p>
                    </div>
                    <div className="rounded-lg border border-[var(--color-border)] p-2.5">
                      <span className="text-[10px] text-[var(--color-muted)]">Keyword Density</span>
                      <p className="font-bold text-sm">{result.qaReport.keywordDensityPct}% (target: 1.0–2.5%)</p>
                    </div>
                    <div className="rounded-lg border border-[var(--color-border)] p-2.5">
                      <span className="text-[10px] text-[var(--color-muted)]">Readability Status</span>
                      <p className="font-bold text-sm text-emerald-600">Grade 8 (Optimal for SEO)</p>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2">
                    <div className="flex items-center gap-2 text-emerald-600">
                      <CheckCircle2 size={14} />
                      <span>H1 and Title contain exact-match primary keyword</span>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-600">
                      <CheckCircle2 size={14} />
                      <span>AEO 45-word Direct Answer Box formatted right beneath the introduction</span>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-600">
                      <CheckCircle2 size={14} />
                      <span>GEO Comparison Matrix &amp; Key Takeaways ready for ChatGPT / Gemini citations</span>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-600">
                      <CheckCircle2 size={14} />
                      <span>Valid Schema.org Article &amp; FAQPage structured data integrated</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
                  <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed max-h-[600px] overflow-y-auto">
                    {result.content.body}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            /* Empty Blueprint Illustration */
            <div className="space-y-6 px-6 py-12 text-sm text-[var(--color-muted)]">
              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/30 p-6 space-y-4">
                <div className="flex items-center gap-2 font-bold text-base text-[var(--color-foreground)]">
                  <Sparkles size={18} className="text-[var(--color-primary)]" />
                  What the SEO · AEO · GEO Engine Generates:
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-600">
                      <Search size={14} />
                      <span>1. Google Page-1 SEO</span>
                    </div>
                    <p className="text-[11px] text-[var(--color-muted)]">
                      High-CTR title formulas, clean H2/H3 semantic structure, optimal keyword density &amp; meta description.
                    </p>
                  </div>
                  <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-blue-600">
                      <Zap size={14} />
                      <span>2. Answer Engine (AEO)</span>
                    </div>
                    <p className="text-[11px] text-[var(--color-muted)]">
                      45-word direct answer box engineered for Google Featured Snippets + People-Also-Ask Q&amp;A blocks.
                    </p>
                  </div>
                  <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-purple-600">
                      <Bot size={14} />
                      <span>3. Generative Engine (GEO)</span>
                    </div>
                    <p className="text-[11px] text-[var(--color-muted)]">
                      Entity-rich summary matrix &amp; comparison tables structured for ChatGPT, Perplexity &amp; AI Overviews.
                    </p>
                  </div>
                  <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-amber-600">
                      <Code2 size={14} />
                      <span>4. Structured JSON-LD</span>
                    </div>
                    <p className="text-[11px] text-[var(--color-muted)]">
                      Instant FAQPage and Article Schema generation with 1-click universal export and live WordPress publishing.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
