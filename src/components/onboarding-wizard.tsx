"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bot,
  Check,
  CheckCircle2,
  ExternalLink,
  FileCode,
  Globe,
  Key,
  Layers,
  Loader2,
  Lock,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

type Step = 1 | 2 | 3 | 4;

type TechResult = {
  url: string;
  normalizedUrl: string;
  isReachable: boolean;
  httpStatus: number | null;
  isHttps: boolean;
  title: string | null;
  faviconUrl: string | null;
  detectedCms: string;
  detectedFramework: string;
  detectedHosting: string;
  hasSitemap: boolean;
  hasRobotsTxt: boolean;
  hasSchema: boolean;
  schemaTypes: string[];
  hasGoogleAnalytics: boolean;
  hasGoogleTagManager: boolean;
  wordCount: number;
};

export function OnboardingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Step 1 = Add Domain & Website
  // Step 2 = Website Login / CMS (Optional)
  // Step 3 = GSC Connect (Optional or Later)
  // Step 4 = Complete -> Dashboard
  const [step, setStep] = useState<Step>(1);

  // Step 1 State: Website & Domain
  const [url, setUrl] = useState("");
  const [siteName, setSiteName] = useState("");
  const [cms, setCms] = useState<"WORDPRESS" | "SHOPIFY" | "WEBFLOW" | "NEXTJS" | "REACT" | "LARAVEL" | "CUSTOM">("WORDPRESS");
  const [country, setCountry] = useState("IND");
  const [analyzing, setAnalyzing] = useState(false);
  const [websiteId, setWebsiteId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<TechResult | null>(null);
  const [step1Error, setStep1Error] = useState<string | null>(null);

  // Step 2 State: Login / CMS Credentials (Optional)
  const [loginMode, setLoginMode] = useState<"none" | "wordpress" | "custom">("none");
  const [loginUrl, setLoginUrl] = useState("");
  const [wpUsername, setWpUsername] = useState("");
  const [wpAppPassword, setWpAppPassword] = useState("");
  const [savingCreds, setSavingCreds] = useState(false);

  // Step 3 State: Google Search Console (Optional or Later)
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);

  // Check if returning from Google OAuth redirect (e.g. ?google=connected&website=...)
  useEffect(() => {
    const googleParam = searchParams.get("google");
    const siteParam = searchParams.get("website");
    const stepParam = searchParams.get("step");

    if (siteParam) {
      setWebsiteId(siteParam);
    }

    if (googleParam === "connected") {
      setGoogleConnected(true);
      setStep(4);
    } else if (stepParam === "gsc") {
      setStep(3);
    } else if (stepParam === "login") {
      setStep(2);
    }
  }, [searchParams]);

  // Clean and normalize domain URL
  function normalizeUrl(input: string): string {
    let raw = input.trim();
    if (!raw) return "";
    if (!raw.startsWith("http://") && !raw.startsWith("https://")) {
      raw = `https://${raw}`;
    }
    return raw;
  }

  // STEP 1: Add Domain & Website
  async function handleAddDomain(e: React.FormEvent) {
    e.preventDefault();
    setStep1Error(null);

    const formattedUrl = normalizeUrl(url);
    if (!formattedUrl) {
      setStep1Error("Please enter a valid website domain or URL.");
      return;
    }

    setAnalyzing(true);
    let detectedAnalysis: TechResult | null = null;

    // Optional quick technology detection
    try {
      const analyzeRes = await fetch("/api/websites/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: formattedUrl }),
      });
      if (analyzeRes.ok) {
        const analyzeData = (await analyzeRes.json()) as { data?: TechResult };
        if (analyzeData.data) {
          detectedAnalysis = analyzeData.data;
          setAnalysis(detectedAnalysis);
          if (detectedAnalysis.detectedCms.toUpperCase().includes("WORDPRESS")) {
            setCms("WORDPRESS");
          } else if (detectedAnalysis.detectedCms.toUpperCase().includes("SHOPIFY")) {
            setCms("SHOPIFY");
          }
        }
      }
    } catch {
      // Continue even if quick scan times out
    }

    // Create the website in database
    try {
      const hostname = new URL(formattedUrl).hostname.replace(/^www\./, "");
      const finalName = siteName.trim() || detectedAnalysis?.title || hostname;

      const createRes = await fetch("/api/websites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: finalName,
          url: formattedUrl,
          cms,
          country,
        }),
      });

      const createData = (await createRes.json()) as { data?: { id: string } };
      if (!createRes.ok || !createData.data?.id) {
        setStep1Error("Failed to save website. Please check the domain and try again.");
        return;
      }

      const newId = createData.data.id;
      setWebsiteId(newId);
      document.cookie = `active_website_id=${encodeURIComponent(newId)}; path=/; max-age=31536000; samesite=lax`;

      // Set default login URL suggestion based on domain
      setLoginUrl(`${formattedUrl.replace(/\/+$/, "")}/wp-login.php`);

      // Advance to Step 2: Website Login (Optional)
      setStep(2);
    } catch {
      setStep1Error("Could not connect to server. Please verify your connection.");
    } finally {
      setAnalyzing(false);
    }
  }

  // STEP 2: Save Login Credentials (Optional) or Skip
  async function handleSaveCredentials(skip = false) {
    if (!websiteId) {
      setStep(3);
      return;
    }

    if (skip || loginMode === "none") {
      setStep(3);
      return;
    }

    setSavingCreds(true);
    try {
      if (loginMode === "wordpress" && wpUsername.trim() && wpAppPassword.trim()) {
        await fetch(`/api/websites/${websiteId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cms: "WORDPRESS",
            loginUrl: loginUrl.trim() || undefined,
            wpUsername: wpUsername.trim(),
            wpAppPassword: wpAppPassword.trim(),
          }),
        });
      }
      setStep(3);
    } catch {
      // Allow proceeding even if credentials fail verification
      setStep(3);
    } finally {
      setSavingCreds(false);
    }
  }

  // STEP 3: Connect Google OAuth
  async function handleConnectGoogle() {
    setConnectingGoogle(true);
    try {
      const res = await fetch(`/api/integrations/google/auth?websiteId=${websiteId || ""}`);
      const data = (await res.json()) as { url?: string; error?: { message?: string } };
      if (data.url) {
        if (data.url.startsWith("/onboarding")) {
          setGoogleConnected(true);
          setStep(4);
          return;
        }
        window.location.href = data.url;
      } else {
        alert(data.error?.message || "Google OAuth client is not configured yet. You can connect later from the dashboard.");
      }
    } catch {
      alert("Failed to initialize Google OAuth. You can connect later from your dashboard.");
    } finally {
      setConnectingGoogle(false);
    }
  }

  // Finish and Go to Dashboard
  function handleGoToDashboard() {
    if (websiteId) {
      document.cookie = `active_website_id=${encodeURIComponent(websiteId)}; path=/; max-age=31536000; samesite=lax`;
      router.push(`/?website=${encodeURIComponent(websiteId)}`);
    } else {
      router.push("/");
    }
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Top Header & Breadcrumb */}
      <div className="mb-6 flex items-center justify-between border-b border-[var(--color-border)] pb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-primary)] text-xs font-bold text-[var(--color-primary-fg)]">
            AI
          </div>
          <span className="text-sm font-semibold tracking-tight">Website Onboarding</span>
        </div>
        <Link
          href="/"
          className="text-xs text-[var(--color-muted)] hover:text-[var(--color-foreground)] transition-colors"
        >
          Exit to Dashboard →
        </Link>
      </div>

      {/* Progress Steps Bar */}
      <div className="mb-8 grid grid-cols-3 gap-2 text-center text-xs">
        <div
          className={`flex items-center justify-center gap-2 rounded-lg border p-2.5 transition-all ${
            step === 1
              ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 font-semibold text-[var(--color-primary)]"
              : step > 1
                ? "border-green-500/30 bg-green-500/5 text-[var(--color-success)]"
                : "border-[var(--color-border)] text-[var(--color-muted)]"
          }`}
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-surface-muted)] text-[10px] font-bold">
            {step > 1 ? "✓" : "1"}
          </span>
          <span>Add Domain</span>
        </div>

        <div
          className={`flex items-center justify-center gap-2 rounded-lg border p-2.5 transition-all ${
            step === 2
              ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 font-semibold text-[var(--color-primary)]"
              : step > 2
                ? "border-green-500/30 bg-green-500/5 text-[var(--color-success)]"
                : "border-[var(--color-border)] text-[var(--color-muted)]"
          }`}
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-surface-muted)] text-[10px] font-bold">
            {step > 2 ? "✓" : "2"}
          </span>
          <span>Login (Optional)</span>
        </div>

        <div
          className={`flex items-center justify-center gap-2 rounded-lg border p-2.5 transition-all ${
            step === 3
              ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 font-semibold text-[var(--color-primary)]"
              : step > 3
                ? "border-green-500/30 bg-green-500/5 text-[var(--color-success)]"
                : "border-[var(--color-border)] text-[var(--color-muted)]"
          }`}
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-surface-muted)] text-[10px] font-bold">
            {step > 3 ? "✓" : "3"}
          </span>
          <span>GSC (Optional)</span>
        </div>
      </div>

      {/* STEP 1: ADD DOMAIN */}
      {step === 1 && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-7 shadow-sm sm:p-9">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-primary)] text-white shadow-sm">
            <Globe size={24} />
          </div>

          <h2 className="mt-4 text-xl font-bold tracking-tight text-[var(--color-foreground)]">
            Step 1: Add Your Website Domain
          </h2>
          <p className="mt-1 text-xs text-[var(--color-muted)] leading-relaxed">
            Enter your website address to initialize autonomous SEO scanning, page cataloging, and keyword opportunities.
          </p>

          {step1Error && (
            <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600">
              {step1Error}
            </div>
          )}

          <form onSubmit={handleAddDomain} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-foreground)]">
                Website Domain or URL <span className="text-red-500">*</span>
              </label>
              <div className="relative mt-1.5">
                <input
                  type="text"
                  required
                  placeholder="example.com or https://example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3.5 py-2.5 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>
              <p className="mt-1 text-[11px] text-[var(--color-muted)]">
                Enter your bare domain (e.g. example.com) or full URL. We will format it automatically.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-foreground)]">
                  Website / Brand Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. My Website"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-foreground)]">
                  Primary CMS / Framework
                </label>
                <select
                  value={cms}
                  onChange={(e) => setCms(e.target.value as typeof cms)}
                  className="mt-1.5 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                >
                  <option value="WORDPRESS">WordPress (Rank Math / Yoast)</option>
                  <option value="SHOPIFY">Shopify</option>
                  <option value="NEXTJS">Next.js / React</option>
                  <option value="WEBFLOW">Webflow</option>
                  <option value="LARAVEL">Laravel / PHP</option>
                  <option value="CUSTOM">Custom HTML / Headless</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-foreground)]">
                Target Market / Region
              </label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              >
                <option value="IND">India (IND)</option>
                <option value="USA">United States (USA)</option>
                <option value="GBR">United Kingdom (GBR)</option>
                <option value="CAN">Canada (CAN)</option>
                <option value="AUS">Australia (AUS)</option>
                <option value="SGP">Singapore (SGP)</option>
                <option value="ARE">United Arab Emirates (UAE)</option>
              </select>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={analyzing || !url.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] py-3 text-sm font-semibold text-[var(--color-primary-fg)] transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {analyzing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Analyzing &amp; Saving Domain…</span>
                  </>
                ) : (
                  <>
                    <span>Save Domain &amp; Continue</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* STEP 2: WEBSITE LOGIN (OPTIONAL) */}
      {step === 2 && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-7 shadow-sm sm:p-9 space-y-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600">
            <Lock size={24} />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-[var(--color-foreground)]">
                Step 2: Website Login &amp; CMS
              </h2>
              <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-blue-600">
                Optional
              </span>
            </div>
            <p className="mt-1 text-xs text-[var(--color-muted)] leading-relaxed">
              Add your website login credentials if you want AI agents to automatically publish articles and update SEO meta tags. If you prefer manual copy/export, you can skip this step safely.
            </p>
          </div>

          {/* Mode Selector */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div
              onClick={() => setLoginMode("none")}
              className={`cursor-pointer rounded-lg border p-4 transition-all ${
                loginMode === "none"
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5"
                  : "border-[var(--color-border)] hover:bg-[var(--color-surface-muted)]"
              }`}
            >
              <div className="flex items-center gap-2">
                <FileCode size={18} className="text-[var(--color-primary)]" />
                <p className="text-xs font-semibold text-[var(--color-foreground)]">
                  Manual Content Export (Zero Login)
                </p>
              </div>
              <p className="mt-1.5 text-[11px] text-[var(--color-muted)] leading-relaxed">
                Generate SEO briefs, articles, and schema markup without giving any passwords. Copy &amp; paste anytime.
              </p>
            </div>

            <div
              onClick={() => setLoginMode("wordpress")}
              className={`cursor-pointer rounded-lg border p-4 transition-all ${
                loginMode === "wordpress"
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5"
                  : "border-[var(--color-border)] hover:bg-[var(--color-surface-muted)]"
              }`}
            >
              <div className="flex items-center gap-2">
                <Key size={18} className="text-[var(--color-primary)]" />
                <p className="text-xs font-semibold text-[var(--color-foreground)]">
                  WordPress Application Password
                </p>
              </div>
              <p className="mt-1.5 text-[11px] text-[var(--color-muted)] leading-relaxed">
                Sync drafts directly to your WordPress site using a secure Application Password (encrypted with AES-256).
              </p>
            </div>
          </div>

          {/* WordPress Login Form (if selected) */}
          {loginMode === "wordpress" && (
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[var(--color-foreground)]">
                  WordPress Login / Admin URL
                </label>
                <input
                  type="text"
                  placeholder="https://example.com/wp-login.php"
                  value={loginUrl}
                  onChange={(e) => setLoginUrl(e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block font-semibold text-[var(--color-foreground)]">
                    WP Username / Email
                  </label>
                  <input
                    type="text"
                    placeholder="admin or editor@example.com"
                    value={wpUsername}
                    onChange={(e) => setWpUsername(e.target.value)}
                    className="mt-1.5 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[var(--color-foreground)]">
                    Application Password
                  </label>
                  <input
                    type="password"
                    placeholder="xxxx xxxx xxxx xxxx"
                    value={wpAppPassword}
                    onChange={(e) => setWpAppPassword(e.target.value)}
                    className="mt-1.5 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  />
                </div>
              </div>

              <p className="text-[11px] text-[var(--color-muted)] leading-relaxed">
                💡 To create an Application Password in WordPress: Go to <strong>Users → Profile → Application Passwords</strong>, enter &quot;AI SEO Agent&quot;, and paste the generated 16-character code above.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[var(--color-border)]">
            <button
              type="button"
              onClick={() => handleSaveCredentials(true)}
              className="w-full sm:w-auto px-4 py-2.5 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-foreground)] transition-colors"
            >
              Skip this step (Optional) →
            </button>

            <button
              type="button"
              disabled={savingCreds}
              onClick={() => handleSaveCredentials(false)}
              className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-6 py-2.5 text-xs font-semibold text-[var(--color-primary-fg)] hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {savingCreds ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Saving…</span>
                </>
              ) : (
                <>
                  <span>{loginMode === "none" ? "Continue without Login" : "Save & Continue"}</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: GSC CONNECT (OPTIONAL OR LATER) */}
      {step === 3 && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-7 shadow-sm sm:p-9 space-y-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
            <Search size={24} />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-[var(--color-foreground)]">
                Step 3: Connect Google Search Console &amp; GA4
              </h2>
              <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-blue-600">
                Optional or Later
              </span>
            </div>
            <p className="mt-1 text-xs text-[var(--color-muted)] leading-relaxed">
              Link your official Google account to sync live Google Search Console impressions, clicks, queries, and GA4 visitor traffic. You can also connect anytime later directly from your dashboard.
            </p>
          </div>

          {/* Value Props */}
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 space-y-2.5 text-xs">
            <div className="flex items-center gap-2 font-semibold text-[var(--color-foreground)]">
              <ShieldCheck size={16} className="text-[var(--color-success)]" />
              <span>Official Google OAuth 2.0 (Read-Only)</span>
            </div>
            <ul className="ml-6 list-disc space-y-1 text-[var(--color-muted)] text-[11px]">
              <li>Sync real search queries, average positions, impressions, and CTR</li>
              <li>Track keyword ranking movements over 28-day intervals</li>
              <li>Read-only scopes: we never edit or modify your Google Search Console settings</li>
            </ul>
          </div>

          {/* Action Cards */}
          <div className="space-y-3">
            <button
              type="button"
              disabled={connectingGoogle}
              onClick={handleConnectGoogle}
              className="flex w-full items-center justify-center gap-2.5 rounded-lg bg-[#4285F4] py-3 text-xs font-semibold text-white hover:bg-[#3367D6] transition-colors disabled:opacity-50 shadow-sm"
            >
              {connectingGoogle ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
              )}
              <span>Connect with Google Search Console</span>
            </button>

            <button
              type="button"
              onClick={() => setStep(4)}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-2.5 text-xs font-medium text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)] transition-colors"
            >
              <span>Connect Later / Skip to Dashboard</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: ONBOARDING COMPLETE -> DASHBOARD */}
      {step === 4 && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-7 text-center shadow-sm sm:p-10 space-y-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-green-500/10 text-[var(--color-success)] shadow-sm">
            <CheckCircle2 size={32} />
          </div>

          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[var(--color-foreground)]">
              Your SEO Workspace is Ready!
            </h2>
            <p className="mt-1 text-xs text-[var(--color-muted)] max-w-md mx-auto">
              Your website is configured. AI SEO agents and deterministic crawlers are primed for keyword discovery, technical audits, and performance tracking.
            </p>
          </div>

          {/* Configured Summary */}
          <div className="mx-auto max-w-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 text-left text-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-muted)]">Website Domain</span>
              <span className="font-mono font-medium text-[var(--color-foreground)] truncate max-w-[180px]">
                {url ? normalizeUrl(url) : "Configured"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-muted)]">CMS / Login</span>
              <span className="font-medium text-[var(--color-foreground)]">
                {loginMode === "wordpress" && wpUsername ? "WordPress Connected" : "Manual Export (Zero Login)"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-muted)]">Google Search Console</span>
              <span className={googleConnected ? "font-medium text-[var(--color-success)]" : "text-[var(--color-muted)]"}>
                {googleConnected ? "✓ Connected" : "Connect Later (Available on Dashboard)"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-muted)]">AI Audit Engines</span>
              <span className="font-medium text-[var(--color-primary)]">
                ✓ 4 Agents Ready
              </span>
            </div>
          </div>

          {/* Launch Dashboard Button */}
          <button
            type="button"
            onClick={handleGoToDashboard}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-8 py-3 text-sm font-semibold text-[var(--color-primary-fg)] hover:opacity-90 shadow-md transition-all"
          >
            <span>Launch Command Center Dashboard</span>
            <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
