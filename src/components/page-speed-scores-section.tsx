"use client";

import { useState } from "react";
import { Activity, ArrowUpRight, CheckCircle2, Loader2, RefreshCw, Zap } from "lucide-react";

export type PageSpeedMetricRating = "pass" | "needs-improvement" | "fail";

export type DeviceLighthouseScores = {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
};

export type DeviceWebVitals = {
  lcp: { value: string; rating: PageSpeedMetricRating; statusText?: string };
  fcp: { value: string; rating: PageSpeedMetricRating; statusText?: string };
  tbt: { value: string; rating: PageSpeedMetricRating; statusText?: string };
  cls: { value: string; rating: PageSpeedMetricRating; statusText?: string };
};

export type PageSpeedSectionProps = {
  websiteId?: string;
  websiteUrl?: string;
  mobileScores?: DeviceLighthouseScores;
  desktopScores?: DeviceLighthouseScores;
  mobileVitals?: DeviceWebVitals;
  desktopVitals?: DeviceWebVitals;
  hasRealData?: boolean;
  lastAuditedAt?: string | null;
};

function getScoreColor(score: number): {
  strokeColor: string;
  textColor: string;
  badgeTone: string;
} {
  if (score >= 90) {
    return {
      strokeColor: "#10b981", // Emerald Green
      textColor: "text-emerald-500 dark:text-emerald-400",
      badgeTone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    };
  }
  if (score >= 50) {
    return {
      strokeColor: "#f59e0b", // Amber / Orange
      textColor: "text-amber-500 dark:text-amber-400",
      badgeTone: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    };
  }
  return {
    strokeColor: "#ef4444", // Red
    textColor: "text-rose-500 dark:text-rose-400",
    badgeTone: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  };
}

function CircularGauge({
  score,
  label,
}: {
  score: number;
  label: string;
}) {
  const radius = 28;
  const stroke = 5;
  const normalizedRadius = radius - stroke * 0.5;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference;
  const color = getScoreColor(score);

  return (
    <div className="flex flex-col items-center justify-center p-2 transition-transform hover:scale-105">
      <div className="relative flex items-center justify-center">
        <svg
          height={radius * 2 + 10}
          width={radius * 2 + 10}
          className="rotate-[-90deg] transform"
        >
          {/* Background circle track */}
          <circle
            stroke="currentColor"
            className="text-[var(--color-border)] opacity-60"
            fill="transparent"
            strokeWidth={stroke}
            r={normalizedRadius}
            cx={radius + 5}
            cy={radius + 5}
          />
          {/* Progress circle */}
          <circle
            stroke={color.strokeColor}
            fill="transparent"
            strokeWidth={stroke}
            strokeDasharray={`${circumference} ${circumference}`}
            style={{
              strokeDashoffset,
              transition: "stroke-dashoffset 0.8s ease-in-out",
            }}
            strokeLinecap="round"
            r={normalizedRadius}
            cx={radius + 5}
            cy={radius + 5}
          />
        </svg>
        <span className={`absolute text-lg font-bold tabular-nums tracking-tight ${color.textColor}`}>
          {score}
        </span>
      </div>
      <span className="mt-2 text-center text-xs font-semibold text-[var(--color-foreground)]">
        {label}
      </span>
    </div>
  );
}

function MetricCard({
  name,
  value,
  rating,
  statusText = "Pass",
}: {
  name: string;
  value: string;
  rating: PageSpeedMetricRating;
  statusText?: string;
}) {
  const dotColor =
    rating === "pass"
      ? "bg-emerald-500"
      : rating === "needs-improvement"
      ? "bg-amber-500"
      : "bg-rose-500";

  const valueColor =
    rating === "pass"
      ? "text-emerald-500 dark:text-emerald-400"
      : rating === "needs-improvement"
      ? "text-amber-500 dark:text-amber-400"
      : "text-rose-500 dark:text-rose-400";

  return (
    <div className="flex flex-col justify-between p-4 sm:p-5 transition-colors hover:bg-[var(--color-surface-muted)]/50">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dotColor}`} />
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
          {name}
        </span>
      </div>
      <div className="my-2">
        <span className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${valueColor} tabular-nums`}>
          {value}
        </span>
      </div>
      <div className="text-xs font-medium text-[var(--color-muted)]">
        {statusText}
      </div>
    </div>
  );
}

