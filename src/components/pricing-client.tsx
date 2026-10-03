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
  Globe,
  Layers,
  FileText,
  Search,
  Users,
  Code2,
  Video,
  Share2,
  Compass,
} from "lucide-react";
import { Card } from "@/components/card";

export type PlanSection = {
  category: string;
  items: string[];
};

export type PlanItem = {
  id: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  badge: string;
  subtitle?: string;
  tagline?: string;
  features: string[];
  sections?: PlanSection[];
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

// Fallback plans if database config is loading
export const DEFAULT_AI_CMO_PLANS: PlanItem[] = [
  {
    id: "free",
    name: "Free Starter",
    priceMonthly: 0,
    priceYearly: 0,
    currency: "USD",
    badge: "Free Audit",
    subtitle: "Essential SEO & Diagnostic Access",
    tagline: "1 website · No credit card required.",
    features: [
      "Full Website Analysis & HTML Metadata Extraction",
      "Technical Health Score & Core Web Vitals",
      "20 Monitored Search Keywords",
      "1 AI Search Visibility Prompt",
      "Google Search Console Integration",
    ],
    sections: [
      {
        category: "Website Analysis",
        items: [
          "Full website crawl & metadata extraction",
          "Technical SEO health score",
        ],
      },
    ],
    limits: {
      websites: 1,
      users: 1,
      keywords: 20,
      credits: 100,
      aiActions: 10,
      seoTools: "Basic",
      aiVisibility: true,
      geoAgent: false,
      seoAgent: "Basic",
      articleAgent: false,
      redditAgent: false,
      xAgent: false,
      aiArticles: 0,
      publishing: 1,
      competitorMonitoring: "None",
      teamManagement: "None",
      prioritySupport: false,
    },
    isPopular: false,
  },
  {
    id: "lite",
    name: "AI CMO Lite",
    priceMonthly: 108,
    priceYearly: 1080,
    currency: "USD",
    badge: "Core Growth",
    subtitle: "Limited AI CMO access",
    tagline: "1 AI CMO per website · Cancel anytime.",
    features: [
      "Full Website Analysis & Technical Documents",
      "Product Info & Competitor Analysis Documents",
      "Positioning + ICP & 30-Day Marketing Strategy",
      "Monthly Content Strategy",
      "SEO Agent (Technical & Content Opportunities)",
      "GEO Agent (Track up to 15 AI Search Prompts)",
      "Mentions & Citation Visibility Tracking",
      "X / Twitter Agent (30+ Posts & Threads/mo)",
    ],
    sections: [
      {
        category: "Website Analysis",
        items: [
          "Full website analysis",
          "Product info document",
          "Design guide document",
          "Competitor analysis document",
        ],
      },
      {
        category: "Strategies",
        items: [
          "Positioning + ICP messaging",
          "30-day marketing strategy",
          "Monthly content strategy",
        ],
      },
      {
        category: "SEO Agent",
        items: [
          "SEO recommendations",
          "Technical SEO opportunities",
          "Content opportunities",
        ],
      },
      {
        category: "GEO Agent",
        items: [
          "Track up to 15 AI search prompts",
          "Mentions + citation visibility",
          "Competitor AI visibility",
          "AI visibility recommendations",
        ],
      },
      {
        category: "X / Twitter Agent",
        items: [
          "Minimum 30 posts/month",
          "Posts + thread drafts",
        ],
      },
    ],
    limits: {
      websites: 1,
      users: 2,
      keywords: 1500,
      credits: 25000,
      aiActions: 250,
      seoTools: "Full",
      aiVisibility: true,
      geoAgent: true,
      seoAgent: "Full",
      articleAgent: false,
      redditAgent: false,
      xAgent: true,
      aiArticles: 5,
      publishing: -1,
      competitorMonitoring: "Included",
      teamManagement: "Basic",
      prioritySupport: true,
    },
    isPopular: false,
  },
  {
    id: "pro",
    name: "AI CMO Pro",
    priceMonthly: 208,
    priceYearly: 2080,
    currency: "USD",
    badge: "Most Popular ⭐",
    subtitle: "Full agent suite access",
    tagline: "1 AI CMO per website · Cancel anytime.",
    features: [
      "Everything in Lite included",
      "Reddit Agent (High-intent monitoring & replies)",
      "AI Content Writer (30+ Strategy articles/mo)",
      "X / Twitter Agent (60+ Posts & Threads/mo)",
      "Full SEO + GEO + Content Autonomous Suite",
      "Unlimited CMS & Publishing Target Automations",
      "Priority 24/7 Dedicated Support",
    ],
    sections: [
      {
        category: "Website Analysis",
        items: [
          "Full website analysis",
          "Product info document",
          "Design guide document",
          "Competitor analysis document",
        ],
      },
      {
        category: "Strategies",
        items: [
          "Positioning + ICP messaging",
          "30-day marketing strategy",
          "Monthly content strategy",
        ],
      },
      {
        category: "SEO Agent",
        items: [
          "SEO recommendations",
          "Technical SEO opportunities",
          "Content opportunities",
        ],
      },
      {
        category: "GEO Agent",
        items: [
          "Track up to 100 AI search prompts",
          "Mentions + citation visibility",
          "Competitor AI visibility",
          "AI visibility recommendations",
        ],
      },
      {
        category: "X / Twitter Agent",
        items: [
          "Minimum 60 posts/month",
          "Posts + thread drafts",
        ],
      },
      {
        category: "Reddit Agent",
        items: [
          "High-intent monitoring",
          "Contextual reply drafts",
        ],
      },
      {
        category: "AI Content Writer Agent",
        items: [
          "Minimum 30 articles/month",
          "Strategy-led article drafts",
        ],
      },
    ],
    limits: {
      websites: 3,
      users: 5,
      keywords: 5000,
      credits: 100000,
      aiActions: 1000,
      seoTools: "Full",
      aiVisibility: true,
      geoAgent: true,
      seoAgent: "Full",
      articleAgent: true,
      redditAgent: true,
      xAgent: true,
      aiArticles: 30,
      publishing: -1,
      competitorMonitoring: "Advanced",
      teamManagement: "Advanced",
      prioritySupport: true,
    },
    isPopular: true,
  },
];

export function PricingClient({
  plans,
  currentPlan: initialPlan,
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
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<string | null>(initialPlan);
  const [loadingUpgrade, setLoadingUpgrade] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const activePlans = plans && plans.length > 0 ? plans : DEFAULT_AI_CMO_PLANS;

  function handleSelectPlan(planId: string) {
    if (!isLoggedIn) {
      window.location.href = `/register?plan=${encodeURIComponent(planId.toUpperCase())}`;
      return;
    }
    setSelectedPlanId(planId);
    setSuccessMessage(null);
    setCheckoutModalOpen(true);
  }

  async function handleConfirmUpgrade() {
    if (!selectedPlanId) return;
    setLoadingUpgrade(true);
    try {
      const res = await fetch("/api/subscription/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: selectedPlanId,
          billingCycle,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.data) {
        setCurrentPlan(selectedPlanId);
        setSuccessMessage(json.data.message || `Successfully upgraded to ${json.data.planName}!`);
        setTimeout(() => {
          window.location.href = "/";
        }, 1500);
      } else {
        alert(json.error?.message || "Failed to upgrade subscription. Please try again.");
      }
    } catch {
      alert("Network error processing upgrade. Please try again.");
    } finally {
      setLoadingUpgrade(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-12">
      {/* Header */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-xs font-semibold border border-[var(--color-primary)]/20">
          <Sparkles size={13} />
          Autonomous AI CMO &amp; Growth Agent Suite
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--color-foreground)]">
          Predictable Pricing for Autonomous AI Search &amp; Growth
        </h1>
        <p className="text-sm text-[var(--color-muted)] leading-relaxed">
          From solo brands to scaling teams — deploy autonomous SEO, GEO, Reddit, and Twitter agents to dominate Google and AI engines (Perplexity, ChatGPT, Gemini).
        </p>

        {/* Monthly / Yearly Toggle */}
        <div className="pt-4 flex items-center justify-center gap-3 text-xs font-semibold">
          <span className={billingCycle === "monthly" ? "text-[var(--color-foreground)] font-bold" : "text-[var(--color-muted)]"}>
            Monthly Billing
          </span>
          <button
            type="button"
            onClick={() => setBillingCycle(billingCycle === "monthly" ? "yearly" : "monthly")}
            aria-label="Toggle Monthly and Yearly billing cycle"
            className="relative h-6 w-12 rounded-full bg-[var(--color-primary)] transition-colors focus:outline-none shadow-xs"
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                billingCycle === "yearly" ? "translate-x-7" : "translate-x-1"
              }`}
            />
          </button>
          <span className={billingCycle === "yearly" ? "text-[var(--color-primary)] font-bold flex items-center gap-1.5" : "text-[var(--color-muted)] flex items-center gap-1.5"}>
            Annual Billing
            <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full text-[10px] font-bold">
              2 Months Free (Save 20%)
            </span>
          </span>
        </div>
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        {activePlans.map((plan) => {
          const price = billingCycle === "monthly" ? plan.priceMonthly : Math.round(plan.priceYearly / 12);
          const isCurrent = currentPlan?.toLowerCase() === plan.id.toLowerCase();
          const hasSections = plan.sections && plan.sections.length > 0;

          return (
            <div
              key={plan.id}
              className={`relative p-6 sm:p-7 rounded-2xl border flex flex-col justify-between transition-all ${
                plan.isPopular
                  ? "border-[var(--color-primary)] shadow-xl shadow-[var(--color-primary)]/10 bg-[var(--color-surface)] ring-2 ring-[var(--color-primary)]"
                  : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-zinc-400 dark:hover:border-zinc-600"
              }`}
            >
              {plan.isPopular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[var(--color-primary)] text-white text-[11px] font-extrabold py-0.5 px-4 rounded-full shadow-md flex items-center gap-1 uppercase tracking-wider">
                  <Zap size={11} className="fill-white" /> MOST POPULAR
                </div>
              )}

              <div>
                {/* Plan Header */}
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-[var(--color-foreground)] tracking-tight">
                    {plan.name}
                  </h3>
                  <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-[var(--color-surface-muted)] text-[var(--color-muted)] border border-[var(--color-border)]">
                    {billingCycle === "yearly" && plan.priceYearly > 0 ? "2 months free" : plan.badge}
                  </span>
                </div>

                {/* Pricing Number */}
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl sm:text-5xl font-extrabold tracking-tight text-[var(--color-foreground)]">
                    ${price}
                  </span>
                  <span className="text-xs text-[var(--color-muted)] font-medium">
                    /mo
                  </span>
                </div>

                {plan.subtitle && (
                  <p className="text-xs text-[var(--color-muted)] mt-1 font-medium">
                    {plan.subtitle}
                  </p>
                )}

                {/* Primary CTA Button placed prominently under price */}
                <div className="mt-5">
                  {isCurrent ? (
                    <button
                      type="button"
                      disabled
                      className="w-full py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-xs text-center cursor-default"
                    >
                      Current Plan Active
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSelectPlan(plan.id)}
                      className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs ${
                        plan.isPopular
                          ? "bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white shadow-md shadow-[var(--color-primary)]/20"
                          : "bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white"
                      }`}
                    >
                      <span>
                        {plan.priceMonthly === 0
                          ? "Start Free Audit"
                          : "Start Growing"}
                      </span>
                      <ArrowRight size={13} />
                    </button>
                  )}
                </div>

                {/* Tagline under CTA button */}
                <p className="text-[11px] text-center text-[var(--color-muted)] mt-2 font-medium">
                  {plan.tagline || "1 AI CMO per website · Cancel anytime."}
                </p>

                {/* Package Features & Agent Sections */}
                <div className="my-6 border-t border-[var(--color-border)] pt-5 space-y-4">
                  <p className="text-xs font-bold text-[var(--color-foreground)]">
                    {plan.id === "free"
                      ? "Core Diagnostics Included:"
                      : plan.id === "lite"
                      ? "Everything in Free, plus core growth channels:"
                      : "Everything in Free, plus full access to every agent:"}
                  </p>

                  {hasSections ? (
                    <div className="space-y-3.5 text-xs">
                      {plan.sections!.map((section, sIdx) => (
                        <div key={sIdx} className="space-y-1.5">
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-primary)]">
                            {section.category}
                          </h4>
                          <ul className="space-y-1 pl-1 text-[var(--color-foreground)]">
                            {section.items.map((item, iIdx) => (
                              <li key={iIdx} className="flex items-start gap-1.5 text-xs text-[var(--color-foreground)] leading-relaxed">
                                <span className="text-[var(--color-muted)] select-none">•</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <ul className="space-y-2.5 text-xs text-[var(--color-foreground)]">
                      {plan.features.map((feat, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Complete Feature Comparison Table */}
      <Card className="p-6 border border-[var(--color-border)] space-y-6">
        <div className="text-center max-w-xl mx-auto space-y-1">
          <h2 className="text-xl font-bold tracking-tight">Compare Complete AI CMO Capabilities</h2>
          <p className="text-xs text-[var(--color-muted)]">
            Detailed breakdown of search credits, AI models, autonomous agents, and multi-channel marketing allocations.
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--color-surface-muted)] text-[var(--color-muted)] border-b border-[var(--color-border)]">
              <tr>
                <th className="py-3 px-4 font-semibold">Growth Module / Agent</th>
                <th className="py-3 px-4 font-semibold text-center w-36">Free Starter ($0)</th>
                <th className="py-3 px-4 font-semibold text-center w-44">AI CMO Lite ($108/mo)</th>
                <th className="py-3 px-4 font-semibold text-center w-48 bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                  AI CMO Pro ⭐ ($208/mo)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              <tr className="hover:bg-[var(--color-surface-muted)]/50">
                <td className="py-2.5 px-4 font-medium">Connected Websites</td>
                <td className="py-2.5 px-4 text-center">1 Website</td>
                <td className="py-2.5 px-4 text-center font-semibold">1 Website</td>
                <td className="py-2.5 px-4 text-center font-semibold bg-[var(--color-primary)]/5 text-[var(--color-primary)]">3 Websites</td>
              </tr>
              <tr className="hover:bg-[var(--color-surface-muted)]/50">
                <td className="py-2.5 px-4 font-medium">Search &amp; AI Execution Credits</td>
                <td className="py-2.5 px-4 text-center font-mono font-semibold text-amber-600">100 / mo</td>
                <td className="py-2.5 px-4 text-center font-mono font-semibold text-emerald-600">25,000 / mo</td>
                <td className="py-2.5 px-4 text-center font-mono font-semibold bg-[var(--color-primary)]/5 text-[var(--color-primary)]">100,000 / mo</td>
              </tr>
              <tr className="hover:bg-[var(--color-surface-muted)]/50">
                <td className="py-2.5 px-4 font-medium">Monitored Search Keywords</td>
                <td className="py-2.5 px-4 text-center font-semibold">20 Keywords</td>
                <td className="py-2.5 px-4 text-center font-semibold text-emerald-600">1,500 Keywords</td>
                <td className="py-2.5 px-4 text-center font-semibold bg-[var(--color-primary)]/5 text-[var(--color-primary)]">5,000 Keywords</td>
              </tr>
              <tr className="hover:bg-[var(--color-surface-muted)]/50">
                <td className="py-2.5 px-4 font-medium">Full Website &amp; Technical Analysis</td>
                <td className="py-2.5 px-4 text-center text-emerald-500">✅ Included</td>
                <td className="py-2.5 px-4 text-center text-emerald-500">✅ Included</td>
                <td className="py-2.5 px-4 text-center bg-[var(--color-primary)]/5 text-emerald-500 font-semibold">✅ Included</td>
              </tr>
              <tr className="hover:bg-[var(--color-surface-muted)]/50">
                <td className="py-2.5 px-4 font-medium">Product Info &amp; Design Guide Docs</td>
                <td className="py-2.5 px-4 text-center text-zinc-400">❌</td>
                <td className="py-2.5 px-4 text-center text-emerald-500">✅ Included</td>
                <td className="py-2.5 px-4 text-center bg-[var(--color-primary)]/5 text-emerald-500 font-semibold">✅ Included</td>
              </tr>
              <tr className="hover:bg-[var(--color-surface-muted)]/50">
                <td className="py-2.5 px-4 font-medium">Positioning &amp; 30-Day Marketing Strategy</td>
                <td className="py-2.5 px-4 text-center text-zinc-400">❌</td>
                <td className="py-2.5 px-4 text-center text-emerald-500 font-semibold">✅ Included</td>
                <td className="py-2.5 px-4 text-center bg-[var(--color-primary)]/5 text-emerald-500 font-semibold">✅ Included</td>
              </tr>
              <tr className="hover:bg-[var(--color-surface-muted)]/50">
                <td className="py-2.5 px-4 font-medium">SEO Agent (Technical &amp; Content Opportunities)</td>
                <td className="py-2.5 px-4 text-center text-[var(--color-muted)]">Basic Audit</td>
                <td className="py-2.5 px-4 text-center text-emerald-500 font-semibold">✅ Full SEO Agent</td>
                <td className="py-2.5 px-4 text-center bg-[var(--color-primary)]/5 text-emerald-500 font-semibold">✅ Full SEO Agent</td>
              </tr>
              <tr className="hover:bg-[var(--color-surface-muted)]/50">
                <td className="py-2.5 px-4 font-medium">GEO Agent (AI Search Visibility &amp; Citations)</td>
                <td className="py-2.5 px-4 text-center font-mono">1 Prompt</td>
                <td className="py-2.5 px-4 text-center font-semibold text-emerald-600">Up to 15 Prompts</td>
                <td className="py-2.5 px-4 text-center bg-[var(--color-primary)]/5 text-emerald-500 font-semibold">Up to 100 Prompts</td>
              </tr>
              <tr className="hover:bg-[var(--color-surface-muted)]/50">
                <td className="py-2.5 px-4 font-medium">X / Twitter Agent (30+ Posts &amp; Threads/mo)</td>
                <td className="py-2.5 px-4 text-center text-zinc-400">❌</td>
                <td className="py-2.5 px-4 text-center text-emerald-500 font-semibold">✅ 30 posts/mo</td>
                <td className="py-2.5 px-4 text-center bg-[var(--color-primary)]/5 text-emerald-500 font-semibold">✅ 60 posts/mo</td>
              </tr>
              <tr className="hover:bg-[var(--color-surface-muted)]/50">
                <td className="py-2.5 px-4 font-medium">Reddit Distribution Agent (High-Intent Replies)</td>
                <td className="py-2.5 px-4 text-center text-zinc-400">❌</td>
                <td className="py-2.5 px-4 text-center text-zinc-400">❌ Pro only</td>
                <td className="py-2.5 px-4 text-center bg-[var(--color-primary)]/5 text-emerald-500 font-semibold">✅ Included</td>
              </tr>
              <tr className="hover:bg-[var(--color-surface-muted)]/50">
                <td className="py-2.5 px-4 font-medium">AI Content Writer Agent (30 Articles/mo)</td>
                <td className="py-2.5 px-4 text-center text-zinc-400">❌</td>
                <td className="py-2.5 px-4 text-center text-zinc-400">❌ Pro only</td>
                <td className="py-2.5 px-4 text-center bg-[var(--color-primary)]/5 text-emerald-500 font-semibold">✅ 30 articles/mo</td>
              </tr>
              <tr className="hover:bg-[var(--color-surface-muted)]/50">
                <td className="py-2.5 px-4 font-medium">Support Level</td>
                <td className="py-2.5 px-4 text-center text-[var(--color-muted)]">Standard</td>
                <td className="py-2.5 px-4 text-center font-semibold text-emerald-600">Priority Support</td>
                <td className="py-2.5 px-4 text-center bg-[var(--color-primary)]/5 text-emerald-500 font-semibold">24/7 Dedicated SLA</td>
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
                <div className="h-8 w-8 rounded-lg bg-[var(--color-primary)] text-white flex items-center justify-center font-bold text-xs">
                  <CreditCard size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Secure Subscription Checkout</h3>
                  <p className="text-[11px] text-[var(--color-muted)]">
                    Selected: {activePlans.find((p) => p.id === selectedPlanId)?.name}
                  </p>
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

            {successMessage ? (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-300 text-center space-y-2">
                <p className="font-bold text-sm">🎉 Plan Activated!</p>
                <p>{successMessage}</p>
                <p className="text-[11px] text-[var(--color-muted)]">Redirecting to dashboard…</p>
              </div>
            ) : (
              <>
                <div className="p-4 rounded-xl bg-[var(--color-surface-muted)] text-xs space-y-2">
                  <div className="flex justify-between font-semibold">
                    <span>Plan:</span>
                    <span>{activePlans.find((p) => p.id === selectedPlanId)?.name}</span>
                  </div>
                  <div className="flex justify-between text-[var(--color-muted)]">
                    <span>Billing:</span>
                    <span className="capitalize">{billingCycle} (with 2 months free)</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-[var(--color-foreground)] border-t border-[var(--color-border)] pt-2 mt-2">
                    <span>Total Due:</span>
                    <span>
                      $
                      {billingCycle === "monthly"
                        ? activePlans.find((p) => p.id === selectedPlanId)?.priceMonthly
                        : activePlans.find((p) => p.id === selectedPlanId)?.priceYearly}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-[var(--color-muted)] leading-relaxed text-center">
                  1 AI CMO per website · Cancel anytime. Instant activation with full agent access.
                </p>

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={loadingUpgrade}
                    onClick={() => setCheckoutModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl border border-[var(--color-border)] text-xs font-semibold text-[var(--color-muted)] hover:bg-[var(--color-surface-muted)] transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={loadingUpgrade}
                    onClick={handleConfirmUpgrade}
                    className="flex-1 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-xs font-bold hover:bg-[var(--color-primary-hover)] transition-colors shadow-xs disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {loadingUpgrade ? "Activating…" : "Confirm & Activate"}
                  </button>
                </div>
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
