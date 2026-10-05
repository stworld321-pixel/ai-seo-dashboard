"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  BarChart3,
  Loader2,
  ShieldCheck,
  CheckCircle2,
  KeyRound,
  AlertCircle,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";

export function GoogleConnectCard({
  websiteId,
  websiteName,
  websiteUrl,
}: {
  websiteId: string;
  websiteName: string;
  websiteUrl: string;
}) {
  const router = useRouter();
  const [connecting, setConnecting] = useState(false);
  const [needsOAuthSetup, setNeedsOAuthSetup] = useState(false);
  const [authMode, setAuthMode] = useState<"oauth" | "token">("oauth");
  const [redirectUri, setRedirectUri] = useState(
    "http://localhost:3000/api/integrations/google/callback",
  );
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [accessToken, setAccessToken] = useState("");
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

  async function handleStartGoogleSignIn() {
    setConnecting(true);
    setErrorMsg(null);
    try {
      const authRes = await fetch(
        `/api/integrations/google/auth?websiteId=${encodeURIComponent(websiteId)}`,
      );
      const authData = (await authRes.json().catch(() => ({}))) as {
        url?: string;
        needsOAuthConfig?: boolean;
        redirectUri?: string;
        message?: string;
      };

      if (authData.redirectUri) {
        setRedirectUri(authData.redirectUri);
      }

      if (authData.url && authData.url.startsWith("https://accounts.google.com")) {
        window.location.href = authData.url;
        return;
      }

      if (authData.needsOAuthConfig) {
        setNeedsOAuthSetup(true);
      }
    } catch {
      setErrorMsg("Unable to start Google OAuth flow. Please check your connection.");
    } finally {
      setConnecting(false);
    }
  }

  async function handleSaveOAuthAndRedirect(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId.trim() || !clientSecret.trim()) {
      setErrorMsg("Please enter both Google OAuth Client ID and Client Secret.");
      return;
    }
    setConnecting(true);
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
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: { message?: string };
      };
      if (data.url && data.url.startsWith("https://accounts.google.com")) {
        window.location.href = data.url;
        return;
      }
      setErrorMsg(data.error?.message || "Failed to generate Google OAuth URL.");
    } catch {
      setErrorMsg("Failed to save Google OAuth credentials.");
    } finally {
      setConnecting(false);
    }
  }

  async function handleConnectWithToken(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken.trim()) {
      setErrorMsg("Please paste a valid Google OAuth Access Token (ya29....).");
      return;
    }
    setConnecting(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/integrations/google/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteId,
          accessToken: accessToken.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      if (!res.ok) {
        setErrorMsg(
          data.error?.message ||
            "Google Search Console verification failed. Make sure the token has webmasters.readonly scope.",
        );
        return;
      }
      router.refresh();
    } catch {
      setErrorMsg("Failed to verify Google OAuth token.");
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div className="mx-auto my-8 max-w-2xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-sm">
      <div className="flex flex-col items-center text-center">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
            <Search size={24} />
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
            <BarChart3 size={24} />
          </div>
        </div>

        <span className="mt-4 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700">
          Google Search Console &amp; GA4 Not Connected
        </span>

        <h2 className="mt-3 text-xl font-bold tracking-tight text-[var(--color-foreground)]">
          Connect with Google for {websiteName}
        </h2>

        <p className="mt-2 max-w-lg text-xs leading-relaxed text-[var(--color-muted)]">
          Sign in with your Gmail account that owns{" "}
          <span className="font-mono font-medium text-[var(--color-foreground)]">{websiteUrl}</span>{" "}
          in Google Search Console &amp; Google Analytics 4. No demo or fake metrics are shown — real
          Clicks, Impressions, Average Position, CTR, and Traffic charts load after your Gmail
          account is authenticated.
        </p>

        <div className="mt-6 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 text-left text-xs">
          <div className="flex items-center gap-2 font-semibold text-[var(--color-foreground)]">
            <ShieldCheck size={16} className="text-[var(--color-success)]" />
            <span>Official Google OAuth 2.0 (Read-Only Gmail Scopes):</span>
          </div>
          <div className="mt-2.5 grid gap-2 sm:grid-cols-2 text-[var(--color-muted)]">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-[var(--color-success)] shrink-0" />
              <span>Real Search Console Clicks &amp; Impressions</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-[var(--color-success)] shrink-0" />
              <span>Verified Queries, Pages &amp; CTR</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-[var(--color-success)] shrink-0" />
              <span>GA4 Property &amp; Country/Device Telemetry</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-[var(--color-success)] shrink-0" />
              <span>Zero Demo Data — 100% Live Google API</span>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-4 flex w-full items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-left text-xs text-red-600">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {!needsOAuthSetup ? (
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row">
            <button
              type="button"
              disabled={connecting}
              onClick={handleStartGoogleSignIn}
              className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-[#4285F4] px-6 py-3 text-xs font-semibold text-white shadow-sm hover:bg-[#3367D6] disabled:opacity-50 transition-colors"
            >
              {connecting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="#fff"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#fff"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#fff"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#fff"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              )}
              {connecting ? "Redirecting to Google…" : "Connect with Google (Sign in with Gmail)"}
            </button>
          </div>
        ) : (
          <div className="mt-6 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-5 text-left text-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
              <div className="flex items-center gap-2 font-semibold text-[var(--color-foreground)]">
                <KeyRound size={15} className="text-[#4285F4]" />
                <span>Authenticate Gmail Account for Google Search Console &amp; GA4</span>
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
                    To avoid <strong>Error 400: redirect_uri_mismatch (&ldquo;Access blocked: This app&apos;s request is invalid&rdquo;)</strong>, add these exact URLs to your OAuth 2.0 Web Client in{" "}
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
                    className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 font-mono text-xs focus:border-[#4285F4] focus:outline-none"
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
                    className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 font-mono text-xs focus:border-[#4285F4] focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={connecting}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#4285F4] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#3367D6] disabled:opacity-50"
                >
                  {connecting ? <Loader2 size={14} className="animate-spin" /> : null}
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
                  (select Search Console &amp; Analytics read-only scopes, click &quot;Exchange
                  authorization code for tokens&quot;) and paste your live{" "}
                  <code className="font-mono">Access token</code> below:
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
                    className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 font-mono text-xs focus:border-[#4285F4] focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={connecting}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#4285F4] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#3367D6] disabled:opacity-50"
                >
                  {connecting ? <Loader2 size={14} className="animate-spin" /> : null}
                  Verify Gmail Account &amp; Sync Search Console Data
                </button>
              </form>
            )}
          </div>
        )}

        <div className="mt-4">
          <Link
            href={`/integrations/google?website=${encodeURIComponent(websiteId)}`}
            className="text-[11px] font-medium text-[var(--color-primary)] hover:underline"
          >
            Open Google Search Console &amp; GA4 Integration Settings →
          </Link>
        </div>
      </div>
    </div>
  );
}
