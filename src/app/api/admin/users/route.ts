import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getCurrentUser } from "@/server/auth";

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser?.isAdmin) {
    return NextResponse.json({ error: { message: "Forbidden: Admin access required." } }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      isAdmin: true,
      role: true,
      createdAt: true,
    },
  });

  const [memberships, allOrgs, allWebsites] = await Promise.all([
    prisma.orgMember.findMany(),
    prisma.organization.findMany(),
    prisma.website.findMany(),
  ]);

  const userStats = users.map((u) => {
    const userMemberships = memberships.filter((m) => m.userId === u.id);
    const orgIds = userMemberships.map((m) => m.orgId);
    const orgs = allOrgs.filter((o) => orgIds.includes(o.id));
    const userWebsites = allWebsites.filter((w) => orgIds.includes(w.orgId));

    return {
      ...u,
      organizations: orgs.map((o) => ({ id: o.id, name: o.name, slug: o.slug })),
      websiteCount: userWebsites.length,
      websites: userWebsites.map((w) => ({ id: w.id, name: w.name, url: w.url })),
    };
  });

  return NextResponse.json({ data: userStats });
}
