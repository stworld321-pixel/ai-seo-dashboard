import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { generateAndSendTelegramDigest } from "@/server/services/telegram-digest";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: { message: "Unauthorized." } }, { status: 401 });
  }

  const json = await request.json().catch(() => ({}));
  const websiteId = (json.websiteId as string)?.trim();
  const chatId = (json.chatId as string)?.trim();
  const botToken = (json.botToken as string)?.trim();
  const includeGsc = json.includeGsc !== false;
  const includeKeywords = json.includeKeywords !== false;
  const includeAiUpdates = json.includeAiUpdates !== false;
  const includeTechnical = json.includeTechnical !== false;

  if (!websiteId) {
    return NextResponse.json(
      { error: { message: "websiteId is required to generate a Telegram digest." } },
      { status: 400 },
    );
  }

  // Check user membership for this website's organization
  const website = await prisma.website.findUnique({
    where: { id: websiteId },
  });

  if (!website) {
    return NextResponse.json({ error: { message: "Website not found." } }, { status: 404 });
  }

  if (!currentUser.isAdmin) {
    const membership = await prisma.orgMember.findFirst({
      where: { orgId: website.orgId, userId: currentUser.id },
    });
    if (!membership) {
      return NextResponse.json({ error: { message: "Forbidden." } }, { status: 403 });
    }
  }

  try {
    const result = await generateAndSendTelegramDigest({
      websiteId,
      chatId: chatId || undefined,
      botToken: botToken || undefined,
      includeGsc,
      includeKeywords,
      includeAiUpdates,
      includeTechnical,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          error: { message: result.error || "Failed to dispatch Telegram digest" },
          compiledMessage: result.compiledMessage,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      messageId: result.messageId,
      chatId: result.chatId,
      directUrl: result.directUrl,
      compiledMessage: result.compiledMessage,
      dispatchedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: { message: err instanceof Error ? err.message : "Failed to compile Telegram digest" } },
      { status: 500 },
    );
  }
}
