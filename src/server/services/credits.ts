import { prisma } from "@/server/db";
import { getCurrentUser } from "@/server/auth";

export type PlanType = "FREE" | "LITE" | "PRO" | "ENTERPRISE" | "BASIC" | "STARTER";

export const CREDIT_COSTS = {
  KEYWORD_SEARCH: 5,       // 5 credits per keyword research / SERP search
  AI_CITATION: 1,          // 1 credit per AI citation / prompt audit
  AI_ACTION: 2,            // 2 credits per autonomous AI action
  AI_ARTICLE: 25,          // 25 credits per full AI blog generation
} as const;

export const PLAN_LIMITS: Record<string, {
  name: string;
  priceMonthly: number;
  priceYearly: number;
  websites: number;
  users: number;
  keywords: number;
  credits: number;
  aiSearchPrompts: number;
  aiActions: number;
  aiArticles: number;
  xPostsPerMonth: number;
  publishing: number; // -1 for unlimited
  geoAgent: boolean;
  xAgent: boolean;
  codingAgent: boolean;
  redditAgent: boolean;
  articleAgent: boolean;
  competitorMonitoring: boolean;
  teamManagement: boolean;
  prioritySupport: boolean;
}> = {
  FREE: {
    name: "Free Starter",
    priceMonthly: 0,
    priceYearly: 0,
    websites: 1,
    users: 1,
    keywords: 20,
    credits: 100,
    aiSearchPrompts: 1,
    aiActions: 10,
    aiArticles: 0,
    xPostsPerMonth: 0,
    publishing: 1,
    geoAgent: false,
    xAgent: false,
    codingAgent: false,
    redditAgent: false,
    articleAgent: false,
    competitorMonitoring: false,
    teamManagement: false,
    prioritySupport: false,
  },
  BASIC: {
    name: "Free Starter",
    priceMonthly: 0,
    priceYearly: 0,
    websites: 1,
    users: 1,
    keywords: 20,
    credits: 100,
    aiSearchPrompts: 1,
    aiActions: 10,
    aiArticles: 0,
    xPostsPerMonth: 0,
    publishing: 1,
    geoAgent: false,
    xAgent: false,
    codingAgent: false,
    redditAgent: false,
    articleAgent: false,
    competitorMonitoring: false,
    teamManagement: false,
    prioritySupport: false,
  },
  STARTER: {
    name: "Free Starter",
    priceMonthly: 0,
    priceYearly: 0,
    websites: 1,
    users: 1,
    keywords: 20,
    credits: 100,
    aiSearchPrompts: 1,
    aiActions: 10,
    aiArticles: 0,
    xPostsPerMonth: 0,
    publishing: 1,
    geoAgent: false,
    xAgent: false,
    codingAgent: false,
    redditAgent: false,
    articleAgent: false,
    competitorMonitoring: false,
    teamManagement: false,
    prioritySupport: false,
  },
  LITE: {
    name: "AI CMO Lite",
    priceMonthly: 108,
    priceYearly: 1080,
    websites: 1,
    users: 2,
    keywords: 1500,
    credits: 25000,
    aiSearchPrompts: 15,
    aiActions: 250,
    aiArticles: 5,
    xPostsPerMonth: 30,
    publishing: -1,
    geoAgent: true,
    xAgent: true,
    codingAgent: true,
    redditAgent: false,
    articleAgent: false,
    competitorMonitoring: true,
    teamManagement: true,
    prioritySupport: true,
  },
  PRO: {
    name: "AI CMO Pro ⭐",
    priceMonthly: 208,
    priceYearly: 2080,
    websites: 3,
    users: 5,
    keywords: 5000,
    credits: 100000,
    aiSearchPrompts: 100,
    aiActions: 1000,
    aiArticles: 30,
    xPostsPerMonth: 60,
    publishing: -1,
    geoAgent: true,
    xAgent: true,
    codingAgent: true,
    redditAgent: true,
    articleAgent: true,
    competitorMonitoring: true,
    teamManagement: true,
    prioritySupport: true,
  },
  ENTERPRISE: {
    name: "AI CMO Enterprise",
    priceMonthly: 499,
    priceYearly: 4990,
    websites: 20,
    users: 15,
    keywords: 20000,
    credits: 500000,
    aiSearchPrompts: 500,
    aiActions: 5000,
    aiArticles: 100,
    xPostsPerMonth: 200,
    publishing: -1,
    geoAgent: true,
    xAgent: true,
    codingAgent: true,
    redditAgent: true,
    articleAgent: true,
    competitorMonitoring: true,
    teamManagement: true,
    prioritySupport: true,
  },
};

export function normalizePlan(plan?: string | null): PlanType {
  const p = (plan || "FREE").toUpperCase();
  if (p === "ENTERPRISE") return "ENTERPRISE";
  if (p === "PRO") return "PRO";
  if (p === "LITE") return "LITE";
  if (p === "STARTER" || p === "BASIC") return "FREE";
  return "FREE";
}

export function getPlanConfig(plan?: string | null) {
  const norm = normalizePlan(plan);
  return PLAN_LIMITS[norm] || PLAN_LIMITS.BASIC;
}

/**
 * Fetch current user credit balances and active plan allowances
 */
