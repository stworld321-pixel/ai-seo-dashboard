import { NextResponse } from "next/server";
import { prisma } from "@/server/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const prompt = await prisma.aiPrompt.findUnique({
    where: { id },
    include: {
      runs: {
        orderBy: { runAt: "desc" },
      },
      geoOpps: true,
      website: true,
    },
  });

  if (!prompt) {
    return NextResponse.json({ error: { message: "Prompt not found" } }, { status: 404 });
  }

  return NextResponse.json({ data: prompt });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    status?: string;
    approved?: boolean;
    priority?: number;
    intent?: string;
    text?: string;
  };

  const prompt = await prisma.aiPrompt.update({
    where: { id },
    data: {
      status: body.status,
      approved: body.approved,
      priority: body.priority,
      intent: body.intent,
      text: body.text,
    },
  });

  return NextResponse.json({ data: prompt });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.aiPrompt.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
