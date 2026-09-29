"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function WebsiteAddForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [cms, setCms] = useState("WORDPRESS");
  const [gscProperty, setGscProperty] = useState("");
  const [ga4PropertyId, setGa4PropertyId] = useState("");
  const [wpUsername, setWpUsername] = useState("");
  const [wpAppPassword, setWpAppPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/websites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          url,
          cms,
          gscProperty: gscProperty.trim() || null,
          ga4PropertyId: ga4PropertyId.trim() || null,
          wpUsername: wpUsername.trim() || undefined,
          wpAppPassword: wpAppPassword.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFeedback(`Error: ${json.error?.message ?? "Failed to connect website"}`);
      } else {
        setFeedback(`Connected "${json.data.name}" (${json.data.url}) and synced CMS catalog.`);
        setName("");
        setUrl("");
        setGscProperty("");
        setGa4PropertyId("");
        setWpUsername("");
        setWpAppPassword("");
        router.refresh();
      }
    } catch (err) {
      setFeedback(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="block text-xs font-medium text-[var(--color-muted)]">
            Website Name
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Acme Store"
            className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-muted)]">
            Website URL
          </label>
          <input
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/"
            className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 font-mono text-xs"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-muted)]">
            CMS Platform
          </label>
          <select
            value={cms}
            onChange={(e) => setCms(e.target.value)}
            className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
          >
            <option value="WORDPRESS">WordPress + WooCommerce</option>
            <option value="SHOPIFY">Shopify</option>
            <option value="NEXTJS">Next.js</option>
            <option value="WEBFLOW">Webflow</option>
            <option value="CUSTOM">Custom CMS</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="block text-xs font-medium text-[var(--color-muted)]">
            GSC Property URL (optional)
          </label>
          <input
            type="text"
            value={gscProperty}
            onChange={(e) => setGscProperty(e.target.value)}
            placeholder="https://example.com/"
            className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 font-mono text-xs"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-muted)]">
            GA4 Property ID (optional)
          </label>
          <input
            type="text"
            value={ga4PropertyId}
            onChange={(e) => setGa4PropertyId(e.target.value)}
            placeholder="524688594"
            className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 font-mono text-xs"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-muted)]">
            WP Username (optional)
          </label>
          <input
            type="text"
            value={wpUsername}
            onChange={(e) => setWpUsername(e.target.value)}
            placeholder="admin@example.com"
            className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-muted)]">
            WP Application Password (encrypted)
          </label>
          <input
            type="password"
            value={wpAppPassword}
            onChange={(e) => setWpAppPassword(e.target.value)}
            placeholder="xxxx xxxx xxxx xxxx"
            className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 font-mono text-xs"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-[var(--color-primary-fg)] hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Connecting & Syncing..." : "Connect Website & Sync"}
        </button>
        {feedback ? (
          <span className="text-xs font-medium text-[var(--color-muted)]">{feedback}</span>
        ) : null}
      </div>
    </form>
  );
}
