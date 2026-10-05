"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Layers,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";

export type IntegrationItem = {
  id: string;
  provider: string;
  title: string;
  description: string;
  category: "publishing" | "analytics" | "messaging" | "social";
  kind: "CMS" | "GSC" | "GA4" | "LLM";
  icon: (className?: string) => React.ReactNode;
  isConnected: boolean;
  connectedDetails?: string;
  buttonLabel?: string;
  agentHref?: string;
  modalFields: Array<{
    id: string;
    label: string;
    placeholder: string;
    type: "text" | "password" | "select";
    options?: Array<{ label: string; value: string }>;
    helperText?: string;
    required?: boolean;
    defaultValue?: string;
  }>;
};

// High-fidelity branded SVGs for each integration provider
function RedditIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path
        fill="#FF4500"
        d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.688-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"
      />
    </svg>
  );
}

function XTwitterIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path
        fill="#0F1419"
        d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
      />
    </svg>
  );
}
function WordPressIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path
        fill="#21759B"
        d="M12 2C6.477 2 2 6.477 2 12c0 2.228.73 4.286 1.957 5.952L8.27 6.47a7.96 7.96 0 013.73-.918c.08 0 .159.006.238.008L12 2zm-8.877 10c0 1.258.267 2.454.747 3.535l4.89-13.385A9.97 9.97 0 003.123 12zm8.877 9.948c-1.42 0-2.75-.306-3.953-.852l3.41-9.914 3.493 9.57c-.01.006-.022.01-.032.015a9.92 9.92 0 01-2.918 1.181zm6.983-4.437l-3.32-9.638c.677-.035 1.289-.107 1.289-.107.502-.06.442-.8-.06-.778 0 0-1.506.12-2.48.12-.914 0-2.45-.12-2.45-.12-.503-.023-.563.74-.06.778 0 0 .582.072 1.198.107l1.777 4.954-2.52 7.558 4.626-13.064c1.884 1.488 3.123 3.79 3.123 6.386 0 1.343-.306 2.614-.852 3.745z"
      />
    </svg>
  );
}

function WebflowIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path
        fill="#146EF5"
        d="M23.998 6.574l-6.84 11.233h-5.263l3.65-5.992h-.163c-2.317 2.91-5.187 4.933-9.582 5.093l4.636-7.609h.163c2.208 0 3.738-1.092 4.472-2.597h-5.95L13.758 0h5.698l-3.595 5.91h.163c1.743-1.638 3.847-2.676 6.974-2.703v3.367z"
      />
    </svg>
  );
}

function FramerIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path fill="#0055FF" d="M4 0h16v8h-8zM4 8h8l8 8H4zM4 16h8v8z" />
    </svg>
  );
}

function WixIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-black text-[11px] font-black text-white tracking-tighter">
      WıX
    </div>
  );
}

function SanityIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F03E2F] text-white">
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M14.5 3L8 9.5l6.5 6.5L16 14.5 11 9.5l5-5zM9.5 21L16 14.5 9.5 8 8 9.5l5 5-5 5z" />
      </svg>
    </div>
  );
}

function HubSpotIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path
        fill="#FF7A59"
        d="M18.88 7.37a3.49 3.49 0 00-2.61-3.37V2.6a1.59 1.59 0 00-3.18 0v1.4a3.49 3.49 0 00-2.61 3.37c0 1.25.66 2.34 1.64 2.96v4.34a3.5 3.5 0 00-1.74 3.03 3.52 3.52 0 107.03 0 3.5 3.5 0 00-1.74-3.03V10.33a3.46 3.46 0 001.64-2.96h1.57zm-4.2-1.75a1.86 1.86 0 110-3.72 1.86 1.86 0 010 3.72zm0 14.47a1.86 1.86 0 110-3.72 1.86 1.86 0 010 3.72z"
      />
    </svg>
  );
}

function GitHubIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path
        fill="#24292F"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

function ShopifyIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path
        fill="#96BF48"
        d="M20.2 6.4L18.4 2.8C18.2 2.3 17.8 2 17.3 2H6.7C6.2 2 5.8 2.3 5.6 2.8L3.8 6.4C3.3 7.3 3.6 8.5 4.5 9.1L11.2 13.6C11.7 13.9 12.3 13.9 12.8 13.6L19.5 9.1C20.4 8.5 20.7 7.3 20.2 6.4Z"
      />
      <path fill="#5E8E3E" d="M12 15.5L4 10.1V19C4 20.1 4.9 21 6 21H18C19.1 21 20 20.1 20 19V10.1L12 15.5Z" />
    </svg>
  );
}

function GoogleAnalyticsIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="4" fill="#F9AB00" fillOpacity="0.1" />
      <path
        d="M6 16.5C6 15.67 6.67 15 7.5 15C8.33 15 9 15.67 9 16.5V18.5C9 19.33 8.33 20 7.5 20C6.67 20 6 19.33 6 18.5V16.5Z"
        fill="#F9AB00"
      />
      <path
        d="M10.5 11.5C10.5 10.67 11.17 10 12 10C12.83 10 13.5 10.67 13.5 11.5V18.5C13.5 19.33 12.83 20 12 20C11.17 20 10.5 19.33 10.5 18.5V11.5Z"
        fill="#E37400"
      />
      <path
        d="M15 6.5C15 5.67 15.67 5 16.5 5C17.33 5 18 5.67 18 6.5V18.5C18 19.33 17.33 20 16.5 20C15.67 20 15 19.33 15 18.5V6.5Z"
        fill="#E37400"
      />
    </svg>
  );
}

function GoogleSearchConsoleIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path
        d="M19.5 21H4.5C3.67 21 3 20.33 3 19.5V4.5C3 3.67 3.67 3 4.5 3H19.5C20.33 3 21 3.67 21 4.5V19.5C21 20.33 20.33 21 19.5 21Z"
        fill="#4285F4"
        fillOpacity="0.1"
      />
      <path
        d="M7 16L10.5 12L13.5 15L17.5 9"
        stroke="#4285F4"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="17.5" cy="9" r="1.5" fill="#34A853" />
      <circle cx="13.5" cy="15" r="1.5" fill="#FBBC05" />
      <circle cx="10.5" cy="12" r="1.5" fill="#EA4335" />
    </svg>
  );
}

function WhatsAppIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path
        fill="#25D366"
        d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0012.04 2zm5.79 14.12c-.24.68-1.39 1.3-1.92 1.38-.5.08-1.14.12-3.69-.93-2.17-.9-3.58-3.11-3.69-3.26-.11-.15-.88-1.17-.88-2.23s.55-1.58.75-1.79c.2-.21.44-.26.59-.26.15 0 .3 0 .42.01.13.01.3.05.46.43.17.41.58 1.42.63 1.53.05.11.08.24.01.38-.07.14-.11.23-.21.35-.11.12-.22.26-.32.35-.11.1-.23.21-.1.43.13.22.58.95 1.24 1.54.85.76 1.57 1 1.79 1.11.22.11.35.1.48-.05.13-.15.56-.65.71-.87.15-.22.3-.18.5-.11.2.07 1.28.6 1.5.71.22.11.37.16.42.26.05.1.05.58-.19 1.26z"
      />
    </svg>
  );
}

function TelegramIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path
        fill="#229ED9"
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.19-.08-.05-.19-.02-.27 0-.12.03-1.99 1.26-5.61 3.71-.53.36-1.01.54-1.44.53-.47-.01-1.38-.27-2.05-.49-.83-.27-1.49-.42-1.43-.88.03-.24.37-.49 1.02-.75 3.99-1.74 6.66-2.88 8.01-3.44 3.81-1.59 4.6-1.87 5.12-1.88.11 0 .37.03.54.17.14.12.18.28.2.45-.01.07.01.21 0 .28z"
      />
    </svg>
  );
}

