"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Loader2, CheckCircle2 } from "lucide-react";

export function WeeklyAuditButton({ websiteId }: { websiteId: string }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [statusText, setStatusText] = useState<string | null>(null);

  async function handleRunAudit() {
    setRunning(true);
    setStatusText(null);
    setElapsed(0);

    const start = Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);

    try {
      const res = await fetch("/api/audits/weekly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error?.message || `HTTP ${res.status}`);
      }

      const data = await res.json() as { data?: { promptsTested: number; mentionsTotal: number; citationsTotal: number } };
      if (data.data) {
        setStatusText(`Audit Complete ✓ (${data.data.promptsTested} prompts, ${data.data.citationsTotal} citations)`);
      }
      router.refresh();
    } catch (e: unknown) {
      setStatusText(`Audit Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      clearInterval(timer);
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleRunAudit}
        disabled={running}
        className="flex items-center gap-1.5 rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary-fg)] hover:opacity-90 disabled:opacity-50"
      >
        {running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
        {running ? `Running AI Audit… ${elapsed}s` : "Run Weekly AI Audit Now"}
      </button>

      {statusText && (
        <span className="text-[10px] text-[var(--color-success)] font-medium">
          {statusText}
        </span>
      )}
    </div>
  );
}
