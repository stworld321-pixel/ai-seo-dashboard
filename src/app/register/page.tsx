"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Bot,
  Search,
  Globe,
  AlertCircle,
} from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordScore = [
    password.length >= 8,
    /[A-Z]/.test(password) && /[a-z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password) || password.length >= 12,
  ].filter(Boolean).length;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          workspaceName: workspaceName.trim() || undefined,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        data?: { redirectTo?: string };
        error?: { message?: string };
      };

      if (!res.ok) {
        setError(data.error?.message || "Registration failed. Please try again.");
        return;
      }

      // Redirect to the Onboarding wizard after registration completes
      router.push(data.data?.redirectTo || "/onboarding");
      router.refresh();
    } catch {
      setError("Network error while creating your account. Please try again.");
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
              <Sparkles size={13} /> Multi-Site SEO &amp; AI Visibility Suite
            </span>
            <h1 className="text-3xl font-bold tracking-tight leading-tight">
              Rank #1 on Google &amp; AI Answer Engines.
            </h1>
            <p className="text-sm text-stone-300 leading-relaxed">
              Create your workspace to audit unlimited websites, connect Google Search Console &amp;
              GA4, track ChatGPT/Perplexity/Gemini citations, and deploy autonomous SEO &amp; content
              agents.
            </p>
          </div>

          <div className="mt-10 space-y-4">
            {[
              {
                icon: Search,
                title: "Live Search Console & GA4 Telemetry",
                desc: "Verified clicks, impressions, CTR, and keyword rankings per website.",
              },
              {
                icon: Bot,
                title: "Autonomous SEO, GEO, Reddit & X Agents",
                desc: "Multi-agent audits and 1-click CMS publishing with OpenAI, Claude, Gemini & Grok.",
              },
              {
                icon: Globe,
                title: "Multi-Website Workspace Isolation",
                desc: "Manage WordPress, Shopify, Next.js, and custom websites under one roof.",
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
            <ShieldCheck size={15} className="text-emerald-400" /> AES-256-GCM Encrypted Credentials
          </span>
          <span>v2.5 Enterprise</span>
        </div>
      </div>

      {/* Right Registration Form Panel */}
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
              href="/login"
              className="text-xs font-semibold text-[var(--color-primary)] hover:underline"
            >
              Sign in →
            </Link>
          </div>

          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[var(--color-foreground)]">
              Create your account
            </h2>
            <p className="mt-1.5 text-xs text-[var(--color-muted)]">
              Set up your AI SEO Command Center account to launch your dashboard immediately.
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
                htmlFor="name"
                className="block text-xs font-semibold text-[var(--color-foreground)]"
              >
                Full Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Manikandan S"
                className="mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm text-[var(--color-foreground)] shadow-2xs focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-[var(--color-foreground)]"
              >
                Work or Personal Email
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
                  htmlFor="new-password"
                  className="block text-xs font-semibold text-[var(--color-foreground)]"
                >
                  Password
                </label>
                <span className="text-[11px] text-[var(--color-muted)]">Minimum 8 characters</span>
              </div>
              <div className="relative mt-1.5">
                <input
                  id="new-password"
                  name="new-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a strong password"
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

              {password.length > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          passwordScore >= level
                            ? passwordScore <= 2
                              ? "bg-amber-500"
                              : "bg-emerald-600"
                            : "bg-[var(--color-border)]"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-[11px] text-[var(--color-muted)]">
                    {passwordScore <= 1
                      ? "Add numbers or uppercase letters for a stronger password"
                      : passwordScore <= 2
                        ? "Good password strength"
                        : "Strong password"}
                  </p>
                </div>
              )}
            </div>

            <div>
              <label
                htmlFor="organization"
                className="block text-xs font-semibold text-[var(--color-foreground)]"
              >
                Workspace / Agency Name <span className="font-normal text-[var(--color-muted)]">(Optional)</span>
              </label>
              <input
                id="organization"
                name="organization"
                type="text"
                autoComplete="organization"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="e.g. Acme Marketing or My SEO Workspace"
                className="mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm text-[var(--color-foreground)] shadow-2xs focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-3 text-xs font-semibold text-white shadow-sm hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Creating Account &amp; Launching Dashboard…
                </>
              ) : (
                <>
                  Create Account &amp; Open Dashboard
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-xs">
            <div className="flex items-center gap-2 text-[var(--color-muted)]">
              <CheckCircle2 size={14} className="text-[var(--color-success)] shrink-0" />
              <span>Instant access to your SEO Command Center dashboard after registration.</span>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-[var(--color-muted)]">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-[var(--color-primary)] hover:underline"
            >
              Sign in to your account →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
