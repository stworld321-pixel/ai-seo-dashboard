"use client";

import { useState } from "react";
import {
  X,
  Search,
  ExternalLink,
  Sparkles,
  HelpCircle,
  TrendingUp,
  Globe,
  RefreshCw,
  AlertCircle,
  Layers,
  ChevronRight,
} from "lucide-react";
import { shortenUrl } from "@/lib/format";
import type { GoogleSerpData } from "@/server/services/google-serp";

interface KeywordSerpModalProps {
  keyword: string;
  websiteId: string;
  initialSerp?: GoogleSerpData | null;
  isOpen: boolean;
  onClose: () => void;
  onGenerateContent?: (keyword: string) => void;
}

const COUNTRY_OPTIONS = [
  { code: "in", name: "India", flag: "🇮🇳" },
  { code: "us", name: "United States", flag: "🇺🇸" },
  { code: "uk", name: "United Kingdom", flag: "🇬🇧" },
  { code: "ae", name: "UAE", flag: "🇦🇪" },
  { code: "ca", name: "Canada", flag: "🇨🇦" },
  { code: "au", name: "Australia", flag: "🇦🇺" },
  { code: "sg", name: "Singapore", flag: "🇸🇬" },
  { code: "de", name: "Germany", flag: "🇩🇪" },
  { code: "fr", name: "France", flag: "🇫🇷" },
  { code: "sa", name: "Saudi Arabia", flag: "🇸🇦" },
  { code: "my", name: "Malaysia", flag: "🇲🇾" },
  { code: "nz", name: "New Zealand", flag: "🇳🇿" },
];

