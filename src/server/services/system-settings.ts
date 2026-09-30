import { prisma } from "@/server/db";
import { encrypt, decrypt } from "@/server/crypto";

export type SystemSettingCategory =
  | "ai_models"
  | "developer_connect"
  | "google_auth"
  | "whatsapp"
  | "plans"
  | "payments_stripe"
  | "payments_razorpay";

export type SystemSettingItem = {
  key: string;
  category: SystemSettingCategory;
  isSecret: boolean;
  value: string;
  updatedAt?: string;
};

// Keys that should be encrypted before storage
const SECRET_KEYS = new Set([
  "ai_gemini_api_key",
  "ai_openai_api_key",
  "ai_claude_api_key",
  "ai_perplexity_api_key",
  "reddit_client_secret",
  "x_client_secret",
  "x_api_secret",
  "x_bearer_token",
  "google_client_secret",
  "whatsapp_auth_token",
  "whatsapp_meta_token",
  "stripe_secret_key",
  "stripe_webhook_secret",
  "razorpay_key_secret",
  "razorpay_webhook_secret",
]);

/**
 * Mask secret string for safe UI presentation (e.g. "sk-abc•••••••7890")
 */
export function maskSecret(val: string): string {
  if (!val || val.length < 8) return val ? "••••••••" : "";
  const prefix = val.slice(0, 4);
  const suffix = val.slice(-4);
  return `${prefix}••••••••${suffix}`;
}

/**
 * Default fallback configurations when database has not yet been populated
 */
