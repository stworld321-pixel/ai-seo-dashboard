"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronDown, Plus, Check, Trash2, Sparkles, Loader2 } from "lucide-react";

export type WebsiteOption = {
  id: string;
  name: string;
  url: string;
  cms?: string;
  technology?: string;
};

export function WebsiteSwitcher({
  currentWebsite,
  websites: initialWebsites = [],
}: {
  currentWebsite: { id: string; name: string; url: string };
  websites?: WebsiteOption[];
}) {
  const [open, setOpen] = useState(false);
  const [websites, setWebsites] = useState<WebsiteOption[]>(initialWebsites);
  const [busyId, setBusyId] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);

  async function refreshWebsiteList() {
    try {
      const res = await fetch("/api/websites", { cache: "no-store" });
      const json = (await res.json()) as { data?: WebsiteOption[] };
      if (json.data) {
        setWebsites(json.data);
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    void refreshWebsiteList();
  }, [currentWebsite.url, open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function setActiveWebsiteCookie(id: string) {
    document.cookie = `active_website_id=${encodeURIComponent(id)}; path=/; max-age=31536000; samesite=lax`;
  }

  function handleSelect(id: string) {
    setActiveWebsiteCookie(id);
    const params = new URLSearchParams(searchParams.toString());
    params.set("website", id);
    setOpen(false);
    router.push(`${pathname}?${params.toString()}`);
    router.refresh();
  }

  async function handleRunAiAudit(e: React.MouseEvent, site: WebsiteOption) {
    e.stopPropagation();
    setBusyId(site.id);
    try {
      await fetch(`/api/websites/${site.id}`, { method: "POST" });
      setActiveWebsiteCookie(site.id);
      const params = new URLSearchParams(searchParams.toString());
      params.set("website", site.id);
      setOpen(false);
      router.push(`${pathname}?${params.toString()}`);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemoveWebsite(e: React.MouseEvent, site: WebsiteOption) {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to remove "${site.name}" (${site.url})?\n\nThis will permanently delete this website project and its data.`)) {
      return;
    }
    setBusyId(site.id);
    try {
      const res = await fetch(`/api/websites/${encodeURIComponent(site.id)}`, { method: "DELETE" });
      const json = (await res.json().catch(() => ({}))) as {
        data?: { nextWebsiteId?: string | null };
      };
      setWebsites((prev) => prev.filter((w) => w.id !== site.id));
      const nextId = json.data?.nextWebsiteId;
      const params = new URLSearchParams(searchParams.toString());
      if (nextId) {
        setActiveWebsiteCookie(nextId);
        params.set("website", nextId);
        setOpen(false);
        router.push(`${pathname}?${params.toString()}`);
      } else {
        document.cookie = "active_website_id=; path=/; max-age=0";
        params.delete("website");
        setOpen(false);
        router.push("/websites");
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-lg px-2 py-1 text-left hover:bg-[var(--color-surface-muted)] transition-colors"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate max-w-[240px] sm:max-w-[320px] text-sm font-bold text-[var(--color-foreground)]">
              {currentWebsite.name}
            </p>
            <ChevronDown size={14} className="text-[var(--color-muted)] shrink-0" />
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Active
            </span>
          </div>
          <p className="truncate font-mono text-[11px] text-[var(--color-muted)]">{currentWebsite.url}</p>
        </div>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-80 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5 shadow-xl">
          <div className="flex items-center justify-between px-3 py-1">
            <p className="text-[10px] font-semibold uppercase text-[var(--color-muted)]">
              Switch or Manage Websites ({websites.length || 1})
            </p>
            <Link
              href="/integrations"
              onClick={() => setOpen(false)}
              className="text-[10px] font-medium text-[var(--color-primary)] hover:underline"
            >
              All Integrations
            </Link>
          </div>

          <div className="mt-1 max-h-64 divide-y divide-[var(--color-border)] overflow-y-auto">
            {websites.length > 0 ? (
              websites.map((site) => {
                const isSelected =
                  site.id === currentWebsite.id ||
                  site.url.replace(/\/+$/, "") === currentWebsite.url.replace(/\/+$/, "");
                const isBusy = busyId === site.id;
                return (
                  <div
                    key={site.id}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-xs rounded-lg transition-colors ${
                      isSelected ? "bg-[var(--color-surface-muted)]/70" : "hover:bg-[var(--color-surface-muted)]"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelect(site.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex items-center gap-1.5">
                        <p className="truncate font-semibold text-[var(--color-foreground)]">{site.name}</p>
                        {isSelected && <Check size={13} className="text-[var(--color-primary)] shrink-0" />}
                      </div>
                      <p className="truncate font-mono text-[10px] text-[var(--color-muted)]">{site.url}</p>
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={(e) => handleRunAiAudit(e, site)}
                        title="Run AI Model SEO & Agent Audit"
                        className="rounded p-1 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 disabled:opacity-50"
                      >
                        {isBusy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={(e) => handleRemoveWebsite(e, site)}
                        title="Remove website"
                        className="rounded p-1 text-red-600 hover:bg-red-500/10 disabled:opacity-50"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="px-3 py-2 text-xs text-[var(--color-muted)]">
                <p className="font-semibold text-[var(--color-foreground)]">{currentWebsite.name}</p>
                <p className="font-mono text-[10px]">{currentWebsite.url}</p>
              </div>
            )}
          </div>

          <div className="mt-1 border-t border-[var(--color-border)] pt-1 space-y-0.5">
            <Link
              href="/onboarding"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs font-semibold text-[var(--color-primary)] hover:bg-[var(--color-surface-muted)] rounded-lg transition-colors"
            >
              <Plus size={14} /> Add New Website
            </Link>
            <Link
              href="/websites"
              onClick={() => setOpen(false)}
              className="flex w-full items-center justify-between px-3 py-1.5 text-[11px] font-medium text-[var(--color-muted)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)] rounded-lg transition-colors"
            >
              <span>Manage &amp; Delete Websites</span>
              <span className="text-[10px] text-[var(--color-primary)]">View All →</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
