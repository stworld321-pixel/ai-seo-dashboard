"use client";

import { useState } from "react";
import {
  Sparkles,
  Globe,
  ExternalLink,
  Shield,
  Layers,
  Cpu,
  Target,
  FileText,
  Compass,
  ArrowUpRight,
} from "lucide-react";
import type { BusinessIntelligenceData } from "@/server/services/business-intelligence";
import { ProductInfoModal } from "@/components/product-info-modal";

type WebsiteBusinessCardProps = {
  data: BusinessIntelligenceData;
  onRefresh?: () => Promise<void>;
};

export function WebsiteBusinessCard({ data, onRefresh }: WebsiteBusinessCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { website, competitors, productInfo } = data;

  return (
    <>
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs overflow-hidden">
        {/* Top Header Strip */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface-muted)]/40 px-5 py-4">
          <div className="flex items-center gap-3.5">
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs overflow-hidden">
              <img
                src={website.faviconUrl}
                alt={website.name}
                className="h-7 w-7 object-contain rounded"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = `https://www.google.com/s2/favicons?domain=${website.domain}&sz=64`;
                }}
              />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-[var(--color-foreground)] tracking-tight">
                  {website.name}
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-primary)]/10 px-2 py-0.5 text-[11px] font-semibold text-[var(--color-primary)]">
                  {website.industry}
                </span>
              </div>
              <a
                href={website.url}
                target="_blank"
                rel="noreferrer"
                className="mt-0.5 inline-flex items-center gap-1 font-mono text-xs text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors"
              >
                <Globe className="h-3 w-3" />
                {website.domain}
                <ExternalLink className="h-2.5 w-2.5 opacity-60" />
              </a>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={() => setIsModalOpen(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] px-4 py-2 text-xs font-bold text-white shadow-xs transition-all active:scale-95"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Product Information
            </button>
          </div>
        </div>

        {/* Content Body: Business Basic Data & Competitors List */}
        <div className="grid gap-6 p-5 lg:grid-cols-12">
          {/* Left Column: Website Business Overview (5 cols) */}
          <div className="space-y-4 lg:col-span-5 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)] flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-[var(--color-primary)]" />
                  Website Business Profile
                </span>
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                  Active Profile
                </span>
              </div>

              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/30 p-3.5 space-y-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)] block">
                  One-Liner &amp; Positioning
                </span>
                <p className="text-xs font-medium text-[var(--color-foreground)] leading-relaxed">
                  &ldquo;{productInfo.oneLiner}&rdquo;
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="rounded-xl border border-[var(--color-border)] p-2.5 bg-[var(--color-surface)]">
                  <span className="text-[10px] text-[var(--color-muted)] block">Product Type</span>
                  <span className="font-bold text-[var(--color-foreground)] line-clamp-1">{productInfo.productType}</span>
                </div>
                <div className="rounded-xl border border-[var(--color-border)] p-2.5 bg-[var(--color-surface)]">
                  <span className="text-[10px] text-[var(--color-muted)] block">Tech Platform</span>
                  <span className="font-bold text-[var(--color-foreground)] line-clamp-1">{website.framework || "Next.js / Web"}</span>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setIsModalOpen(true)}
                className="w-full inline-flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/50 hover:bg-[var(--color-surface-muted)] p-3 text-xs font-medium text-[var(--color-foreground)] transition-colors group"
              >
                <span className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-[var(--color-primary)]" />
                  View Full Product Dossier &amp; Key Features
                </span>
                <ArrowUpRight className="h-3.5 w-3.5 text-[var(--color-muted)] group-hover:text-[var(--color-primary)] transition-colors" />
              </button>
            </div>
          </div>

          {/* Right Column: Competitor List with Favicons & URLs (7 cols) */}
          <div className="space-y-3 lg:col-span-7">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)] flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5 text-amber-500" />
                Competitor Intelligence &amp; Market Overlap
              </span>
              <span className="text-[11px] text-[var(--color-muted)]">
                {competitors.length} tracked rivals
              </span>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              {competitors.slice(0, 4).map((comp, idx) => (
                <div
                  key={idx}
                  className="flex items-start justify-between gap-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 hover:border-[var(--color-primary)]/40 transition-all shadow-2xs"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] overflow-hidden mt-0.5">
                      <img
                        src={comp.faviconUrl}
                        alt={comp.name}
                        className="h-5 w-5 object-contain rounded"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = `https://www.google.com/s2/favicons?domain=${comp.domain}&sz=64`;
                        }}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-[var(--color-foreground)] truncate">
                          {comp.name}
                        </span>
                      </div>
                      <a
                        href={comp.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-[11px] text-[var(--color-primary)] hover:underline flex items-center gap-0.5 truncate"
                      >
                        {comp.domain}
                        <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-60" />
                      </a>
                      <p className="mt-1 text-[10px] text-[var(--color-muted)] line-clamp-1">
                        {comp.keyStrength}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                      {comp.overlapScore}% overlap
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Interactive AI Product Information Popup Modal */}
      <ProductInfoModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        productInfo={productInfo}
        websiteId={website.id}
        websiteName={website.name}
        websiteUrl={website.url}
        faviconUrl={website.faviconUrl}
        onRefresh={onRefresh}
      />
    </>
  );
}
