import crypto from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/server/db";

export const SESSION_COOKIE_NAME = "seo_session";

function getSecret(): string {
  return (
    process.env.NEXTAUTH_SECRET ||
    process.env.ENCRYPTION_KEY ||
    "ai-seo-command-center-default-secret-key"
  );
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string | null | undefined): boolean {
  if (!storedHash || !storedHash.includes(":")) return false;
  const [salt, keyHex] = storedHash.split(":");
  if (!salt || !keyHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(keyHex, "hex");
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

export type SessionPayload = {
  userId: string;
  email: string;
  name: string;
  isAdmin?: boolean;
  role?: string;
  orgId?: string;
  orgName?: string;
  exp: number;
};

export function createSessionToken(payload: Omit<SessionPayload, "exp">, ttlDays = 30): string {
  const fullPayload: SessionPayload = {
    ...payload,
    exp: Date.now() + ttlDays * 24 * 60 * 60 * 1000,
  };
  const dataB64 = Buffer.from(JSON.stringify(fullPayload), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", getSecret()).update(dataB64).digest("base64url");
  return `${dataB64}.${sig}`;
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token || !token.includes(".")) return null;
  const [dataB64, sig] = token.split(".");
  if (!dataB64 || !sig) return null;
  const expectedSig = crypto
    .createHmac("sha256", getSecret())
    .update(dataB64)
    .digest("base64url");
  if (sig !== expectedSig) return null;
  try {
    const parsed = JSON.parse(Buffer.from(dataB64, "base64url").toString("utf8")) as SessionPayload;
    if (!parsed.userId || !parsed.email || parsed.exp < Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
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
    const session = verifySessionToken(token);
    if (!session) return null;

    const dbUser = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!dbUser) return null;

    const rawUser = dbUser as any;
    const configuredAdminEmails = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "suriyamanikandan4@gmail.com")
      .toLowerCase()
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);

    const isSystemAdmin =
      Boolean(rawUser.isAdmin) ||
      rawUser.role === "ADMIN" ||
      session.isAdmin === true ||
      configuredAdminEmails.includes(dbUser.email.toLowerCase()) ||
      dbUser.email.toLowerCase().startsWith("admin@") ||
      dbUser.email.toLowerCase() === "suriyamanikandan4@gmail.com";

    const userPlan = rawUser.plan || (isSystemAdmin ? "ENTERPRISE" : "BASIC");
    const defaultCredits = userPlan === "ENTERPRISE" ? 100000 : userPlan === "PRO" ? 25000 : 5000;
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
      role: isSystemAdmin ? "ADMIN" : (rawUser.role || "USER"),
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
