import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { type Prisma } from "@prisma/client";
import { getDefaultWebsite } from "@/server/services/dashboard";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    websiteId?: string;
    pageUrl?: string;
    status?: "HEALTHY" | "OPTIMIZE" | "DISMISSED";
    issueId?: string;
    action?: "set_status" | "dismiss_issue" | "resolve_issue" | "restore_issue";
  };

  if (!body.pageUrl) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "pageUrl is required" } },
      { status: 400 },
    );
  }

  const website = await getDefaultWebsite(body.websiteId);
  if (!website) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Website not found" } },
      { status: 404 },
    );
  }

  const normUrl = body.pageUrl.replace(/\/+$/, "");

  // Find or create page record
  let page = await prisma.pageRecord.findFirst({
    where: {
      websiteId: website.id,
      url: { in: [body.pageUrl, normUrl, `${normUrl}/`] },
    },
  });

  if (!page) {
    page = await prisma.pageRecord.create({
      data: {
        websiteId: website.id,
        url: body.pageUrl,
        status: body.status === "DISMISSED" ? "HEALTHY" : (body.status || "HEALTHY"),
        contentScoreDetail: body.status === "DISMISSED" ? { isDismissed: true } : {},
      },
    });
  }

  const detail = (page.contentScoreDetail && typeof page.contentScoreDetail === "object"
    ? { ...page.contentScoreDetail }
    : {}) as {
    dismissedIssues?: string[];
    resolvedIssues?: string[];
    isDismissed?: boolean;
    [key: string]: unknown;
  };

  detail.dismissedIssues = Array.isArray(detail.dismissedIssues) ? [...detail.dismissedIssues] : [];
  detail.resolvedIssues = Array.isArray(detail.resolvedIssues) ? [...detail.resolvedIssues] : [];

  let nextStatus = page.status;

  if (body.action === "dismiss_issue" && body.issueId) {
    if (!detail.dismissedIssues.includes(body.issueId)) {
      detail.dismissedIssues.push(body.issueId);
    }
    detail.resolvedIssues = detail.resolvedIssues.filter((id) => id !== body.issueId);
  } else if (body.action === "resolve_issue" && body.issueId) {
    if (!detail.resolvedIssues.includes(body.issueId)) {
      detail.resolvedIssues.push(body.issueId);
    }
    detail.dismissedIssues = detail.dismissedIssues.filter((id) => id !== body.issueId);
  } else if (body.action === "restore_issue" && body.issueId) {
    detail.dismissedIssues = detail.dismissedIssues.filter((id) => id !== body.issueId);
    detail.resolvedIssues = detail.resolvedIssues.filter((id) => id !== body.issueId);
  } else if (body.status) {
    if (body.status === "DISMISSED") {
      detail.isDismissed = true;
    } else {
      detail.isDismissed = false;
      nextStatus = body.status;
    }
  }

  const updated = await prisma.pageRecord.update({
    where: { id: page.id },
    data: {
      status: nextStatus,
      contentScoreDetail: detail as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({
    data: {
      pageRecord: updated,
      isDismissed: Boolean(detail.isDismissed),
      dismissedIssues: detail.dismissedIssues,
      resolvedIssues: detail.resolvedIssues,
    },
  });
}
