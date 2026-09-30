import { prisma } from "@/server/db";
import { getCurrentUser } from "@/server/auth";

export type PlanType = "BASIC" | "STARTER" | "PRO" | "ENTERPRISE";

export const CREDIT_COSTS = {
  KEYWORD_SEARCH: 5,       // 5 credits per keyword research / SERP search
  AI_CITATION: 1,          // 1 credit per AI citation / prompt audit
  AI_ACTION: 2,            // 2 credits per autonomous AI action
  AI_ARTICLE: 25,          // 25 credits per full AI blog generation
} as const;

export const PLAN_LIMITS: Record<string, {
  name: string;
  priceMonthly: number;
  websites: number;
  users: number;
  keywords: number;
  credits: number;
  aiActions: number;
  aiArticles: number;
  publishing: number; // -1 for unlimited
  geoAgent: boolean;
  articleAgent: boolean;
  redditAgent: boolean;
  xAgent: boolean;
  competitorMonitoring: boolean;
  teamManagement: boolean;
  prioritySupport: boolean;
}> = {
  BASIC: {
    name: "Basic",
    priceMonthly: 29,
    websites: 1,
    users: 1,
    keywords: 500,
    credits: 5000,
    aiActions: 50,
    aiArticles: 2,
    publishing: 1,
    geoAgent: false,
    articleAgent: false,
    redditAgent: false,
    xAgent: false,
    competitorMonitoring: false,
    teamManagement: false,
    prioritySupport: false,
  },
  STARTER: {
    name: "Basic",
    priceMonthly: 29,
    websites: 1,
    users: 1,
    keywords: 500,
    credits: 5000,
    aiActions: 50,
    aiArticles: 2,
    publishing: 1,
    geoAgent: false,
    articleAgent: false,
    redditAgent: false,
    xAgent: false,
    competitorMonitoring: false,
    teamManagement: false,
    prioritySupport: false,
  },
  PRO: {
    name: "Pro ⭐",
    priceMonthly: 79,
    websites: 5,
    users: 3,
    keywords: 2500,
    credits: 25000,
    aiActions: 300,
    aiArticles: 20,
    publishing: -1,
    geoAgent: true,
    articleAgent: true,
    redditAgent: true,
    xAgent: true,
    competitorMonitoring: true,
    teamManagement: true,
    prioritySupport: true,
  },
  ENTERPRISE: {
    name: "Enterprise",
    priceMonthly: 199,
    websites: 20,
    users: 10,
    keywords: 10000,
    credits: 100000,
    aiActions: 1000,
    aiArticles: 50,
    publishing: -1,
    geoAgent: true,
    articleAgent: true,
    redditAgent: true,
    xAgent: true,
    competitorMonitoring: true,
    teamManagement: true,
    prioritySupport: true,
  },
};

export function normalizePlan(plan?: string | null): PlanType {
  const p = (plan || "BASIC").toUpperCase();
  if (p === "ENTERPRISE") return "ENTERPRISE";
  if (p === "PRO") return "PRO";
  if (p === "STARTER") return "BASIC";
  return "BASIC";
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
      creditsTotal: 5000,
      plan: "BASIC" as PlanType,
      planLimits: PLAN_LIMITS.BASIC,
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
  if (!currentUser) return { allowed: false, requiredPlan: "PRO", currentPlan: "BASIC" };
  if (currentUser.isAdmin) return { allowed: true, requiredPlan: "PRO", currentPlan: "ENTERPRISE" };

  const plan = normalizePlan((currentUser as any).plan);
  const limits = PLAN_LIMITS[plan];
  const isAllowed = Boolean(limits[feature]);

  return {
    allowed: isAllowed,
    requiredPlan: "PRO" as const,
    currentPlan: plan,
  };
}