export async function getUserCredits(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      plan: true,
      isAdmin: true,
    },
  });

  if (!user) {
    return {
      creditsRemaining: 0,
      creditsTotal: 100,
      plan: "FREE" as PlanType,
      planLimits: PLAN_LIMITS.FREE,
    };
  }

  const rawUser = user as any;
  const plan = normalizePlan(user.plan);
  const planLimits = PLAN_LIMITS[plan];

  const creditsTotal = typeof rawUser.creditsTotal === "number" ? rawUser.creditsTotal : planLimits.credits;
  const creditsRemaining =
    typeof rawUser.creditsRemaining === "number" ? rawUser.creditsRemaining : creditsTotal;

  return {
    creditsRemaining,
    creditsTotal,
    plan,
    planLimits,
    isAdmin: Boolean(user.isAdmin),
  };
}

/**
 * Deduct credits from user account.
 * If user has insufficient credits, returns success: false.
 */
export async function deductCredits(params: {
  userId: string;
  amount: number;
  reason: string;
}): Promise<{
  success: boolean;
  remaining: number;
  total: number;
  required: number;
  error?: string;
}> {
  const { userId, amount, reason } = params;
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    return { success: false, remaining: 0, total: 0, required: amount, error: "User not found" };
  }

  // Admins have unlimited credits bypass
  if ((user as any).isAdmin) {
    return { success: true, remaining: 999999, total: 999999, required: amount };
  }

  const plan = normalizePlan(user.plan);
  const planLimits = PLAN_LIMITS[plan];

  const rawUser = user as any;
  const creditsTotal = typeof rawUser.creditsTotal === "number" ? rawUser.creditsTotal : planLimits.credits;
  let creditsRemaining =
    typeof rawUser.creditsRemaining === "number" ? rawUser.creditsRemaining : creditsTotal;

  if (creditsRemaining < amount) {
    return {
      success: false,
      remaining: creditsRemaining,
      total: creditsTotal,
      required: amount,
      error: `Insufficient credits. This action requires ${amount} credits, but you have ${creditsRemaining} remaining. Please upgrade your plan.`,
    };
  }

  creditsRemaining -= amount;

  await prisma.user.update({
    where: { id: userId },
    data: {
      creditsRemaining,
      creditsTotal,
    } as any,
  });

  return {
    success: true,
    remaining: creditsRemaining,
    total: creditsTotal,
    required: amount,
  };
}

/**
 * Check if the current user can access a specific autonomous agent or premium feature.
 */
export async function checkFeatureAccess(feature: keyof typeof PLAN_LIMITS.BASIC) {
  const currentUser = await getCurrentUser();
  const proOnlyFeatures = ["redditAgent", "articleAgent"];
  const requiredPlanName = proOnlyFeatures.includes(feature) ? "AI CMO Pro ⭐" : "AI CMO Lite";
  const requiredPrice = proOnlyFeatures.includes(feature) ? "$208/mo" : "$108/mo";

  if (!currentUser) {
    return {
      allowed: false,
      requiredPlan: requiredPlanName,
      price: requiredPrice,
      currentPlan: "FREE" as const,
    };
  }
  if (currentUser.isAdmin) {
    return {
      allowed: true,
      requiredPlan: requiredPlanName,
      price: requiredPrice,
      currentPlan: "ENTERPRISE" as const,
    };
  }

  const plan = normalizePlan((currentUser as any).plan);
  const limits = PLAN_LIMITS[plan];
  const isAllowed = Boolean(limits[feature]);

  return {
    allowed: isAllowed,
    requiredPlan: requiredPlanName,
    price: requiredPrice,
    currentPlan: plan,
  };
}

/**
 * Validates if the user is allowed to connect an additional website under their active plan.
 */
export async function checkWebsiteLimit(userId: string): Promise<{
  allowed: boolean;
  limit: number;
  currentCount: number;
  planName: string;
  error?: string;
}> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { allowed: false, limit: 0, currentCount: 0, planName: "None", error: "User not found" };
  if (user.isAdmin) return { allowed: true, limit: 9999, currentCount: 0, planName: "Administrator" };

  const plan = normalizePlan(user.plan);
  const limits = PLAN_LIMITS[plan];

  const memberships = await prisma.orgMember.findMany({ where: { userId } });
  const orgIds = memberships.map((m) => m.orgId).filter(Boolean);
  const currentCount = await prisma.website.count({
    where: { orgId: { in: orgIds } },
  });

  const allowed = currentCount < limits.websites;
  return {
    allowed,
    limit: limits.websites,
    currentCount,
    planName: limits.name,
    error: allowed
      ? undefined
      : `Your active plan (${limits.name}) allows up to ${limits.websites} connected website(s). You currently have ${currentCount}. Please upgrade to AI CMO Pro (${limits.websites < 3 ? "$208/mo for 3 sites" : "Enterprise"}) to add more domains.`,
  };
}

/**
 * Validates if the user is allowed to track additional AI search prompts for a website.
 */
export async function checkPromptLimit(websiteId: string): Promise<{
  allowed: boolean;
  limit: number;
  currentCount: number;
  planName: string;
  error?: string;
}> {
  const currentUser = await getCurrentUser();
  if (currentUser?.isAdmin) return { allowed: true, limit: 9999, currentCount: 0, planName: "Administrator" };

  const plan = normalizePlan(currentUser?.plan);
  const limits = PLAN_LIMITS[plan];

  const currentCount = await prisma.aiPrompt.count({
    where: { websiteId },
  });

  const allowed = currentCount < limits.aiSearchPrompts;
  return {
    allowed,
    limit: limits.aiSearchPrompts,
    currentCount,
    planName: limits.name,
    error: allowed
      ? undefined
      : `Your active plan (${limits.name}) allows up to ${limits.aiSearchPrompts} AI search prompts. You currently have ${currentCount}. Upgrade to AI CMO Lite (15 prompts) or Pro (100 prompts) to track more.`,
  };
}

