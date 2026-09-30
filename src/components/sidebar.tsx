"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  Bot,
  CreditCard,
  FileText,
  Gauge,
  Globe,
  Layers,
  Link2,
  LogIn,
  LogOut,
  Menu,
  MessageSquare,
  Search,
  Settings,
  Share2,
  Shield,
  ShieldCheck,
  Sparkles,
  Target,
  UserPlus,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { cn } from "@/lib/format";

type Item = { href: string; label: string; icon?: React.ElementType };
type Group = { label?: string; items: Item[] };

type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  isAdmin?: boolean;
  role?: string;
  plan?: string;
  creditsRemaining?: number;
  creditsTotal?: number;
  orgName?: string;
};

const GROUPS: Group[] = [
  {
    items: [{ href: "/", label: "Dashboard", icon: Gauge }],
  },
  {
    label: "Websites",
    items: [
      { href: "/onboarding", label: "Add Website", icon: Sparkles },
      { href: "/settings", label: "Website Settings", icon: Settings },
    ],
  },
  {
    label: "SEO",
    items: [
      { href: "/performance/search-console", label: "SEO Overview", icon: Search },
      { href: "/seo/keywords", label: "Keywords", icon: Target },
      { href: "/seo/pages", label: "Pages", icon: FileText },
      { href: "/seo/technical", label: "Technical Audit", icon: Wrench },
      { href: "/seo/opportunities", label: "Content Opportunities", icon: Sparkles },
      { href: "/content/generator", label: "Blog & Brief Generator", icon: FileText },
      { href: "/content/internal-links", label: "Internal Links", icon: Link2 },
    ],
  },
  {
    label: "AI Search",
    items: [
      { href: "/ai-visibility", label: "AI Visibility", icon: Sparkles },
      { href: "/ai-visibility/prompts", label: "Prompt Tracker", icon: Search },
      { href: "/geo-agent", label: "GEO Agent", icon: Bot },
      { href: "/ai-visibility/citations", label: "Citation Tracker", icon: Link2 },
      { href: "/ai-visibility/audit", label: "Weekly AI Audit", icon: Gauge },
    ],
  },
  {
    label: "AI Agents",
    items: [
      { href: "/seo-agent", label: "SEO Agent", icon: Target },
      { href: "/article-agent", label: "Article Agent", icon: FileText },
      { href: "/reddit-agent", label: "Reddit Agent", icon: Activity },
      { href: "/x-agent", label: "X Influencer Agent", icon: Globe },
    ],
  },
  {
    label: "Integrations",
    items: [
      { href: "/integrations", label: "All Integrations", icon: Layers },
      { href: "/integrations/publishing", label: "Publishing & Deployment", icon: Wrench },
      { href: "/automation/activity", label: "Activity Log", icon: Activity },
    ],
  },
  {
    label: "Settings & Plans",
    items: [
      { href: "/settings", label: "Settings & API Keys", icon: Settings },
      { href: "/pricing", label: "Plans & Pricing", icon: CreditCard },
    ],
  },
];

