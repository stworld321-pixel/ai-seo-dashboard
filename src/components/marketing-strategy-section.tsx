"use client";

import { useState } from "react";
import {
  Target,
  Users,
  Compass,
  MessageSquare,
  BarChart3,
  CalendarCheck2,
  CheckCircle2,
  Circle,
  Copy,
  Check,
  Sparkles,
  ArrowRight,
  TrendingUp,
  ShieldAlert,
  Zap,
} from "lucide-react";
import type { MarketingStrategy } from "@/server/services/business-intelligence";

type MarketingStrategySectionProps = {
  strategy: MarketingStrategy;
  websiteName: string;
};

export function MarketingStrategySection({ strategy, websiteName }: MarketingStrategySectionProps) {
  const [activeTab, setActiveTab] = useState<"icp" | "positioning" | "messaging" | "channels" | "roadmap">("icp");
  const [copied, setCopied] = useState(false);

  // Local state for interactive 30-day checklist
  const [checkedTasks, setCheckedTasks] = useState<Record<string, boolean>>({
    "w1-1": true,
    "w1-2": true,
  });

  const totalTasks = strategy.roadmap30Day.reduce((sum, w) => sum + w.tasks.length, 0);
  const completedTasks = Object.values(checkedTasks).filter(Boolean).length;
  const progressPercent = Math.round((completedTasks / totalTasks) * 100);

  function toggleTask(id: string) {
    setCheckedTasks((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  async function handleCopyStrategy() {
    const text = `
=== MARKETING STRATEGY FOR ${websiteName.toUpperCase()} ===

1. IDEAL CUSTOMER PROFILE (ICP)
Target Persona: ${strategy.icp.personaTitle}
Industries: ${strategy.icp.targetIndustries.join(", ")}
Company Size / Segment: ${strategy.icp.companySize}
Core Pain Points:
${strategy.icp.corePainPoints.map((p) => `- ${p}`).join("\n")}
Buying Triggers:
${strategy.icp.buyingTriggers.map((t) => `- ${t}`).join("\n")}

2. POSITIONING STATEMENT
${strategy.positioningStatement.fullStatement}

3. MESSAGING FRAMEWORK
Headline: ${strategy.messagingFramework.headline}
Subheadline: ${strategy.messagingFramework.subheadline}
Elevator Pitch: ${strategy.messagingFramework.elevatorPitch}

Key proof points to repeat across all channels:
${strategy.messagingFramework.keyProofPoints.map((pt) => `- ${pt}`).join("\n")}

4. CHANNEL PRIORITIZATION REPORT
${strategy.channelPrioritization
  .map((c) => `[${c.tier}] ${c.channelName} | CAC: ${c.expectedCac} | Effort: ${c.effortLevel} | ROI: ${c.potentialRoi}\nAction: ${c.strategicAction}`)
  .join("\n\n")}

5. 30-DAY ROADMAP
${strategy.roadmap30Day
  .map((w) => `\n${w.week}: ${w.title} (${w.days})\n` + w.tasks.map((t) => `[${checkedTasks[t.id] ? "X" : " "}] ${t.task}`).join("\n"))
  .join("\n")}
    `.trim();

    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface-muted)]/40 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-[var(--color-foreground)] tracking-tight">
              Marketing Strategy
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-primary)]/10 px-2 py-0.5 text-[11px] font-semibold text-[var(--color-primary)]">
              <Sparkles className="h-3 w-3" /> AI Growth Playbook
            </span>
          </div>
          <p className="mt-0.5 text-xs text-[var(--color-muted)]">
            Autonomous market positioning, customer profile, and high-ROI acquisition roadmap for {websiteName}.
          </p>
        </div>

        <button
          onClick={handleCopyStrategy}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)] transition-colors shadow-2xs"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied Strategy" : "Copy Strategy"}
        </button>
      </div>

      {/* Tabs Navigation */}
      <div className="flex overflow-x-auto border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 scrollbar-none">
        <button
          onClick={() => setActiveTab("icp")}
          className={`flex items-center gap-2 border-b-2 px-3.5 py-3 text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === "icp"
              ? "border-[var(--color-primary)] text-[var(--color-primary)]"
              : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          1. Ideal Customer Profile (ICP)
        </button>

        <button
          onClick={() => setActiveTab("positioning")}
          className={`flex items-center gap-2 border-b-2 px-3.5 py-3 text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === "positioning"
              ? "border-[var(--color-primary)] text-[var(--color-primary)]"
              : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          }`}
        >
          <Compass className="h-3.5 w-3.5" />
          2. Positioning Statement
        </button>

        <button
          onClick={() => setActiveTab("messaging")}
          className={`flex items-center gap-2 border-b-2 px-3.5 py-3 text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === "messaging"
              ? "border-[var(--color-primary)] text-[var(--color-primary)]"
              : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          }`}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          3. Messaging Framework
        </button>

        <button
          onClick={() => setActiveTab("channels")}
          className={`flex items-center gap-2 border-b-2 px-3.5 py-3 text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === "channels"
              ? "border-[var(--color-primary)] text-[var(--color-primary)]"
              : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          }`}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          4. Channel Prioritization Report
        </button>

        <button
          onClick={() => setActiveTab("roadmap")}
          className={`flex items-center gap-2 border-b-2 px-3.5 py-3 text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === "roadmap"
              ? "border-[var(--color-primary)] text-[var(--color-primary)]"
              : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          }`}
        >
          <CalendarCheck2 className="h-3.5 w-3.5" />
          5. 30-Day Roadmap (Checklist)
          <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
            {progressPercent}%
          </span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="p-5">
        {/* TAB 1: Ideal Customer Profile (ICP) */}
        {activeTab === "icp" && (
          <div className="space-y-5 animate-fade-in">
            <div className="rounded-xl border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-primary)]">
                  Primary Buyer Persona
                </span>
                <h3 className="text-sm font-bold text-[var(--color-foreground)] mt-0.5">
                  {strategy.icp.personaTitle}
                </h3>
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  Target Company Size / Segment: <span className="font-semibold text-[var(--color-foreground)]">{strategy.icp.companySize}</span>
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {strategy.icp.targetIndustries.map((ind, i) => (
                  <span
                    key={i}
                    className="rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] px-2 py-1 text-[11px] font-medium text-[var(--color-foreground)]"
                  >
                    {ind}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Pain Points */}
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-rose-500 flex items-center gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Core Pain Points &amp; Friction
                </h4>
                <div className="space-y-2">
                  {strategy.icp.corePainPoints.map((point, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs leading-relaxed text-[var(--color-foreground)]">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-rose-500/10 text-[10px] font-bold text-rose-600 mt-0.5">
                        {i + 1}
                      </span>
                      <span>{point}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Buying Triggers */}
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-500 flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5" />
                  Conversion &amp; Buying Triggers
                </h4>
                <div className="space-y-2">
                  {strategy.icp.buyingTriggers.map((trig, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs leading-relaxed text-[var(--color-foreground)]">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-[10px] font-bold text-emerald-600 mt-0.5">
                        {i + 1}
                      </span>
                      <span>{trig}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Positioning Statement */}
        {activeTab === "positioning" && (
          <div className="space-y-5 animate-fade-in">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/30 p-5 space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-primary)]">
                Formal Positioning Matrix
              </span>

              <blockquote className="rounded-xl border-l-4 border-[var(--color-primary)] bg-[var(--color-surface)] p-4 text-sm font-medium italic text-[var(--color-foreground)] leading-relaxed shadow-xs">
                &ldquo;{strategy.positioningStatement.fullStatement}&rdquo;
              </blockquote>

              <div className="grid gap-3 sm:grid-cols-3 pt-2">
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                  <span className="text-[10px] uppercase font-semibold text-[var(--color-muted)] block">For Target</span>
                  <span className="text-xs font-bold text-[var(--color-foreground)]">{strategy.positioningStatement.forTarget}</span>
                </div>
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                  <span className="text-[10px] uppercase font-semibold text-[var(--color-muted)] block">Key Benefit</span>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{strategy.positioningStatement.keyBenefit}</span>
                </div>
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                  <span className="text-[10px] uppercase font-semibold text-[var(--color-muted)] block">Unlike Competitors</span>
                  <span className="text-xs font-bold text-[var(--color-foreground)]">{strategy.positioningStatement.unlikeCompetitors}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Messaging Framework */}
        {activeTab === "messaging" && (
          <div className="space-y-5 animate-fade-in">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4.5 space-y-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">Core Headline</span>
                <h3 className="text-base font-bold text-[var(--color-foreground)] mt-0.5">{strategy.messagingFramework.headline}</h3>
              </div>
              <div className="pt-2 border-t border-[var(--color-border)]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">Sub-Headline</span>
                <p className="text-xs font-medium text-[var(--color-foreground)] mt-0.5">{strategy.messagingFramework.subheadline}</p>
              </div>
              <div className="pt-2 border-t border-[var(--color-border)]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">Elevator Pitch</span>
                <p className="text-xs text-[var(--color-muted)] mt-0.5 leading-relaxed">{strategy.messagingFramework.elevatorPitch}</p>
              </div>
            </div>

            {/* Key Proof Points to Repeat Across All Channels */}
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4.5 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200">
                  Key proof points to repeat across all channels:
                </h4>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2">
                {strategy.messagingFramework.keyProofPoints.map((point, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-[var(--color-surface)] p-3 text-xs leading-relaxed"
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                    <span className="text-[var(--color-foreground)] font-medium">{point}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Channel Prioritization Report */}
        {activeTab === "channels" && (
          <div className="space-y-4 animate-fade-in">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {strategy.channelPrioritization.map((chan, i) => (
                <div
                  key={i}
                  className="flex flex-col justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 hover:border-[var(--color-primary)]/40 transition-all shadow-2xs space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          chan.tier.includes("Tier 1")
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : chan.tier.includes("Tier 2")
                              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                              : "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                        }`}
                      >
                        {chan.tier}
                      </span>
                      <span className="text-[11px] font-bold text-[var(--color-primary)]">{chan.potentialRoi}</span>
                    </div>

                    <h4 className="text-xs font-bold text-[var(--color-foreground)]">{chan.channelName}</h4>
                    <p className="text-[11px] text-[var(--color-muted)] leading-relaxed">{chan.strategicAction}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 border-t border-[var(--color-border)] pt-2 text-[10px]">
                    <div>
                      <span className="text-[var(--color-muted)] block">Expected CAC</span>
                      <span className="font-semibold text-[var(--color-foreground)]">{chan.expectedCac}</span>
                    </div>
                    <div>
                      <span className="text-[var(--color-muted)] block">Effort Level</span>
                      <span className="font-semibold text-[var(--color-foreground)]">{chan.effortLevel}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: 30-Day Roadmap (Checklist) */}
        {activeTab === "roadmap" && (
          <div className="space-y-5 animate-fade-in">
            {/* Progress Bar */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/40 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[var(--color-foreground)]">30-Day Execution Progress</span>
                <span className="font-bold text-[var(--color-primary)]">
                  {completedTasks} of {totalTasks} Tasks Completed ({progressPercent}%)
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
                <div
                  className="h-full bg-[var(--color-primary)] transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Weeks Accordion / List */}
            <div className="grid gap-4 sm:grid-cols-2">
              {strategy.roadmap30Day.map((wk, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2.5">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-primary)]">
                        {wk.week} &middot; {wk.days}
                      </span>
                      <h4 className="text-xs font-bold text-[var(--color-foreground)]">{wk.title}</h4>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {wk.tasks.map((t) => {
                      const isDone = Boolean(checkedTasks[t.id]);
                      return (
                        <button
                          key={t.id}
                          onClick={() => toggleTask(t.id)}
                          className={`w-full flex items-start gap-2.5 rounded-lg p-2 text-left text-xs transition-colors ${
                            isDone
                              ? "bg-emerald-500/5 text-[var(--color-muted)] line-through"
                              : "hover:bg-[var(--color-surface-muted)] text-[var(--color-foreground)]"
                          }`}
                        >
                          {isDone ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
                          ) : (
                            <Circle className="h-4 w-4 shrink-0 text-[var(--color-muted)] mt-0.5" />
                          )}
                          <span className="leading-snug">{t.task}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
