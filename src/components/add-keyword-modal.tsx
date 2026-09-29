"use client";

import { useState } from "react";
import { Plus, X, Search, Sparkles, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

interface AddKeywordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeywordsAdded: () => void;
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

export function AddKeywordModal({ isOpen, onClose, onKeywordsAdded }: AddKeywordModalProps) {
  const [keywordsInput, setKeywordsInput] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [country, setCountry] = useState("in");
  const [checkSerpNow, setCheckSerpNow] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessCount(null);

    const splitKeywords = keywordsInput
      .split(/[,\n]/)
      .map((k) => k.trim())
      .filter(Boolean);

    if (splitKeywords.length === 0) {
      setError("Please enter at least one target keyword.");
      return;
    }

    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/seo/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywords: splitKeywords,
          targetUrl: targetUrl.trim() || undefined,
          tags: tags.length > 0 ? tags : undefined,
          country,
          checkSerpNow,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error?.message || "Failed to add keywords");
      }

      setSuccessCount(json.data?.count ?? splitKeywords.length);
      setTimeout(() => {
        onKeywordsAdded();
        onClose();
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
              <Plus size={16} />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-[var(--color-foreground)]">Add Custom Keywords</h3>
              <p className="text-xs text-[var(--color-muted)]">Track Google rankings and gather live SERP data</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-foreground)]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 p-3 text-[var(--color-danger)]">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successCount !== null && (
            <div className="flex items-center gap-2 rounded-lg border border-[var(--color-success)]/30 bg-[var(--color-success)]/10 p-3 text-[var(--color-success)]">
              <CheckCircle2 size={15} />
              <span>Added {successCount} keyword(s) with live Google rank checking!</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="font-medium text-[var(--color-foreground)]">
              Target Keyword(s) <span className="text-[var(--color-danger)]">*</span>
            </label>
            <textarea
              rows={3}
              value={keywordsInput}
              onChange={(e) => setKeywordsInput(e.target.value)}
              placeholder="e.g. cold processed camel milk soap, kumkumadi tailam benefits for face&#10;(Separate multiple keywords with commas or newlines)"
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 text-xs focus:border-[var(--color-primary)] focus:outline-hidden"
              required
            />
            <p className="text-[11px] text-[var(--color-muted)]">
              You can track non-GSC target queries, competitor terms, and planned article topics.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="font-medium text-[var(--color-foreground)]">Target Landing Page URL (optional)</label>
            <input
              type="url"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://example.com/target-page"
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs focus:border-[var(--color-primary)] focus:outline-hidden"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-medium text-[var(--color-foreground)]">Target Google Search Country</label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs focus:border-[var(--color-primary)] focus:outline-hidden"
            >
              {COUNTRY_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.name} ({c.code.toUpperCase()})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-[var(--color-muted)]">
              Rank tracking and SERP results will be localized to this Google Search country.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="font-medium text-[var(--color-foreground)]">Category Tags / Clusters (optional)</label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. Core Products, High-Intent, Autumn Launch"
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs focus:border-[var(--color-primary)] focus:outline-hidden"
            />
          </div>

          <div className="flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
            <input
              type="checkbox"
              id="checkSerpNow"
              checked={checkSerpNow}
              onChange={(e) => setCheckSerpNow(e.target.checked)}
              className="h-4 w-4 rounded-sm border-[var(--color-border)] text-[var(--color-primary)]"
            />
            <label htmlFor="checkSerpNow" className="cursor-pointer text-[var(--color-foreground)] font-medium">
              Run Google Live Rank & SERP data extraction immediately
            </label>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2 text-xs font-medium text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-[var(--color-primary-fg)] hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Fetching Google SERP...
                </>
              ) : (
                <>
                  <Sparkles size={13} />
                  Add & Track Keyword
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