export const DEFAULT_SYSTEM_SETTINGS: Record<string, { value: string; category: SystemSettingCategory }> = {
  // 1. AI Models
  ai_primary_provider: { value: "gemini", category: "ai_models" },
  ai_gemini_model: { value: "gemini-2.0-flash", category: "ai_models" },
  ai_gemini_api_key: { value: process.env.GEMINI_API_KEY || "", category: "ai_models" },
  ai_openai_model: { value: "gpt-4o", category: "ai_models" },
  ai_openai_api_key: { value: process.env.OPENAI_API_KEY || "", category: "ai_models" },
  ai_claude_model: { value: "claude-3-5-sonnet-20241022", category: "ai_models" },
  ai_claude_api_key: { value: "", category: "ai_models" },
  ai_perplexity_model: { value: "sonar-pro", category: "ai_models" },
  ai_perplexity_api_key: { value: "", category: "ai_models" },

  // 2. Developer Connect (Reddit & X)
  reddit_client_id: { value: process.env.REDDIT_CLIENT_ID || "", category: "developer_connect" },
  reddit_client_secret: { value: process.env.REDDIT_CLIENT_SECRET || "", category: "developer_connect" },
  reddit_redirect_uri: { value: "http://localhost:3000/api/auth/reddit/callback", category: "developer_connect" },
  reddit_user_agent: { value: "web:ai-seo-agent:v1.0 (by /u/aiseo)", category: "developer_connect" },

  x_client_id: { value: process.env.X_CLIENT_ID || "", category: "developer_connect" },
  x_client_secret: { value: process.env.X_CLIENT_SECRET || "", category: "developer_connect" },
  x_api_key: { value: process.env.X_API_KEY || "", category: "developer_connect" },
  x_api_secret: { value: process.env.X_API_SECRET || "", category: "developer_connect" },
  x_bearer_token: { value: process.env.X_BEARER_TOKEN || "", category: "developer_connect" },
  x_redirect_uri: { value: "http://localhost:3000/api/auth/x/callback", category: "developer_connect" },

  // 3. Google Auth & Search Console Setup
  google_client_id: { value: process.env.GOOGLE_CLIENT_ID || "", category: "google_auth" },
  google_client_secret: { value: process.env.GOOGLE_CLIENT_SECRET || "", category: "google_auth" },
  google_redirect_uri: { value: "http://localhost:3000/api/integrations/google/callback", category: "google_auth" },
  google_scopes: {
    value: "https://www.googleapis.com/auth/webmasters.readonly,https://www.googleapis.com/auth/analytics.readonly,openid,email,profile",
    category: "google_auth",
  },

  // 4. WhatsApp Authentication & Messaging Setup
  whatsapp_provider: { value: "twilio", category: "whatsapp" }, // "twilio" | "meta"
  whatsapp_account_sid: { value: process.env.TWILIO_ACCOUNT_SID || "", category: "whatsapp" },
  whatsapp_auth_token: { value: process.env.TWILIO_AUTH_TOKEN || "", category: "whatsapp" },
  whatsapp_from_number: { value: process.env.TWILIO_WHATSAPP_NUMBER || "whatsapp:+14155238886", category: "whatsapp" },
  whatsapp_meta_phone_id: { value: "", category: "whatsapp" },
  whatsapp_meta_account_id: { value: "", category: "whatsapp" },
  whatsapp_meta_token: { value: "", category: "whatsapp" },

  // 5. Subscription Plans
  plans_config: {
    value: JSON.stringify([
      {
        id: "basic",
        name: "Basic",
        priceMonthly: 29,
        priceYearly: 290,
        currency: "USD",
        badge: "Starter",
        features: [
          "1 Website Included",
          "1 User Account",
          "500 Monitored Keywords",
          "5K Search & AI Credits",
          "50 Autonomous AI Actions/mo",
          "Basic SEO Tools & Technical Audit",
          "AI Visibility & Brand Tracking",
          "Basic SEO Agent",
          "2 AI Articles / month",
          "1 Publishing Target (WordPress)",
        ],
        limits: {
          websites: 1,
          users: 1,
          keywords: 500,
          credits: 5000,
          aiActions: 50,
          seoTools: "Basic",
          aiVisibility: true,
          geoAgent: false,
          seoAgent: "Basic",
          articleAgent: false,
          redditAgent: false,
          xAgent: false,
          aiArticles: 2,
          publishing: 1,
          competitorMonitoring: "None",
          teamManagement: "None",
          prioritySupport: false,
        },
        isPopular: false,
      },
      {
        id: "pro",
        name: "Pro ⭐",
        priceMonthly: 79,
        priceYearly: 790,
        currency: "USD",
        badge: "Most Popular",
        features: [
          "5 Websites Included",
          "3 Team Users",
          "2,500 Monitored Keywords",
          "25K Search & AI Credits",
          "300 Autonomous AI Actions/mo",
          "Full SEO Tool Suite",
          "AI Visibility & Search Grounding",
          "GEO Agent Included",
          "Full SEO Autonomous Agent",
          "Article Agent & Automated Content",
          "Reddit & X AI Opportunity Agents",
          "20 AI Articles / month",
          "Unlimited Publishing Integrations",
          "Competitor Monitoring",
          "Basic Team Management",
          "Priority 24/7 Support",
        ],
        limits: {
          websites: 5,
          users: 3,
          keywords: 2500,
          credits: 25000,
          aiActions: 300,
          seoTools: "Full",
          aiVisibility: true,
          geoAgent: true,
          seoAgent: "Full",
          articleAgent: true,
          redditAgent: true,
          xAgent: true,
          aiArticles: 20,
          publishing: -1,
          competitorMonitoring: "Standard",
          teamManagement: "Basic",
          prioritySupport: true,
        },
        isPopular: true,
      },
      {
        id: "enterprise",
        name: "Enterprise",
        priceMonthly: 199,
        priceYearly: 1990,
        currency: "USD",
        badge: "Agency Scale",
        features: [
          "20 Websites Included",
          "10 Team Users",
          "10,000 Monitored Keywords",
          "100K Search & AI Credits",
          "1,000 Autonomous AI Actions/mo",
          "Full SEO Tool Suite",
          "AI Visibility & Multi-LLM Citation Graph",
          "GEO Agent Included",
          "Full SEO Autonomous Agent",
          "Article Agent & Automated Content",
          "Reddit & X AI Opportunity Agents",
          "50 AI Articles / month",
          "Unlimited Publishing Integrations",
          "Advanced Competitor Monitoring",
          "Advanced Team Management & RBAC",
          "Priority Dedicated SLA Support",
        ],
        limits: {
          websites: 20,
          users: 10,
          keywords: 10000,
          credits: 100000,
          aiActions: 1000,
          seoTools: "Full",
          aiVisibility: true,
          geoAgent: true,
          seoAgent: "Full",
          articleAgent: true,
          redditAgent: true,
          xAgent: true,
          aiArticles: 50,
          publishing: -1,
          competitorMonitoring: "Advanced",
          teamManagement: "Advanced",
          prioritySupport: true,
        },
        isPopular: false,
      },
    ]),
    category: "plans",
  },

  // 6. Payment Gateways: Stripe
  stripe_enabled: { value: "true", category: "payments_stripe" },
  stripe_mode: { value: "test", category: "payments_stripe" }, // "test" | "live"
  stripe_publishable_key: { value: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "pk_test_sample", category: "payments_stripe" },
  stripe_secret_key: { value: process.env.STRIPE_SECRET_KEY || "", category: "payments_stripe" },
  stripe_webhook_secret: { value: process.env.STRIPE_WEBHOOK_SECRET || "", category: "payments_stripe" },
  stripe_currency: { value: "USD", category: "payments_stripe" },

  // 7. Payment Gateways: Razorpay
  razorpay_enabled: { value: "true", category: "payments_razorpay" },
  razorpay_mode: { value: "test", category: "payments_razorpay" }, // "test" | "live"
  razorpay_key_id: { value: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_sample", category: "payments_razorpay" },
  razorpay_key_secret: { value: process.env.RAZORPAY_KEY_SECRET || "", category: "payments_razorpay" },
  razorpay_webhook_secret: { value: process.env.RAZORPAY_WEBHOOK_SECRET || "", category: "payments_razorpay" },
  razorpay_currency: { value: "INR", category: "payments_razorpay" },
};

/**
 * Retrieve all settings for admin display.
 * Secret keys are masked unless explicitly requested unmasked for server execution.
 */
export async function getSystemSettings(options: { unmaskSecrets?: boolean } = {}): Promise<Record<string, SystemSettingItem>> {
  try {
    const records = await prisma.systemSetting.findMany();
    const storedMap = new Map<string, string>();
    const updatedAtMap = new Map<string, Date>();

    for (const r of records) {
      storedMap.set(r.key, r.value);
      updatedAtMap.set(r.key, r.updatedAt);
    }

    const result: Record<string, SystemSettingItem> = {};

    for (const [key, def] of Object.entries(DEFAULT_SYSTEM_SETTINGS)) {
      const isSecret = SECRET_KEYS.has(key);
      let rawVal = storedMap.get(key) ?? def.value;

      // If secret and stored as encrypted JSON, decrypt it
      if (isSecret && rawVal) {
        if (rawVal.startsWith("ENC:")) {
          try {
            const packedHex = rawVal.slice(4);
            const buf = Buffer.from(packedHex, "hex");
            rawVal = decrypt({ cipher: buf });
          } catch {
            // keep raw or mask
          }
        }
      }

      const displayVal = isSecret && !options.unmaskSecrets ? maskSecret(rawVal) : rawVal;

      result[key] = {
        key,
        category: def.category,
        isSecret,
        value: displayVal,
        updatedAt: updatedAtMap.get(key)?.toISOString(),
      };
    }

    return result;
  } catch (error) {
    console.error("[SystemSettings] Failed to fetch settings:", error);
    // Return defaults masked
    const result: Record<string, SystemSettingItem> = {};
    for (const [key, def] of Object.entries(DEFAULT_SYSTEM_SETTINGS)) {
      const isSecret = SECRET_KEYS.has(key);
      result[key] = {
        key,
        category: def.category,
        isSecret,
        value: isSecret && !options.unmaskSecrets ? maskSecret(def.value) : def.value,
      };
    }
    return result;
  }
}

/**
 * Retrieve a single setting unmasked for server execution (e.g. API keys for LLM or payments)
 */
export async function getSystemSettingValue(key: string): Promise<string> {
  try {
    const record = await prisma.systemSetting.findUnique({ where: { key } });
    let val = record?.value ?? DEFAULT_SYSTEM_SETTINGS[key]?.value ?? "";

    if (SECRET_KEYS.has(key) && val) {
      if (val.startsWith("ENC:")) {
        try {
          const packedHex = val.slice(4);
          const buf = Buffer.from(packedHex, "hex");
          val = decrypt({ cipher: buf });
        } catch {
          // fallback
        }
      }
    }
    return val;
  } catch {
    return DEFAULT_SYSTEM_SETTINGS[key]?.value ?? "";
  }
}

/**
 * Update multiple settings. Encrypts sensitive keys with AES-256-GCM.
 */
export async function updateSystemSettings(
  updates: Record<string, string>,
): Promise<{ success: boolean; updatedCount: number }> {
  let count = 0;

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined || value === null) continue;

    // Skip updating secrets if user didn't change the masked string
    if (SECRET_KEYS.has(key) && value.includes("••••••••")) {
      continue;
    }

    const def = DEFAULT_SYSTEM_SETTINGS[key];
    const category = def ? def.category : "general";

    let storedValue = value.trim();

    // Encrypt secrets before writing to DB
    if (SECRET_KEYS.has(key) && storedValue) {
      try {
        const encrypted = encrypt(storedValue);
        const packedBuf = Buffer.from(encrypted.packed || Buffer.concat([
          Buffer.from(encrypted.iv),
          Buffer.from(encrypted.tag),
          Buffer.from(encrypted.cipher),
        ]));
        storedValue = `ENC:${packedBuf.toString("hex")}`;
      } catch (err) {
        console.warn(`[SystemSettings] Failed to encrypt secret for ${key}:`, err);
      }
    }

    await prisma.systemSetting.upsert({
      where: { key },
      create: {
        key,
        value: storedValue,
        category,
      },
      update: {
        value: storedValue,
        category,
      },
    });

    count++;
  }

  return { success: true, updatedCount: count };
}