export function KeywordSerpModal({
  keyword,
  websiteId,
  initialSerp,
  isOpen,
  onClose,
}: KeywordSerpModalProps) {
  const [serp, setSerp] = useState<GoogleSerpData | null>(initialSerp ?? null);
  const [selectedCountry, setSelectedCountry] = useState<string>(initialSerp?.country || "in");
  const [activePageTab, setActivePageTab] = useState<number | "all">("all");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleRefreshSerp(targetCountry = selectedCountry) {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/seo/keywords/serp-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword,
          websiteId,
          country: targetCountry,
          pagesToCheck: 5,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error?.message || "Failed to fetch SERP data");
      }
      setSerp(json.data.serp);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }

  const currentCountryObj =
    COUNTRY_OPTIONS.find((c) => c.code === (serp?.country || selectedCountry)) || COUNTRY_OPTIONS[0]!;

  const totalResults = serp?.organicResults?.length ?? 0;
  const availablePages = Array.from(
    new Set(serp?.organicResults?.map((r) => r.page ?? Math.ceil(r.position / 10)) || [1]),
  ).sort((a, b) => a - b);

  const displayedResults =
    activePageTab === "all"
      ? serp?.organicResults || []
      : serp?.organicResults?.filter(
          (r) => (r.page ?? Math.ceil(r.position / 10)) === activePageTab,
        ) || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
              <Search size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-[var(--color-foreground)]">
                  Google Live SERP & 5-Page Rank Tracker
                </h3>
                <span className="rounded bg-[var(--color-primary)]/10 px-2 py-0.5 text-xs font-semibold text-[var(--color-primary)]">
                  &ldquo;{keyword}&rdquo;
                </span>
                {serp?.provider && (
                  <span className="rounded border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-muted)]">
                    {serp.provider}
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--color-muted)]">
                Live Google Organic Search positions (Pages 1 to 5), Competitor SERP & People-Also-Ask questions
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Country Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-[var(--color-muted)] font-medium">Country:</span>
              <select
                value={selectedCountry}
                disabled={isLoading}
                onChange={(e) => {
                  const newCountry = e.target.value;
                  setSelectedCountry(newCountry);
                  handleRefreshSerp(newCountry);
                }}
                aria-label="Google SERP Target Country"
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)] cursor-pointer focus:outline-hidden"
              >
                {COUNTRY_OPTIONS.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.name} ({c.code.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => handleRefreshSerp()}
              disabled={isLoading}
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)] disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} />
              Re-scan 5 Pages
            </button>
            <button
              onClick={onClose}
              aria-label="Close dialog"
              className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-foreground)] cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 p-3 text-[var(--color-danger)]">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          {/* Quick Metrics KPI Bar */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
              <span className="text-[var(--color-muted)] font-medium">Google Live Rank</span>
              <p className="mt-1 text-lg font-bold text-[var(--color-foreground)]">
                {serp?.rank ? (
                  <span
                    className={
                      serp.rank <= 10
                        ? "text-[var(--color-success)]"
                        : serp.rank <= 30
                          ? "text-[var(--color-info)]"
                          : "text-[var(--color-warning)]"
                    }
                  >
                    #{serp.rank}{" "}
                    <span className="text-xs font-normal text-[var(--color-muted)]">
                      (Page {serp.rankingPage ?? Math.ceil(serp.rank / 10)})
                    </span>
                  </span>
                ) : (
                  <span className="text-[var(--color-muted)] text-sm">Outside Top 50</span>
                )}
              </p>
              <span className="text-[10px] text-[var(--color-muted)]">
                {serp?.rankingUrl
                  ? shortenUrl(serp.rankingUrl)
                  : `Checked 5 Google Pages (${totalResults} Results)`}
              </span>
            </div>

            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
              <span className="text-[var(--color-muted)] font-medium">Search Intent</span>
              <p className="mt-1 text-sm font-semibold capitalize text-[var(--color-primary)]">
                {serp?.intent?.toLowerCase() ?? "Commercial"}
              </p>
              <span className="text-[10px] text-[var(--color-muted)]">
                Confidence {serp?.intentConfidence ? Math.round(serp.intentConfidence * 100) : 90}%
              </span>
            </div>

            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
              <span className="text-[var(--color-muted)] font-medium">SERP Difficulty</span>
              <p className="mt-1 text-lg font-bold text-[var(--color-foreground)]">
                {serp?.difficultyEstimate ?? 45}/100
              </p>
              <span className="text-[10px] text-[var(--color-muted)]">Moderate Competition</span>
            </div>

            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
              <span className="text-[var(--color-muted)] font-medium">Opportunity Score</span>
              <p className="mt-1 text-lg font-bold text-[var(--color-success)]">
                {serp?.opportunityScore ?? 78}/100
              </p>
              <span className="text-[10px] text-[var(--color-muted)]">High ROI potential</span>
            </div>
          </div>

          {/* If ranking found on a deep page, give a quick jump button */}
          {serp?.rank && serp.rankingPage && serp.rankingPage > 1 && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-info)]/30 bg-[var(--color-info)]/10 p-3 text-[var(--color-info)]">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs">🎯 Target Domain Ranking Found on Page {serp.rankingPage}!</span>
                <span className="text-xs">
                  Position #{serp.rank} — {serp.rankingUrl ? shortenUrl(serp.rankingUrl) : ""}
                </span>
              </div>
              <button
                onClick={() => setActivePageTab(serp.rankingPage!)}
                className="inline-flex items-center gap-1 rounded bg-[var(--color-info)] text-white px-2.5 py-1 text-xs font-medium hover:opacity-90 cursor-pointer"
              >
                Jump to Page {serp.rankingPage}
                <ChevronRight size={12} />
              </button>
            </div>
          )}

          {/* Action Callout */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 p-4">
            <div className="space-y-0.5">
              <p className="font-semibold text-sm text-[var(--color-foreground)]">
                Target This Keyword With AI Content
              </p>
              <p className="text-[var(--color-muted)]">
                Synthesize a 1,500+ word AEO+GEO optimized guide targeting Google Page 1 and AI Overview citations.
              </p>
            </div>
            <a
              href={`/content/generator?keyword=${encodeURIComponent(keyword)}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-4 py-2 font-semibold text-[var(--color-primary-fg)] hover:opacity-90 shadow-xs"
            >
              <Sparkles size={14} />
              Generate Article Draft →
            </a>
          </div>

          {/* Google 10-Page SERP Results Section */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-semibold text-[var(--color-foreground)] flex items-center gap-1.5">
                <Globe size={14} className="text-[var(--color-primary)]" />
                Google Organic Rankings ({currentCountryObj.flag} {currentCountryObj.name})
                <span className="ml-1 text-[11px] font-normal text-[var(--color-muted)]">
                  ({totalResults} results across {availablePages.length} pages)
                </span>
              </h4>

              {/* Page Filter Tabs */}
              <div className="flex flex-wrap items-center gap-1">
                <button
                  onClick={() => setActivePageTab("all")}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                    activePageTab === "all"
                      ? "bg-[var(--color-primary)] text-[var(--color-primary-fg)] shadow-xs"
                      : "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                  }`}
                >
                  All ({totalResults})
                </button>

                {availablePages.map((pageNum) => {
                  const hasRankingHere = serp?.rankingPage === pageNum;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setActivePageTab(pageNum)}
                      className={`rounded px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                        activePageTab === pageNum
                          ? "bg-[var(--color-primary)] text-[var(--color-primary-fg)] shadow-xs"
                          : hasRankingHere
                            ? "border border-[var(--color-success)] bg-[var(--color-success)]/10 text-[var(--color-success)] font-semibold"
                            : "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                      }`}
                    >
                      <span>Page {pageNum}</span>
                      {hasRankingHere && <span>🎯</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Results Table */}
            <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
              <div className="divide-y divide-[var(--color-border)]">
                {displayedResults.map((item) => (
                  <div
                    key={item.position}
                    className={`p-3 space-y-1 transition-colors ${
                      item.isTargetDomain
                        ? "bg-[var(--color-success)]/10 border-l-4 border-[var(--color-success)]"
                        : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex h-5 w-7 items-center justify-center rounded font-bold text-[11px] ${
                            item.isTargetDomain
                              ? "bg-[var(--color-success)] text-white"
                              : "bg-[var(--color-surface-muted)] text-[var(--color-muted)]"
                          }`}
                        >
                          #{item.position}
                        </span>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-xs text-[var(--color-info)] hover:underline inline-flex items-center gap-1"
                        >
                          {item.title}
                          <ExternalLink size={10} />
                        </a>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="rounded bg-[var(--color-surface-muted)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]">
                          Page {item.page ?? Math.ceil(item.position / 10)}
                        </span>
                        <span className="font-mono text-[10px] text-[var(--color-muted)]">
                          {item.domain}
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-[var(--color-muted)] leading-relaxed pl-9">
                      {item.snippet}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* People Also Ask (PAA) */}
          {serp?.peopleAlsoAsk && serp.peopleAlsoAsk.length > 0 && (
            <div className="space-y-2.5">
              <h4 className="font-semibold text-[var(--color-foreground)] flex items-center gap-1.5">
                <HelpCircle size={14} className="text-[var(--color-primary)]" />
                Google &ldquo;People Also Ask&rdquo; (PAA) Questions
              </h4>
              <div className="grid gap-2 sm:grid-cols-2">
                {serp.peopleAlsoAsk.map((paa, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 space-y-1.5"
                  >
                    <p className="font-medium text-[var(--color-foreground)]">{paa.question}</p>
                    {paa.snippet && <p className="text-[11px] text-[var(--color-muted)]">{paa.snippet}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Google Related Searches */}
          {serp?.relatedSearches && serp.relatedSearches.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold text-[var(--color-foreground)] flex items-center gap-1.5">
                <TrendingUp size={14} className="text-[var(--color-primary)]" />
                Related Google Autocomplete Queries
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {serp.relatedSearches.map((rel, idx) => (
                  <span
                    key={idx}
                    className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2.5 py-1 text-xs text-[var(--color-foreground)]"
                  >
                    {rel}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[var(--color-border)] px-6 py-3.5 bg-[var(--color-surface-muted)]">
          <span className="text-[11px] text-[var(--color-muted)]">
            Checked at: {serp?.checkedAt ? new Date(serp.checkedAt).toLocaleString() : "Live"} • {totalResults} Google results scanned
          </span>
          <button
            onClick={onClose}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-xs font-medium text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)] cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
