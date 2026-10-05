"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  KeyRound,
  Copy,
  Check,
} from "lucide-react";

export function GoogleConnectPanel({
  websiteId,
  websiteName,
  websiteUrl,
  isGscConnected,
  isGa4Connected,
  currentGscProperty,
  currentGa4PropertyId,
}: {
  websiteId: string;
  websiteName: string;
  websiteUrl: string;
  isGscConnected: boolean;
  isGa4Connected: boolean;
  currentGscProperty: string | null;
  currentGa4PropertyId: string | null;
}) {
  const router = useRouter();
  const [gscInput, setGscInput] = useState(currentGscProperty || websiteUrl);
  const [ga4Input, setGa4Input] = useState(currentGa4PropertyId || "");
  const [savingGsc, setSavingGsc] = useState(false);
  const [savingGa4, setSavingGa4] = useState(false);
  const [needsOAuthSetup, setNeedsOAuthSetup] = useState(false);
  const [authMode, setAuthMode] = useState<"oauth" | "token">("oauth");
  const [redirectUri, setRedirectUri] = useState(
    "http://localhost:3000/api/integrations/google/callback",
  );
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setRedirectUri(`${window.location.origin}/api/integrations/google/callback`);
    }
  }, []);

  function copyToClipboard(text: string, field: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  }

  async function handleOAuthConnect() {
    setSavingGsc(true);
    setMessage(null);
    setErrorMsg(null);
    try {
      const res = await fetch(
        `/api/integrations/google/auth?websiteId=${encodeURIComponent(websiteId)}`,
      );
      const data = (await res.json()) as {
        url?: string;
        needsOAuthConfig?: boolean;
        redirectUri?: string;
        error?: { message?: string };
      };
      if (data.redirectUri) {
        setRedirectUri(data.redirectUri);
      }
      if (data.url && data.url.startsWith("https://accounts.google.com")) {
        window.location.href = data.url;
        return;
      }
      if (data.needsOAuthConfig) {
        setNeedsOAuthSetup(true);
      }
    } catch {
      setErrorMsg("Unable to initialize Google OAuth sign-in.");
    } finally {
      setSavingGsc(false);
    }
  }

  async function handleSaveOAuthAndRedirect(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId.trim() || !clientSecret.trim()) {
      setErrorMsg("Please enter both Google OAuth Client ID and Client Secret.");
      return;
    }
    setSavingGsc(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/integrations/google/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteId,
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim(),
        }),
      });
      const data = (await res.json()) as { url?: string; error?: { message?: string } };
      if (data.url && data.url.startsWith("https://accounts.google.com")) {
        window.location.href = data.url;
        return;
      }
      setErrorMsg(data.error?.message || "Failed to generate Google OAuth URL.");
    } finally {
      setSavingGsc(false);
    }
  }

  async function handleConnectWithToken(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken.trim()) {
      setErrorMsg("Please paste a valid Google OAuth Access Token (ya29....).");
      return;
    }
    setSavingGsc(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/integrations/google/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteId,
          accessToken: accessToken.trim(),
          gscProperty: gscInput.trim() || websiteUrl,
          ga4PropertyId: ga4Input.trim() || undefined,
        }),
      });
      const data = (await res.json()) as {
        data?: { email?: string; rowsSynced?: number };
        error?: { message?: string };
      };
      if (!res.ok) {
        setErrorMsg(data.error?.message || "Google Search Console verification failed.");
        return;
      }
      setNeedsOAuthSetup(false);
      setMessage(
        `Connected Gmail account${data.data?.email ? ` (${data.data.email})` : ""} and synced ${data.data?.rowsSynced ?? 0} Search Console rows.`,
      );
      router.refresh();
    } finally {
      setSavingGsc(false);
    }
  }

  async function handleDisconnectGoogle() {
    setSavingGsc(true);
    setMessage(null);
    setErrorMsg(null);
    try {
      const res = await fetch(
        `/api/integrations/google/connect?websiteId=${encodeURIComponent(websiteId)}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        setMessage(`Disconnected Google Search Console & GA4 for ${websiteName}.`);
        router.refresh();
      }
    } finally {
      setSavingGsc(false);
    }
  }

  async function handleSaveGsc(e: React.FormEvent) {
    e.preventDefault();
    if (!gscInput.trim()) return;
    if (!isGscConnected) {
      setNeedsOAuthSetup(true);
      setErrorMsg("Please sign in with your Gmail account first before selecting a GSC property.");
      return;
    }
    setSavingGsc(true);
    setMessage(null);
    try {
      const res = await fetch("/api/integrations/google/gsc/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteId,
          propertyUrl: gscInput.trim(),
        }),
      });
      if (res.ok) {
        setMessage(`Updated Search Console property: ${gscInput.trim()}`);
        router.refresh();
      }
    } finally {
      setSavingGsc(false);
    }
  }

  async function handleSaveGa4(e: React.FormEvent) {
    e.preventDefault();
    if (!ga4Input.trim()) return;
    if (!isGscConnected && !isGa4Connected) {
      setNeedsOAuthSetup(true);
      setErrorMsg("Please sign in with your Gmail account first before linking a GA4 property.");
      return;
    }
    setSavingGa4(true);
    setMessage(null);
    try {
      const res = await fetch("/api/integrations/google/ga4/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteId,
          propertyId: ga4Input.trim(),
          propertyName: websiteName,
        }),
      });
      if (res.ok) {
        setMessage(`Updated GA4 Property ID: ${ga4Input.trim()}`);
        router.refresh();
      }
    } finally {
      setSavingGa4(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
              isGscConnected && isGa4Connected
                ? "bg-emerald-500/10 text-emerald-600"
                : "bg-amber-500/10 text-amber-600"
            }`}
          >
            {isGscConnected && isGa4Connected ? (
              <CheckCircle2 size={22} />
            ) : (
              <AlertCircle size={22} />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[var(--color-foreground)]">
                Google Account Status for {websiteName}
              </h3>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  isGscConnected && isGa4Connected
                    ? "bg-emerald-500/10 text-emerald-700"
                    : "bg-amber-500/10 text-amber-700"
                }`}
              >
                {isGscConnected && isGa4Connected
                  ? "Connected"
                  : isGscConnected || isGa4Connected
                    ? "Partially Connected"
                    : "Not Connected"}
              </span>
            </div>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              {isGscConnected && isGa4Connected
                ? `Search Console and GA4 are authenticated via Google OAuth for ${websiteUrl}.`
                : `Google Search Console and GA4 are not connected yet for ${websiteUrl}. Click "Connect with Google" to sign in with your Gmail account.`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(isGscConnected || isGa4Connected) && (
            <button
              type="button"
              disabled={savingGsc}
              onClick={handleDisconnectGoogle}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-500/20 disabled:opacity-50"
            >
              Disconnect Google
            </button>
          )}
          <button
            type="button"
            disabled={savingGsc}
            onClick={handleOAuthConnect}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#4285F4] px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#3367D6] disabled:opacity-50"
          >
            {savingGsc ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
            {isGscConnected ? "Reconnect Gmail Account" : "Connect with Google (Gmail)"}
          </button>
        </div>
      </div>

      {message && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-700">
          {message}
        </div>
      )}

      {errorMsg && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-600">
          {errorMsg}
        </div>
      )}

      {needsOAuthSetup && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
            <div className="flex items-center gap-2 font-semibold text-[var(--color-foreground)]">
              <KeyRound size={15} className="text-[#4285F4]" />
              <span>Sign in with Gmail for {websiteName}</span>
            </div>
            <div className="flex gap-1 rounded-lg bg-[var(--color-surface-muted)] p-1">
              <button
                type="button"
                onClick={() => setAuthMode("oauth")}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                  authMode === "oauth"
                    ? "bg-[var(--color-surface)] text-[var(--color-foreground)] shadow-sm"
                    : "text-[var(--color-muted)]"
                }`}
              >
                Google OAuth Client
              </button>
              <button
                type="button"
                onClick={() => setAuthMode("token")}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                  authMode === "token"
                    ? "bg-[var(--color-surface)] text-[var(--color-foreground)] shadow-sm"
                    : "text-[var(--color-muted)]"
                }`}
              >
                OAuth Access Token
              </button>
            </div>
          </div>

          {authMode === "oauth" ? (
            <form onSubmit={handleSaveOAuthAndRedirect} className="space-y-4">
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] text-[var(--color-foreground)] space-y-2">
                <p className="font-semibold text-amber-700 dark:text-amber-400">
                  Google Cloud Console Configuration Guide:
                </p>
                <p className="text-[var(--color-muted)] leading-relaxed">
                  To avoid <strong>Error 400: redirect_uri_mismatch (&ldquo;Access blocked: This app&apos;s request is invalid&rdquo;)</strong>, add the exact URLs below to your OAuth 2.0 Web Client in{" "}
                  <a
                    href="https://console.cloud.google.com/apis/credentials"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[var(--color-primary)] font-medium underline"
                  >
                    Google Cloud Console <ExternalLink size={10} />
                  </a>:
                </p>

                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between gap-2 rounded bg-[var(--color-surface)] p-2 border border-[var(--color-border)]">
                    <div className="overflow-hidden">
                      <span className="block text-[10px] text-[var(--color-muted)] uppercase tracking-wider font-semibold">Authorized JavaScript origin</span>
                      <code className="block font-mono text-[11px] truncate text-[var(--color-foreground)]">
                        {typeof window !== "undefined" ? window.location.origin : "https://ai-seo-dashboard-gold.vercel.app"}
                      </code>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(typeof window !== "undefined" ? window.location.origin : "https://ai-seo-dashboard-gold.vercel.app", "origin")}
                      className="inline-flex shrink-0 items-center gap-1 rounded bg-[var(--color-surface-muted)] px-2 py-1 text-[10px] font-medium hover:bg-[var(--color-surface-hover)] transition-colors"
                    >
                      {copiedField === "origin" ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                      {copiedField === "origin" ? "Copied" : "Copy"}
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2 rounded bg-[var(--color-surface)] p-2 border border-[var(--color-border)]">
                    <div className="overflow-hidden">
                      <span className="block text-[10px] text-[var(--color-muted)] uppercase tracking-wider font-semibold">Authorized redirect URI</span>
                      <code className="block font-mono text-[11px] truncate text-[var(--color-foreground)]">
                        {redirectUri}
                      </code>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(redirectUri, "redirectUri")}
                      className="inline-flex shrink-0 items-center gap-1 rounded bg-[var(--color-surface-muted)] px-2 py-1 text-[10px] font-medium hover:bg-[var(--color-surface-hover)] transition-colors"
                    >
                      {copiedField === "redirectUri" ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                      {copiedField === "redirectUri" ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>

                <p className="text-[10px] text-[var(--color-muted)]">
                  <strong>Tip:</strong> If your OAuth Consent Screen is in <em>Testing</em> mode, also add your Gmail to <strong>OAuth consent screen &gt; Test users</strong>.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="block font-medium text-[var(--color-foreground)]">
                    Google OAuth Client ID
                  </label>
                  <input
                    type="text"
                    required
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="xxxx-xxxxxxxxxxxxxxxx.apps.googleusercontent.com"
                    className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 font-mono text-xs focus:border-[#4285F4] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[var(--color-foreground)]">
                    Google OAuth Client Secret
                  </label>
                  <input
                    type="password"
                    required
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder="GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx"
                    className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 font-mono text-xs focus:border-[#4285F4] focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={savingGsc}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#4285F4] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#3367D6] disabled:opacity-50"
              >
                {savingGsc ? <Loader2 size={14} className="animate-spin" /> : null}
                Save &amp; Redirect to Gmail Sign-In
              </button>
            </form>
          ) : (
            <form onSubmit={handleConnectWithToken} className="space-y-3">
              <p className="text-[11px] text-[var(--color-muted)] leading-relaxed">
                Or authorize your Gmail account in{" "}
                <a
                  href="https://developers.google.com/oauthplayground/#step1&apisSelect=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fwebmasters.readonly%2Chttps%3A%2F%2Fwww.googleapis.com%2Fauth%2Fanalytics.readonly%2Chttps%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.email&url=https%3A%2F%2F&content_type=application%2Fjson&http_method=GET&useDefaultOauthCred=unchecked"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[var(--color-primary)] underline"
                >
                  Google OAuth 2.0 Playground <ExternalLink size={10} />
                </a>{" "}
                and paste your live <code className="font-mono">Access token</code> below:
              </p>

              <div>
                <label className="block font-medium text-[var(--color-foreground)]">
                  Google OAuth Access Token
                </label>
                <input
                  type="password"
                  required
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="ya29.a0AX..."
                  className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 font-mono text-xs focus:border-[#4285F4] focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={savingGsc}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#4285F4] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#3367D6] disabled:opacity-50"
              >
                {savingGsc ? <Loader2 size={14} className="animate-spin" /> : null}
                Verify Gmail Account &amp; Sync Search Console Data
              </button>
            </form>
          )}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <form
          onSubmit={handleSaveGsc}
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search size={16} className="text-[var(--color-primary)]" />
              <h4 className="text-sm font-semibold">Google Search Console</h4>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                isGscConnected
                  ? "bg-emerald-500/10 text-emerald-700"
                  : "bg-amber-500/10 text-amber-700"
              }`}
            >
              {isGscConnected ? "✓ Connected" : "Not Connected"}
            </span>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-muted)]">
              Search Console Property URL (or sc-domain:)
            </label>
            <input
              type="text"
              value={gscInput}
              onChange={(e) => setGscInput(e.target.value)}
              placeholder={websiteUrl}
              className="mt-1.5 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 font-mono text-xs focus:border-[var(--color-primary)] focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={savingGsc}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {savingGsc ? <Loader2 size={13} className="animate-spin" /> : null}
            {isGscConnected ? "Update GSC Property" : "Sign in with Gmail to Link GSC"}
          </button>
        </form>

        <form
          onSubmit={handleSaveGa4}
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 size={16} className="text-[var(--color-primary)]" />
              <h4 className="text-sm font-semibold">Google Analytics 4 (GA4)</h4>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                isGa4Connected
                  ? "bg-emerald-500/10 text-emerald-700"
                  : "bg-amber-500/10 text-amber-700"
              }`}
            >
              {isGa4Connected ? "✓ Connected" : "Not Connected"}
            </span>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-muted)]">
              GA4 Property ID (Numeric ID, e.g. 524688594)
            </label>
            <input
              type="text"
              value={ga4Input}
              onChange={(e) => setGa4Input(e.target.value)}
              placeholder="Enter GA4 Property ID"
              className="mt-1.5 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 font-mono text-xs focus:border-[var(--color-primary)] focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={savingGa4}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {savingGa4 ? <Loader2 size={13} className="animate-spin" /> : null}
            {isGa4Connected ? "Update GA4 Property" : "Sign in with Gmail to Link GA4"}
          </button>
        </form>
      </div>
    </div>
  );
}
