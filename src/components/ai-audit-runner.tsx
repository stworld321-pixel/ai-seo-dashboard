"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Sparkles, Loader2, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";

export function AiAuditRunner({ websiteId }: { websiteId: string }) {
  const router = useRouter();
  const [isRunningAudit, setIsRunningAudit] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [lastCompleted, setLastCompleted] = useState<string | null>(null);

  async function handleRunAudit() {
    setIsRunningAudit(true);
    setStatusMessage("Testing prompts across ChatGPT, Claude, Perplexity & Gemini...");
    try {
      const res = await fetch("/api/ai/prompts/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId, runAll: true }),
      });
      const json = (await res.json()) as { data?: { totalRuns?: number } };
      setStatusMessage(`Completed ${json.data?.totalRuns ?? "all"} engine evaluations!`);
      setLastCompleted(new Date().toLocaleTimeString());
      router.refresh();
    } catch {
      setStatusMessage("Error running AI evaluations. Please retry.");
    } finally {
      setIsRunningAudit(false);
      setTimeout(() => setStatusMessage(null), 5000);
    }
  }

  async function handleDiscoverPrompts() {
    setIsDiscovering(true);
    setStatusMessage("Analyzing Search Console queries & discovering AI prompts...");
    try {
      const res = await fetch("/api/ai/prompts/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId, autoSave: true }),
      });
      const json = (await res.json()) as { data?: { count?: number } };
      setStatusMessage(`Discovered and saved ${json.data?.count ?? 0} high-intent AI prompts!`);
      // Now run tests for newly discovered prompts
      await fetch("/api/ai/prompts/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId, runAll: true }),
      });
      setLastCompleted(new Date().toLocaleTimeString());
      router.refresh();
    } catch {
      setStatusMessage("Error discovering prompts.");
    } finally {
      setIsDiscovering(false);
      setTimeout(() => setStatusMessage(null), 5000);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {statusMessage && (
        <div className="flex items-center gap-1.5 rounded-md border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10 px-3 py-1.5 text-xs text-[var(--color-primary)] animate-in fade-in">
          {isRunningAudit || isDiscovering ? (
            <Loader2 size={13} className="animate-spin text-[var(--color-primary)]" />
          ) : (
            <CheckCircle2 size={13} className="text-[var(--color-success)]" />
          )}
          <span>{statusMessage}</span>
        </div>
      )}

      <button
        type="button"
        onClick={handleDiscoverPrompts}
        disabled={isDiscovering || isRunningAudit}
        className="flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)] disabled:opacity-50 transition-colors shadow-sm"
      >
        {isDiscovering ? (
          <Loader2 size={14} className="animate-spin text-[var(--color-primary)]" />
        ) : (
          <Sparkles size={14} className="text-amber-500" />
        )}
        <span>{isDiscovering ? "Discovering…" : "Auto-Discover Prompts"}</span>
      </button>

      <button
        type="button"
        onClick={handleRunAudit}
        disabled={isRunningAudit || isDiscovering}
        className="flex items-center gap-1.5 rounded-md bg-[var(--color-primary)] px-3.5 py-1.5 text-xs font-semibold text-[var(--color-primary-fg)] hover:opacity-90 disabled:opacity-50 transition-opacity shadow-sm"
      >
        {isRunningAudit ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Play size={14} className="fill-current" />
        )}
        <span>{isRunningAudit ? "Running Live Audit…" : "⚡ Run Live AI Audit (All Engines)"}</span>
      </button>

      {lastCompleted && !statusMessage && (
        <span className="text-[11px] text-[var(--color-muted)]">
          Last tested at {lastCompleted}
        </span>
      )}
    </div>
  );
}
