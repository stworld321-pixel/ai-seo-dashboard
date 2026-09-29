"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Bot,
  Search,
  Globe,
  AlertCircle,
  Lock,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          rememberMe,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        data?: { redirectTo?: string };
        error?: { message?: string };
      };

      if (!res.ok) {
        setError(data.error?.message || "Invalid email or password.");
        return;
      }

      const returnTo =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("returnTo")
          : null;
      router.push(returnTo || data.data?.redirectTo || "/");
      router.refresh();
    } catch {
      setError("Network error while signing in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen w-full lg:grid-cols-12 bg-[var(--color-background)]">
      {/* Left Brand Showcase Panel */}
      <div className="hidden lg:col-span-5 lg:flex lg:flex-col lg:justify-between bg-[#1c1917] p-10 text-white relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary)] text-sm font-bold text-white shadow-md">
              AI
            </div>
            <div>
              <p className="text-base font-bold tracking-tight">AI SEO Command Center</p>
              <p className="text-xs text-stone-400">Autonomous SEO &amp; GEO Growth Platform</p>
            </div>
          </div>

          <div className="mt-14 space-y-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-amber-300">
              <Sparkles size={13} /> Welcome Back to Command Center
            </span>
            <h1 className="text-3xl font-bold tracking-tight leading-tight">
              Your Autonomous SEO &amp; AI Search Headquarters.
            </h1>
            <p className="text-sm text-stone-300 leading-relaxed">
              Sign in to monitor real-time Google Search Console performance, track AI citations,
              generate Page-1 AEO/GEO articles, and manage all your connected websites.
            </p>
          </div>

          <div className="mt-10 space-y-4">
            {[
              {
                icon: Search,
                title: "Google Search Console & GA4 Sync",
                desc: "Direct OAuth 2.0 integration with live query, page, and country telemetry.",
              },
              {
                icon: Bot,
                title: "Multi-Model AI SEO & Content Agents",
                desc: "Switch seamlessly between OpenAI GPT-4o, Claude, Gemini, DeepSeek & Grok.",
              },
              {
                icon: Globe,
                title: "1-Click WordPress & CMS Deployment",
                desc: "Approve internal links, metadata fixes, and full blog posts directly to live sites.",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="flex items-start gap-3.5 rounded-xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary)]/80 text-white">
                    <Icon size={18} />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-white">{item.title}</h3>
                    <p className="mt-0.5 text-xs text-stone-400 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-6 text-xs text-stone-400">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck size={15} className="text-emerald-400" /> Protected by HMAC-SHA256 Sessions
          </span>
          <span>v2.5 Enterprise</span>
        </div>
      </div>

      {/* Right Login Form Panel */}
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:col-span-7 xl:px-20">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary)] text-xs font-bold text-white">
                AI
              </div>
              <span className="text-sm font-bold">AI SEO Command Center</span>
            </div>
            <Link
              href="/register"
              className="text-xs font-semibold text-[var(--color-primary)] hover:underline"
            >
              Create account →
            </Link>
          </div>

          <div>
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
              <Lock size={20} />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-[var(--color-foreground)]">
              Sign in to your account
            </h2>
            <p className="mt-1.5 text-xs text-[var(--color-muted)]">
              Enter your registered email and password to access the AI SEO Command Center.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-5 flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-700"
            >
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-[var(--color-foreground)]"
              >
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm text-[var(--color-foreground)] shadow-2xs focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="current-password"
                  className="block text-xs font-semibold text-[var(--color-foreground)]"
                >
                  Password
                </label>
              </div>
              <div className="relative mt-1.5">
                <input
                  id="current-password"
                  name="current-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 pr-10 text-sm text-[var(--color-foreground)] shadow-2xs focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-[var(--color-muted)]">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                />
                <span>Keep me signed in for 30 days</span>
              </label>

              <Link
                href="/register"
                className="text-xs font-medium text-[var(--color-primary)] hover:underline"
              >
                Need an account?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-3 text-xs font-semibold text-white shadow-sm hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Signing in to Dashboard…
                </>
              ) : (
                <>
                  Sign In to Dashboard
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-[var(--color-muted)]">
            Don&apos;t have an account yet?{" "}
            <Link
              href="/register"
              className="font-semibold text-[var(--color-primary)] hover:underline"
            >
              Create your account →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