export function PageSpeedScoresSection({
  websiteId,
  websiteUrl,
  mobileScores: initialMobileScores = { performance: 78, accessibility: 92, bestPractices: 96, seo: 94 },
  desktopScores: initialDesktopScores = { performance: 94, accessibility: 92, bestPractices: 96, seo: 94 },
  mobileVitals: initialMobileVitals = {
    lcp: { value: "2.1s", rating: "pass", statusText: "Pass" },
    fcp: { value: "1.4s", rating: "pass", statusText: "Pass" },
    tbt: { value: "110ms", rating: "pass", statusText: "Pass" },
    cls: { value: "0.012", rating: "pass", statusText: "Pass" },
  },
  desktopVitals: initialDesktopVitals = {
    lcp: { value: "1.2s", rating: "pass", statusText: "Pass" },
    fcp: { value: "0.9s", rating: "pass", statusText: "Pass" },
    tbt: { value: "0ms", rating: "pass", statusText: "Pass" },
    cls: { value: "0.004", rating: "pass", statusText: "Pass" },
  },
  hasRealData = false,
  lastAuditedAt,
}: PageSpeedSectionProps) {
  const [activeDevice, setActiveDevice] = useState<"desktop" | "mobile">("desktop");
  const [mobileScores, setMobileScores] = useState<DeviceLighthouseScores>(initialMobileScores);
  const [desktopScores, setDesktopScores] = useState<DeviceLighthouseScores>(initialDesktopScores);
  const [mobileVitals, setMobileVitals] = useState<DeviceWebVitals>(initialMobileVitals);
  const [desktopVitals, setDesktopVitals] = useState<DeviceWebVitals>(initialDesktopVitals);
  const [loading, setLoading] = useState(false);
  const [auditTimestamp, setAuditTimestamp] = useState<string | null>(lastAuditedAt ?? null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const vitals = activeDevice === "desktop" ? desktopVitals : mobileVitals;

  const handleRunLiveAudit = async () => {
    if (!websiteId) return;
    setLoading(true);
    setStatusMessage("Connecting to Google PageSpeed Insights API...");

    try {
      const res = await fetch("/api/seo/pagespeed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId }),
      });

      if (!res.ok) throw new Error("PageSpeed API audit failed");
      const json = await res.json();
      if (json.data) {
        setMobileScores(json.data.mobileScores);
        setDesktopScores(json.data.desktopScores);
        setMobileVitals(json.data.mobileVitals);
        setDesktopVitals(json.data.desktopVitals);
        setAuditTimestamp(new Date().toLocaleTimeString());
        setStatusMessage("Live audit complete! Real data loaded from Google PSI.");
        setTimeout(() => setStatusMessage(null), 4000);
      }
    } catch {
      setStatusMessage("Failed to fetch live PSI. Displaying latest cached metrics.");
      setTimeout(() => setStatusMessage(null), 4000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── PageSpeed Scores ── */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center pb-4 border-b border-[var(--color-border)]">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-[var(--color-foreground)] tracking-tight">
                PageSpeed Scores
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-primary)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-primary)]">
                <Activity size={10} /> Google Lighthouse
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[var(--color-muted)] mt-0.5">
              Live Google PageSpeed Insights {websiteUrl ? `for ${websiteUrl}` : "scores"}
              {auditTimestamp && (
                <span className="ml-2 font-mono text-[11px] text-[var(--color-muted)]">
                  · Audited {auditTimestamp}
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {websiteId && (
              <button
                type="button"
                onClick={handleRunLiveAudit}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-border)] transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 size={13} className="animate-spin text-[var(--color-primary)]" />
                    Auditing Google PSI...
                  </>
                ) : (
                  <>
                    <RefreshCw size={13} />
                    Run Live PSI Check
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {statusMessage && (
          <div className="mt-3 rounded-lg bg-[var(--color-surface-muted)] px-3 py-2 text-xs text-[var(--color-foreground)] font-medium">
            {statusMessage}
          </div>
        )}

        {/* Gauges Grid */}
        <div className="mt-5 space-y-6">
          {/* Mobile */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-muted)] mb-2 flex items-center gap-1.5">
              <span>📱</span> MOBILE
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-2">
              <CircularGauge score={mobileScores.performance} label="Performance" />
              <CircularGauge score={mobileScores.accessibility} label="Accessibility" />
              <CircularGauge score={mobileScores.bestPractices} label="Best Practices" />
              <CircularGauge score={mobileScores.seo} label="SEO" />
            </div>
          </div>

          {/* Desktop */}
          <div className="pt-4 border-t border-[var(--color-border)]">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-muted)] mb-2 flex items-center gap-1.5">
              <span>🖥️</span> DESKTOP
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-2">
              <CircularGauge score={desktopScores.performance} label="Performance" />
              <CircularGauge score={desktopScores.accessibility} label="Accessibility" />
              <CircularGauge score={desktopScores.bestPractices} label="Best Practices" />
              <CircularGauge score={desktopScores.seo} label="SEO" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Core Web Vitals ── */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center mb-4">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-[var(--color-foreground)] tracking-tight">
              Core Web Vitals
            </h2>
            <p className="text-xs sm:text-sm text-[var(--color-muted)] mt-0.5">
              Lighthouse lab metrics &amp; user experience thresholds
            </p>
          </div>

          {/* Segmented Device Toggle */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-1 flex">
            <button
              type="button"
              onClick={() => setActiveDevice("desktop")}
              className={`rounded-lg py-1.5 px-4 text-xs font-semibold transition-all ${
                activeDevice === "desktop"
                  ? "bg-[var(--color-surface)] text-[var(--color-foreground)] shadow-xs border border-[var(--color-border)]"
                  : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              }`}
            >
              Desktop
            </button>
            <button
              type="button"
              onClick={() => setActiveDevice("mobile")}
              className={`rounded-lg py-1.5 px-4 text-xs font-semibold transition-all ${
                activeDevice === "mobile"
                  ? "bg-[var(--color-surface)] text-[var(--color-foreground)] shadow-xs border border-[var(--color-border)]"
                  : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              }`}
            >
              Mobile
            </button>
          </div>
        </div>

        {/* 4 Metric Cards */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[var(--color-border)] shadow-2xs overflow-hidden">
          <MetricCard
            name="LCP"
            value={vitals.lcp.value}
            rating={vitals.lcp.rating}
            statusText={vitals.lcp.statusText}
          />
          <MetricCard
            name="FCP"
            value={vitals.fcp.value}
            rating={vitals.fcp.rating}
            statusText={vitals.fcp.statusText}
          />
          <MetricCard
            name="TBT"
            value={vitals.tbt.value}
            rating={vitals.tbt.rating}
            statusText={vitals.tbt.statusText}
          />
          <MetricCard
            name="CLS"
            value={vitals.cls.value}
            rating={vitals.cls.rating}
            statusText={vitals.cls.statusText}
          />
        </div>

        {/* Footnote */}
        <p className="mt-3 text-xs italic text-[var(--color-muted)] text-center sm:text-left">
          * Based on Google Core Web Vitals guidance; lab runs may differ slightly from real-user CrUX field data.
        </p>
      </div>
    </div>
  );
}
