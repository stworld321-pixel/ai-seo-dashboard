"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/card";
import { StatusBadge } from "@/components/badges";
import type {
  AiProviderId,
  ConfiguredAiModel,
} from "@/server/integrations/llm/provider";

type WebsiteData = {
  id: string;
  name: string;
  url: string;
  automationLevel: number;
  timezone: string;
  country: string;
  sitemapUrl: string | null;
  robotsUrl: string | null;
  ga4PropertyId: string | null;
};

const LEVEL_DESCRIPTIONS: Record<number, string> = {
  1: "Level 1 — Analysis only: sync + analyze + detect opportunities",
  2: "Level 2 — Recommendations (default): + briefs, suggested titles/metas/links (nothing written)",
  3: "Level 3 — Content drafts: + generate drafts, store as AWAITING_APPROVAL",
  4: "Level 4 — Auto-publish approved: + publish human-approved items; auto-apply low-risk fixes",
  5: "Level 5 — Fully automated: + auto-approve non-destructive changes (delete/canonical/redirect remain hard-gated)",
};

const PROVIDER_OPTIONS: {
  id: AiProviderId;
  label: string;
  defaultModel: string;
  placeholder: string;
  suggestions: string[];
}[] = [
  {
    id: "openai",
    label: "ChatGPT (OpenAI)",
    defaultModel: "gpt-4o",
    placeholder: "Type model name, e.g. gpt-4o, gpt-4.1, o3-mini",
    suggestions: ["gpt-4o", "gpt-4.1", "gpt-4o-mini", "o3-mini", "o1"],
  },
  {
    id: "anthropic",
    label: "Claude (Anthropic)",
    defaultModel: "claude-sonnet-4-5",
    placeholder: "Type model name, e.g. claude-sonnet-4-5, claude-opus-4-1",
    suggestions: [
      "claude-sonnet-4-5",
      "claude-3-7-sonnet-latest",
      "claude-opus-4-1",
      "claude-3-5-haiku-latest",
    ],
  },
  {
    id: "gemini",
    label: "Gemini (Google AI)",
    defaultModel: "gemini-2.5-pro",
    placeholder: "Type model name, e.g. gemini-2.5-pro, gemini-2.5-flash",
    suggestions: [
      "gemini-2.5-pro",
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-1.5-pro",
    ],
  },
  {
    id: "custom",
    label: "Custom / OpenRouter (OpenAI-Compatible)",
    defaultModel: "openai/gpt-4o",
    placeholder: "Type any model ID, e.g. anthropic/claude-3.7-sonnet",
    suggestions: [
      "openai/gpt-4o",
      "anthropic/claude-3.7-sonnet",
      "google/gemini-2.5-pro",
      "deepseek/deepseek-r1",
    ],
  },
];

