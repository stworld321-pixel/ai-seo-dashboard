import { Metadata } from "next";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/auth";
import { getSystemSettings } from "@/server/services/system-settings";
import { AdminDashboardClient, type AdminUserItem, type AdminWebsiteItem, type AdminStats } from "@/components/admin-dashboard-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SuperAdmin Command Center — Global Platform Governance",
  description: "Global administration dashboard for user management, AI model integrations, developer connect, OAuth setup, WhatsApp dispatch, and Stripe/Razorpay payment plans.",
};

export default async function AdminPage() {
  const currentAdmin = await requireAdmin();

  const [
    users,
    memberships,
    organizations,
    websites,
    totalPages,
    totalKeywords,
    totalIntegrations,
    totalOpportunities,
    totalAiPrompts,
    systemSettings,
  ] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
    }),
    prisma.orgMember.findMany(),
    prisma.organization.findMany(),
    prisma.website.findMany({
      orderBy: { createdAt: "desc" },
    }),
    prisma.pageRecord.count(),
    prisma.keyword.count(),
    prisma.integration.count(),
    prisma.opportunity.count(),
    prisma.aiPrompt.count(),
    getSystemSettings({ unmaskSecrets: false }),
  ]);

  const userItems: AdminUserItem[] = users.map((u) => {
    const userMemberships = memberships.filter((m) => m.userId === u.id);
    const orgIds = userMemberships.map((m) => m.orgId);
    const orgs = organizations.filter((o) => orgIds.includes(o.id));
    const userWebsites = websites.filter((w) => orgIds.includes(w.orgId));

    const rawUser = u as any;

    return {
      id: u.id,
      email: u.email,
      name: u.name,
      isAdmin: Boolean(rawUser.isAdmin),
      role: rawUser.role || (rawUser.isAdmin ? "ADMIN" : "USER"),
      plan: rawUser.plan || "STARTER",
      status: rawUser.status || "ACTIVE",
      phone: rawUser.phone || null,
      createdAt: u.createdAt.toISOString(),
      organizations: orgs.map((o) => ({ id: o.id, name: o.name, slug: o.slug })),
      websiteCount: userWebsites.length,
      websites: userWebsites.map((w) => ({ id: w.id, name: w.name, url: w.url })),
    };
  });

  const websiteItems: AdminWebsiteItem[] = websites.map((w) => {
    const org = organizations.find((o) => o.id === w.orgId);
    const membership = memberships.find((m) => m.orgId === w.orgId);
    const owner = membership ? users.find((u) => u.id === membership.userId) : null;

    return {
      id: w.id,
      name: w.name,
      url: w.url,
      cms: w.cms,
      orgId: w.orgId,
      orgName: org?.name,
      ownerEmail: owner?.email,
      gscProperty: w.gscProperty,
      ga4PropertyId: w.ga4PropertyId,
      automationLevel: w.automationLevel,
      createdAt: w.createdAt.toISOString(),
    };
  });

  const stats: AdminStats = {
    totalUsers: users.length,
    totalOrgs: organizations.length,
    totalWebsites: websites.length,
    totalPages,
    totalKeywords,
    totalIntegrations,
    totalOpportunities,
    totalAiPrompts,
  };

  return (
    <AdminDashboardClient
      users={userItems}
      websites={websiteItems}
      stats={stats}
      initialSettings={systemSettings}
      currentAdminEmail={currentAdmin.email}
    />
  );
}
