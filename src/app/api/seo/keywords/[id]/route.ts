import { NextResponse } from "next/server";
import { prisma } from "@/server/db";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const keyword = await prisma.keyword.findUnique({
    where: { id },
  });

  if (!keyword) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Keyword not found" } },
      { status: 404 },
    );
  }

  return NextResponse.json({ data: keyword });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    targetUrl?: string;
    targetPosition?: number;
    tags?: string[];
    isCustom?: boolean;
  };

  const existing = await prisma.keyword.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Keyword not found" } },
      { status: 404 },
    );
  }

  const updated = await prisma.keyword.update({
    where: { id },
    data: {
      ...(body.targetUrl !== undefined ? { targetUrl: body.targetUrl } : {}),
      ...(body.targetPosition !== undefined ? { targetPosition: body.targetPosition } : {}),
      ...(body.tags !== undefined ? { tags: body.tags } : {}),
      ...(body.isCustom !== undefined ? { isCustom: body.isCustom } : {}),
    },
  });

  return NextResponse.json({ data: updated });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const existing = await prisma.keyword.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Keyword not found" } },
      { status: 404 },
    );
  }

  await prisma.keyword.delete({ where: { id } });
  return NextResponse.json({ data: { success: true, id } });
}
