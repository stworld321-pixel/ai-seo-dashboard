"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/card";
import { StatusBadge } from "@/components/badges";
import { relativeTime } from "@/lib/format";

type RuleRow = {
  id: string;
  name: string;
  kind: string;
  enabled: boolean;
  schedule: string;
  lastRunAt: Date | string | null;
};

export function DailyAgentClient({
  websiteId,
  rules,
}: {
  websiteId: string;
  rules: RuleRow[];
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [lastSummary, setLastSummary] = useState<{
    queriesAnalyzed: number;
    pagesAnalyzed: number;
    opportunitiesDetected: number;
    healthScore: number;
    internalLinksSuggested: number;
  } | null>(null);

  async function handleRunNow(ruleId?: string) {
    setRunning(true);
    try {
      const res = await fetch("/api/automation/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId, ruleId }),
      });
      const json = await res.json();
      if (res.ok && json.data?.summary) {
        setLastSummary(json.data.summary);
      }
      router.refresh();
    } finally {
      setRunning(false);
    }
  }

  async function handleToggle(rule: RuleRow) {
    setTogglingId(rule.id);
    try {
      await fetch("/api/automation/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toggleRuleId: rule.id, enabled: !rule.enabled }),
      });
      router.refresh();
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Execute Daily SEO Pipeline"
          subtitle="Runs the deterministic 28-day reconciliation, opportunity detection, SEO health audit, and internal link analysis"
          action={
            <button
              type="button"
              onClick={() => handleRunNow()}
              disabled={running}
              className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-xs font-medium text-[var(--color-primary-fg)] hover:opacity-90 disabled:opacity-50"
            >
              {running ? "Running Pipeline..." : "Run Daily SEO Agent Now"}
            </button>
          }
        />
        {lastSummary ? (
          <div className="border-t border-[var(--color-border)] bg-[var(--color-success-bg)] px-5 py-3 text-xs text-[var(--color-success)]">
            Pipeline completed: {lastSummary.queriesAnalyzed} queries &amp; {lastSummary.pagesAnalyzed} pages analyzed ·{" "}
            {lastSummary.opportunitiesDetected} opportunities detected · Health Score {lastSummary.healthScore}/100 ·{" "}
            {lastSummary.internalLinksSuggested} internal links suggested.
          </div>
        ) : null}
      </Card>

      <Card>
        <CardHeader
          title="Scheduled Automation Rules"
          subtitle={`${rules.length} rules configured for this website`}
        />
        <div className="divide-y divide-[var(--color-border)]">
          {rules.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{r.name}</p>
                  <StatusBadge
                    status={r.enabled ? "Enabled" : "Paused"}
                    tone={r.enabled ? "success" : "neutral"}
                  />
                </div>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  Cron: <code className="font-mono">{r.schedule}</code> · Kind:{" "}
                  <code className="font-mono">{r.kind}</code> · Last run:{" "}
                  {relativeTime(r.lastRunAt ? new Date(r.lastRunAt) : null)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={togglingId === r.id}
                  onClick={() => handleToggle(r)}
                  className="rounded border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-surface-muted)]"
                >
                  {r.enabled ? "Pause" : "Enable"}
                </button>
                <button
                  type="button"
                  disabled={running}
                  onClick={() => handleRunNow(r.id)}
                  className="rounded bg-[var(--color-surface-muted)] px-3 py-1.5 text-xs font-medium hover:opacity-80"
                >
                  Run Rule
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
