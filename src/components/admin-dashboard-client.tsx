"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Users,
  Globe,
  Building,
  Shield,
  ShieldCheck,
  Search,
  ExternalLink,
  Bot,
  Activity,
  Key,
  CheckCircle2,
  ArrowUpRight,
  Sparkles,
  Send,
  MessageSquare,
  CreditCard,
  RefreshCw,
  AlertCircle,
  Save,
  Phone,
  Cpu,
  Share2,
  Lock,
  Zap,
  Trash2,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { Card } from "@/components/card";
import type { SystemSettingItem } from "@/server/services/system-settings";

export type AdminUserItem = {
  id: string;
  email: string;
  name: string | null;
  isAdmin: boolean;
  role: string;
  plan: string;
  status: string;
  phone: string | null;
  createdAt: string;
  organizations: Array<{ id: string; name: string; slug: string }>;
  websiteCount: number;
  websites: Array<{ id: string; name: string; url: string }>;
};

export type AdminWebsiteItem = {
  id: string;
  name: string;
  url: string;
  cms: string;
  orgId: string;
  orgName?: string;
  ownerEmail?: string;
  gscProperty: string | null;
  ga4PropertyId: string | null;
  automationLevel: number;
  createdAt: string;
};

export type AdminStats = {
  totalUsers: number;
  totalOrgs: number;
  totalWebsites: number;
  totalPages: number;
  totalKeywords: number;
  totalIntegrations: number;
  totalOpportunities: number;
  totalAiPrompts: number;
};

type TabType =
  | "overview"
  | "users"
  | "ai_models"
  | "developer_connect"
  | "google_auth"
  | "whatsapp"
  | "telegram"
  | "plans_payments"
  | "websites";

const VALID_TABS = new Set<TabType>([
  "overview",
  "users",
  "ai_models",
  "developer_connect",
  "google_auth",
  "whatsapp",
  "telegram",
  "plans_payments",
  "websites",
]);

