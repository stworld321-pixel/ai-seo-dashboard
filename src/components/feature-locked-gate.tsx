"use client";

import Link from "next/link";
import { Lock, Sparkles, Zap, ArrowRight, ShieldCheck, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/card";

export function FeatureLockedGate({
  featureName,
  featureDescription,
  requiredPlan = "AI CMO Pro ⭐",
  price = "$208/mo",
  benefits,
  previewSnippet,
}: {
  featureName: string;
  featureDescription: string;
  requiredPlan?: string;
  price?: string;
  benefits: string[];
  previewSnippet?: string;
}) {
  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-6">
      <Card className="relative overflow-hidden p-8 md:p-10 border border-indigo-500/30 bg-gradient-to-b from-indigo-950/20 via-[var(--color-surface)] to-[var(--color-surface)] rounded-3xl shadow-xl">
        {/* Glow background accent */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />

        <div className="space-y-6">
          {/* Header pill */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 text-xs font-bold border border-indigo-500/30">
              <Lock size={13} /> {requiredPlan} Feature
            </span>
            <span className="text-xs text-[var(--color-muted)] font-medium">
              Included in {requiredPlan} ({price}) and Enterprise
            </span>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--color-foreground)]">
              Unlock the {featureName}
            </h1>
            <p className="text-sm text-[var(--color-muted)] max-w-2xl leading-relaxed">
              {featureDescription}
            </p>
          </div>

          {/* Benefits Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {benefits.map((b, i) => (
              <div
                key={i}
                className="flex items-start gap-2.5 p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] text-xs"
              >
                <CheckCircle2 size={15} className="text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-[var(--color-foreground)]">{b}</span>
              </div>
            ))}
          </div>

          {previewSnippet && (
            <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-950/20 text-xs font-mono text-[var(--color-muted)]">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-400 mb-1">
                Autonomous Agent Preview
              </p>
              <p className="italic text-[var(--color-foreground)]">{previewSnippet}</p>
            </div>
          )}

          {/* Upgrade Action CTA */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-[var(--color-border)]">
            <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
              <ShieldCheck size={16} className="text-emerald-500" />
              <span>Instant activation · Cancel anytime · Full AI CMO capabilities</span>
            </div>

            <Link
              href="/pricing"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 transition-all hover:scale-[1.02]"
            >
              <Sparkles size={14} />
              <span>Upgrade to {requiredPlan} ({price})</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
