"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function LiveSyncButton() {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);

  async function handleSync() {
    if (syncing) return;
    setSyncing(true);
    try {
      await fetch("/api/automation/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ syncLive: true }),
      });
      router.refresh();
    } finally {
      setSyncing(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleSync}
      disabled={syncing}
      className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-fg)] transition hover:bg-[var(--color-surface-muted)] disabled:opacity-50"
      title="Sync Search Console & Live WordPress CMS Data"
    >
      <RefreshCw className={`h-3.5 w-3.5 text-[var(--color-accent)] ${syncing ? "animate-spin" : ""}`} />
      <span>{syncing ? "Syncing..." : "Sync Live"}</span>
    </button>
  );
}
