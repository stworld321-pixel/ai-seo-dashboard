"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Sparkles,
  Zap,
  Shield,
  ArrowRight,
  Bot,
  CreditCard,
  Building,
  HelpCircle,
  Check,
  X,
} from "lucide-react";
import { Card } from "@/components/card";

export type PlanItem = {
  id: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  badge: string;
  features: string[];
  limits: {
    websites: number;
    users: number;
    keywords: number;
    credits: number;
    aiActions: number;
    seoTools: string;
    aiVisibility: boolean;
    geoAgent: boolean;
    seoAgent: string;
    articleAgent: boolean;
    redditAgent: boolean;
    xAgent: boolean;
    aiArticles: number;
    publishing: number;
    competitorMonitoring: string;
    teamManagement: string;
    prioritySupport: boolean;
  };
  isPopular: boolean;
};

export function PricingClient({
  plans,
  currentPlan,
  isLoggedIn,
  userEmail,
  stripeKey,
  razorpayKey,
}: {
  plans: PlanItem[];
  currentPlan: string | null;
  isLoggedIn: boolean;
  userEmail?: string;
  stripeKey?: string;
  razorpayKey?: string;
}) {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);

  function handleSelectPlan(planId: string) {
    setSelectedPlanId(planId);
    setCheckoutModalOpen(true);
  }

  return (
    <div className="max-w-6xl mx-auto space-y-12">
      {/* Header */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-semibold border border-indigo-500/20">
          <Sparkles size={13} />
          Autonomous SEO & Generative Engine Optimization
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--color-foreground)]">
          Predictable Pricing for High-Growth Search Visibility
        </h1>
        <p className="text-sm text-[var(--color-muted)] leading-relaxed">
          From solo brands to scaling agencies — automate technical audits, rank on Google & AI search engines (Perplexity, ChatGPT, Gemini), and deploy autonomous content agents.
        </p>

        {/* Monthly / Yearly Toggle */}
        <div className="pt-4 flex items-center justify-center gap-3 text-xs font-semibold">
          <span className={billingCycle === "monthly" ? "text-[var(--color-foreground)]" : "text-[var(--color-muted)]"}>
            Monthly Billing
          </span>
          <button
            type="button"
            onClick={() => setBillingCycle(billingCycle === "monthly" ? "yearly" : "monthly")}
            aria-label="Toggle Monthly and Yearly billing cycle"
            className="relative h-6 w-11 rounded-full bg-indigo-600 transition-colors focus:outline-none"
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                billingCycle === "yearly" ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          <span className={billingCycle === "yearly" ? "text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5" : "text-[var(--color-muted)] flex items-center gap-1.5"}>
            Annual Billing
            <span className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-2 py-0.5 rounded-full text-[10px] font-bold">
              Save 20% (2 Months Free)
            </span>
          </span>
        </div>
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const price = billingCycle === "monthly" ? plan.priceMonthly : Math.round(plan.priceYearly / 12);
          const isCurrent = currentPlan?.toLowerCase() === plan.id.toLowerCase();

          return (
            <Card
              key={plan.id}
              className={`relative p-6 rounded-2xl border flex flex-col justify-between transition-all ${
                plan.isPopular
                  ? "border-indigo-500 shadow-lg shadow-indigo-500/10 bg-[var(--color-surface)] ring-1 ring-indigo-500"
                  : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-zinc-400 dark:hover:border-zinc-600"
              }`}
            >
              {plan.isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-[11px] font-bold py-0.5 px-3.5 rounded-full shadow-sm flex items-center gap-1">
                  <Zap size={11} className="fill-white" /> MOST POPULAR
                </div>
              )}

              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-[var(--color-foreground)]">{plan.name}</h3>
                  <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20">
                    {plan.badge}
                  </span>
                </div>

                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold tracking-tight">${price}</span>
                  <span className="text-xs text-[var(--color-muted)] font-medium">/ month</span>
                </div>
                {billingCycle === "yearly" && (
                  <p className="text-[11px] text-emerald-600 mt-0.5 font-medium">
                    Billed annually (${plan.priceYearly}/year)
                  </p>
                )}

                <div className="my-6 border-t border-[var(--color-border)] pt-5 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                    Included in {plan.name}:
                  </p>
                  <ul className="space-y-2.5 text-xs text-[var(--color-foreground)]">
                    {plan.features.map((feat, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-4 border-t border-[var(--color-border)]">
                {isCurrent ? (
                  <button
                    type="button"
                    disabled
                    className="w-full py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 font-semibold text-xs text-center cursor-default"
                  >
                    Current Plan Active
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSelectPlan(plan.id)}
                    className={`w-full py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs ${
                      plan.isPopular
                        ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20"
                        : "bg-[var(--color-surface-muted)] hover:bg-[var(--color-border)] text-[var(--color-foreground)] border border-[var(--color-border)]"
                    }`}
                  >
                    <span>{isLoggedIn ? "Upgrade to " + plan.name : "Get Started with " + plan.name}</span>
                    <ArrowRight size={13} />
                  </button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Complete Feature Comparison Table */}
      <Card className="p-6 border border-[var(--color-border)] space-y-6">
        <div className="text-center max-w-xl mx-auto space-y-1">
          <h2 className="text-xl font-bold">Compare Complete Plan Specifications</h2>
          <p className="text-xs text-[var(--color-muted)]">
            Detailed breakdown of search credits, AI models, autonomous agents, and publishing limits.
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--color-surface-muted)] text-[var(--color-muted)] border-b border-[var(--color-border)]">
              <tr>
                <th className="py-3 px-4 font-semibold">Feature / Allocation</th>
                <th className="py-3 px-4 font-semibold text-center w-40">Basic ($29/mo)</th>
                <th className="py-3 px-4 font-semibold text-center w-40 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  Pro ⭐ ($79/mo)
                </th>
                <th className="py-3 px-4 font-semibold text-center w-40">Enterprise ($199/mo)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              <tr className="hover:bg-[var(--color-surface-muted)]/50">
                <td className="py-2.5 px-4 font-medium">Connected Websites</td>
                <td className="py-2.5 px-4 text-center font-semibold">1 Website</td>
                <td className="py-2.5 px-4 text-center font-semibold bg-indigo-500/5 text-indigo-600 dark:text-indigo-400">5 Websites</td>
                <td className="py-2.5 px-4 text-center font-semibold">20 Websites</td>
              </tr>
              <tr className="hover:bg-[var(--color-surface-muted)]/50">
                <td className="py-2.5 px-4 font-medium">Team Users</td>
                <td className="py-2.5 px-4 text-center">1 User</td>
                <td className="py-2.5 px-4 text-center bg-indigo-500/5 font-semibold text-indigo-600 dark:text-indigo-400">3 Users</td>
                <td className="py-2.5 px-4 text-center font-semibold">10 Users</td>
              </tr>
              <tr className="hover:bg-[var(--color-surface-muted)]/50">
                <td className="py-2.5 px-4 font-medium">Ranked Keywords Tracked</td>
                <td className="py-2.5 px-4 text-center font-mono font-semibold">500</td>
                <td className="py-2.5 px-4 text-center font-mono font-semibold bg-indigo-500/5 text-indigo-600 dark:text-indigo-400">2,500</td>
                <td className="py-2.5 px-4 text-center font-mono font-semibold">10,000</td>
              </tr>
              <tr className="hover:bg-[var(--color-surface-muted)]/50">
                <td className="py-2.5 px-4 font-medium">Search & AI Credits</td>
                <td className="py-2.5 px-4 text-center font-mono">5,000 / mo</td>
                <td className="py-2.5 px-4 text-center font-mono bg-indigo-500/5 text-indigo-600 dark:text-indigo-400 font-semibold">25,000 / mo</td>
                <td className="py-2.5 px-4 text-center font-mono font-semibold">100,000 / mo</td>
              </tr>
              <tr className="hover:bg-[var(--color-surface-muted)]/50">
                <td className="py-2.5 px-4 font-medium">Autonomous AI Actions</td>
                <td className="py-2.5 px-4 text-center font-mono">50 / mo</td>
                <td className="py-2.5 px-4 text-center font-mono bg-indigo-500/5 text-indigo-600 dark:text-indigo-400 font-semibold">300 / mo</td>
                <td className="py-2.5 px-4 text-center font-mono font-semibold">1,000 / mo</td>
              </tr>
              <tr className="hover:bg-[var(--color-surface-muted)]/50">
                <td className="py-2.5 px-4 font-medium">SEO Tools Suite</td>
                <td className="py-2.5 px-4 text-center text-[var(--color-muted)]">Basic</td>
                <td className="py-2.5 px-4 text-center bg-indigo-500/5 text-emerald-600 font-semibold">Full Suite</td>
                <td className="py-2.5 px-4 text-center text-emerald-600 font-semibold">Full Suite</td>
              </tr>
              <tr className="hover:bg-[var(--color-surface-muted)]/50">
                <td className="py-2.5 px-4 font-medium">AI Search Visibility Tracker</td>
                <td className="py-2.5 px-4 text-center text-emerald-500">✅ Included</td>
                <td className="py-2.5 px-4 text-center bg-indigo-500/5 text-emerald-500 font-semibold">✅ Included</td>
                <td className="py-2.5 px-4 text-center text-emerald-500 font-semibold">✅ Included</td>
              </tr>
              <tr className="hover:bg-[var(--color-surface-muted)]/50">
                <td className="py-2.5 px-4 font-medium">GEO Agent (Local & Regional Authority)</td>
                <td className="py-2.5 px-4 text-center text-zinc-400">❌</td>
                <td className="py-2.5 px-4 text-center bg-indigo-500/5 text-emerald-500 font-semibold">✅ Included</td>
                <td className="py-2.5 px-4 text-center text-emerald-500 font-semibold">✅ Included</td>
              </tr>
              <tr className="hover:bg-[var(--color-surface-muted)]/50">
                <td className="py-2.5 px-4 font-medium">SEO Agent (Audits & Opportunities)</td>
                <td className="py-2.5 px-4 text-center text-[var(--color-muted)]">Basic</td>
                <td className="py-2.5 px-4 text-center bg-indigo-500/5 text-emerald-600 font-semibold">Full Suite</td>
                <td className="py-2.5 px-4 text-center text-emerald-600 font-semibold">Full Suite</td>
              </tr>
              <tr className="hover:bg-[var(--color-surface-muted)]/50">
                <td className="py-2.5 px-4 font-medium">Article Agent (Full AI Generator)</td>
                <td className="py-2.5 px-4 text-center text-zinc-400">❌</td>
                <td className="py-2.5 px-4 text-center bg-indigo-500/5 text-emerald-500 font-semibold">✅ Included</td>
                <td className="py-2.5 px-4 text-center text-emerald-500 font-semibold">✅ Included</td>
              </tr>
              <tr className="hover:bg-[var(--color-surface-muted)]/50">
                <td className="py-2.5 px-4 font-medium">Reddit Opportunity Agent</td>
                <td className="py-2.5 px-4 text-center text-zinc-400">❌</td>
                <td className="py-2.5 px-4 text-center bg-indigo-500/5 text-emerald-500 font-semibold">✅ Included</td>
                <td className="py-2.5 px-4 text-center text-emerald-500 font-semibold">✅ Included</td>
              </tr>
              <tr className="hover:bg-[var(--color-surface-muted)]/50">
                <td className="py-2.5 px-4 font-medium">X (Twitter) Influencer Agent</td>
                <td className="py-2.5 px-4 text-center text-zinc-400">❌</td>
                <td className="py-2.5 px-4 text-center bg-indigo-500/5 text-emerald-500 font-semibold">✅ Included</td>
                <td className="py-2.5 px-4 text-center text-emerald-500 font-semibold">✅ Included</td>
              </tr>
              <tr className="hover:bg-[var(--color-surface-muted)]/50">
                <td className="py-2.5 px-4 font-medium">AI Articles Generated</td>
                <td className="py-2.5 px-4 text-center font-semibold">2 / mo</td>
                <td className="py-2.5 px-4 text-center bg-indigo-500/5 text-indigo-600 dark:text-indigo-400 font-semibold">20 / mo</td>
                <td className="py-2.5 px-4 text-center font-semibold">50 / mo</td>
              </tr>
              <tr className="hover:bg-[var(--color-surface-muted)]/50">
                <td className="py-2.5 px-4 font-medium">Publishing Integrations</td>
                <td className="py-2.5 px-4 text-center">1 Target (WordPress)</td>
                <td className="py-2.5 px-4 text-center bg-indigo-500/5 text-emerald-500 font-semibold">✅ Unlimited</td>
                <td className="py-2.5 px-4 text-center text-emerald-500 font-semibold">✅ Unlimited</td>
              </tr>
              <tr className="hover:bg-[var(--color-surface-muted)]/50">
                <td className="py-2.5 px-4 font-medium">Competitor Monitoring</td>
                <td className="py-2.5 px-4 text-center text-zinc-400">❌</td>
                <td className="py-2.5 px-4 text-center bg-indigo-500/5 text-emerald-500 font-semibold">✅ Included</td>
                <td className="py-2.5 px-4 text-center font-semibold text-purple-600">Advanced</td>
              </tr>
              <tr className="hover:bg-[var(--color-surface-muted)]/50">
                <td className="py-2.5 px-4 font-medium">Team Management & RBAC</td>
                <td className="py-2.5 px-4 text-center text-zinc-400">❌</td>
                <td className="py-2.5 px-4 text-center bg-indigo-500/5 text-[var(--color-foreground)] font-medium">Basic</td>
                <td className="py-2.5 px-4 text-center font-semibold text-purple-600">Advanced</td>
              </tr>
              <tr className="hover:bg-[var(--color-surface-muted)]/50">
                <td className="py-2.5 px-4 font-medium">Support Channel</td>
                <td className="py-2.5 px-4 text-center text-[var(--color-muted)]">Standard</td>
                <td className="py-2.5 px-4 text-center bg-indigo-500/5 text-emerald-500 font-semibold">✅ Priority 24/7</td>
                <td className="py-2.5 px-4 text-center text-emerald-500 font-semibold">✅ Dedicated SLA</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Checkout Modal */}
      {checkoutModalOpen && selectedPlanId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <Card className="max-w-md w-full p-6 border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl rounded-2xl space-y-5 animate-scale-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                  <CreditCard size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Secure Subscription Checkout</h3>
                  <p className="text-[11px] text-[var(--color-muted)]">Selected: {plans.find((p) => p.id === selectedPlanId)?.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCheckoutModalOpen(false)}
                className="text-[var(--color-muted)] hover:text-[var(--color-foreground)] text-xs"
              >
                ✕
              </button>
            </div>

            <div className="p-4 rounded-xl bg-[var(--color-surface-muted)] text-xs space-y-2">
              <div className="flex justify-between">
                <span>Plan:</span>
                <span className="font-semibold">{plans.find((p) => p.id === selectedPlanId)?.name}</span>
              </div>
              <div className="flex justify-between">
                <span>Billing:</span>
                <span className="capitalize">{billingCycle}</span>
              </div>
              <div className="flex justify-between border-t border-[var(--color-border)] pt-2 font-bold text-sm">
                <span>Total Due:</span>
                <span className="text-indigo-600 dark:text-indigo-400">
                  ${billingCycle === "monthly"
                    ? plans.find((p) => p.id === selectedPlanId)?.priceMonthly
                    : plans.find((p) => p.id === selectedPlanId)?.priceYearly}
                </span>
              </div>
            </div>

            {/* Payment Options */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  alert(`Stripe checkout initialized for ${selectedPlanId} (${billingCycle}). Gateway live/test mode.`);
                  setCheckoutModalOpen(false);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors"
              >
                <CreditCard size={14} /> Pay with Credit Card (Stripe)
              </button>

              <button
                type="button"
                onClick={() => {
                  alert(`Razorpay checkout initialized for ${selectedPlanId}. Accepting UPI, NetBanking & Indian Cards.`);
                  setCheckoutModalOpen(false);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors"
              >
                <Zap size={14} /> Pay with UPI / NetBanking (Razorpay)
              </button>
            </div>

            <p className="text-[10px] text-center text-[var(--color-muted)]">
              🔒 256-Bit SSL Encrypted. Cancel or change plan anytime from account settings.
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