export function IntegrationsHub({
  websiteId,
  websiteName,
  websiteUrl,
  initialIntegrations,
  googleStatus,
}: {
  websiteId: string;
  websiteName: string;
  websiteUrl: string;
  initialIntegrations: Array<{
    id: string;
    provider: string;
    kind: string;
    status: string;
    config?: Record<string, unknown>;
  }>;
  googleStatus: {
    isConnected: boolean;
    email: string | null;
    isGscConnected: boolean;
    gscProperty: string | null;
    isGa4Connected: boolean;
    ga4PropertyId: string | null;
  };
}) {
  const router = useRouter();
  const [integrationsList, setIntegrationsList] = useState(initialIntegrations);
  const [activeModal, setActiveModal] = useState<IntegrationItem | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [modalFeedback, setModalFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  function isProviderConnected(providerId: string): boolean {
    if (providerId === "google_search_console") return googleStatus.isGscConnected;
    if (providerId === "google_analytics") return googleStatus.isGa4Connected;
    return integrationsList.some((i) => i.provider === providerId && i.status === "ACTIVE");
  }

  function getConnectedSummary(providerId: string): string | undefined {
    if (providerId === "google_search_console" && googleStatus.isGscConnected) {
      return googleStatus.gscProperty || websiteUrl;
    }
    if (providerId === "google_analytics" && googleStatus.isGa4Connected) {
      return googleStatus.ga4PropertyId ? `Property ${googleStatus.ga4PropertyId}` : "GA4 Active";
    }
    const found = integrationsList.find((i) => i.provider === providerId && i.status === "ACTIVE");
    if (!found) return undefined;
    if (providerId === "reddit") {
      const mode = (found.config?.mode as string) === "direct" ? "Direct Post" : "1-Click Copy & Paste";
      const subs = typeof found.config?.subreddits === "string" && found.config.subreddits ? ` · ${found.config.subreddits}` : "";
      return `Mode: ${mode}${subs}`;
    }
    if (providerId === "x") {
      const mode = (found.config?.mode as string) === "direct" ? "Direct Post" : "1-Click Copy & Paste";
      const handle = typeof found.config?.handle === "string" && found.config.handle ? ` · ${found.config.handle}` : "";
      return `Mode: ${mode}${handle}`;
    }
    if (typeof found.config?.username === "string") return `User: ${found.config.username}`;
    if (typeof found.config?.phoneNumber === "string") return found.config.phoneNumber;
    if (typeof found.config?.repo === "string") return found.config.repo;
    return "Active";
  }

  // Master definition of integration catalog
  const INTEGRATION_CATALOG: IntegrationItem[] = [
    // ── 1. CMS & Publishing Platforms ──
    {
      id: "wordpress",
      provider: "wordpress",
      title: "WordPress",
      description: "Publish articles to WordPress.com",
      category: "publishing",
      kind: "CMS",
      icon: (c) => <WordPressIcon className={c} />,
      isConnected: isProviderConnected("wordpress"),
      connectedDetails: getConnectedSummary("wordpress"),
      modalFields: [
        {
          id: "siteUrl",
          label: "WordPress.com Site URL",
          placeholder: "https://mysite.wordpress.com",
          type: "text",
          required: true,
          defaultValue: websiteUrl,
        },
        {
          id: "apiToken",
          label: "WordPress.com OAuth / REST Token",
          placeholder: "Paste WP.com Bearer Token",
          type: "password",
          required: true,
          helperText: "Generated in WordPress.com Developer Console",
        },
      ],
    },
    {
      id: "wordpress_self_hosted",
      provider: "wordpress_self_hosted",
      title: "WordPress (Self-Hosted)",
      description: "Connect via application password",
      category: "publishing",
      kind: "CMS",
      icon: (c) => <WordPressIcon className={c} />,
      isConnected: isProviderConnected("wordpress_self_hosted") || isProviderConnected("wordpress"),
      connectedDetails: getConnectedSummary("wordpress_self_hosted") || getConnectedSummary("wordpress"),
      modalFields: [
        {
          id: "siteUrl",
          label: "Website URL",
          placeholder: "https://example.com",
          type: "text",
          required: true,
          defaultValue: websiteUrl,
        },
        {
          id: "username",
          label: "WP Admin Username",
          placeholder: "admin or editor@domain.com",
          type: "text",
          required: true,
        },
        {
          id: "appPassword",
          label: "Application Password",
          placeholder: "xxxx xxxx xxxx xxxx",
          type: "password",
          required: true,
          helperText: "Generated in WP Admin → Users → Profile → Application Passwords",
        },
      ],
    },
    {
      id: "webflow",
      provider: "webflow",
      title: "Webflow",
      description: "Publish to Webflow CMS collections",
      category: "publishing",
      kind: "CMS",
      icon: (c) => <WebflowIcon className={c} />,
      isConnected: isProviderConnected("webflow"),
      connectedDetails: getConnectedSummary("webflow"),
      modalFields: [
        {
          id: "apiToken",
          label: "Webflow API Token",
          placeholder: "Bearer Token",
          type: "password",
          required: true,
          helperText: "Found in Webflow Site Settings → Integrations → API Access",
        },
        {
          id: "siteId",
          label: "Webflow Site ID",
          placeholder: "e.g. 5f9e2b109...",
          type: "text",
          required: true,
        },
        {
          id: "collectionId",
          label: "Blog CMS Collection ID",
          placeholder: "e.g. 5f9e2b109b...",
          type: "text",
          required: true,
        },
      ],
    },
    {
      id: "framer",
      provider: "framer",
      title: "Framer",
      description: "Publish to Framer CMS collections",
      category: "publishing",
      kind: "CMS",
      icon: (c) => <FramerIcon className={c} />,
      isConnected: isProviderConnected("framer"),
      connectedDetails: getConnectedSummary("framer"),
      modalFields: [
        {
          id: "framerApiKey",
          label: "Framer CMS API Key",
          placeholder: "framer_api_...",
          type: "password",
          required: true,
          helperText: "Generate an API Key in your Framer project settings.",
        },
        {
          id: "collectionName",
          label: "CMS Collection Name",
          placeholder: "Blog Posts or Articles",
          type: "text",
          required: true,
        },
      ],
    },
    {
      id: "wix",
      provider: "wix",
      title: "Wix",
      description: "Publish articles to your Wix site blog",
      category: "publishing",
      kind: "CMS",
      icon: (c) => <WixIcon className={c} />,
      isConnected: isProviderConnected("wix"),
      connectedDetails: getConnectedSummary("wix"),
      modalFields: [
        {
          id: "apiKey",
          label: "Wix API Key",
          placeholder: "Paste Wix API Key",
          type: "password",
          required: true,
        },
        {
          id: "accountId",
          label: "Wix Account ID",
          placeholder: "e.g. 8836241a-...",
          type: "text",
          required: true,
        },
        {
          id: "siteId",
          label: "Wix Site ID",
          placeholder: "e.g. 471b0981-...",
          type: "text",
          required: true,
        },
      ],
    },
    {
      id: "sanity",
      provider: "sanity",
      title: "Sanity",
      description: "Publish articles to your Sanity dataset",
      category: "publishing",
      kind: "CMS",
      icon: (c) => <SanityIcon className={c} />,
      isConnected: isProviderConnected("sanity"),
      connectedDetails: getConnectedSummary("sanity"),
      modalFields: [
        {
          id: "projectId",
          label: "Sanity Project ID",
          placeholder: "e.g. 3k9z81a",
          type: "text",
          required: true,
        },
        {
          id: "dataset",
          label: "Dataset Name",
          placeholder: "production",
          type: "text",
          required: true,
          defaultValue: "production",
        },
        {
          id: "token",
          label: "Sanity Write Token",
          placeholder: "sk...",
          type: "password",
          required: true,
          helperText: "Create a write token in Sanity Manage → API → Tokens",
        },
      ],
    },
    {
      id: "hubspot",
      provider: "hubspot",
      title: "HubSpot",
      description: "Publish articles to your HubSpot blog",
      category: "publishing",
      kind: "CMS",
      icon: (c) => <HubSpotIcon className={c} />,
      isConnected: isProviderConnected("hubspot"),
      connectedDetails: getConnectedSummary("hubspot"),
      modalFields: [
        {
          id: "accessToken",
          label: "HubSpot Private App Access Token",
          placeholder: "pat-na1-...",
          type: "password",
          required: true,
          helperText: "Created under HubSpot Settings → Integrations → Private Apps",
        },
        {
          id: "blogId",
          label: "HubSpot Blog ID (Optional)",
          placeholder: "e.g. 102938475",
          type: "text",
        },
      ],
    },
    {
      id: "github",
      provider: "github",
      title: "GitHub",
      description: "Publish articles to your repo as a pull request.",
      category: "publishing",
      kind: "CMS",
      icon: (c) => <GitHubIcon className={c} />,
      isConnected: isProviderConnected("github"),
      connectedDetails: getConnectedSummary("github"),
      modalFields: [
        {
          id: "repo",
          label: "Repository (owner/repo)",
          placeholder: "e.g. my-agency/my-nextjs-site",
          type: "text",
          required: true,
        },
        {
          id: "branch",
          label: "Base Branch",
          placeholder: "main",
          type: "text",
          defaultValue: "main",
          required: true,
        },
        {
          id: "contentPath",
          label: "Content Directory Path",
          placeholder: "content/blog or src/content/posts",
          type: "text",
          defaultValue: "content/blog",
          required: true,
        },
        {
          id: "token",
          label: "GitHub Personal Access Token",
          placeholder: "ghp_...",
          type: "password",
          required: true,
          helperText: "Token requires 'repo' permissions to create branches and pull requests.",
        },
      ],
    },
    {
      id: "shopify",
      provider: "shopify",
      title: "Shopify",
      description: "Publish articles to your Shopify store blog",
      category: "publishing",
      kind: "CMS",
      icon: (c) => <ShopifyIcon className={c} />,
      isConnected: isProviderConnected("shopify"),
      connectedDetails: getConnectedSummary("shopify"),
      modalFields: [
        {
          id: "storeDomain",
          label: "Shopify Store Domain",
          placeholder: "yourstore.myshopify.com",
          type: "text",
          required: true,
        },
        {
          id: "adminAccessToken",
          label: "Admin API Access Token",
          placeholder: "shpat_...",
          type: "password",
          required: true,
          helperText: "Generated in Shopify Admin → Apps → Develop apps",
        },
      ],
    },

    // ── 2. Analytics ──
    {
      id: "google_analytics",
      provider: "google_analytics",
      title: "Google Analytics",
      description: "Track website traffic and user behaviour",
      category: "analytics",
      kind: "GA4",
      icon: (c) => <GoogleAnalyticsIcon className={c} />,
      isConnected: googleStatus.isGa4Connected,
      connectedDetails: getConnectedSummary("google_analytics"),
      buttonLabel: googleStatus.isGa4Connected ? "Manage" : "Connect",
      modalFields: [
        {
          id: "propertyId",
          label: "GA4 Measurement / Property ID",
          placeholder: "e.g. 524688594",
          type: "text",
          required: true,
          defaultValue: googleStatus.ga4PropertyId ?? undefined,
          helperText: "Found in Google Analytics 4 Admin → Property Settings",
        },
      ],
    },
    {
      id: "google_search_console",
      provider: "google_search_console",
      title: "Google Search Console",
      description: "Monitor SEO performance and indexing",
      category: "analytics",
      kind: "GSC",
      icon: (c) => <GoogleSearchConsoleIcon className={c} />,
      isConnected: googleStatus.isGscConnected,
      connectedDetails: getConnectedSummary("google_search_console"),
      buttonLabel: googleStatus.isGscConnected ? "Manage" : "Connect",
      modalFields: [
        {
          id: "propertyUrl",
          label: "Search Console Property URL or Domain",
          placeholder: websiteUrl,
          type: "text",
          required: true,
          defaultValue: googleStatus.gscProperty ?? websiteUrl,
          helperText: "Prefix matching URL or domain property (e.g. sc-domain:example.com)",
        },
      ],
    },

    // ── 3. Messaging ──
    {
      id: "whatsapp",
      provider: "whatsapp",
      title: "WhatsApp",
      description: "Receive daily digests and chat with your AI CMO on WhatsApp",
      category: "messaging",
      kind: "LLM",
      icon: (c) => <WhatsAppIcon className={c} />,
      isConnected: isProviderConnected("whatsapp"),
      connectedDetails: getConnectedSummary("whatsapp"),
      modalFields: [
        {
          id: "phoneNumber",
          label: "WhatsApp Phone Number (with Country Code)",
          placeholder: "+91 9876543210 or +1 4155552671",
          type: "text",
          required: true,
          helperText: "Your phone will receive daily SEO summaries and urgent ranking alerts.",
        },
        {
          id: "frequency",
          label: "Alert Frequency",
          placeholder: "Daily Morning Digest (9:00 AM)",
          type: "select",
          options: [
            { label: "Daily Morning Digest (9:00 AM)", value: "daily" },
            { label: "Real-time Critical Alerts & Weekly Summary", value: "critical_weekly" },
            { label: "Weekly Executive SEO Report (Mondays)", value: "weekly" },
          ],
        },
      ],
    },
    {
      id: "telegram",
      provider: "telegram",
      title: "Telegram",
      description: "Receive daily digests and chat with your AI CMO on Telegram",
      category: "messaging",
      kind: "LLM",
      icon: (c) => <TelegramIcon className={c} />,
      isConnected: isProviderConnected("telegram"),
      connectedDetails: getConnectedSummary("telegram"),
      modalFields: [
        {
          id: "chatId",
          label: "Telegram Chat ID or Username",
          placeholder: "@my_seo_channel or 123456789",
          type: "text",
          required: true,
          helperText: "Send /start to our bot @SEOCommandBot to get your Chat ID.",
        },
        {
          id: "botToken",
          label: "Custom Telegram Bot Token (Optional)",
          placeholder: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
          type: "password",
          helperText: "Leave blank to use our default verified @SEOCommandBot notification service.",
        },
      ],
    },

    // ── 4. Social & Community Distribution (Reddit & X) ──
    {
      id: "reddit",
      provider: "reddit",
      title: "Reddit",
      description: "Suggest AI responses to relevant subreddits — direct post or copy/paste",
      category: "social",
      kind: "LLM",
      icon: (c) => <RedditIcon className={c} />,
      isConnected: isProviderConnected("reddit"),
      connectedDetails: getConnectedSummary("reddit"),
      agentHref: `/reddit-agent?website=${encodeURIComponent(websiteId)}`,
      modalFields: [
        {
          id: "mode",
          label: "Publishing & Suggestion Mode",
          placeholder: "Choose Posting Mode",
          type: "select",
          defaultValue: "copy_paste",
          options: [
            { label: "1-Click Copy & Paste (Recommended - Zero Credentials)", value: "copy_paste" },
            { label: "Direct Auto-Post (Reddit OAuth Script App)", value: "direct" },
          ],
          helperText: "In Copy & Paste mode, AI finds questions and prepares ready-to-copy responses with zero API keys.",
        },
        {
          id: "subreddits",
          label: "Target Subreddits (comma separated)",
          placeholder: "r/SEO, r/digitalmarketing, r/entrepreneur",
          type: "text",
          helperText: "Subreddits to monitor for high-intent questions and answer suggestions.",
        },
        {
          id: "username",
          label: "Reddit Username / Handle (Optional)",
          placeholder: "u/your_brand",
          type: "text",
        },
        {
          id: "clientId",
          label: "Reddit App Client ID (Only for Direct Auto-Post)",
          placeholder: "14-char script client ID",
          type: "text",
          helperText: "Created at reddit.com/prefs/apps (script app). Leave empty for copy & paste mode.",
        },
        {
          id: "clientSecret",
          label: "Reddit App Secret (Only for Direct Auto-Post)",
          placeholder: "Paste app secret",
          type: "password",
        },
      ],
    },
    {
      id: "x",
      provider: "x",
      title: "X (Twitter)",
      description: "Suggest viral threads & brand replies — direct post or copy/paste",
      category: "social",
      kind: "LLM",
      icon: (c) => <XTwitterIcon className={c} />,
      isConnected: isProviderConnected("x"),
      connectedDetails: getConnectedSummary("x"),
      agentHref: `/x-agent?website=${encodeURIComponent(websiteId)}`,
      modalFields: [
        {
          id: "mode",
          label: "Publishing & Suggestion Mode",
          placeholder: "Choose Posting Mode",
          type: "select",
          defaultValue: "copy_paste",
          options: [
            { label: "1-Click Copy & Paste (Recommended - Zero Credentials)", value: "copy_paste" },
            { label: "Direct Auto-Post (X Developer API v2)", value: "direct" },
          ],
          helperText: "In Copy & Paste mode, AI drafts tweets and reply suggestions you can 1-click copy directly into X.",
        },
        {
          id: "handle",
          label: "X Brand Handle",
          placeholder: "@yourbrand",
          type: "text",
          helperText: "Your official brand or founder profile on X.",
        },
        {
          id: "tone",
          label: "Brand Voice & Content Persona",
          placeholder: "Select tone",
          type: "select",
          defaultValue: "authoritative",
          options: [
            { label: "Authoritative & Data-Driven Industry Expert", value: "authoritative" },
            { label: "Founder / Building in Public & Storytelling", value: "founder" },
            { label: "Casual, Punchy & Educational", value: "casual" },
          ],
        },
        {
          id: "apiKey",
          label: "X API Consumer Key (Only for Direct Auto-Post)",
          placeholder: "Paste X API Key",
          type: "text",
          helperText: "From developer.x.com portal. Leave empty for copy & paste mode.",
        },
        {
          id: "apiSecret",
          label: "X API Secret (Only for Direct Auto-Post)",
          placeholder: "Paste X API Secret",
          type: "password",
        },
        {
          id: "accessToken",
          label: "X User Access Token (Only for Direct Auto-Post)",
          placeholder: "Paste User Access Token",
          type: "password",
        },
      ],
    },
  ];

  // Open modal with prefilled defaults
  function handleOpenModal(item: IntegrationItem) {
    // If it's Google Search Console or Analytics and not connected, prompt Google OAuth directly
    if (
      (item.provider === "google_search_console" || item.provider === "google_analytics") &&
      !item.isConnected
    ) {
      window.location.href = `/api/integrations/google/auth?websiteId=${encodeURIComponent(websiteId)}&redirect=true`;
      return;
    }

    const initialVals: Record<string, string> = {};
    item.modalFields.forEach((f) => {
      initialVals[f.id] = f.defaultValue || "";
    });
    setFormValues(initialVals);
    setModalFeedback(null);
    setActiveModal(item);
  }

  // Handle Save / Connect
  async function handleConnectSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeModal) return;
    setLoading(true);
    setModalFeedback(null);

    try {
      // If it's Google Analytics / Search Console manual update:
      if (activeModal.provider === "google_search_console" || activeModal.provider === "google_analytics") {
        await fetch("/api/integrations/google/connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            websiteId,
            gscProperty: formValues.propertyUrl || undefined,
            ga4PropertyId: formValues.propertyId || undefined,
            accessToken: "local-manual-override",
          }),
        }).catch(() => {});

        setModalFeedback({ type: "success", message: "Connected successfully!" });
        setTimeout(() => {
          setActiveModal(null);
          router.refresh();
        }, 800);
        return;
      }

      // Standard integration save
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteId,
          provider: activeModal.provider,
          kind: activeModal.kind,
          config: formValues,
          secrets: {
            ...formValues,
          },
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save integration.");
      }

      setIntegrationsList((prev) => [
        ...prev.filter((i) => i.provider !== activeModal.provider),
        {
          id: `int_${Date.now()}`,
          provider: activeModal.provider,
          kind: activeModal.kind,
          status: "ACTIVE",
          config: formValues,
        },
      ]);

      setModalFeedback({ type: "success", message: `${activeModal.title} connected successfully!` });
      setTimeout(() => {
        setActiveModal(null);
        router.refresh();
      }, 700);
    } catch (err: unknown) {
      setModalFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Connection failed. Please check inputs.",
      });
    } finally {
      setLoading(false);
    }
  }

  // Handle Disconnect
  async function handleDisconnect(item: IntegrationItem) {
    if (!confirm(`Are you sure you want to disconnect ${item.title}?`)) return;
    setLoading(true);

    try {
      if (item.provider === "google_search_console" || item.provider === "google_analytics") {
        await fetch(`/api/integrations/google/connect?websiteId=${websiteId}`, {
          method: "DELETE",
        });
      } else {
        await fetch(`/api/integrations?websiteId=${websiteId}&provider=${item.provider}`, {
          method: "DELETE",
        });
        setIntegrationsList((prev) => prev.filter((i) => i.provider !== item.provider));
      }

      setActiveModal(null);
      router.refresh();
    } catch {
      alert("Failed to disconnect.");
    } finally {
      setLoading(false);
    }
  }

  const publishingItems = INTEGRATION_CATALOG.filter((i) => i.category === "publishing");
  const analyticsItems = INTEGRATION_CATALOG.filter((i) => i.category === "analytics");
  const messagingItems = INTEGRATION_CATALOG.filter((i) => i.category === "messaging");
  const socialItems = INTEGRATION_CATALOG.filter((i) => i.category === "social");

  // Reusable Card Renderer matching the user's uploaded images
  function renderCard(item: IntegrationItem) {
    return (
      <div
        key={item.id}
        className="group relative flex flex-col justify-between rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-xs transition-all hover:border-[#D1D5DB] hover:shadow-sm dark:border-[var(--color-border)] dark:bg-[var(--color-surface)]"
      >
        <div className="flex items-start gap-3.5">
          {/* Logo container */}
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#F3F4F6] bg-white p-2 shadow-2xs dark:border-neutral-700 dark:bg-neutral-800">
            {item.icon("w-6 h-6 object-contain")}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-semibold tracking-tight text-[#111827] dark:text-[#F9FAFB]">
                {item.title}
              </h3>
              {item.isConnected && (
                <span className="rounded-full bg-emerald-50 px-1.5 py-0.2 text-[10px] font-bold text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                  Active
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-[#6B7280] dark:text-[var(--color-muted)] leading-relaxed">
              {item.description}
            </p>
            {item.connectedDetails && (
              <p className="mt-1 font-mono text-[11px] text-emerald-600 dark:text-emerald-400 truncate">
                {item.connectedDetails}
              </p>
            )}
          </div>
        </div>

        {/* Card Footer: Status Dot + Action Buttons */}
        <div className="mt-5 flex items-center justify-between border-t border-[#F3F4F6] pt-3.5 dark:border-[var(--color-border)]">
          <div className="flex items-center gap-2 text-xs">
            <span
              className={`h-2 w-2 rounded-full ${
                item.isConnected ? "bg-[#10B981]" : "bg-[#D1D5DB] dark:bg-neutral-600"
              }`}
            />
            <span
              className={`text-xs ${
                item.isConnected
                  ? "font-medium text-[#10B981]"
                  : "text-[#9CA3AF] dark:text-[var(--color-muted)]"
              }`}
            >
              {item.isConnected ? "Connected" : "Not connected"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {item.agentHref && (
              <Link
                href={item.agentHref}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-[#4B5563] hover:bg-[#F3F4F6] hover:text-[#111827] dark:text-neutral-300 dark:hover:bg-neutral-800 transition-colors"
                title="View suggestions and posts"
              >
                <span>Open Agent</span>
                <ArrowRight size={11} />
              </Link>
            )}

            <button
              type="button"
              onClick={() => handleOpenModal(item)}
              className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold transition-all ${
                item.isConnected
                  ? "border border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F9FAFB] dark:border-[var(--color-border)] dark:bg-[var(--color-surface)] dark:text-neutral-200 dark:hover:bg-[var(--color-surface-muted)]"
                  : "bg-[#111827] text-white hover:bg-[#1F2937] dark:bg-white dark:text-black dark:hover:bg-neutral-200 shadow-xs"
              }`}
            >
              {item.isConnected ? (
                <span>Manage</span>
              ) : (
                <>
                  <Lock size={12} className="opacity-80" />
                  <span>{item.buttonLabel || "Connect"}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      {/* SECTION 1: CMS & PUBLISHING */}
      <section className="space-y-3.5">
        <div>
          <h2 className="text-base font-bold tracking-tight text-[#111827] dark:text-[#F9FAFB]">
            Publishing Platforms
          </h2>
          <p className="mt-0.5 text-xs text-[#6B7280] dark:text-[var(--color-muted)]">
            Connect your content management system to deploy approved articles, blogs, and SEO metadata automatically.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {publishingItems.map((item) => renderCard(item))}
        </div>
      </section>

      {/* SECTION 2: ANALYTICS (EXACT MATCH TO IMAGE 2) */}
      <section className="space-y-3.5 pt-2">
        <div>
          <h2 className="text-base font-bold tracking-tight text-[#111827] dark:text-[#F9FAFB]">
            Analytics
          </h2>
          <p className="mt-0.5 text-xs text-[#6B7280] dark:text-[var(--color-muted)]">
            Connect analytics tools to track performance. Disconnecting will remove the connector and all collected data.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {analyticsItems.map((item) => renderCard(item))}
        </div>
      </section>

      {/* SECTION 3: MESSAGING (EXACT MATCH TO IMAGE 2) */}
      <section className="space-y-3.5 pt-2">
        <div>
          <h2 className="text-base font-bold tracking-tight text-[#111827] dark:text-[#F9FAFB]">
            Messaging
          </h2>
          <p className="mt-0.5 text-xs text-[#6B7280] dark:text-[var(--color-muted)]">
            Chat with your AI CMO directly from your phone
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {messagingItems.map((item) => renderCard(item))}
        </div>
      </section>

      {/* SECTION 4: SOCIAL & COMMUNITY DISTRIBUTION (REDDIT & X) */}
      <section className="space-y-3.5 pt-2">
        <div>
          <h2 className="text-base font-bold tracking-tight text-[#111827] dark:text-[#F9FAFB]">
            Social &amp; Community Distribution
          </h2>
          <p className="mt-0.5 text-xs text-[#6B7280] dark:text-[var(--color-muted)]">
            AI monitors high-intent discussions and drafts responses for Reddit &amp; X. Choose between <strong>1-click copy &amp; paste suggestions</strong> (zero API credentials needed) or <strong>direct auto-posting</strong> via API.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {socialItems.map((item) => renderCard(item))}
        </div>
      </section>

      {/* INTERACTIVE CONNECTION / CONFIGURATION MODAL */}
      {activeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          onClick={() => !loading && setActiveModal(null)}
        >
          <div
            className="relative w-full max-w-md rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-2xl dark:border-[var(--color-border)] dark:bg-[var(--color-surface)] sm:p-7"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="absolute right-4 top-4 rounded-md p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
            >
              <X size={18} />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-2 dark:border-neutral-700 dark:bg-neutral-800">
                {activeModal.icon("w-6 h-6 object-contain")}
              </div>
              <div>
                <h3 className="text-base font-bold text-[#111827] dark:text-[#F9FAFB]">
                  {activeModal.isConnected ? `Manage ${activeModal.title}` : `Connect ${activeModal.title}`}
                </h3>
                <p className="text-xs text-[#6B7280] dark:text-[var(--color-muted)]">
                  {activeModal.description}
                </p>
              </div>
            </div>

            {modalFeedback && (
              <div
                className={`mt-4 rounded-lg p-3 text-xs flex items-center gap-2 ${
                  modalFeedback.type === "success"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}
              >
                {modalFeedback.type === "success" ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                <span>{modalFeedback.message}</span>
              </div>
            )}

            {/* Modal Form */}
            <form onSubmit={handleConnectSubmit} className="mt-5 space-y-4 text-xs">
              {activeModal.modalFields.map((field) => (
                <div key={field.id}>
                  <label className="block font-semibold text-[#374151] dark:text-neutral-200">
                    {field.label} {field.required && <span className="text-red-500">*</span>}
                  </label>

                  {field.type === "select" ? (
                    <select
                      value={formValues[field.id] || field.options?.[0]?.value || ""}
                      onChange={(e) =>
                        setFormValues((prev) => ({ ...prev, [field.id]: e.target.value }))
                      }
                      className="mt-1.5 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-xs text-[#111827] focus:border-black focus:outline-none dark:border-[var(--color-border)] dark:bg-[var(--color-surface-muted)] dark:text-neutral-100"
                    >
                      {field.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type}
                      required={field.required}
                      placeholder={field.placeholder}
                      value={formValues[field.id] ?? ""}
                      onChange={(e) =>
                        setFormValues((prev) => ({ ...prev, [field.id]: e.target.value }))
                      }
                      className="mt-1.5 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-xs font-mono text-[#111827] focus:border-black focus:outline-none dark:border-[var(--color-border)] dark:bg-[var(--color-surface-muted)] dark:text-neutral-100"
                    />
                  )}

                  {field.helperText && (
                    <p className="mt-1 text-[11px] text-[#6B7280] dark:text-[var(--color-muted)]">
                      {field.helperText}
                    </p>
                  )}
                </div>
              ))}

              <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#E5E7EB] dark:border-[var(--color-border)]">
                {activeModal.isConnected ? (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleDisconnect(activeModal)}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                  >
                    <Trash2 size={13} />
                    <span>Disconnect</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="rounded-lg px-3 py-2 text-xs font-medium text-[#6B7280] hover:text-[#111827] transition-colors"
                  >
                    Cancel
                  </button>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-1.5 rounded-lg bg-[#111827] px-5 py-2 text-xs font-semibold text-white hover:bg-[#1F2937] dark:bg-white dark:text-black dark:hover:bg-neutral-200 transition-colors shadow-xs disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={14} />
                  )}
                  <span>{activeModal.isConnected ? "Save Changes" : "Connect Provider"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