export function SettingsClient({
  website,
  initialAiModels,
}: {
  website: WebsiteData;
  initialAiModels: ConfiguredAiModel[];
}) {
  const router = useRouter();
  const [name, setName] = useState(website.name);
  const [automationLevel, setAutomationLevel] = useState(website.automationLevel);
  const [timezone, setTimezone] = useState(website.timezone);
  const [country, setCountry] = useState(website.country);
  const [sitemapUrl, setSitemapUrl] = useState(website.sitemapUrl ?? "");
  const [robotsUrl, setRobotsUrl] = useState(website.robotsUrl ?? "");
  const [ga4PropertyId, setGa4PropertyId] = useState(website.ga4PropertyId ?? "");
  const [wpUsername, setWpUsername] = useState("");
  const [wpAppPassword, setWpAppPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  // AI Model Configuration State
  const [aiModels, setAiModels] = useState<ConfiguredAiModel[]>(initialAiModels);
  const activeExisting = initialAiModels.find((m) => m.isActive) ?? initialAiModels[0];
  const [aiProvider, setAiProvider] = useState<AiProviderId>(
    activeExisting?.provider ?? "openai",
  );
  const [aiModelName, setAiModelName] = useState<string>(
    activeExisting?.model ?? "gpt-4o",
  );
  const [aiApiKey, setAiApiKey] = useState<string>("");
  const [aiBaseUrl, setAiBaseUrl] = useState<string>(activeExisting?.baseUrl ?? "");
  const [aiSetActive, setAiSetActive] = useState<boolean>(true);
  const [savingAi, setSavingAi] = useState<boolean>(false);
  const [aiMsg, setAiMsg] = useState<string | null>(null);

  const selectedProviderMeta =
    PROVIDER_OPTIONS.find((p) => p.id === aiProvider) ?? PROVIDER_OPTIONS[0]!;

  function handleProviderChange(nextProvider: AiProviderId) {
    setAiProvider(nextProvider);
    const existing = aiModels.find((m) => m.provider === nextProvider);
    if (existing) {
      setAiModelName(existing.model);
      setAiBaseUrl(existing.baseUrl ?? "");
    } else {
      const meta = PROVIDER_OPTIONS.find((p) => p.id === nextProvider);
      setAiModelName(meta?.defaultModel ?? "");
      setAiBaseUrl("");
    }
  }

  async function handleSaveWebsite(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSavedMsg(null);
    try {
      const res = await fetch("/api/settings/website", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteId: website.id,
          name,
          automationLevel,
          timezone,
          country,
          sitemapUrl,
          robotsUrl,
          ga4PropertyId,
          ...(wpUsername && wpAppPassword ? { wpUsername, wpAppPassword } : {}),
        }),
      });
      if (res.ok) {
        setSavedMsg("Settings saved (credentials encrypted with AES-256-GCM when supplied).");
        setWpAppPassword("");
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAiModel(e: React.FormEvent) {
    e.preventDefault();
    if (!aiModelName.trim()) return;
    setSavingAi(true);
    setAiMsg(null);
    try {
      const res = await fetch("/api/settings/website", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteId: website.id,
          aiModel: {
            provider: aiProvider,
            model: aiModelName.trim(),
            apiKey: aiApiKey.trim() || undefined,
            baseUrl: aiBaseUrl.trim() || undefined,
            setActive: aiSetActive,
          },
        }),
      });
      const json = await res.json();
      if (res.ok) {
        if (json.aiModels) setAiModels(json.aiModels);
        setAiApiKey("");
        setAiMsg(
          `Saved ${selectedProviderMeta.label} with model "${aiModelName.trim()}"${
            aiSetActive ? " as active default." : "."
          }`,
        );
        router.refresh();
      }
    } finally {
      setSavingAi(false);
    }
  }

  async function handleActivateModel(id: string) {
    const res = await fetch("/api/settings/website", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        websiteId: website.id,
        setActiveAiIntegrationId: id,
      }),
    });
    const json = await res.json();
    if (res.ok && json.aiModels) {
      setAiModels(json.aiModels);
      router.refresh();
    }
  }

  async function handleDeleteModel(id: string) {
    const res = await fetch("/api/settings/website", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        websiteId: website.id,
        deleteAiIntegrationId: id,
      }),
    });
    const json = await res.json();
    if (res.ok && json.aiModels) {
      setAiModels(json.aiModels);
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      {/* AI Models Configuration Section */}
      <Card>
        <CardHeader
          title="AI Models & LLM Providers (ChatGPT, Claude, Gemini)"
          subtitle="Add AI providers, type the exact model ID to use for SEO briefs/drafts, and store encrypted API keys"
        />
        <div className="grid gap-6 p-5 xl:grid-cols-2">
          <form onSubmit={handleSaveAiModel} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[var(--color-muted)]">
                1. Choose AI Provider
              </label>
              <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {PROVIDER_OPTIONS.map((p) => {
                  const selected = aiProvider === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleProviderChange(p.id)}
                      className={`rounded-md border px-3 py-2 text-left text-xs font-medium transition ${
                        selected
                          ? "border-[var(--color-accent)] bg-[var(--color-accent-subtle)] text-[var(--color-accent)]"
                          : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)] hover:bg-[var(--color-surface-muted)]"
                      }`}
                    >
                      {p.id === "openai"
                        ? "ChatGPT"
                        : p.id === "anthropic"
                          ? "Claude"
                          : p.id === "gemini"
                            ? "Gemini"
                            : "Custom"}
                      <span className="block truncate text-[10px] font-normal opacity-75">
                        {p.id === "openai"
                          ? "OpenAI"
                          : p.id === "anthropic"
                            ? "Anthropic"
                            : p.id === "gemini"
                              ? "Google AI"
                              : "OpenRouter"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--color-muted)]">
                2. Model Name / Type to Use ({selectedProviderMeta.label})
              </label>
              <input
                type="text"
                value={aiModelName}
                onChange={(e) => setAiModelName(e.target.value)}
                required
                placeholder={selectedProviderMeta.placeholder}
                className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 font-mono text-sm"
              />
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-[var(--color-muted)]">Quick fill:</span>
                {selectedProviderMeta.suggestions.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setAiModelName(m)}
                    className={`rounded border px-2 py-0.5 font-mono text-[11px] transition ${
                      aiModelName === m
                        ? "border-[var(--color-accent)] bg-[var(--color-accent-subtle)] text-[var(--color-accent)]"
                        : "border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-muted)] hover:text-[var(--color-fg)]"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-[var(--color-muted)]">
                  3. API Key (AES-256-GCM Encrypted)
                </label>
                <input
                  type="password"
                  value={aiApiKey}
                  onChange={(e) => setAiApiKey(e.target.value)}
                  placeholder={
                    aiProvider === "openai"
                      ? "sk-..."
                      : aiProvider === "anthropic"
                        ? "sk-ant-..."
                        : aiProvider === "gemini"
                          ? "AIzaSy..."
                          : "sk-or-..."
                  }
                  className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 font-mono text-sm"
                />
                <p className="mt-1 text-[10px] text-[var(--color-muted)]">
                  Leave blank to keep existing stored key or use environment variable.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-muted)]">
                  Base URL (Optional Proxy / Endpoint)
                </label>
                <input
                  type="text"
                  value={aiBaseUrl}
                  onChange={(e) => setAiBaseUrl(e.target.value)}
                  placeholder={
                    aiProvider === "openai"
                      ? "https://api.openai.com/v1"
                      : aiProvider === "anthropic"
                        ? "https://api.anthropic.com/v1"
                        : aiProvider === "gemini"
                          ? "https://generativelanguage.googleapis.com/v1beta"
                          : "https://openrouter.ai/api/v1"
                  }
                  className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 font-mono text-sm"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={aiSetActive}
                onChange={(e) => setAiSetActive(e.target.checked)}
                className="rounded border-[var(--color-border)]"
              />
              <span>Set as active default model for AI SEO Agents &amp; Content Generator</span>
            </label>

            {aiMsg ? (
              <p className="rounded-md bg-[var(--color-success-bg)] px-3 py-2 text-xs text-[var(--color-success)]">
                {aiMsg}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={savingAi}
              className="w-full rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-fg)] hover:opacity-90 disabled:opacity-50"
            >
              {savingAi
                ? "Saving AI Model..."
                : `Add / Update ${selectedProviderMeta.label} Model`}
            </button>
          </form>

          {/* Configured Models List */}
          <div className="flex flex-col justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)]/40 p-4">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  Configured AI Models ({aiModels.length})
                </p>
                {aiModels.find((m) => m.isActive) ? (
                  <span className="font-mono text-xs text-[var(--color-accent)]">
                    Active: {aiModels.find((m) => m.isActive)?.model}
                  </span>
                ) : null}
              </div>

              {aiModels.length === 0 ? (
                <div className="mt-6 rounded-md border border-dashed border-[var(--color-border)] p-6 text-center text-xs text-[var(--color-muted)]">
                  No AI models added yet. Select <strong>ChatGPT</strong>, <strong>Claude</strong>, or{" "}
                  <strong>Gemini</strong> on the left and type the model name to use.
                </div>
              ) : (
                <div className="mt-3 space-y-2.5">
                  {aiModels.map((m) => (
                    <div
                      key={m.id}
                      className={`flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 ${
                        m.isActive
                          ? "border-[var(--color-accent)] bg-[var(--color-surface)]"
                          : "border-[var(--color-border)] bg-[var(--color-surface)]/80"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold">{m.providerLabel}</span>
                          {m.isActive ? (
                            <StatusBadge status="Active Model" tone="success" />
                          ) : (
                            <StatusBadge status="Standby" tone="neutral" />
                          )}
                        </div>
                        <p className="mt-1 font-mono text-xs font-medium text-[var(--color-accent)]">
                          Model: {m.model}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">
                          Key: {m.hasApiKey ? "AES-256-GCM Encrypted" : "Not set (Deterministic fallback)"}
                          {m.baseUrl ? ` · ${m.baseUrl}` : ""}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {!m.isActive ? (
                          <button
                            type="button"
                            onClick={() => handleActivateModel(m.id)}
                            className="rounded border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--color-accent-subtle)] hover:text-[var(--color-accent)]"
                          >
                            Use Model
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => {
                            setAiProvider(m.provider);
                            setAiModelName(m.model);
                            setAiBaseUrl(m.baseUrl ?? "");
                          }}
                          className="rounded border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteModel(m.id)}
                          className="rounded border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p className="mt-4 text-[11px] text-[var(--color-muted)]">
              All LLM outputs pass through the deterministic SEO QA Gate (keyword density ≤ 3.5%,
              unsourced-statistic guard, and SERP pixel bounds) before entering the approval queue.
            </p>
          </div>
        </div>
      </Card>

      {/* Website & CMS Configuration Form */}
      <form onSubmit={handleSaveWebsite} className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Project & Autonomy Configuration"
            subtitle={website.url}
          />
          <div className="space-y-4 p-5">
            <div>
              <label className="block text-xs font-medium text-[var(--color-muted)]">
                Website Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--color-muted)]">
                Automation Level (1–5)
              </label>
              <select
                value={automationLevel}
                onChange={(e) => setAutomationLevel(Number(e.target.value))}
                className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
              >
                {[1, 2, 3, 4, 5].map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {LEVEL_DESCRIPTIONS[lvl]}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-[var(--color-muted)]">
                Destructive actions (delete page, redirect, canonical change, robots.txt) are
                hard-gated at every level.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[var(--color-muted)]">
                  Timezone
                </label>
                <input
                  type="text"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-muted)]">
                  Target Country (ISO-3)
                </label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[var(--color-muted)]">
                  Sitemap URL
                </label>
                <input
                  type="text"
                  value={sitemapUrl}
                  onChange={(e) => setSitemapUrl(e.target.value)}
                  placeholder="https://example.com/sitemap_index.xml"
                  className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-muted)]">
                  Robots.txt URL
                </label>
                <input
                  type="text"
                  value={robotsUrl}
                  onChange={(e) => setRobotsUrl(e.target.value)}
                  placeholder="https://example.com/robots.txt"
                  className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="CMS & Analytics Credentials"
            subtitle="Secrets are encrypted with AES-256-GCM before storage"
          />
          <div className="space-y-4 p-5">
            <div>
              <label className="block text-xs font-medium text-[var(--color-muted)]">
                Google Analytics 4 Property ID
              </label>
              <input
                type="text"
                value={ga4PropertyId}
                onChange={(e) => setGa4PropertyId(e.target.value)}
                placeholder="e.g. properties/123456789"
                className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
              />
            </div>

            <div className="border-t border-[var(--color-border)] pt-4">
              <p className="text-xs font-semibold">
                WordPress Application Password (Self-Hosted REST API)
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">
                Used by <code className="font-mono">WordPressProvider</code> to update Rank Math SEO
                titles &amp; meta descriptions after approval.
              </p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-[var(--color-muted)]">
                    WP Username
                  </label>
                  <input
                    type="text"
                    value={wpUsername}
                    onChange={(e) => setWpUsername(e.target.value)}
                    placeholder="admin"
                    className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--color-muted)]">
                    WP Application Password
                  </label>
                  <input
                    type="password"
                    value={wpAppPassword}
                    onChange={(e) => setWpAppPassword(e.target.value)}
                    placeholder="xxxx xxxx xxxx xxxx"
                    className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>

            {savedMsg ? (
              <p className="rounded-md bg-[var(--color-success-bg)] px-3 py-2 text-xs text-[var(--color-success)]">
                {savedMsg}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-fg)] hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving Settings..." : "Save Website & CMS Settings"}
            </button>
          </div>
        </Card>
      </form>
    </div>
  );
}