export function AdminDashboardClient({
  users: initialUsers,
  websites: initialWebsites,
  stats,
  initialSettings,
  currentAdminEmail,
}: {
  users: AdminUserItem[];
  websites: AdminWebsiteItem[];
  stats: AdminStats;
  initialSettings: Record<string, SystemSettingItem>;
  currentAdminEmail: string;
}) {
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams.get("tab") as TabType | null;

  const [activeTab, setActiveTab] = useState<TabType>(
    tabFromUrl && VALID_TABS.has(tabFromUrl) ? tabFromUrl : "overview",
  );

  useEffect(() => {
    const t = searchParams.get("tab") as TabType | null;
    if (t && VALID_TABS.has(t) && t !== activeTab) {
      setActiveTab(t);
    }
  }, [searchParams, activeTab]);

  function switchTab(tab: TabType) {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.pushState({}, "", url.toString());
    }
  }

  const [users, setUsers] = useState<AdminUserItem[]>(initialUsers);
  const [websites, setWebsites] = useState<AdminWebsiteItem[]>(initialWebsites);
  const [deletingWebsiteId, setDeletingWebsiteId] = useState<string | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>(() => {
    const s: Record<string, string> = {};
    for (const [k, v] of Object.entries(initialSettings)) {
      // Secrets arrive masked ("abcd••••••••wxyz"). Seeding that into a
      // type="password" box is a trap: the mask is invisible, so typing or
      // pasting leaves the bullet run in the value and the server skips the
      // write as "unchanged" — the new secret is silently discarded. Keep
      // secret boxes empty; empty means "leave the stored value alone".
      s[k] = v.isSecret ? "" : v.value;
    }
    return s;
  });

  /** Secret keys that already have a stored value, for the "saved" placeholder. */
  const configuredSecrets = new Set(
    Object.entries(initialSettings)
      .filter(([, v]) => v.isSecret && v.value)
      .map(([k]) => k),
  );

  // Filters & State
  const [userSearch, setUserSearch] = useState("");
  const [userStatusFilter, setUserStatusFilter] = useState<"ALL" | "ACTIVE" | "SUSPENDED">("ALL");
  const [userPlanFilter, setUserPlanFilter] = useState<"ALL" | "STARTER" | "PRO" | "ENTERPRISE">("ALL");
  const [websiteSearch, setWebsiteSearch] = useState("");
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  // Settings Save state
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Connection testing state
  const [testingType, setTestingType] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
    latencyMs?: number;
    provider?: string;
  } | null>(null);

  // Direct WhatsApp Messenger state
  const [waRecipient, setWaRecipient] = useState("");
  const [waMessage, setWaMessage] = useState("");
  const [waSending, setWaSending] = useState(false);
  const [waFeedback, setWaFeedback] = useState<{ ok: boolean; message: string; messageId?: string } | null>(null);

  // Handle setting updates
  function handleSettingChange(key: string, val: string) {
    setSettings((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSaveSettings() {
    setIsSavingSettings(true);
    setSaveSuccessMsg(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (res.ok) {
        setSaveSuccessMsg(`Settings saved and encrypted successfully (${data.data?.updatedCount ?? 0} updated).`);
        setTimeout(() => setSaveSuccessMsg(null), 4000);
      } else {
        alert(data?.error?.message || "Failed to save settings");
      }
    } catch (err: any) {
      alert(err?.message || "Error saving settings");
    } finally {
      setIsSavingSettings(false);
    }
  }

  // Local WhatsApp settings management
  const [isSavingWhatsApp, setIsSavingWhatsApp] = useState(false);
  const [isResettingWhatsApp, setIsResettingWhatsApp] = useState(false);
  const [waSettingsMsg, setWaSettingsMsg] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleSaveWhatsAppSettings() {
    setIsSavingWhatsApp(true);
    setWaSettingsMsg(null);
    try {
      const waKeys = [
        "whatsapp_provider",
        "whatsapp_account_sid",
        "whatsapp_auth_token",
        "whatsapp_from_number",
        "whatsapp_meta_phone_id",
        "whatsapp_meta_account_id",
        "whatsapp_meta_token",
      ];
      const waPayload: Record<string, string> = {};
      for (const k of waKeys) {
        if (settings[k] !== undefined) {
          waPayload[k] = settings[k];
        }
      }
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(waPayload),
      });
      const data = await res.json();
      if (res.ok) {
        setWaSettingsMsg({ ok: true, message: "WhatsApp configuration saved and securely encrypted!" });
        setTimeout(() => setWaSettingsMsg(null), 5000);
      } else {
        setWaSettingsMsg({ ok: false, message: data?.error?.message || "Failed to save WhatsApp settings" });
      }
    } catch (err: any) {
      setWaSettingsMsg({ ok: false, message: err?.message || "Network error saving WhatsApp settings" });
    } finally {
      setIsSavingWhatsApp(false);
    }
  }

  async function handleResetWhatsAppSettings() {
    if (!window.confirm("Are you sure you want to reset all WhatsApp configuration to clean defaults? This will erase all stored tokens and phone IDs.")) {
      return;
    }
    setIsResettingWhatsApp(true);
    setWaSettingsMsg(null);
    try {
      const res = await fetch("/api/admin/whatsapp/reset", {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setSettings((prev) => ({
          ...prev,
          whatsapp_provider: "twilio",
          whatsapp_account_sid: "",
          whatsapp_auth_token: "",
          whatsapp_from_number: "whatsapp:+14155238886",
          whatsapp_meta_phone_id: "",
          whatsapp_meta_account_id: "",
          whatsapp_meta_token: "",
        }));
        setWaSettingsMsg({ ok: true, message: "WhatsApp settings have been reset to clean defaults." });
        setTimeout(() => setWaSettingsMsg(null), 5000);
      } else {
        setWaSettingsMsg({ ok: false, message: data?.error?.message || "Failed to reset WhatsApp settings" });
      }
    } catch (err: any) {
      setWaSettingsMsg({ ok: false, message: err?.message || "Network error resetting WhatsApp settings" });
    } finally {
      setIsResettingWhatsApp(false);
    }
  }

  // Local Telegram settings management
  const [isSavingTelegram, setIsSavingTelegram] = useState(false);
  const [isResettingTelegram, setIsResettingTelegram] = useState(false);
  const [tgSettingsMsg, setTgSettingsMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [tgRecipient, setTgRecipient] = useState("");
  const [tgMessage, setTgMessage] = useState("");
  const [tgSending, setTgSending] = useState(false);
  const [tgFeedback, setTgFeedback] = useState<{ ok: boolean; message: string; messageId?: string } | null>(null);

  async function handleSaveTelegramSettings() {
    setIsSavingTelegram(true);
    setTgSettingsMsg(null);
    try {
      const tgKeys = [
        "telegram_provider",
        "telegram_bot_token",
        "telegram_chat_id",
        "telegram_bot_username",
      ];
      const tgPayload: Record<string, string> = {};
      for (const k of tgKeys) {
        if (settings[k] !== undefined) {
          tgPayload[k] = settings[k];
        }
      }
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tgPayload),
      });
      const data = await res.json();
      if (res.ok) {
        setTgSettingsMsg({ ok: true, message: "Telegram configuration saved and securely encrypted!" });
        setTimeout(() => setTgSettingsMsg(null), 5000);
      } else {
        setTgSettingsMsg({ ok: false, message: data?.error?.message || "Failed to save Telegram settings" });
      }
    } catch (err: any) {
      setTgSettingsMsg({ ok: false, message: err?.message || "Network error saving Telegram settings" });
    } finally {
      setIsSavingTelegram(false);
    }
  }

  async function handleResetTelegramSettings() {
    if (!window.confirm("Are you sure you want to reset Telegram configuration? This will clear your bot token and chat ID.")) {
      return;
    }
    setIsResettingTelegram(true);
    setTgSettingsMsg(null);
    try {
      const tgPayload = {
        telegram_provider: "bot_api",
        telegram_bot_token: "__CLEAR__",
        telegram_chat_id: "",
        telegram_bot_username: "",
      };
      await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tgPayload),
      });
      setSettings((prev) => ({
        ...prev,
        telegram_provider: "bot_api",
        telegram_bot_token: "",
        telegram_chat_id: "",
        telegram_bot_username: "",
      }));
      setTgSettingsMsg({ ok: true, message: "Telegram settings have been reset." });
      setTimeout(() => setTgSettingsMsg(null), 5000);
    } catch (err: any) {
      setTgSettingsMsg({ ok: false, message: err?.message || "Failed to reset Telegram settings" });
    } finally {
      setIsResettingTelegram(false);
    }
  }

  // Handle connection test
  async function runConnectionTest(type: string, provider?: string) {
    setTestingType(provider ? `${type}-${provider}` : type);
    setTestResult(null);
    try {
      // The test runs server-side against STORED settings, so persist the form
      // first. Without this, editing a provider or key and hitting Test silently
      // tests the previously saved values instead of what is on screen.
      await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      const res = await fetch("/api/admin/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, provider, settings }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setTestResult({
        ok: false,
        message: err?.message || "Network test failed.",
      });
    } finally {
      setTestingType(null);
    }
  }

  // Handle user updates (role, plan, status)
  async function handleUpdateUser(userId: string, updates: Partial<AdminUserItem>) {
    setUpdatingUserId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, ...data.data } : u)),
        );
      } else {
        alert(data?.error?.message || "Failed to update user");
      }
    } catch (err: any) {
      alert(err?.message || "Error updating user");
    } finally {
      setUpdatingUserId(null);
    }
  }

  // Handle user deletion
  async function handleDeleteUser(userId: string, email: string) {
    if (
      !window.confirm(
        `Are you sure you want to permanently delete the user "${email}" and all associated workspaces, websites, and data? This action cannot be undone.`,
      )
    ) {
      return;
    }
    setDeletingUserId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== userId));
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data?.error?.message || "Failed to delete user");
      }
    } catch (err: any) {
      alert(err?.message || "Error deleting user");
    } finally {
      setDeletingUserId(null);
    }
  }

  // Handle website deletion
  async function handleDeleteWebsite(siteId: string, siteName: string) {
    if (
      !window.confirm(
        `Are you sure you want to permanently delete "${siteName}" and all associated crawled data, keywords, opportunities, and logs? This action cannot be undone.`,
      )
    ) {
      return;
    }
    setDeletingWebsiteId(siteId);
    try {
      const res = await fetch(`/api/websites/${siteId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setWebsites((prev) => prev.filter((w) => w.id !== siteId));
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data?.error?.message || "Failed to delete website");
      }
    } catch (err: any) {
      alert(err?.message || "Error deleting website");
    } finally {
      setDeletingWebsiteId(null);
    }
  }

  // Handle direct WhatsApp dispatch
  async function handleSendWhatsApp(e: React.FormEvent) {
    e.preventDefault();
    if (!waRecipient || !waMessage) return;

    setWaSending(true);
    setWaFeedback(null);

    try {
      const res = await fetch("/api/admin/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: waRecipient,
          message: waMessage,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setWaFeedback({
          ok: true,
          message: data.simulated
            ? `Sandbox simulated: Message dispatched to ${data.to}`
            : `Message delivered successfully to ${data.to}! (ID: ${data.messageId})`,
          messageId: data.messageId,
        });
        setWaMessage("");
      } else {
        setWaFeedback({
          ok: false,
          message: data?.error?.message || "Failed to send WhatsApp message",
        });
      }
    } catch (err: any) {
      setWaFeedback({
        ok: false,
        message: err?.message || "Network error sending WhatsApp message",
      });
    } finally {
      setWaSending(false);
    }
  }

  // Handle direct Telegram dispatch
  async function handleSendTelegram(e: React.FormEvent) {
    e.preventDefault();
    if (!tgMessage) return;

    setTgSending(true);
    setTgFeedback(null);

    try {
      const res = await fetch("/api/admin/telegram/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: tgRecipient || undefined,
          message: tgMessage,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setTgFeedback({
          ok: true,
          message: `Message delivered successfully to Telegram! (ID: ${data.messageId})`,
          messageId: data.messageId,
        });
        setTgMessage("");
      } else {
        setTgFeedback({
          ok: false,
          message: data?.error?.message || "Failed to send Telegram message",
        });
      }
    } catch (err: any) {
      setTgFeedback({
        ok: false,
        message: err?.message || "Network error sending Telegram message",
      });
    } finally {
      setTgSending(false);
    }
  }

  // Parse subscription plans JSON
  let parsedPlans: Array<{
    id: string;
    name: string;
    priceMonthly: number;
    priceYearly: number;
    currency: string;
    badge: string;
    features: string[];
    limits: { websites: number; keywords: number; aiArticles: number; auditsPerWeek: number; whatsappAlerts: boolean };
    isPopular: boolean;
  }> = [];

  try {
    parsedPlans = JSON.parse(settings.plans_config || "[]");
  } catch {
    parsedPlans = [];
  }

  // Filtered users
  const filteredUsers = users.filter((u) => {
    const q = userSearch.toLowerCase();
    const matchesSearch =
      u.email.toLowerCase().includes(q) ||
      (u.name && u.name.toLowerCase().includes(q)) ||
      u.organizations.some((o) => o.name.toLowerCase().includes(q)) ||
      (u.phone && u.phone.includes(q));

    const matchesStatus =
      userStatusFilter === "ALL" || u.status.toUpperCase() === userStatusFilter;
    const matchesPlan =
      userPlanFilter === "ALL" || u.plan.toUpperCase() === userPlanFilter;

    return matchesSearch && matchesStatus && matchesPlan;
  });

  // Filtered websites
  const filteredWebsites = websites.filter((w) => {
    const q = websiteSearch.toLowerCase();
    return (
      w.name.toLowerCase().includes(q) ||
      w.url.toLowerCase().includes(q) ||
      (w.ownerEmail && w.ownerEmail.toLowerCase().includes(q)) ||
      (w.orgName && w.orgName.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-[var(--color-border)]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-md">
              <ShieldCheck size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">SuperAdmin Command Center</h1>
                <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-indigo-500 border border-indigo-500/20">
                  Tenant Authority & Governance
                </span>
              </div>
              <p className="text-xs text-[var(--color-muted)] mt-0.5">
                Logged in as <span className="font-semibold text-[var(--color-foreground)]">{currentAdminEmail}</span>. Multi-tenant sandboxing active.
              </p>
            </div>
          </div>
        </div>

        {/* Global Save Button if in Settings Tabs */}
        {["ai_models", "developer_connect", "google_auth", "whatsapp", "plans_payments"].includes(activeTab) && (
          <div className="flex items-center gap-3">
            {saveSuccessMsg && (
              <span className="text-xs text-emerald-600 font-medium flex items-center gap-1 animate-fade-in">
                <CheckCircle2 size={14} /> {saveSuccessMsg}
              </span>
            )}
            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={isSavingSettings}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors disabled:opacity-50"
            >
              <Save size={14} />
              {isSavingSettings ? "Saving Settings..." : "Save All Configurations"}
            </button>
          </div>
        )}
      </div>

      {/* Primary Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1 text-xs shadow-xs">
        <button
          type="button"
          onClick={() => switchTab("overview")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
            activeTab === "overview"
              ? "bg-[var(--color-primary)] text-white shadow-xs"
              : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          }`}
        >
          <Activity size={14} />
          Overview
        </button>

        <button
          type="button"
          onClick={() => switchTab("users")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
            activeTab === "users"
              ? "bg-[var(--color-primary)] text-white shadow-xs"
              : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          }`}
        >
          <Users size={14} />
          Users Management ({users.length})
        </button>

        <button
          type="button"
          onClick={() => switchTab("ai_models")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
            activeTab === "ai_models"
              ? "bg-[var(--color-primary)] text-white shadow-xs"
              : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          }`}
        >
          <Bot size={14} />
          AI Model Integrations
        </button>

        <button
          type="button"
          onClick={() => switchTab("developer_connect")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
            activeTab === "developer_connect"
              ? "bg-[var(--color-primary)] text-white shadow-xs"
              : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          }`}
        >
          <Share2 size={14} />
          Developer Connect (X & Reddit)
        </button>

        <button
          type="button"
          onClick={() => switchTab("google_auth")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
            activeTab === "google_auth"
              ? "bg-[var(--color-primary)] text-white shadow-xs"
              : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          }`}
        >
          <Shield size={14} />
          Google Authentication & OAuth
        </button>

        <button
          type="button"
          onClick={() => switchTab("whatsapp")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
            activeTab === "whatsapp"
              ? "bg-[var(--color-primary)] text-white shadow-xs"
              : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          }`}
        >
          <MessageSquare size={14} />
          WhatsApp Messenger & API
        </button>

        <button
          type="button"
          onClick={() => switchTab("plans_payments")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
            activeTab === "plans_payments"
              ? "bg-[var(--color-primary)] text-white shadow-xs"
              : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          }`}
        >
          <CreditCard size={14} />
          Plans & Payments (Stripe / Razorpay)
        </button>

        <button
          type="button"
          onClick={() => switchTab("websites")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
            activeTab === "websites"
              ? "bg-[var(--color-primary)] text-white shadow-xs"
              : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          }`}
        >
          <Globe size={14} />
          Websites Directory ({websites.length})
        </button>
      </div>

      {/* Global Connection Test Result Feedback Banner */}
      {testResult && (
        <div
          className={`p-4 rounded-xl border flex items-start justify-between gap-3 text-xs ${
            testResult.ok
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
              : "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400"
          }`}
        >
          <div className="flex items-start gap-2.5">
            {testResult.ok ? (
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" />
            ) : (
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-500" />
            )}
            <div>
              <p className="font-semibold text-sm">
                {testResult.ok ? "Connection Verification Successful" : "Connection Test Failed"}
              </p>
              <p className="mt-0.5">{testResult.message}</p>
              {testResult.latencyMs !== undefined && (
                <p className="mt-1 font-mono text-[10px] opacity-80">Roundtrip Latency: {testResult.latencyMs}ms</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setTestResult(null)}
            className="text-[11px] underline opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 1: OVERVIEW */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* KPI Cards Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="p-4 bg-[var(--color-surface)] border border-[var(--color-border)]">
              <div className="flex items-center justify-between text-[var(--color-muted)]">
                <span className="text-xs font-medium">Registered Accounts</span>
                <Users size={16} className="text-indigo-500" />
              </div>
              <p className="mt-2 text-2xl font-bold">{stats.totalUsers}</p>
              <p className="mt-1 text-[11px] text-[var(--color-muted)]">Strict tenant segregation</p>
            </Card>

            <Card className="p-4 bg-[var(--color-surface)] border border-[var(--color-border)]">
              <div className="flex items-center justify-between text-[var(--color-muted)]">
                <span className="text-xs font-medium">Workspaces</span>
                <Building size={16} className="text-emerald-500" />
              </div>
              <p className="mt-2 text-2xl font-bold">{stats.totalOrgs}</p>
              <p className="mt-1 text-[11px] text-[var(--color-muted)]">Independent organizations</p>
            </Card>

            <Card className="p-4 bg-[var(--color-surface)] border border-[var(--color-border)]">
              <div className="flex items-center justify-between text-[var(--color-muted)]">
                <span className="text-xs font-medium">Projects Monitored</span>
                <Globe size={16} className="text-blue-500" />
              </div>
              <p className="mt-2 text-2xl font-bold">{stats.totalWebsites}</p>
              <p className="mt-1 text-[11px] text-[var(--color-muted)]">{stats.totalPages} indexed pages</p>
            </Card>

            <Card className="p-4 bg-[var(--color-surface)] border border-[var(--color-border)]">
              <div className="flex items-center justify-between text-[var(--color-muted)]">
                <span className="text-xs font-medium">AI Insights & Audits</span>
                <Sparkles size={16} className="text-amber-500" />
              </div>
              <p className="mt-2 text-2xl font-bold">{stats.totalOpportunities + stats.totalAiPrompts}</p>
              <p className="mt-1 text-[11px] text-[var(--color-muted)]">{stats.totalKeywords} tracked queries</p>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card className="p-5 border border-[var(--color-border)] space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold flex items-center gap-2">
                    <Shield size={16} className="text-indigo-500" />
                    Multi-Tenant Sandboxing & Cross-Project Isolation
                  </h2>
                  <span className="flex items-center gap-1 text-[11px] text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full font-medium border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle2 size={12} /> Strict Partitioning Active
                  </span>
                </div>
                <p className="text-xs text-[var(--color-muted)] leading-relaxed">
                  Each user account operates inside their dedicated organization boundary. Websites, Google OAuth tokens, Search Console properties, GA4 IDs, WordPress REST keys, Reddit/X engagement feeds, and content drafts belong strictly to their owner.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] text-xs">
                    <span className="font-semibold block text-[var(--color-foreground)]">Zero Cross-Tenant Leakage</span>
                    <span className="text-[11px] text-[var(--color-muted)]">
                      Database queries enforce <code>orgId</code> scope at both middleware proxy and service levels.
                    </span>
                  </div>
                  <div className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] text-xs">
                    <span className="font-semibold block text-[var(--color-foreground)]">AES-256-GCM Vault</span>
                    <span className="text-[11px] text-[var(--color-muted)]">
                      All integration secrets, API keys, and client secrets are encrypted with cryptographic auth tags.
                    </span>
                  </div>
                </div>
              </Card>

              {/* Quick User List */}
              <Card className="p-5 border border-[var(--color-border)]">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold">Recent Registered Accounts</h3>
                  <button
                    type="button"
                    onClick={() => switchTab("users")}
                    className="text-xs text-[var(--color-primary)] hover:underline flex items-center gap-1 font-medium"
                  >
                    View All ({users.length}) <ArrowUpRight size={13} />
                  </button>
                </div>
                <div className="divide-y divide-[var(--color-border)] text-xs">
                  {users.slice(0, 5).map((u) => (
                    <div key={u.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-[var(--color-foreground)] truncate">{u.name || "User"}</p>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-semibold uppercase ${
                              u.plan === "ENTERPRISE"
                                ? "bg-purple-500/10 text-purple-600 border border-purple-500/20"
                                : u.plan === "PRO"
                                ? "bg-indigo-500/10 text-indigo-600 border border-indigo-500/20"
                                : "bg-zinc-500/10 text-zinc-500 border border-zinc-500/20"
                            }`}
                          >
                            {u.plan}
                          </span>
                        </div>
                        <p className="text-[11px] text-[var(--color-muted)] truncate">{u.email}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-[var(--color-muted)]">
                          {u.websiteCount} {u.websiteCount === 1 ? "site" : "sites"}
                        </span>
                        {u.isAdmin ? (
                          <span className="bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 px-2 py-0.5 rounded text-[10px] font-semibold">
                            ADMIN
                          </span>
                        ) : (
                          <span className="bg-zinc-500/10 text-zinc-500 border border-zinc-500/20 px-2 py-0.5 rounded text-[10px]">
                            USER
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="p-5 border border-[var(--color-border)] space-y-3">
                <h3 className="text-sm font-semibold">Platform Infrastructure Status</h3>
                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--color-surface-muted)]">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Neon PostgreSQL / Local Store</span>
                    </div>
                    <span className="font-mono text-[11px] text-emerald-600 font-medium">Healthy</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--color-surface-muted)]">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span>Google OAuth 2.0 & Search Console</span>
                    </div>
                    <span className="font-mono text-[11px] text-emerald-600 font-medium">Configured</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--color-surface-muted)]">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span>Gemini 2.0 & OpenAI Pipeline</span>
                    </div>
                    <span className="font-mono text-[11px] text-emerald-600 font-medium">Operational</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--color-surface-muted)]">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span>Twilio / Meta WhatsApp Gateway</span>
                    </div>
                    <span className="font-mono text-[11px] text-emerald-600 font-medium">Ready</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--color-surface-muted)]">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span>Stripe & Razorpay Billing</span>
                    </div>
                    <span className="font-mono text-[11px] text-emerald-600 font-medium">Integrated</span>
                  </div>
                </div>
              </Card>

              {/* Direct Quick Actions */}
              <Card className="p-5 border border-[var(--color-border)] space-y-3">
                <h3 className="text-sm font-semibold">Quick Administration</h3>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => switchTab("ai_models")}
                    className="w-full text-left p-2.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-muted)] transition-colors text-xs flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <Bot size={14} className="text-indigo-500" /> Test AI Models
                    </span>
                    <ArrowUpRight size={12} className="text-[var(--color-muted)]" />
                  </button>

                  <button
                    type="button"
                    onClick={() => switchTab("whatsapp")}
                    className="w-full text-left p-2.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-muted)] transition-colors text-xs flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <MessageSquare size={14} className="text-emerald-500" /> Direct WhatsApp Messenger
                    </span>
                    <ArrowUpRight size={12} className="text-[var(--color-muted)]" />
                  </button>

                  <button
                    type="button"
                    onClick={() => switchTab("plans_payments")}
                    className="w-full text-left p-2.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-muted)] transition-colors text-xs flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <CreditCard size={14} className="text-blue-500" /> Manage Plans & Gateway Keys
                    </span>
                    <ArrowUpRight size={12} className="text-[var(--color-muted)]" />
                  </button>
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 2: USERS MANAGEMENT */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === "users" && (
        <Card className="p-5 border border-[var(--color-border)] space-y-5">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold">User Directory & Role Governance ({filteredUsers.length})</h2>
              <p className="text-xs text-[var(--color-muted)]">
                Manage user access, assign subscription plans, toggle active/suspended status, and message users directly.
              </p>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <div className="relative min-w-[200px]">
                <Search size={14} className="absolute left-3 top-2.5 text-[var(--color-muted)]" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search email, name, phone..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                />
              </div>

              <select
                value={userStatusFilter}
                onChange={(e) => setUserStatusFilter(e.target.value as any)}
                aria-label="Filter users by status"
                className="px-2.5 py-1.5 text-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="SUSPENDED">Suspended Only</option>
              </select>

              <select
                value={userPlanFilter}
                onChange={(e) => setUserPlanFilter(e.target.value as any)}
                aria-label="Filter users by subscription plan"
                className="px-2.5 py-1.5 text-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
              >
                <option value="ALL">All Plans</option>
                <option value="FREE">Free Starter ($0/mo)</option>
                <option value="LITE">AI CMO Lite ($108/mo)</option>
                <option value="PRO">AI CMO Pro ($208/mo)</option>
                <option value="ENTERPRISE">Enterprise ($499/mo)</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-muted)]">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">User</th>
                  <th className="py-2.5 px-3 font-semibold">Role</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                  <th className="py-2.5 px-3 font-semibold">Assigned Plan</th>
                  <th className="py-2.5 px-3 font-semibold">Phone</th>
                  <th className="py-2.5 px-3 font-semibold">Projects</th>
                  <th className="py-2.5 px-3 font-semibold">Joined</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-xs text-[var(--color-muted)]">
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <Users size={24} className="opacity-40 mb-1" />
                        <span className="font-semibold text-[var(--color-foreground)]">No user accounts found</span>
                        <span className="text-[11px]">All accounts have been cleared. Workspaces start completely fresh.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-[var(--color-surface-muted)]/50 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-semibold text-[var(--color-foreground)]">{u.name || "User"}</div>
                        <div className="text-[11px] text-[var(--color-muted)]">{u.email}</div>
                      </td>
                      <td className="py-3 px-3">
                        <select
                          value={u.isAdmin ? "ADMIN" : "USER"}
                          disabled={updatingUserId === u.id || u.email.toLowerCase() === currentAdminEmail.toLowerCase()}
                          onChange={(e) =>
                            handleUpdateUser(u.id, {
                              isAdmin: e.target.value === "ADMIN",
                              role: e.target.value,
                            })
                          }
                          aria-label={`Change role for ${u.name || u.email}`}
                          className="px-2 py-1 text-[11px] rounded border border-[var(--color-border)] bg-[var(--color-surface)] font-medium disabled:opacity-60"
                        >
                          <option value="USER">USER</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                      </td>
                      <td className="py-3 px-3">
                        <select
                          value={u.status}
                          disabled={updatingUserId === u.id || u.email.toLowerCase() === currentAdminEmail.toLowerCase()}
                          onChange={(e) => handleUpdateUser(u.id, { status: e.target.value })}
                          aria-label={`Change status for ${u.name || u.email}`}
                          className={`px-2 py-1 text-[11px] rounded border font-semibold ${
                            u.status === "ACTIVE"
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                              : "bg-red-500/10 text-red-600 border-red-500/20"
                          } disabled:opacity-60`}
                        >
                          <option value="ACTIVE">ACTIVE</option>
                          <option value="SUSPENDED">SUSPENDED</option>
                        </select>
                      </td>
                      <td className="py-3 px-3">
                        <select
                          value={(() => {
                            const p = u.plan.toUpperCase();
                            if (p === "BASIC" || p === "STARTER") return "FREE";
                            return p;
                          })()}
                          disabled={updatingUserId === u.id}
                          onChange={(e) => handleUpdateUser(u.id, { plan: e.target.value })}
                          aria-label={`Change subscription plan for ${u.name || u.email}`}
                          className="px-2 py-1 text-[11px] rounded border border-[var(--color-border)] bg-[var(--color-surface)] font-medium disabled:opacity-60"
                        >
                          <option value="FREE">Free Starter ($0/mo)</option>
                          <option value="LITE">AI CMO Lite ($108/mo)</option>
                          <option value="PRO">AI CMO Pro ($208/mo)</option>
                          <option value="ENTERPRISE">Enterprise ($499/mo)</option>
                        </select>
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-[var(--color-muted)]">
                        {u.phone || "—"}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-semibold">{u.websiteCount}</span>{" "}
                        <span className="text-[11px] text-[var(--color-muted)]">
                          {u.websiteCount === 1 ? "site" : "sites"}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-[11px] text-[var(--color-muted)]">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              if (u.phone) {
                                setWaRecipient(u.phone);
                              }
                              setWaMessage(`Hello ${u.name || "there"}, this is an update regarding your SEO Dashboard.`);
                              switchTab("whatsapp");
                            }}
                            title="Message via WhatsApp"
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded border border-emerald-200 dark:border-emerald-800 transition-colors"
                          >
                            <MessageSquare size={13} />
                          </button>
                          {u.email.toLowerCase() !== currentAdminEmail.toLowerCase() && (
                            <button
                              type="button"
                              disabled={deletingUserId === u.id}
                              onClick={() => handleDeleteUser(u.id, u.email)}
                              title="Delete user account"
                              className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded border border-rose-200 dark:border-rose-800 transition-colors disabled:opacity-50"
                            >
                              <Trash2 size={13} className={deletingUserId === u.id ? "animate-spin" : ""} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 3: AI MODEL INTEGRATIONS */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === "ai_models" && (
        <div className="space-y-6">
          <Card className="p-5 border border-[var(--color-border)] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <Bot size={18} className="text-indigo-500" />
                  Primary Autonomous AI Configuration
                </h2>
                <p className="text-xs text-[var(--color-muted)]">
                  Configure centralized LLM API keys for autonomous content generation, keyword clustering, and AI search visibility.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">Default Primary Provider:</span>
                <select
                  value={settings.ai_primary_provider || "gemini"}
                  onChange={(e) => handleSettingChange("ai_primary_provider", e.target.value)}
                  aria-label="Default primary AI provider"
                  className="px-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] font-semibold text-indigo-600"
                >
                  <option value="gemini">Google Gemini (Recommended)</option>
                  <option value="openai">OpenAI GPT-4o</option>
                  <option value="claude">Anthropic Claude</option>
                  <option value="perplexity">Perplexity AI</option>
                </select>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Google Gemini Card */}
            <Card className="p-5 border border-[var(--color-border)] space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-xs">
                    G
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Google Gemini</h3>
                    <p className="text-[11px] text-[var(--color-muted)]">High speed & structured JSON output</p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={testingType === "ai-gemini"}
                  onClick={() => runConnectionTest("ai", "gemini")}
                  className="px-2.5 py-1 text-[11px] rounded font-medium border border-blue-200 dark:border-blue-800 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 flex items-center gap-1"
                >
                  <RefreshCw size={11} className={testingType === "ai-gemini" ? "animate-spin" : ""} />
                  {testingType === "ai-gemini" ? "Testing..." : "Test Gemini"}
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] font-medium text-[var(--color-muted)] mb-1">
                    Gemini API Key
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={settings.ai_gemini_api_key || ""}
                      onChange={(e) => handleSettingChange("ai_gemini_api_key", e.target.value)}
                      placeholder="AIzaSy••••••••••••••••••••"
                      className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
                    />
                    <Lock size={12} className="absolute right-3 top-2 text-[var(--color-muted)]" />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[var(--color-muted)] mb-1">
                    Gemini Model ID (Input Form)
                  </label>
                  <input
                    type="text"
                    value={settings.ai_gemini_model || ""}
                    onChange={(e) => handleSettingChange("ai_gemini_model", e.target.value)}
                    placeholder="e.g. gemini-2.0-flash, gemini-2.5-pro, gemini-1.5-pro"
                    className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {["gemini-2.0-flash", "gemini-2.5-pro", "gemini-1.5-pro", "gemini-1.5-flash"].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => handleSettingChange("ai_gemini_model", m)}
                        className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                          settings.ai_gemini_model === m
                            ? "bg-blue-500/10 border-blue-500/30 text-blue-600 font-medium"
                            : "border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            {/* OpenAI Card */}
            <Card className="p-5 border border-[var(--color-border)] space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold text-xs">
                    OA
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">OpenAI GPT-4o</h3>
                    <p className="text-[11px] text-[var(--color-muted)]">Benchmark evaluation & multi-model parity</p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={testingType === "ai-openai"}
                  onClick={() => runConnectionTest("ai", "openai")}
                  className="px-2.5 py-1 text-[11px] rounded font-medium border border-emerald-200 dark:border-emerald-800 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 flex items-center gap-1"
                >
                  <RefreshCw size={11} className={testingType === "ai-openai" ? "animate-spin" : ""} />
                  {testingType === "ai-openai" ? "Testing..." : "Test OpenAI"}
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] font-medium text-[var(--color-muted)] mb-1">
                    OpenAI API Key
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={settings.ai_openai_api_key || ""}
                      onChange={(e) => handleSettingChange("ai_openai_api_key", e.target.value)}
                      placeholder="sk-proj-••••••••••••••••••••"
                      className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
                    />
                    <Lock size={12} className="absolute right-3 top-2 text-[var(--color-muted)]" />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[var(--color-muted)] mb-1">
                    OpenAI Model ID (Input Form)
                  </label>
                  <input
                    type="text"
                    value={settings.ai_openai_model || ""}
                    onChange={(e) => handleSettingChange("ai_openai_model", e.target.value)}
                    placeholder="e.g. gpt-4o, gpt-4o-mini, o1, o3-mini"
                    className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {["gpt-4o", "gpt-4o-mini", "o1", "o3-mini"].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => handleSettingChange("ai_openai_model", m)}
                        className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                          settings.ai_openai_model === m
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 font-medium"
                            : "border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            {/* Anthropic Claude Card */}
            <Card className="p-5 border border-[var(--color-border)] space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold text-xs">
                    CL
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Anthropic Claude</h3>
                    <p className="text-[11px] text-[var(--color-muted)]">Nuanced long-form editorial copy</p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={testingType === "ai-claude"}
                  onClick={() => runConnectionTest("ai", "claude")}
                  className="px-2.5 py-1 text-[11px] rounded font-medium border border-amber-200 dark:border-amber-800 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 flex items-center gap-1"
                >
                  <RefreshCw size={11} className={testingType === "ai-claude" ? "animate-spin" : ""} />
                  {testingType === "ai-claude" ? "Testing..." : "Test Claude"}
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] font-medium text-[var(--color-muted)] mb-1">
                    Anthropic API Key
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={settings.ai_claude_api_key || ""}
                      onChange={(e) => handleSettingChange("ai_claude_api_key", e.target.value)}
                      placeholder="sk-ant-••••••••••••••••••••"
                      className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
                    />
                    <Lock size={12} className="absolute right-3 top-2 text-[var(--color-muted)]" />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[var(--color-muted)] mb-1">
                    Claude Model ID (Input Form)
                  </label>
                  <input
                    type="text"
                    value={settings.ai_claude_model || ""}
                    onChange={(e) => handleSettingChange("ai_claude_model", e.target.value)}
                    placeholder="e.g. claude-3-7-sonnet-20250219, claude-3-5-sonnet-20241022"
                    className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {["claude-3-7-sonnet-20250219", "claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-3-opus-20240229"].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => handleSettingChange("ai_claude_model", m)}
                        className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                          settings.ai_claude_model === m
                            ? "bg-amber-500/10 border-amber-500/30 text-amber-600 font-medium"
                            : "border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            {/* Perplexity AI Card */}
            <Card className="p-5 border border-[var(--color-border)] space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-teal-500/10 text-teal-600 flex items-center justify-center font-bold text-xs">
                    PX
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Perplexity AI (Sonar)</h3>
                    <p className="text-[11px] text-[var(--color-muted)]">Live citation graph & real-time search indexing</p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={testingType === "ai-perplexity"}
                  onClick={() => runConnectionTest("ai", "perplexity")}
                  className="px-2.5 py-1 text-[11px] rounded font-medium border border-teal-200 dark:border-teal-800 text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/30 flex items-center gap-1"
                >
                  <RefreshCw size={11} className={testingType === "ai-perplexity" ? "animate-spin" : ""} />
                  {testingType === "ai-perplexity" ? "Testing..." : "Test Perplexity"}
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] font-medium text-[var(--color-muted)] mb-1">
                    Perplexity API Key
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={settings.ai_perplexity_api_key || ""}
                      onChange={(e) => handleSettingChange("ai_perplexity_api_key", e.target.value)}
                      placeholder="pplx-••••••••••••••••••••"
                      className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
                    />
                    <Lock size={12} className="absolute right-3 top-2 text-[var(--color-muted)]" />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[var(--color-muted)] mb-1">
                    Perplexity Model ID (Input Form)
                  </label>
                  <input
                    type="text"
                    value={settings.ai_perplexity_model || ""}
                    onChange={(e) => handleSettingChange("ai_perplexity_model", e.target.value)}
                    placeholder="e.g. sonar-pro, sonar, sonar-reasoning"
                    className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {["sonar-pro", "sonar", "sonar-reasoning"].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => handleSettingChange("ai_perplexity_model", m)}
                        className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                          settings.ai_perplexity_model === m
                            ? "bg-teal-500/10 border-teal-500/30 text-teal-600 font-medium"
                            : "border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 4: DEVELOPER CONNECT (X & REDDIT) */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === "developer_connect" && (
        <div className="space-y-6">
          <Card className="p-5 border border-[var(--color-border)] space-y-3">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <Share2 size={18} className="text-indigo-500" />
              Centralized Developer App Configurations
            </h2>
            <p className="text-xs text-[var(--color-muted)] leading-relaxed">
              Providing platform-level developer credentials allows any registered user to seamlessly connect their Reddit or X accounts via 1-click OAuth, without requiring them to register developer portal accounts on Reddit or X individually.
            </p>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Reddit Developer App */}
            <Card className="p-5 border border-[var(--color-border)] space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-orange-500/10 text-orange-600 flex items-center justify-center font-bold text-xs">
                    R
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Reddit Developer Application</h3>
                    <p className="text-[11px] text-[var(--color-muted)]">OAuth & opportunity monitoring</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => runConnectionTest("reddit")}
                  className="px-2.5 py-1 text-[11px] rounded font-medium border border-orange-200 dark:border-orange-800 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/30"
                >
                  Verify Reddit App
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] font-medium text-[var(--color-muted)] mb-1">
                    Reddit Client ID (App ID)
                  </label>
                  <input
                    type="text"
                    value={settings.reddit_client_id || ""}
                    onChange={(e) => handleSettingChange("reddit_client_id", e.target.value)}
                    placeholder="e.g. 14-character script ID"
                    className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[var(--color-muted)] mb-1">
                    Reddit Client Secret
                  </label>
                  <input
                    type="password"
                    value={settings.reddit_client_secret || ""}
                    onChange={(e) => handleSettingChange("reddit_client_secret", e.target.value)}
                    placeholder="Client Secret"
                    className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[var(--color-muted)] mb-1">
                    Authorized Redirect URI
                  </label>
                  <input
                    type="text"
                    value={settings.reddit_redirect_uri || ""}
                    onChange={(e) => handleSettingChange("reddit_redirect_uri", e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[var(--color-muted)] mb-1">
                    User Agent Header
                  </label>
                  <input
                    type="text"
                    value={settings.reddit_user_agent || ""}
                    onChange={(e) => handleSettingChange("reddit_user_agent", e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
                  />
                </div>
              </div>
            </Card>

            {/* X (Twitter) Developer App */}
            <Card className="p-5 border border-[var(--color-border)] space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-zinc-500/10 text-zinc-800 dark:text-zinc-200 flex items-center justify-center font-bold text-xs">
                    𝕏
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">X (Twitter) Developer Portal</h3>
                    <p className="text-[11px] text-[var(--color-muted)]">OAuth 2.0 PKCE & Opportunity Sync</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => runConnectionTest("x")}
                  className="px-2.5 py-1 text-[11px] rounded font-medium border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  Verify X App
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] font-medium text-[var(--color-muted)] mb-1">
                    X Client ID
                  </label>
                  <input
                    type="text"
                    value={settings.x_client_id || ""}
                    onChange={(e) => handleSettingChange("x_client_id", e.target.value)}
                    placeholder="OAuth 2.0 Client ID"
                    className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[var(--color-muted)] mb-1">
                    X Client Secret
                  </label>
                  <input
                    type="password"
                    value={settings.x_client_secret || ""}
                    onChange={(e) => handleSettingChange("x_client_secret", e.target.value)}
                    placeholder="Client Secret"
                    className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[var(--color-muted)] mb-1">
                    X App Bearer Token
                  </label>
                  <input
                    type="password"
                    value={settings.x_bearer_token || ""}
                    onChange={(e) => handleSettingChange("x_bearer_token", e.target.value)}
                    placeholder="Bearer token"
                    className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[var(--color-muted)] mb-1">
                    Authorized Callback URI
                  </label>
                  <input
                    type="text"
                    value={settings.x_redirect_uri || ""}
                    onChange={(e) => handleSettingChange("x_redirect_uri", e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)]"
                  />
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 5: GOOGLE AUTHENTICATION & OAUTH */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === "google_auth" && (
        <div className="space-y-6">
          <Card className="p-5 border border-[var(--color-border)] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <Shield size={18} className="text-blue-500" />
                  Google OAuth 2.0 Credentials (Search Console & GA4)
                </h2>
                <p className="text-xs text-[var(--color-muted)]">
                  Configure your Google Cloud Platform project credentials so users can link their Search Console and Analytics properties.
                </p>
              </div>

              <button
                type="button"
                disabled={testingType === "google"}
                onClick={() => runConnectionTest("google")}
                className="px-3 py-1.5 text-xs rounded font-medium border border-blue-200 dark:border-blue-800 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 flex items-center gap-1.5"
              >
                <RefreshCw size={13} className={testingType === "google" ? "animate-spin" : ""} />
                Test Google Verification
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 text-xs">
              <div>
                <label className="block text-[11px] font-medium text-[var(--color-muted)] mb-1">
                  Google Client ID
                </label>
                <input
                  type="text"
                  value={settings.google_client_id || ""}
                  onChange={(e) => handleSettingChange("google_client_id", e.target.value)}
                  placeholder="xxxxx.apps.googleusercontent.com"
                  className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[var(--color-muted)] mb-1">
                  Google Client Secret
                </label>
                <input
                  type="password"
                  value={settings.google_client_secret || ""}
                  onChange={(e) => handleSettingChange("google_client_secret", e.target.value)}
                  placeholder="GOCSPX-••••••••••••••••••••"
                  className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11px] font-medium text-[var(--color-muted)] mb-1">
                  Authorized Redirect URI (Add to Google Cloud Console)
                </label>
                <input
                  type="text"
                  value={settings.google_redirect_uri || ""}
                  onChange={(e) => handleSettingChange("google_redirect_uri", e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)]"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11px] font-medium text-[var(--color-muted)] mb-1">
                  Active OAuth Scopes Requested
                </label>
                <textarea
                  rows={2}
                  value={settings.google_scopes || ""}
                  onChange={(e) => handleSettingChange("google_scopes", e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
                />
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 6: WHATSAPP MESSENGER & AUTHENTICATION */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === "whatsapp" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* WhatsApp Credentials & Provider Setup */}
            <Card className="p-5 border border-[var(--color-border)] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold text-xs">
                    <Phone size={14} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">WhatsApp Gateway Settings</h3>
                    <p className="text-[11px] text-[var(--color-muted)]">Twilio WhatsApp or Meta Cloud API</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isResettingWhatsApp}
                    onClick={handleResetWhatsAppSettings}
                    title="Reset all WhatsApp credentials to factory defaults"
                    className="px-2.5 py-1 text-[11px] rounded font-medium border border-rose-200 dark:border-rose-800 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-1 transition-colors disabled:opacity-50"
                  >
                    <RotateCcw size={11} className={isResettingWhatsApp ? "animate-spin" : ""} />
                    Reset
                  </button>
                  <button
                    type="button"
                    disabled={testingType?.startsWith("whatsapp") ?? false}
                    onClick={() => runConnectionTest("whatsapp", settings.whatsapp_provider || "twilio")}
                    className="px-2.5 py-1 text-[11px] rounded font-medium border border-emerald-200 dark:border-emerald-800 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 flex items-center gap-1 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw size={11} className={testingType?.startsWith("whatsapp") ? "animate-spin" : ""} />
                    Test Gateway
                  </button>
                  <button
                    type="button"
                    disabled={isSavingWhatsApp}
                    onClick={handleSaveWhatsAppSettings}
                    className="px-3 py-1 text-[11px] rounded font-medium bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 shadow-xs transition-colors disabled:opacity-50"
                  >
                    <Save size={11} className={isSavingWhatsApp ? "animate-spin" : ""} />
                    Save Settings
                  </button>
                </div>
              </div>

              {/* Status Message (Save / Reset) */}
              {waSettingsMsg && (
                <div
                  className={`p-2.5 rounded-lg text-[11px] flex items-start gap-2 ${
                    waSettingsMsg.ok
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                      : "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                  }`}
                >
                  {waSettingsMsg.ok ? <CheckCircle2 size={13} className="shrink-0 mt-0.5" /> : <AlertCircle size={13} className="shrink-0 mt-0.5" />}
                  <span>{waSettingsMsg.message}</span>
                </div>
              )}

              {/* Gateway Test Result Banner (Inline) */}
              {testResult && (testResult.provider === "twilio" || testResult.provider === "meta" || testingType?.startsWith("whatsapp")) && (
                <div
                  className={`p-3 rounded-lg text-xs flex items-start justify-between gap-2.5 border ${
                    testResult.ok
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                      : "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {testResult.ok ? (
                      <CheckCircle2 size={15} className="shrink-0 mt-0.5 text-emerald-600" />
                    ) : (
                      <AlertCircle size={15} className="shrink-0 mt-0.5 text-red-600" />
                    )}
                    <div>
                      <p className="font-semibold text-xs">
                        {testResult.ok ? `Gateway Verified (${(testResult.provider || "Gateway").toUpperCase()})` : "Gateway Verification Failed"}
                      </p>
                      <p className="text-[11px] mt-0.5">{testResult.message}</p>
                      {testResult.latencyMs !== undefined && (
                        <p className="font-mono text-[10px] opacity-75 mt-0.5">Latency: {testResult.latencyMs}ms</p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTestResult(null)}
                    className="text-[10px] opacity-60 hover:opacity-100 underline shrink-0"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              <div className="space-y-4 text-xs">
                {/* 4 Gateway Mode Selection Cards */}
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--color-foreground)] mb-2">
                    Select Your WhatsApp Gateway Mode
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {/* Mode 1: Direct WhatsApp */}
                    <button
                      type="button"
                      onClick={() => handleSettingChange("whatsapp_provider", "direct_wa_me")}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        (settings.whatsapp_provider || "twilio") === "direct_wa_me"
                          ? "border-emerald-500 bg-emerald-500/10 shadow-xs ring-1 ring-emerald-500/30"
                          : "border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-muted)]"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-xs text-[var(--color-foreground)]">⚡ Instant Direct (wa.me)</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700">Zero API</span>
                      </div>
                      <p className="text-[11px] text-[var(--color-muted)] leading-snug">
                        No API keys required. Launches WhatsApp Web/App instantly with pre-formatted alerts.
                      </p>
                    </button>

                    {/* Mode 2: Twilio */}
                    <button
                      type="button"
                      onClick={() => handleSettingChange("whatsapp_provider", "twilio")}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        (settings.whatsapp_provider || "twilio") === "twilio"
                          ? "border-emerald-500 bg-emerald-500/10 shadow-xs ring-1 ring-emerald-500/30"
                          : "border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-muted)]"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-xs text-[var(--color-foreground)]">💬 Twilio Gateway</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-700">Sandbox/Prod</span>
                      </div>
                      <p className="text-[11px] text-[var(--color-muted)] leading-snug">
                        Twilio Cloud WhatsApp API with free sandbox testing and production sender numbers.
                      </p>
                    </button>

                    {/* Mode 3: Meta Cloud API */}
                    <button
                      type="button"
                      onClick={() => handleSettingChange("whatsapp_provider", "meta")}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        settings.whatsapp_provider === "meta"
                          ? "border-emerald-500 bg-emerald-500/10 shadow-xs ring-1 ring-emerald-500/30"
                          : "border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-muted)]"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-xs text-[var(--color-foreground)]">🌐 Meta Cloud API</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-700">Official</span>
                      </div>
                      <p className="text-[11px] text-[var(--color-muted)] leading-snug">
                        Official Meta WhatsApp Business Cloud API (Graph API) with Phone Number ID.
                      </p>
                    </button>

                    {/* Mode 4: Custom Webhook / Gateway */}
                    <button
                      type="button"
                      onClick={() => handleSettingChange("whatsapp_provider", "custom_webhook")}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        settings.whatsapp_provider === "custom_webhook"
                          ? "border-emerald-500 bg-emerald-500/10 shadow-xs ring-1 ring-emerald-500/30"
                          : "border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-muted)]"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-xs text-[var(--color-foreground)]">🔌 Custom Webhook</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700">UltraMsg/Green</span>
                      </div>
                      <p className="text-[11px] text-[var(--color-muted)] leading-snug">
                        UltraMsg, Green API, Evolution API, Wasapi, Baileys, or any custom HTTP gateway endpoint.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Mode Specific Inputs */}
                {settings.whatsapp_provider === "direct_wa_me" && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-xs space-y-2">
                    <div className="flex items-center gap-2 font-semibold text-emerald-800">
                      <CheckCircle2 size={16} className="text-emerald-600" />
                      Instant 1-Click WhatsApp Enabled
                    </div>
                    <p className="text-[11px] text-[var(--color-muted)] leading-relaxed">
                      You are ready to use WhatsApp without configuring any third-party credentials or API accounts. Whenever SEO reports, keyword alerts, or direct messages are triggered, you can preview and send them directly to any WhatsApp contact or group with 1 click.
                    </p>
                  </div>
                )}

                {settings.whatsapp_provider === "custom_webhook" && (
                  <div className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/50 p-4">
                    <div className="font-semibold text-xs text-[var(--color-foreground)] flex items-center gap-2">
                      <Zap size={14} className="text-amber-500" /> Custom HTTP Webhook Configuration
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[var(--color-muted)] mb-1">
                        Webhook Gateway Endpoint URL <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="url"
                        value={settings.whatsapp_webhook_url || ""}
                        onChange={(e) => handleSettingChange("whatsapp_webhook_url", e.target.value)}
                        placeholder="https://api.ultramsg.com/instance1234/messages/chat or https://api.green-api.com/..."
                        className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
                      />
                      <p className="text-[10px] text-[var(--color-muted)] mt-1">
                        Sends a POST JSON request with <code className="font-mono">{"{ to, message, timestamp }"}</code> to your WhatsApp instance.
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-medium text-[var(--color-muted)]">
                          Webhook Authorization Token / API Key (Optional)
                          {configuredSecrets.has("whatsapp_webhook_token") && (
                            <span className="ml-1.5 font-normal text-emerald-600">
                              (Saved in DB)
                            </span>
                          )}
                        </label>
                        {configuredSecrets.has("whatsapp_webhook_token") && (
                          <button
                            type="button"
                            onClick={() => handleSettingChange("whatsapp_webhook_token", "__CLEAR__")}
                            className="text-[10px] text-rose-500 hover:underline"
                          >
                            Clear Token
                          </button>
                        )}
                      </div>
                      <input
                        type="password"
                        value={settings.whatsapp_webhook_token || ""}
                        onChange={(e) => handleSettingChange("whatsapp_webhook_token", e.target.value)}
                        placeholder={configuredSecrets.has("whatsapp_webhook_token") ? "•••••••••••••••• (Leave blank to keep saved token)" : "Instance Token / Bearer Secret"}
                        className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
                      />
                    </div>
                  </div>
                )}

                {settings.whatsapp_provider === "twilio" && (
                  <div className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/50 p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="font-semibold text-xs text-[var(--color-foreground)] flex items-center gap-2">
                        <MessageSquare size={14} className="text-blue-500" /> Twilio WhatsApp Credentials
                      </span>
                      <a
                        href="https://wa.me/14155238886?text=join%20sandbox"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded hover:bg-emerald-100 transition-colors"
                      >
                        👉 1-Click Join Twilio Sandbox <ExternalLink size={10} />
                      </a>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-[var(--color-muted)] mb-1">
                        Twilio Account SID <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={settings.whatsapp_account_sid || ""}
                        onChange={(e) => handleSettingChange("whatsapp_account_sid", e.target.value)}
                        placeholder="AC••••••••••••••••••••••••••••••••"
                        className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-medium text-[var(--color-muted)]">
                          Twilio Auth Token <span className="text-red-500">*</span>
                          {configuredSecrets.has("whatsapp_auth_token") && (
                            <span className="ml-1.5 font-normal text-emerald-600">
                              (Saved in DB)
                            </span>
                          )}
                        </label>
                        {configuredSecrets.has("whatsapp_auth_token") && (
                          <button
                            type="button"
                            onClick={() => handleSettingChange("whatsapp_auth_token", "__CLEAR__")}
                            className="text-[10px] text-rose-500 hover:underline"
                          >
                            Clear Token
                          </button>
                        )}
                      </div>
                      <input
                        type="password"
                        value={settings.whatsapp_auth_token || ""}
                        onChange={(e) => handleSettingChange("whatsapp_auth_token", e.target.value)}
                        placeholder={configuredSecrets.has("whatsapp_auth_token") ? "•••••••••••••••• (Leave blank to keep saved)" : "Twilio Auth Token"}
                        className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-[var(--color-muted)] mb-1">
                        WhatsApp Sender Number (From)
                      </label>
                      <input
                        type="text"
                        value={settings.whatsapp_from_number || "whatsapp:+14155238886"}
                        onChange={(e) => handleSettingChange("whatsapp_from_number", e.target.value)}
                        placeholder="whatsapp:+14155238886"
                        className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
                      />
                      <p className="text-[10px] text-[var(--color-muted)] mt-1">
                        Default Twilio sandbox number is <code className="font-mono text-[10px]">whatsapp:+14155238886</code>. For sandbox, recipient sends <code className="font-mono text-[10px]">join &lt;keyword&gt;</code> to this number once.
                      </p>
                    </div>
                  </div>
                )}

                {settings.whatsapp_provider === "meta" && (
                  <div className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/50 p-4">
                    <div className="font-semibold text-xs text-[var(--color-foreground)] flex items-center gap-2">
                      <Globe size={14} className="text-indigo-500" /> Meta WhatsApp Business Cloud API
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-[var(--color-muted)] mb-1">
                        Meta Phone Number ID <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={settings.whatsapp_meta_phone_id || ""}
                        onChange={(e) => handleSettingChange("whatsapp_meta_phone_id", e.target.value)}
                        placeholder="1000293848123 (numeric ID, not phone number)"
                        className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
                      />
                      <p className="text-[10px] text-[var(--color-muted)] mt-1">
                        Found in Meta App Dashboard &gt; WhatsApp &gt; API Setup (e.g. <code className="font-mono">105948372619482</code>).
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-medium text-[var(--color-muted)]">
                          System User Permanent Access Token <span className="text-red-500">*</span>
                          {configuredSecrets.has("whatsapp_meta_token") && (
                            <span className="ml-1.5 font-normal text-emerald-600">
                              (Saved in DB)
                            </span>
                          )}
                        </label>
                        {configuredSecrets.has("whatsapp_meta_token") && (
                          <button
                            type="button"
                            onClick={() => handleSettingChange("whatsapp_meta_token", "__CLEAR__")}
                            className="text-[10px] text-rose-500 hover:underline"
                          >
                            Clear Token
                          </button>
                        )}
                      </div>
                      <input
                        type="password"
                        value={settings.whatsapp_meta_token || ""}
                        onChange={(e) => handleSettingChange("whatsapp_meta_token", e.target.value)}
                        placeholder={
                          settings.whatsapp_meta_token === "__CLEAR__"
                            ? "[WILL BE CLEARED ON SAVE]"
                            : configuredSecrets.has("whatsapp_meta_token")
                            ? "•••••••••••••••• (Leave blank to keep saved token)"
                            : "EAA... (Permanent Access Token)"
                        }
                        className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-[var(--color-muted)] mb-1">
                        Meta WhatsApp Business Account ID (WABA ID - Optional)
                      </label>
                      <input
                        type="text"
                        value={settings.whatsapp_meta_account_id || ""}
                        onChange={(e) => handleSettingChange("whatsapp_meta_account_id", e.target.value)}
                        placeholder="109876543210123"
                        className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
                      />
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Direct Admin WhatsApp Dispatch Console */}
            <Card className="p-5 border border-[var(--color-border)] space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                    <Send size={14} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Direct WhatsApp Messenger</h3>
                    <p className="text-[11px] text-[var(--color-muted)]">Dispatch instant messages, ranking notifications, or SEO alerts to any user</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSendWhatsApp} className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] font-medium text-[var(--color-muted)] mb-1">
                    Recipient Phone Number (with Country Code)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={waRecipient}
                      onChange={(e) => setWaRecipient(e.target.value)}
                      placeholder="+919876543210 or +14155552671"
                      required
                      className="flex-1 px-3 py-1.5 text-xs font-mono rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
                    />
                    {/* User Quick Selector */}
                    <select
                      onChange={(e) => {
                        if (e.target.value) setWaRecipient(e.target.value);
                      }}
                      aria-label="Select registered user phone"
                      className="px-2 py-1.5 text-[11px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-muted)]"
                    >
                      <option value="">Pick User...</option>
                      {users
                        .filter((u) => u.phone)
                        .map((u) => (
                          <option key={u.id} value={u.phone!}>
                            {u.name || u.email} ({u.phone})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[11px] font-medium text-[var(--color-muted)]">
                      Message Content (Choose Template or Write Custom)
                    </label>
                  </div>
                  {/* Preset Template Chips */}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    <button
                      type="button"
                      onClick={() =>
                        setWaMessage("🚀 Your weekly AI SEO visibility audit is ready! 4 new search citation opportunities were identified.")
                      }
                      className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-[var(--color-surface-muted)] text-[var(--color-foreground)] border border-[var(--color-border)] hover:border-emerald-500 hover:text-emerald-700 transition-colors"
                    >
                      🚀 Weekly AI Audit
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setWaMessage("📈 SEO Alert: Top keyword 'organic produce' jumped +6 positions into Top 3 Google Search Results!")
                      }
                      className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-[var(--color-surface-muted)] text-[var(--color-foreground)] border border-[var(--color-border)] hover:border-emerald-500 hover:text-emerald-700 transition-colors"
                    >
                      📈 Keyword Ranking Jump
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setWaMessage("⚠️ Technical SEO Alert: 2 new crawl anomalies detected. 1-click diagnostic available in your Command Center.")
                      }
                      className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-[var(--color-surface-muted)] text-[var(--color-foreground)] border border-[var(--color-border)] hover:border-emerald-500 hover:text-emerald-700 transition-colors"
                    >
                      ⚠️ Crawler Anomaly
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setWaMessage("💡 Content Gap: New high-converting competitor topic detected. Fresh draft is ready for one-click publishing.")
                      }
                      className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-[var(--color-surface-muted)] text-[var(--color-foreground)] border border-[var(--color-border)] hover:border-emerald-500 hover:text-emerald-700 transition-colors"
                    >
                      💡 Content Gap
                    </button>
                  </div>
                  <textarea
                    rows={4}
                    value={waMessage}
                    onChange={(e) => setWaMessage(e.target.value)}
                    placeholder="Enter message to dispatch directly via WhatsApp..."
                    required
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {waFeedback && (
                  <div
                    className={`p-2.5 rounded-lg text-[11px] flex items-start justify-between gap-2 ${
                      waFeedback.ok
                        ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20"
                        : "bg-red-500/10 text-red-700 border border-red-500/20"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {waFeedback.ok ? <CheckCircle2 size={14} className="shrink-0 mt-0.5 text-emerald-600" /> : <AlertCircle size={14} className="shrink-0 mt-0.5 text-red-600" />}
                      <div>
                        <span>{waFeedback.message}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={waSending || !waRecipient || !waMessage}
                    className="w-full sm:flex-1 py-2 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors disabled:opacity-50"
                  >
                    <Send size={13} />
                    {waSending ? "Dispatching via WhatsApp..." : "Send Message via Gateway"}
                  </button>
                  {waRecipient && waMessage && (
                    <a
                      href={`https://wa.me/${waRecipient.replace(/[^\d]/g, "")}?text=${encodeURIComponent(waMessage)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full sm:w-auto py-2 px-3.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-muted)] text-[var(--color-foreground)] font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                    >
                      <ExternalLink size={13} />
                      Open WhatsApp Web
                    </a>
                  )}
                </div>
              </form>
            </Card>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB: TELEGRAM BOT & NOTIFICATION GATEWAY */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === "telegram" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            {/* Telegram Gateway Configuration */}
            <Card className="p-5 border border-[var(--color-border)] space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[var(--color-border)] pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-sky-500 text-white flex items-center justify-center font-bold shadow-xs">
                    <Send size={16} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold flex items-center gap-1.5">
                      Telegram Bot &amp; Broadcast Gateway
                    </h2>
                    <p className="text-xs text-[var(--color-muted)]">
                      Configure Telegram bots and channels to deliver autonomous SEO ranking alerts, crawler diagnostics, and AI search visibility reports.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isResettingTelegram}
                    onClick={handleResetTelegramSettings}
                    title="Reset Telegram configuration"
                    className="px-2.5 py-1 text-[11px] rounded font-medium border border-rose-200 dark:border-rose-800 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-1 transition-colors disabled:opacity-50"
                  >
                    <RotateCcw size={11} className={isResettingTelegram ? "animate-spin" : ""} />
                    Reset
                  </button>
                  <button
                    type="button"
                    disabled={testingType?.startsWith("telegram") ?? false}
                    onClick={() => runConnectionTest("telegram", settings.telegram_provider || "bot_api")}
                    className="px-2.5 py-1 text-[11px] rounded font-medium border border-sky-200 dark:border-sky-800 text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/30 flex items-center gap-1 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw size={11} className={testingType?.startsWith("telegram") ? "animate-spin" : ""} />
                    Test Connection
                  </button>
                  <button
                    type="button"
                    disabled={isSavingTelegram}
                    onClick={handleSaveTelegramSettings}
                    className="px-3 py-1 text-[11px] rounded font-medium bg-sky-600 hover:bg-sky-700 text-white flex items-center gap-1 shadow-xs transition-colors disabled:opacity-50"
                  >
                    <Save size={11} className={isSavingTelegram ? "animate-spin" : ""} />
                    Save Settings
                  </button>
                </div>
              </div>

              {/* Status Message (Save / Reset) */}
              {tgSettingsMsg && (
                <div
                  className={`p-2.5 rounded-lg text-[11px] flex items-start gap-2 ${
                    tgSettingsMsg.ok
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                      : "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                  }`}
                >
                  {tgSettingsMsg.ok ? <CheckCircle2 size={13} className="shrink-0 mt-0.5" /> : <AlertCircle size={13} className="shrink-0 mt-0.5" />}
                  <span>{tgSettingsMsg.message}</span>
                </div>
              )}

              {/* Gateway Test Result Banner (Inline) */}
              {testResult && (testResult.provider === "telegram" || testResult.provider === "direct_t_me" || testingType?.startsWith("telegram")) && (
                <div
                  className={`p-3 rounded-lg text-xs flex items-start justify-between gap-2.5 border ${
                    testResult.ok
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                      : "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {testResult.ok ? (
                      <CheckCircle2 size={15} className="shrink-0 mt-0.5 text-emerald-600" />
                    ) : (
                      <AlertCircle size={15} className="shrink-0 mt-0.5 text-red-600" />
                    )}
                    <div>
                      <p className="font-semibold text-xs">
                        {testResult.ok ? "Telegram Connection Verified" : "Telegram Connection Failed"}
                      </p>
                      <p className="text-[11px] mt-0.5">{testResult.message}</p>
                      {testResult.latencyMs !== undefined && (
                        <p className="font-mono text-[10px] opacity-75 mt-0.5">Latency: {testResult.latencyMs}ms</p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTestResult(null)}
                    className="text-[10px] opacity-60 hover:opacity-100 underline shrink-0"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              <div className="space-y-4 text-xs">
                {/* 2 Mode Selection Cards */}
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--color-foreground)] mb-2">
                    Select Your Telegram Connection Mode
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Mode 1: Bot API */}
                    <button
                      type="button"
                      onClick={() => handleSettingChange("telegram_provider", "bot_api")}
                      className={`p-3.5 rounded-xl border text-left transition-all ${
                        (settings.telegram_provider || "bot_api") === "bot_api"
                          ? "border-sky-500 bg-sky-500/10 shadow-xs ring-1 ring-sky-500/30"
                          : "border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-muted)]"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-xs text-[var(--color-foreground)]">🤖 Telegram Bot API (Automated Alerts)</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-700">Official Bot</span>
                      </div>
                      <p className="text-[11px] text-[var(--color-muted)] leading-snug">
                        Automated background message delivery via your own Telegram Bot token to channels, groups, or direct users.
                      </p>
                    </button>

                    {/* Mode 2: Direct t.me */}
                    <button
                      type="button"
                      onClick={() => handleSettingChange("telegram_provider", "direct_t_me")}
                      className={`p-3.5 rounded-xl border text-left transition-all ${
                        settings.telegram_provider === "direct_t_me"
                          ? "border-sky-500 bg-sky-500/10 shadow-xs ring-1 ring-sky-500/30"
                          : "border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-muted)]"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-xs text-[var(--color-foreground)]">⚡ Instant Direct (t.me)</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700">Zero API</span>
                      </div>
                      <p className="text-[11px] text-[var(--color-muted)] leading-snug">
                        Zero credentials required. Launches Telegram Web or Desktop App with 1-click formatted SEO reports.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Direct Mode Banner */}
                {settings.telegram_provider === "direct_t_me" && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-xs space-y-2">
                    <div className="flex items-center gap-2 font-semibold text-emerald-800">
                      <CheckCircle2 size={16} className="text-emerald-600" />
                      Instant 1-Click Telegram Sharing Enabled
                    </div>
                    <p className="text-[11px] text-[var(--color-muted)] leading-relaxed">
                      No bot setup or tokens required. Whenever SEO audits or alerts are generated, you can click &quot;Open in Telegram&quot; to forward reports to any chat, team group, or broadcast channel.
                    </p>
                  </div>
                )}

                {/* Bot API Inputs */}
                {settings.telegram_provider !== "direct_t_me" && (
                  <div className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/50 p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-[var(--color-foreground)] flex items-center gap-2">
                        <Bot size={14} className="text-sky-500" /> Telegram Bot API Credentials
                      </span>
                      <a
                        href="https://t.me/BotFather"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded hover:bg-sky-100 transition-colors"
                      >
                        👉 Open @BotFather <ExternalLink size={10} />
                      </a>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-medium text-[var(--color-muted)]">
                          Telegram Bot API Token <span className="text-red-500">*</span>
                          {configuredSecrets.has("telegram_bot_token") && (
                            <span className="ml-1.5 font-normal text-emerald-600">
                              (Saved in DB)
                            </span>
                          )}
                        </label>
                        {configuredSecrets.has("telegram_bot_token") && (
                          <button
                            type="button"
                            onClick={() => handleSettingChange("telegram_bot_token", "__CLEAR__")}
                            className="text-[10px] text-rose-500 hover:underline"
                          >
                            Clear Token
                          </button>
                        )}
                      </div>
                      <input
                        type="password"
                        value={settings.telegram_bot_token || ""}
                        onChange={(e) => handleSettingChange("telegram_bot_token", e.target.value)}
                        placeholder={
                          settings.telegram_bot_token === "__CLEAR__"
                            ? "[WILL BE CLEARED ON SAVE]"
                            : configuredSecrets.has("telegram_bot_token")
                            ? "•••••••••••••••• (Leave blank to keep saved token)"
                            : "123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ (From @BotFather)"
                        }
                        className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
                      />
                      <p className="text-[10px] text-[var(--color-muted)] mt-1">
                        Obtain your token by creating a bot via <code className="font-mono text-[10px]">@BotFather</code> on Telegram.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-[var(--color-muted)] mb-1">
                          Default Broadcast Chat ID or Channel Username
                        </label>
                        <input
                          type="text"
                          value={settings.telegram_chat_id || ""}
                          onChange={(e) => handleSettingChange("telegram_chat_id", e.target.value)}
                          placeholder="@my_seo_channel or 123456789"
                          className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
                        />
                        <p className="text-[10px] text-[var(--color-muted)] mt-1">
                          Can be a numerical user chat ID (get via <code className="font-mono text-[10px]">@userinfobot</code>) or public channel handle (e.g. <code className="font-mono text-[10px]">@seo_alerts</code>).
                        </p>
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-[var(--color-muted)] mb-1">
                          Bot Username (Optional)
                        </label>
                        <input
                          type="text"
                          value={settings.telegram_bot_username || ""}
                          onChange={(e) => handleSettingChange("telegram_bot_username", e.target.value)}
                          placeholder="MySeoCommandBot"
                          className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
                        />
                        <p className="text-[10px] text-[var(--color-muted)] mt-1">
                          Used to generate direct start links for workspace team members.
                        </p>
                      </div>
                    </div>

                    {/* Quick Step Guide */}
                    <div className="p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[11px] space-y-1 text-[var(--color-muted)]">
                      <p className="font-semibold text-[var(--color-foreground)]">📌 30-Second Quick Setup Guide:</p>
                      <ol className="list-decimal list-inside space-y-0.5">
                        <li>Open Telegram, search for <strong className="text-[var(--color-foreground)]">@BotFather</strong>, send <code className="font-mono text-[10px]">/newbot</code>.</li>
                        <li>Follow prompts to name your bot and copy the HTTP API token into the field above.</li>
                        <li>Send <code className="font-mono text-[10px]">/start</code> to your new bot (or add it as Admin to your channel).</li>
                        <li>Click <strong>Test Connection</strong> above to verify live delivery!</li>
                      </ol>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Direct Telegram Dispatch Console */}
            <Card className="p-5 border border-[var(--color-border)] space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-sky-500 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  <Send size={14} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Direct Telegram Messenger &amp; Alert Dispatcher</h3>
                  <p className="text-[11px] text-[var(--color-muted)]">Broadcast immediate rankings, AI citation opportunities, or technical alerts to Telegram</p>
                </div>
              </div>

              <form onSubmit={handleSendTelegram} className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] font-medium text-[var(--color-muted)] mb-1">
                    Target Telegram Chat ID / Channel (Leave blank to use default configured Chat ID)
                  </label>
                  <input
                    type="text"
                    value={tgRecipient}
                    onChange={(e) => setTgRecipient(e.target.value)}
                    placeholder={settings.telegram_chat_id ? `Default: ${settings.telegram_chat_id}` : "@channelname or 123456789"}
                    className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[11px] font-medium text-[var(--color-muted)]">
                      Message Content (HTML formatting supported)
                    </label>
                  </div>
                  {/* Preset Template Chips */}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    <button
                      type="button"
                      onClick={() =>
                        setTgMessage("🚀 <b>Weekly AI SEO Audit Ready!</b>\n\n4 new citation opportunities were discovered across ChatGPT and Perplexity. View actionable recommendations in Command Center.")
                      }
                      className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-[var(--color-surface-muted)] text-[var(--color-foreground)] border border-[var(--color-border)] hover:border-sky-500 hover:text-sky-700 transition-colors"
                    >
                      🚀 Weekly AI Audit
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setTgMessage("📈 <b>Top Keyword Ranking Alert!</b>\n\nYour primary keyword has advanced into the Top 3 Google Search positions. Estimated monthly click increase: +420.")
                      }
                      className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-[var(--color-surface-muted)] text-[var(--color-foreground)] border border-[var(--color-border)] hover:border-sky-500 hover:text-sky-700 transition-colors"
                    >
                      📈 Keyword Rank Jump
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setTgMessage("⚠️ <b>Crawler Health Diagnostic Alert</b>\n\n2 non-indexed pages detected on your primary domain. 1-click Google Indexing sync ready in Command Center.")
                      }
                      className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-[var(--color-surface-muted)] text-[var(--color-foreground)] border border-[var(--color-border)] hover:border-sky-500 hover:text-sky-700 transition-colors"
                    >
                      ⚠️ Crawler Alert
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setTgMessage("💡 <b>High-Intent Content Gap Identified</b>\n\nCompetitor search volume surge identified for your industry. New optimized article outline generated.")
                      }
                      className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-[var(--color-surface-muted)] text-[var(--color-foreground)] border border-[var(--color-border)] hover:border-sky-500 hover:text-sky-700 transition-colors"
                    >
                      💡 Content Gap
                    </button>
                  </div>
                  <textarea
                    rows={4}
                    value={tgMessage}
                    onChange={(e) => setTgMessage(e.target.value)}
                    placeholder="Enter message to dispatch directly via Telegram..."
                    required
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>

                {tgFeedback && (
                  <div
                    className={`p-2.5 rounded-lg text-[11px] flex items-start justify-between gap-2 ${
                      tgFeedback.ok
                        ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20"
                        : "bg-red-500/10 text-red-700 border border-red-500/20"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {tgFeedback.ok ? <CheckCircle2 size={14} className="shrink-0 mt-0.5 text-emerald-600" /> : <AlertCircle size={14} className="shrink-0 mt-0.5 text-red-600" />}
                      <div>
                        <span>{tgFeedback.message}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={tgSending || !tgMessage}
                    className="w-full sm:flex-1 py-2 px-4 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors disabled:opacity-50"
                  >
                    <Send size={13} />
                    {tgSending ? "Dispatching via Telegram..." : "Dispatch Message to Telegram"}
                  </button>
                  {tgMessage && (
                    <a
                      href={`https://t.me/share/url?url=${encodeURIComponent("https://seo-command-center.local")}&text=${encodeURIComponent(tgMessage.replace(/<[^>]*>/g, ""))}`}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full sm:w-auto py-2 px-3.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-muted)] text-[var(--color-foreground)] font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                    >
                      <ExternalLink size={13} />
                      Open Telegram Web / App
                    </a>
                  )}
                </div>
              </form>
            </Card>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 7: PLANS & PAYMENT INTEGRATIONS (STRIPE & RAZORPAY) */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === "plans_payments" && (
        <div className="space-y-6">
          {/* Subscription Plans Tier Management */}
          <Card className="p-5 border border-[var(--color-border)] space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <CreditCard size={18} className="text-indigo-500" />
                  Subscription Plans & Tier Architecture
                </h2>
                <p className="text-xs text-[var(--color-muted)]">
                  Define subscription tiers, maximum website allocations, keyword quotas, and AI article generation limits.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              {parsedPlans.map((plan) => (
                <div
                  key={plan.id}
                  className={`p-4 rounded-xl border flex flex-col justify-between ${
                    plan.isPopular
                      ? "border-indigo-500/50 bg-indigo-500/5 shadow-xs"
                      : "border-[var(--color-border)] bg-[var(--color-surface)]"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm text-[var(--color-foreground)]">{plan.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                        {plan.badge}
                      </span>
                    </div>

                    <div className="my-2">
                      <span className="text-2xl font-extrabold">${plan.priceMonthly}</span>
                      <span className="text-xs text-[var(--color-muted)]"> / month</span>
                    </div>

                    <div className="space-y-1.5 text-xs text-[var(--color-muted)] mt-4">
                      {plan.features.map((f, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-[var(--color-border)] flex items-center justify-between text-[11px] text-[var(--color-muted)]">
                    <span>Active Subscribers:</span>
                    <span className="font-semibold text-[var(--color-foreground)]">
                      {users.filter((u) => u.plan.toLowerCase() === plan.id.toLowerCase()).length} accounts
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {/* Plan Comparison Feature Matrix */}
            <div className="mt-6 pt-4 border-t border-[var(--color-border)]">
              <h3 className="text-sm font-semibold mb-3">Complete Plan Limits & Feature Matrix</h3>
              <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--color-surface-muted)] text-[var(--color-muted)] border-b border-[var(--color-border)]">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">Feature / Allocation</th>
                      <th className="py-2.5 px-3 font-semibold text-center w-28">Free Starter</th>
                      <th className="py-2.5 px-3 font-semibold text-center w-32">AI CMO Lite</th>
                      <th className="py-2.5 px-3 font-semibold text-center w-36 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                        AI CMO Pro ⭐
                      </th>
                      <th className="py-2.5 px-3 font-semibold text-center w-32">Enterprise</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    <tr className="hover:bg-[var(--color-surface-muted)]/50">
                      <td className="py-2.5 px-3 font-medium">Monthly Price</td>
                      <td className="py-2.5 px-3 text-center font-bold text-sm">$0 / mo</td>
                      <td className="py-2.5 px-3 text-center font-bold text-sm">$108 / mo</td>
                      <td className="py-2.5 px-3 text-center font-bold text-sm bg-indigo-500/5 text-indigo-600 dark:text-indigo-400">$208 / mo</td>
                      <td className="py-2.5 px-3 text-center font-bold text-sm">$499 / mo</td>
                    </tr>
                    <tr className="hover:bg-[var(--color-surface-muted)]/50">
                      <td className="py-2.5 px-3 font-medium">Connected Websites</td>
                      <td className="py-2.5 px-3 text-center font-semibold">1 Website</td>
                      <td className="py-2.5 px-3 text-center font-semibold">1 Website</td>
                      <td className="py-2.5 px-3 text-center font-semibold bg-indigo-500/5 text-indigo-600 dark:text-indigo-400">3 Websites</td>
                      <td className="py-2.5 px-3 text-center font-semibold">Unlimited</td>
                    </tr>
                    <tr className="hover:bg-[var(--color-surface-muted)]/50">
                      <td className="py-2.5 px-3 font-medium">Team Users</td>
                      <td className="py-2.5 px-3 text-center">1 User</td>
                      <td className="py-2.5 px-3 text-center font-semibold">2 Users</td>
                      <td className="py-2.5 px-3 text-center bg-indigo-500/5 font-semibold text-indigo-600 dark:text-indigo-400">5 Users</td>
                      <td className="py-2.5 px-3 text-center font-semibold">Unlimited</td>
                    </tr>
                    <tr className="hover:bg-[var(--color-surface-muted)]/50">
                      <td className="py-2.5 px-3 font-medium">Ranked Keywords Monitored</td>
                      <td className="py-2.5 px-3 text-center font-mono font-semibold">20</td>
                      <td className="py-2.5 px-3 text-center font-mono font-semibold">1,500</td>
                      <td className="py-2.5 px-3 text-center font-mono font-semibold bg-indigo-500/5 text-indigo-600 dark:text-indigo-400">5,000</td>
                      <td className="py-2.5 px-3 text-center font-mono font-semibold">Unlimited</td>
                    </tr>
                    <tr className="hover:bg-[var(--color-surface-muted)]/50">
                      <td className="py-2.5 px-3 font-medium">Search & AI Credits</td>
                      <td className="py-2.5 px-3 text-center font-mono">100 / mo</td>
                      <td className="py-2.5 px-3 text-center font-mono">25K / mo</td>
                      <td className="py-2.5 px-3 text-center font-mono bg-indigo-500/5 text-indigo-600 dark:text-indigo-400 font-semibold">100K / mo</td>
                      <td className="py-2.5 px-3 text-center font-mono font-semibold">500K / mo</td>
                    </tr>
                    <tr className="hover:bg-[var(--color-surface-muted)]/50">
                      <td className="py-2.5 px-3 font-medium">SEO Tools Suite</td>
                      <td className="py-2.5 px-3 text-center text-[var(--color-muted)]">Basic</td>
                      <td className="py-2.5 px-3 text-center text-emerald-600 font-semibold">Full Suite</td>
                      <td className="py-2.5 px-3 text-center bg-indigo-500/5 text-emerald-600 font-semibold">Full Suite</td>
                      <td className="py-2.5 px-3 text-center text-emerald-600 font-semibold">Full Suite</td>
                    </tr>
                    <tr className="hover:bg-[var(--color-surface-muted)]/50">
                      <td className="py-2.5 px-3 font-medium">AI Search Visibility Tracker</td>
                      <td className="py-2.5 px-3 text-center text-emerald-500">✅ 1 Prompt</td>
                      <td className="py-2.5 px-3 text-center text-emerald-500 font-semibold">✅ 15 Prompts</td>
                      <td className="py-2.5 px-3 text-center bg-indigo-500/5 text-emerald-500 font-semibold">✅ 100 Prompts</td>
                      <td className="py-2.5 px-3 text-center text-emerald-500 font-semibold">✅ Unlimited</td>
                    </tr>
                    <tr className="hover:bg-[var(--color-surface-muted)]/50">
                      <td className="py-2.5 px-3 font-medium">GEO Agent (Regional Citations)</td>
                      <td className="py-2.5 px-3 text-center text-zinc-400">❌</td>
                      <td className="py-2.5 px-3 text-center text-emerald-500 font-semibold">✅ Included</td>
                      <td className="py-2.5 px-3 text-center bg-indigo-500/5 text-emerald-500 font-semibold">✅ Full Access</td>
                      <td className="py-2.5 px-3 text-center text-emerald-500 font-semibold">✅ Full Access</td>
                    </tr>
                    <tr className="hover:bg-[var(--color-surface-muted)]/50">
                      <td className="py-2.5 px-3 font-medium">SEO Agent (Audits & Opportunities)</td>
                      <td className="py-2.5 px-3 text-center text-[var(--color-muted)]">Limited</td>
                      <td className="py-2.5 px-3 text-center text-emerald-600 font-semibold">Full</td>
                      <td className="py-2.5 px-3 text-center bg-indigo-500/5 text-emerald-600 font-semibold">Full</td>
                      <td className="py-2.5 px-3 text-center text-emerald-600 font-semibold">Full</td>
                    </tr>
                    <tr className="hover:bg-[var(--color-surface-muted)]/50">
                      <td className="py-2.5 px-3 font-medium">X / Twitter Agent</td>
                      <td className="py-2.5 px-3 text-center text-zinc-400">❌</td>
                      <td className="py-2.5 px-3 text-center text-emerald-500 font-semibold">✅ 30 posts/mo</td>
                      <td className="py-2.5 px-3 text-center bg-indigo-500/5 text-emerald-500 font-semibold">✅ 60 posts/mo</td>
                      <td className="py-2.5 px-3 text-center text-emerald-500 font-semibold">✅ Custom</td>
                    </tr>
                    <tr className="hover:bg-[var(--color-surface-muted)]/50">
                      <td className="py-2.5 px-3 font-medium">Reddit Distribution Agent</td>
                      <td className="py-2.5 px-3 text-center text-zinc-400">❌</td>
                      <td className="py-2.5 px-3 text-center text-zinc-400">❌ Pro only</td>
                      <td className="py-2.5 px-3 text-center bg-indigo-500/5 text-emerald-500 font-semibold">✅ Included</td>
                      <td className="py-2.5 px-3 text-center text-emerald-500 font-semibold">✅ Included</td>
                    </tr>
                    <tr className="hover:bg-[var(--color-surface-muted)]/50">
                      <td className="py-2.5 px-3 font-medium">AI Content Writer Agent</td>
                      <td className="py-2.5 px-3 text-center text-zinc-400">❌</td>
                      <td className="py-2.5 px-3 text-center text-zinc-400">❌ Pro only</td>
                      <td className="py-2.5 px-3 text-center bg-indigo-500/5 text-indigo-600 dark:text-indigo-400 font-semibold">30 / mo</td>
                      <td className="py-2.5 px-3 text-center font-semibold">Custom</td>
                    </tr>
                    <tr className="hover:bg-[var(--color-surface-muted)]/50">
                      <td className="py-2.5 px-3 font-medium">Publishing Integrations</td>
                      <td className="py-2.5 px-3 text-center">1 Target (WordPress)</td>
                      <td className="py-2.5 px-3 text-center text-emerald-500 font-semibold">✅ Unlimited</td>
                      <td className="py-2.5 px-3 text-center bg-indigo-500/5 text-emerald-500 font-semibold">✅ Unlimited</td>
                      <td className="py-2.5 px-3 text-center text-emerald-500 font-semibold">✅ Unlimited</td>
                    </tr>
                    <tr className="hover:bg-[var(--color-surface-muted)]/50">
                      <td className="py-2.5 px-3 font-medium">Competitor Monitoring</td>
                      <td className="py-2.5 px-3 text-center text-zinc-400">❌</td>
                      <td className="py-2.5 px-3 text-center text-emerald-500 font-semibold">✅ Included</td>
                      <td className="py-2.5 px-3 text-center bg-indigo-500/5 text-emerald-500 font-semibold">✅ Advanced</td>
                      <td className="py-2.5 px-3 text-center font-semibold text-purple-600">Enterprise</td>
                    </tr>
                    <tr className="hover:bg-[var(--color-surface-muted)]/50">
                      <td className="py-2.5 px-3 font-medium">Team Management & RBAC</td>
                      <td className="py-2.5 px-3 text-center text-zinc-400">❌</td>
                      <td className="py-2.5 px-3 text-center text-[var(--color-foreground)] font-medium">Basic</td>
                      <td className="py-2.5 px-3 text-center bg-indigo-500/5 text-[var(--color-foreground)] font-semibold">Advanced</td>
                      <td className="py-2.5 px-3 text-center font-semibold text-purple-600">Enterprise</td>
                    </tr>
                    <tr className="hover:bg-[var(--color-surface-muted)]/50">
                      <td className="py-2.5 px-3 font-medium">Support Channel</td>
                      <td className="py-2.5 px-3 text-center text-[var(--color-muted)]">Standard</td>
                      <td className="py-2.5 px-3 text-center text-emerald-500 font-semibold">Priority Email</td>
                      <td className="py-2.5 px-3 text-center bg-indigo-500/5 text-emerald-500 font-semibold">✅ Priority 24/7</td>
                      <td className="py-2.5 px-3 text-center text-emerald-500 font-semibold">✅ Dedicated SLA</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </Card>

          {/* Payment Gateways: Stripe and Razorpay */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Stripe Gateway Card */}
            <Card className="p-5 border border-[var(--color-border)] space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                    S
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Stripe Payment Gateway</h3>
                    <p className="text-[11px] text-[var(--color-muted)]">Credit Cards, Apple Pay, Global Currencies</p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={testingType === "stripe"}
                  onClick={() => runConnectionTest("stripe")}
                  className="px-2.5 py-1 text-[11px] rounded font-medium border border-indigo-200 dark:border-indigo-800 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 flex items-center gap-1"
                >
                  <RefreshCw size={11} className={testingType === "stripe" ? "animate-spin" : ""} />
                  Test Stripe
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-[var(--color-muted)]">Gateway Mode</label>
                  <select
                    value={settings.stripe_mode || "test"}
                    onChange={(e) => handleSettingChange("stripe_mode", e.target.value)}
                    className="px-2 py-1 text-xs rounded border border-[var(--color-border)] bg-[var(--color-surface)] font-semibold text-indigo-600"
                  >
                    <option value="test">TEST / SANDBOX</option>
                    <option value="live">LIVE PRODUCTION</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[var(--color-muted)] mb-1">
                    Stripe Publishable Key
                  </label>
                  <input
                    type="text"
                    value={settings.stripe_publishable_key || ""}
                    onChange={(e) => handleSettingChange("stripe_publishable_key", e.target.value)}
                    placeholder="pk_test_••••••••••••••••••••"
                    className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[var(--color-muted)] mb-1">
                    Stripe Secret Key
                  </label>
                  <input
                    type="password"
                    value={settings.stripe_secret_key || ""}
                    onChange={(e) => handleSettingChange("stripe_secret_key", e.target.value)}
                    placeholder="sk_test_••••••••••••••••••••"
                    className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[var(--color-muted)] mb-1">
                    Webhook Signing Secret
                  </label>
                  <input
                    type="password"
                    value={settings.stripe_webhook_secret || ""}
                    onChange={(e) => handleSettingChange("stripe_webhook_secret", e.target.value)}
                    placeholder="whsec_••••••••••••••••••••"
                    className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
                  />
                </div>
              </div>
            </Card>

            {/* Razorpay Gateway Card */}
            <Card className="p-5 border border-[var(--color-border)] space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                    R
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Razorpay Payment Gateway</h3>
                    <p className="text-[11px] text-[var(--color-muted)]">UPI, NetBanking, Indian & Global Cards</p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={testingType === "razorpay"}
                  onClick={() => runConnectionTest("razorpay")}
                  className="px-2.5 py-1 text-[11px] rounded font-medium border border-blue-200 dark:border-blue-800 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 flex items-center gap-1"
                >
                  <RefreshCw size={11} className={testingType === "razorpay" ? "animate-spin" : ""} />
                  Test Razorpay
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-[var(--color-muted)]">Gateway Mode</label>
                  <select
                    value={settings.razorpay_mode || "test"}
                    onChange={(e) => handleSettingChange("razorpay_mode", e.target.value)}
                    className="px-2 py-1 text-xs rounded border border-[var(--color-border)] bg-[var(--color-surface)] font-semibold text-blue-600"
                  >
                    <option value="test">TEST / SANDBOX</option>
                    <option value="live">LIVE PRODUCTION</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[var(--color-muted)] mb-1">
                    Razorpay Key ID
                  </label>
                  <input
                    type="text"
                    value={settings.razorpay_key_id || ""}
                    onChange={(e) => handleSettingChange("razorpay_key_id", e.target.value)}
                    placeholder="rzp_test_••••••••••••••••••••"
                    className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[var(--color-muted)] mb-1">
                    Razorpay Key Secret
                  </label>
                  <input
                    type="password"
                    value={settings.razorpay_key_secret || ""}
                    onChange={(e) => handleSettingChange("razorpay_key_secret", e.target.value)}
                    placeholder="Key Secret"
                    className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[var(--color-muted)] mb-1">
                    Razorpay Webhook Secret
                  </label>
                  <input
                    type="password"
                    value={settings.razorpay_webhook_secret || ""}
                    onChange={(e) => handleSettingChange("razorpay_webhook_secret", e.target.value)}
                    placeholder="Webhook secret"
                    className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
                  />
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 8: WEBSITES DIRECTORY */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === "websites" && (
        <Card className="p-5 border border-[var(--color-border)] space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold">All Websites Across Tenants ({filteredWebsites.length})</h2>
              <p className="text-xs text-[var(--color-muted)]">
                SuperAdmin global website index. Each site is partitioned to its tenant organization.
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-2.5 text-[var(--color-muted)]" />
              <input
                type="text"
                value={websiteSearch}
                onChange={(e) => setWebsiteSearch(e.target.value)}
                placeholder="Search domain, name, owner..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-muted)]">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Website</th>
                  <th className="py-2.5 px-3 font-semibold">Owner / Organization</th>
                  <th className="py-2.5 px-3 font-semibold">CMS Engine</th>
                  <th className="py-2.5 px-3 font-semibold">GSC Property</th>
                  <th className="py-2.5 px-3 font-semibold">Automation</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filteredWebsites.map((w) => (
                  <tr key={w.id} className="hover:bg-[var(--color-surface-muted)]/50 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-semibold text-[var(--color-foreground)]">{w.name}</div>
                      <a
                        href={w.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-[var(--color-muted)] hover:text-[var(--color-primary)] hover:underline flex items-center gap-1"
                      >
                        {w.url} <ExternalLink size={10} />
                      </a>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-medium text-[var(--color-foreground)]">{w.orgName || "Workspace"}</div>
                      <div className="text-[11px] text-[var(--color-muted)]">{w.ownerEmail || "Tenant"}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-mono text-[11px] rounded bg-[var(--color-surface-muted)] px-1.5 py-0.5 border border-[var(--color-border)]">
                        {w.cms}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-[var(--color-muted)] truncate max-w-[180px]">
                      {w.gscProperty || "Not connected"}
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-500 border border-blue-500/20">
                        Level {w.automationLevel}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={w.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] rounded font-medium border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)] hover:bg-[var(--color-surface-muted)] transition-colors"
                        >
                          Visit Site <ExternalLink size={11} />
                        </a>
                        <button
                          type="button"
                          disabled={deletingWebsiteId === w.id}
                          onClick={() => handleDeleteWebsite(w.id, w.name || w.url)}
                          title={`Delete ${w.name || w.url}`}
                          className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-colors disabled:opacity-50"
                        >
                          {deletingWebsiteId === w.id ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Trash2 size={13} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