const ADMIN_TABS = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "users", label: "Users Management", icon: Users },
  { id: "ai_models", label: "AI Model Integrations", icon: Bot },
  { id: "developer_connect", label: "Developer Connect (X & Reddit)", icon: Share2 },
  { id: "google_auth", label: "Google Auth & OAuth", icon: Shield },
  { id: "whatsapp", label: "WhatsApp Messenger & API", icon: MessageSquare },
  { id: "plans_payments", label: "Plans & Payments", icon: CreditCard },
  { id: "websites", label: "Websites Directory", icon: Globe },
];

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const isAdminPage = pathname.startsWith("/admin");
  const isStandaloneAuthPage =
    pathname === "/login" || pathname === "/register" || pathname === "/onboarding";

  const currentAdminTab = searchParams.get("tab") || "overview";

  useEffect(() => {
    if (isStandaloneAuthPage) return;
    let active = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        setUser(data?.data?.user ?? data?.user ?? null);
        setAuthChecked(true);
      })
      .catch(() => {
        if (!active) return;
        setAuthChecked(true);
      });
    return () => {
      active = false;
    };
  }, [pathname, isStandaloneAuthPage]);

  if (isStandaloneAuthPage) {
    return null;
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/login");
    router.refresh();
  }

  function buildHref(baseHref: string): string {
    if (baseHref === "/onboarding" || baseHref === "/websites") return baseHref;
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const w = sp.get("website");
      if (w) return `${baseHref}?website=${encodeURIComponent(w)}`;
    }
    return baseHref;
  }

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() || "AD";

  // Dedicated SuperAdmin Sidebar Content (8 Tabs ONLY)
  if (isAdminPage) {
    const adminNavContent = (
      <div className="flex min-h-full flex-col justify-between">
        <div>
          {/* Admin Header */}
          <div className="flex h-14 items-center justify-between gap-2 border-b border-[var(--color-border)] px-5 bg-indigo-950/20">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600 text-xs font-bold text-white shadow-xs">
                <ShieldCheck size={16} />
              </div>
              <div className="leading-tight">
                <p className="text-sm font-bold text-indigo-500">SuperAdmin</p>
                <p className="text-[10px] text-[var(--color-muted)]">Command Center</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="rounded p-1 text-[var(--color-muted)] hover:text-[var(--color-foreground)] lg:hidden"
              aria-label="Close navigation"
            >
              <X size={18} />
            </button>
          </div>

          {/* 8 Admin Tabs List */}
          <nav className="px-3 py-4">
            <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-indigo-500">
              Admin Governance ({ADMIN_TABS.length} Modules)
            </p>
            <ul className="space-y-1">
              {ADMIN_TABS.map((tab) => {
                const active = currentAdminTab === tab.id;
                const Icon = tab.icon;

                return (
                  <li key={tab.id}>
                    <Link
                      href={`/admin?tab=${tab.id}`}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors",
                        active
                          ? "bg-indigo-600 font-semibold text-white shadow-xs"
                          : "text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)]",
                      )}
                    >
                      <Icon size={16} className={active ? "text-white" : "text-indigo-500"} />
                      <span>{tab.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>

            {/* Exit to User Dashboard */}
            <div className="mt-6 border-t border-[var(--color-border)] pt-4">
              <Link
                href="/"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)] transition-colors"
              >
                <ArrowLeft size={14} />
                Return to User Dashboard
              </Link>
            </div>
          </nav>
        </div>

        {/* Admin Footer & Profile */}
        <div className="border-t border-[var(--color-border)] p-3">
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-2.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white shadow-xs">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-xs font-semibold text-[var(--color-foreground)]">
                    {user?.name || "SuperAdmin"}
                  </p>
                  <span className="shrink-0 rounded bg-indigo-500/10 px-1 py-0.5 text-[9px] font-bold text-indigo-500 border border-indigo-500/20 leading-none">
                    ADMIN
                  </span>
                </div>
                <p className="truncate text-[11px] text-[var(--color-muted)]">{user?.email || "Administrator"}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-foreground)] transition-colors hover:bg-red-50 hover:text-red-600 hover:border-red-200"
            >
              <LogOut size={13} />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );

    return (
      <>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="fixed bottom-4 right-4 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg lg:hidden"
          aria-label="Open admin navigation"
        >
          <Menu size={20} />
        </button>

        {mobileOpen ? (
          <div
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <aside
              className="h-full w-64 overflow-y-auto border-r border-[var(--color-border)] bg-[var(--color-surface)]"
              onClick={(e) => e.stopPropagation()}
            >
              {adminNavContent}
            </aside>
          </div>
        ) : null}

        <aside className="hidden w-64 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] lg:block">
          {adminNavContent}
        </aside>
      </>
    );
  }

  // Standard User Dashboard Navigation
  const navContent = (
    <div className="flex min-h-full flex-col justify-between">
      <div>
        <div className="flex h-14 items-center justify-between gap-2 border-b border-[var(--color-border)] px-5">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-primary)] text-xs font-bold text-[var(--color-primary-fg)]">
              AI
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold">SEO Command</p>
              <p className="text-[10px] text-[var(--color-muted)]">Growth Platform</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded p-1 text-[var(--color-muted)] hover:text-[var(--color-foreground)] lg:hidden"
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="px-3 py-4">
          {GROUPS.map((group, gi) => (
            <div key={gi} className={cn(gi > 0 && "mt-5")}>
              {group.label ? (
                <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  {group.label}
                </p>
              ) : null}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = pathname === item.href;
                  const Icon = item.icon;
                  const userPlan = (user?.plan || "BASIC").toUpperCase();
                  const isBasic = userPlan === "BASIC" || userPlan === "STARTER";
                  const isLockedAgent =
                    !user?.isAdmin &&
                    isBasic &&
                    (item.href === "/geo-agent" ||
                      item.href === "/article-agent" ||
                      item.href === "/reddit-agent" ||
                      item.href === "/x-agent");

                  return (
                    <li key={`${group.label ?? "root"}-${item.href}`}>
                      <Link
                        href={buildHref(item.href)}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "flex items-center justify-between gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                          active
                            ? "bg-[var(--color-primary)] font-medium text-[var(--color-primary-fg)]"
                            : "text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)]",
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {Icon ? <Icon size={15} /> : null}
                          <span className="truncate">{item.label}</span>
                        </div>
                        {isLockedAgent && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded font-bold uppercase bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                            PRO ⭐
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {user?.isAdmin ? (
            <div className="mt-5 border-t border-[var(--color-border)] pt-4">
              <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-500 flex items-center gap-1.5">
                <ShieldCheck size={12} /> Administration
              </p>
              <ul className="space-y-0.5">
                <li>
                  <Link
                    href="/admin"
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
                      pathname === "/admin"
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30",
                    )}
                  >
                    <ShieldCheck size={15} />
                    SuperAdmin Command Center
                  </Link>
                </li>
              </ul>
            </div>
          ) : null}
        </nav>
      </div>

      <div className="border-t border-[var(--color-border)] p-3">
        {user ? (
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-2.5 space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white shadow-xs">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-xs font-semibold text-[var(--color-foreground)]">
                    {user.name || "Workspace Member"}
                  </p>
                  {user.isAdmin ? (
                    <span className="shrink-0 rounded bg-indigo-500/10 px-1 py-0.5 text-[9px] font-bold text-indigo-500 border border-indigo-500/20 leading-none">
                      ADMIN
                    </span>
                  ) : (
                    <span className="shrink-0 rounded bg-indigo-500/10 px-1 py-0.5 text-[9px] font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 leading-none">
                      {user.plan === "ENTERPRISE" ? "ENTERPRISE" : user.plan === "PRO" ? "PRO ⭐" : "BASIC"}
                    </span>
                  )}
                </div>
                <p className="truncate text-[11px] text-[var(--color-muted)]">{user.email}</p>
              </div>
            </div>

            {/* Credits bar */}
            <div className="pt-1.5 border-t border-[var(--color-border)] flex items-center justify-between text-[11px]">
              <span className="text-[var(--color-muted)] flex items-center gap-1">
                ⚡ <span className="font-semibold text-[var(--color-foreground)]">{(user.creditsRemaining ?? 5000).toLocaleString()}</span> credits
              </span>
              <Link
                href="/pricing"
                className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                + Upgrade
              </Link>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-foreground)] transition-colors hover:bg-red-50 hover:text-red-600 hover:border-red-200"
            >
              <LogOut size={13} />
              Sign Out
            </button>
          </div>
        ) : authChecked ? (
          <div className="space-y-1.5">
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="flex w-full items-center justify-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-muted)]"
            >
              <LogIn size={13} />
              Sign In
            </Link>
            <Link
              href="/register"
              onClick={() => setMobileOpen(false)}
              className="flex w-full items-center justify-center gap-1.5 rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary-fg)] transition-colors hover:opacity-90"
            >
              <UserPlus size={13} />
              Create Account
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed bottom-4 right-4 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-primary)] text-[var(--color-primary-fg)] shadow-lg lg:hidden"
        aria-label="Open navigation"
      >
        <Menu size={20} />
      </button>

      {mobileOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <aside
            className="h-full w-64 overflow-y-auto border-r border-[var(--color-border)] bg-[var(--color-surface)]"
            onClick={(e) => e.stopPropagation()}
          >
            {navContent}
          </aside>
        </div>
      ) : null}

      <aside className="hidden w-60 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] lg:block">
        {navContent}
      </aside>
    </>
  );
}
