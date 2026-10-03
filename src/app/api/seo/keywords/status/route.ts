import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getDefaultWebsite } from "@/server/services/dashboard";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    websiteId?: string;
    keywordId?: string;
    query?: string;
    status: "active" | "done" | "dismissed";
  };

  if (!body.query && !body.keywordId) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "keywordId or query is required" } },
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

  const queryText = body.query?.trim();

  // Find existing keyword by id or by (websiteId, query)
  let kw = body.keywordId && !body.keywordId.startsWith("gsc-")
    ? await prisma.keyword.findUnique({ where: { id: body.keywordId } })
    : null;

  if (!kw && queryText) {
    kw = await prisma.keyword.findFirst({
      where: {
        websiteId: website.id,
        query: { equals: queryText, mode: "insensitive" },
      },
    });
  }

  let currentTags: string[] = kw ? [...(kw.tags || [])] : [];

  // Remove old status tags
  currentTags = currentTags.filter((t) => t !== "status:done" && t !== "status:dismissed");

  if (body.status === "done") {
    currentTags.push("status:done");
  } else if (body.status === "dismissed") {
    currentTags.push("status:dismissed");
  }

  let resultKw;
  if (kw) {
    resultKw = await prisma.keyword.update({
      where: { id: kw.id },
      data: { tags: currentTags },
    });
  } else if (queryText) {
    resultKw = await prisma.keyword.create({
      data: {
        websiteId: website.id,
        query: queryText,
        tags: currentTags,
        isCustom: false,
      },
    });
  }

  return NextResponse.json({
    data: {
      keyword: resultKw,
      status: body.status,
      tags: currentTags,
    },
  });
}
