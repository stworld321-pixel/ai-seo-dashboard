"use client";

import { useState } from "react";
import {
  Sparkles,
  X,
  Copy,
  Check,
  Globe,
  Building2,
  Users,
  Layers,
  Cpu,
  BadgeDollarSign,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import type { ProductInformation } from "@/server/services/business-intelligence";

type ProductInfoModalProps = {
  isOpen: boolean;
  onClose: () => void;
  productInfo: ProductInformation;
  websiteId: string;
  websiteName: string;
  websiteUrl: string;
  faviconUrl: string;
  onRefresh?: () => Promise<void>;
};

export function ProductInfoModal({
  isOpen,
  onClose,
  productInfo,
  websiteId,
  websiteName,
  websiteUrl,
  faviconUrl,
  onRefresh,
}: ProductInfoModalProps) {
  const [copied, setCopied] = useState(false);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [currentInfo, setCurrentInfo] = useState<ProductInformation>(productInfo);

  if (!isOpen) return null;

  async function handleCopy() {
    const text = `
=== PRODUCT INFORMATION DOSSIER ===
Product Name: ${currentInfo.productName}
Website: ${currentInfo.website}
One-liner: ${currentInfo.oneLiner}
What It Does: ${currentInfo.whatItDoes}
Product Category: ${currentInfo.productCategory}
Product Type: ${currentInfo.productType}
Target Customers: ${currentInfo.targetCustomers.join(", ")}
Key Features:
${currentInfo.keyFeatures.map((f) => `- ${f}`).join("\n")}
Tech Signals:
- Framework: ${currentInfo.techSignals.framework}
- CMS: ${currentInfo.techSignals.cms}
- Hosting: ${currentInfo.techSignals.hosting}
- Schema: ${currentInfo.techSignals.hasSchema ? "Active" : "None"}
- Pages: ${currentInfo.techSignals.pageCount}
Business Model: ${currentInfo.businessModel}
    `.trim();

    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleReanalyze() {
    setIsReanalyzing(true);
    try {
      const res = await fetch("/api/ai/product-info/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data?.productInfo) {
          setCurrentInfo(json.data.productInfo);
        }
        if (onRefresh) await onRefresh();
      }
    } catch {
      // ignore
    } finally {
      setIsReanalyzing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface-muted)]/50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs overflow-hidden">
              <img
                src={faviconUrl}
                alt={websiteName}
                className="h-6 w-6 object-contain rounded"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = `https://www.google.com/s2/favicons?domain=example.com&sz=64`;
                }}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[var(--color-foreground)]">Product Information</h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <Sparkles className="h-3 w-3" /> AI Analyzed
                </span>
              </div>
              <p className="text-xs text-[var(--color-muted)] font-mono">{websiteUrl}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReanalyze}
              disabled={isReanalyzing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)] transition-colors disabled:opacity-50"
              title="Re-run AI Analysis"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isReanalyzing ? "animate-spin text-[var(--color-primary)]" : ""}`} />
              {isReanalyzing ? "Analyzing..." : "Re-Analyze"}
            </button>

            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)] transition-colors"
              title="Copy to clipboard"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy Dossier"}
            </button>

            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-foreground)] transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Overview Block */}
          <div className="rounded-xl border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5 p-4.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-primary)]">
                Overview &amp; Executive Summary
              </span>
              <span className="text-[11px] text-[var(--color-muted)] font-mono">
                Updated: {new Date(currentInfo.analyzedAt).toLocaleDateString()}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-[var(--color-muted)] uppercase">Product Name</span>
                <p className="text-sm font-bold text-[var(--color-foreground)] flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-[var(--color-primary)]" />
                  {currentInfo.productName}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-[var(--color-muted)] uppercase">Website</span>
                <a
                  href={currentInfo.website}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-mono text-[var(--color-primary)] hover:underline flex items-center gap-1"
                >
                  <Globe className="h-3.5 w-3.5" />
                  {currentInfo.website}
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </a>
              </div>
            </div>

            <div className="space-y-1 pt-1 border-t border-[var(--color-primary)]/10">
              <span className="text-[11px] font-semibold text-[var(--color-muted)] uppercase">One-liner</span>
              <p className="text-sm font-medium text-[var(--color-foreground)] leading-snug">
                &ldquo;{currentInfo.oneLiner}&rdquo;
              </p>
            </div>
          </div>

          {/* What It Does */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)] flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-[var(--color-primary)]" />
              What It Does
            </h3>
            <p className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/40 p-4 text-xs font-normal text-[var(--color-foreground)] leading-relaxed">
              {currentInfo.whatItDoes}
            </p>
          </div>

          {/* Categories & Product Type */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--color-border)] p-4 space-y-1.5 bg-[var(--color-surface)]">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Product Category
              </span>
              <div className="flex items-center gap-2">
                <span className="inline-flex rounded-lg bg-[var(--color-primary)]/10 px-2.5 py-1 text-xs font-bold text-[var(--color-primary)]">
                  {currentInfo.productCategory}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--color-border)] p-4 space-y-1.5 bg-[var(--color-surface)]">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Product Type
              </span>
              <p className="text-xs font-semibold text-[var(--color-foreground)]">
                {currentInfo.productType}
              </p>
            </div>
          </div>

          {/* Target Customers */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)] flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-blue-500" />
              Target Customers
            </h3>
            <div className="grid gap-2 sm:grid-cols-3">
              {currentInfo.targetCustomers.map((cust, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/30 p-3 text-xs text-[var(--color-foreground)] flex items-start gap-2"
                >
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--color-primary)] mt-0.5" />
                  <span>{cust}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Key Features */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)] flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              Key Features &amp; Capabilities
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {currentInfo.keyFeatures.map((feat, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-xs leading-relaxed"
                >
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                  <span className="text-[var(--color-foreground)]">{feat}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tech Signals & Business Model */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Tech Signals */}
            <div className="rounded-xl border border-[var(--color-border)] p-4 space-y-3 bg-[var(--color-surface)]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)] flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5 text-purple-500" />
                Tech Signals
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-[var(--color-surface-muted)]/50 p-2">
                  <span className="text-[10px] text-[var(--color-muted)] block">Framework</span>
                  <span className="font-semibold text-[var(--color-foreground)]">{currentInfo.techSignals.framework}</span>
                </div>
                <div className="rounded-lg bg-[var(--color-surface-muted)]/50 p-2">
                  <span className="text-[10px] text-[var(--color-muted)] block">CMS / Platform</span>
                  <span className="font-semibold text-[var(--color-foreground)]">{currentInfo.techSignals.cms}</span>
                </div>
                <div className="rounded-lg bg-[var(--color-surface-muted)]/50 p-2">
                  <span className="text-[10px] text-[var(--color-muted)] block">Hosting / CDN</span>
                  <span className="font-semibold text-[var(--color-foreground)]">{currentInfo.techSignals.hosting}</span>
                </div>
                <div className="rounded-lg bg-[var(--color-surface-muted)]/50 p-2">
                  <span className="text-[10px] text-[var(--color-muted)] block">Schema / AEO</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {currentInfo.techSignals.hasSchema ? "Active JSON-LD" : "Basic HTML"}
                  </span>
                </div>
              </div>
            </div>

            {/* Business Model */}
            <div className="rounded-xl border border-[var(--color-border)] p-4 space-y-3 bg-[var(--color-surface)]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)] flex items-center gap-1.5">
                <BadgeDollarSign className="h-3.5 w-3.5 text-amber-500" />
                Business Model
              </h3>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 space-y-1">
                <p className="text-xs font-bold text-[var(--color-foreground)]">{currentInfo.businessModel}</p>
                <p className="text-[11px] text-[var(--color-muted)] leading-relaxed">
                  Monetized via high-value customer acquisitions, verified digital traffic, and conversion funnels.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[var(--color-border)] bg-[var(--color-surface-muted)]/50 px-6 py-3 text-xs">
          <span className="text-[var(--color-muted)]">
            AI SEO Intelligence Engine &middot; Real-time Synthesis
          </span>
          <button
            onClick={onClose}
            className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--color-primary-hover)] transition-colors shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
