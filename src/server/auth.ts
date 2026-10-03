import crypto from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/server/db";
import { isAdminEmail } from "@/server/authz";
import {
  SESSION_COOKIE_NAME,
  type SessionPayload,
  createSessionToken,
  verifySessionToken,
} from "@/lib/session";

export {
  SESSION_COOKIE_NAME,
  type SessionPayload,
  createSessionToken,
  verifySessionToken,
};

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string | null | undefined): boolean {
  if (!storedHash) return false;
  const cleanPassword = password.trim();
  const cleanStored = storedHash.trim();
  if (cleanStored === cleanPassword) return true;
  if (!cleanStored.includes(":")) return false;
  try {
    const [salt, keyHex] = cleanStored.split(":");
    if (!salt || !keyHex) return false;
    const derived = crypto.scryptSync(cleanPassword, salt, 64);
    const keyBuf = Buffer.from(keyHex, "hex");
    if (derived.length !== keyBuf.length) return false;
    return crypto.timingSafeEqual(derived, keyBuf);
  } catch {
    return false;
  }
}

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string | null;
  isAdmin: boolean;
  role: string;
  plan: string;
  creditsRemaining: number;
  creditsTotal: number;
  orgId: string | null;
  orgName: string | null;
};

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const session = await verifySessionToken(token);
    if (!session) return null;

    const dbUser = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!dbUser) return null;

    const rawUser = dbUser as any;
    // Admin follows the configured address only — never a database flag or a
    // claim carried in the session token. See src/server/authz.ts.
    const isSystemAdmin = isAdminEmail(dbUser.email);

    const userPlan = rawUser.plan || (isSystemAdmin ? "ENTERPRISE" : "FREE");
    const defaultCredits =
      userPlan === "ENTERPRISE"
        ? 500000
        : userPlan === "PRO"
        ? 100000
        : userPlan === "LITE"
        ? 25000
        : 100;
    const creditsTotal = typeof rawUser.creditsTotal === "number" ? rawUser.creditsTotal : defaultCredits;
    const creditsRemaining =
      typeof rawUser.creditsRemaining === "number" ? rawUser.creditsRemaining : creditsTotal;

    // Fetch user's active organization membership
    const membership = await prisma.orgMember.findFirst({
      where: { userId: dbUser.id },
      orderBy: { role: "asc" },
    });

    let orgName: string | null = null;
    let orgId: string | null = membership?.orgId || null;

    if (orgId) {
      const org = await prisma.organization.findUnique({ where: { id: orgId } });
      orgName = org?.name || null;
    }

    // If user has no organization yet, auto-provision their own private organization
    if (!orgId) {
      const orgSlug = `org-${dbUser.id.slice(-6)}-${Math.random().toString(36).slice(2, 6)}`;
      const newOrg = await prisma.organization.create({
        data: {
          name: `${dbUser.name || "My"} Workspace`,
          slug: orgSlug,
        },
      });
      await prisma.orgMember.create({
        data: {
          orgId: newOrg.id,
          userId: dbUser.id,
          role: "OWNER",
        },
      });
      orgId = newOrg.id;
      orgName = newOrg.name;
    }

    return {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name ?? session.name,
      isAdmin: isSystemAdmin,
      role: isSystemAdmin ? "ADMIN" : "USER",
      plan: userPlan,
      creditsRemaining,
      creditsTotal,
      orgId,
      orgName,
    };
  } catch {
    return null;
  }
}

export async function requireAuth(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (!user) {
    const { redirect } = await import("next/navigation");
    redirect("/login");
    throw new Error("Unauthorized");
  }
  return user;
}

export async function requireAdmin(): Promise<AuthenticatedUser> {
  const user = await requireAuth();
  if (!user.isAdmin) {
    const { redirect } = await import("next/navigation");
    redirect("/");
    throw new Error("Admin access required");
  }
  return user;
}

/** Every organization the user belongs to. The unit of tenancy is the org. */
export async function getAccessibleOrgIds(user: AuthenticatedUser): Promise<string[]> {
  const memberships = await prisma.orgMember.findMany({
    where: { userId: user.id },
    select: { orgId: true },
  });
  const orgIds = memberships.map((m) => m.orgId).filter(Boolean);
  if (orgIds.length === 0 && user.orgId) orgIds.push(user.orgId);
  return orgIds;
}

/**
 * Resolves a website the current user is actually allowed to touch, or null.
 *
 * Use this in any route that accepts a website id (or an id derived from one)
 * from the client. Returning null rather than throwing lets callers answer with
 * their own 403/404 without leaking whether the id exists.
 */
export async function getOwnedWebsite(websiteId: string) {
  const user = await getCurrentUser();
  if (!user) return null;

  const website = await prisma.website.findUnique({ where: { id: websiteId } });
  if (!website) return null;
  if (user.isAdmin) return website;

  const orgIds = await getAccessibleOrgIds(user);
  return orgIds.includes(website.orgId) ? website : null;
}

/** Ownership check for any record that carries a websiteId. */
export async function canAccessWebsite(websiteId: string | null | undefined): Promise<boolean> {
  if (!websiteId) return false;
  return (await getOwnedWebsite(websiteId)) !== null;
}
