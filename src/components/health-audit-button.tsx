"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type AuditStep = "idle" | "running" | "done" | "error";

type PageScores = Record<string, { mobile: number | null; desktop: number | null }>;

type AuditSummary = {
  healthScore: number;
  issuesTotal: number;
  pageSpeedResultsReturned: number;
  pageSpeedErrors: number;
  hasPsiKey: boolean;
  perPage: PageScores;
  brokenLinksChecked: number;
  brokenLinksBroken: number;
};

export function HealthAuditButton({ websiteId }: { websiteId: string }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);

  async function handleAudit() {
    setRunning(true);
    try {
      await fetch("/api/seo/health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId }),
      });
      router.refresh();
    } finally {
      setRunning(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleAudit}
      disabled={running}
      className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-foreground)] disabled:opacity-50"
    >
      {running ? "Running…" : "Re-run Health Audit"}
    </button>
  );
}

export function TechnicalAuditButton({ websiteId }: { websiteId: string }) {
  const router = useRouter();
  const [step, setStep] = useState<AuditStep>("idle");
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  async function handleFullAudit() {
    setStep("running");
    setSummary(null);
    setErrorMsg(null);
    setElapsed(0);

    // Live timer so user sees progress during slow PSI calls
    const start = Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);

    try {
      const res = await fetch("/api/seo/technical-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId, maxPages: 5 }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({ error: { message: "Unknown error" } }))) as {
          error?: { message?: string };
        };
        throw new Error(err.error?.message ?? `HTTP ${res.status}`);
      }

      const data = (await res.json()) as {
        data: {
          health: { total: number; issues: { category: string }[] };
          audit: {
            pageSpeed: {
              hasPsiKey: boolean;
              resultsReturned: number;
              errors: { url: string; strategy: string; reason: string }[];
              perPage: PageScores;
            };
            brokenLinks: {
              urlsChecked: number;
              results: { status: number | null }[];
            };
          };
        };
      };

      const brokenCount = data.data.audit.brokenLinks.results.filter(
        (r) => r.status !== null && r.status >= 400,
      ).length;

      setSummary({
        healthScore: data.data.health.total,
        issuesTotal: data.data.health.issues.length,
        pageSpeedResultsReturned: data.data.audit.pageSpeed.resultsReturned,
        pageSpeedErrors: data.data.audit.pageSpeed.errors.length,
        hasPsiKey: data.data.audit.pageSpeed.hasPsiKey,
        perPage: data.data.audit.pageSpeed.perPage,
        brokenLinksChecked: data.data.audit.brokenLinks.urlsChecked,
        brokenLinksBroken: brokenCount,
      });

      setStep("done");
      router.refresh();
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setStep("error");
    } finally {
      clearInterval(timer);
    }
  }

  const isRunning = step === "running";

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={handleFullAudit}
        disabled={isRunning}
        className="rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary-fg)] hover:opacity-90 disabled:opacity-50"
      >
        {isRunning ? (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 animate-spin rounded-full border border-[var(--color-primary-fg)] border-t-transparent" />
            Running PSI + Link Check… {elapsed}s
          </span>
        ) : step === "done" ? (
          "Audit Complete ✓ — Run Again"
        ) : step === "error" ? (
          "Audit Failed — Retry"
        ) : (
          "Run Full Technical Audit"
        )}
      </button>

      {isRunning && (
        <p className="text-[10px] text-[var(--color-muted)]">
          Fetching Mobile + Desktop PageSpeed Insights — may take ~2 minutes…
        </p>
      )}

      {step === "done" && summary && (
        <div className="max-w-xs text-right">
          <p className="text-[10px] font-medium text-[var(--color-foreground)]">
            Score {summary.healthScore}/100 · {summary.issuesTotal} issues
          </p>
          {summary.hasPsiKey && summary.pageSpeedResultsReturned > 0 && (
            <div className="mt-0.5 text-[10px] text-[var(--color-muted)]">
              {Object.entries(summary.perPage).map(([url, scores]) => {
                const shortUrl = (() => {
                  try { return new URL(url).pathname || "/"; } catch { return url.slice(0, 30); }
                })();
                return (
                  <p key={url} title={url}>
                    {shortUrl}: 📱{scores.mobile ?? "—"} 🖥{scores.desktop ?? "—"}
                  </p>
                );
              })}
            </div>
          )}
          {summary.hasPsiKey && summary.pageSpeedResultsReturned === 0 && (
            <p className="text-[10px] text-[var(--color-warning)]">
              PSI returned no data — API may be slow, retry in a moment
            </p>
          )}
          {!summary.hasPsiKey && (
            <p className="text-[10px] text-[var(--color-warning)]">
              Add GOOGLE_PSI_API_KEY to .env for Page Speed scores
            </p>
          )}
          <p className="text-[10px] text-[var(--color-muted)]">
            Links: {summary.brokenLinksBroken} broken / {summary.brokenLinksChecked} checked
          </p>
        </div>
      )}

      {step === "error" && errorMsg && (
        <p className="max-w-xs text-right text-[10px] text-[var(--color-danger)]">{errorMsg}</p>
      )}
    </div>
  );
}
