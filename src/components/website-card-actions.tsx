"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Trash2, ExternalLink, Loader2 } from "lucide-react";

export function WebsiteCardActions({
  websiteId,
  websiteName,
  websiteUrl,
}: {
  websiteId: string;
  websiteName: string;
  websiteUrl: string;
}) {
  const router = useRouter();
  const [auditing, setAuditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [removed, setRemoved] = useState(false);

  function handleOpenDashboard() {
    document.cookie = `active_website_id=${encodeURIComponent(websiteId)}; path=/; max-age=31536000; samesite=lax`;
    router.push(`/?website=${encodeURIComponent(websiteId)}`);
    router.refresh();
  }

  async function handleRunAiAudit() {
    setAuditing(true);
    try {
      await fetch(`/api/websites/${encodeURIComponent(websiteId)}`, { method: "POST" });
      document.cookie = `active_website_id=${encodeURIComponent(websiteId)}; path=/; max-age=31536000; samesite=lax`;
      router.refresh();
    } finally {
      setAuditing(false);
    }
  }

  async function handleRemove() {
    if (!window.confirm(`Are you sure you want to remove "${websiteName}" (${websiteUrl})?\n\nThis will permanently delete this website project, Search Console links, crawled pages, and AI audit history.`)) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/websites/${encodeURIComponent(websiteId)}`, {
        method: "DELETE",
      });
      const json = (await res.json().catch(() => ({}))) as {
        data?: { nextWebsiteId?: string | null };
      };
      if (res.ok) {
        setRemoved(true);
        const nextId = json.data?.nextWebsiteId;
        if (nextId) {
          document.cookie = `active_website_id=${encodeURIComponent(nextId)}; path=/; max-age=31536000; samesite=lax`;
        } else {
          document.cookie = "active_website_id=; path=/; max-age=0";
        }
        router.refresh();
      } else {
        alert("Failed to remove website. Please check permissions and try again.");
      }
    } catch {
      alert("Error removing website.");
    } finally {
      setDeleting(false);
    }
  }

  if (removed) {
    return (
      <span className="text-xs font-medium text-red-600">
        Removed {websiteName} ({websiteUrl})
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleOpenDashboard}
        className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-primary)] px-2.5 py-1 text-xs font-medium text-white hover:opacity-90"
      >
        <ExternalLink size={12} />
        Open Dashboard
      </button>

      <button
        type="button"
        disabled={auditing || deleting}
        onClick={handleRunAiAudit}
        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10 px-2.5 py-1 text-xs font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20 disabled:opacity-50"
      >
        {auditing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
        {auditing ? "Auditing with AI..." : "Run AI SEO & Agent Audit"}
      </button>

      <button
        type="button"
        disabled={auditing || deleting}
        onClick={handleRemove}
        className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-500/20 disabled:opacity-50"
      >
        {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
        {deleting ? "Removing..." : "Remove"}
      </button>
    </div>
  );
}
