import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { sendTelegramMessage } from "@/server/integrations/messaging/telegram";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser?.isAdmin) {
    return NextResponse.json({ error: { message: "Forbidden: Admin access required." } }, { status: 403 });
  }

  const json = await request.json().catch(() => ({}));
  const chatId = (json.chatId as string)?.trim();
  const message = (json.message as string)?.trim();

  if (!message) {
    return NextResponse.json(
      { error: { message: "Message content is required." } },
      { status: 400 },
    );
  }

  try {
    const result = await sendTelegramMessage({
      chatId: chatId || undefined,
      message,
      config: json.config,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: { message: result.error || "Failed to dispatch Telegram message" } },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      provider: result.provider,
      messageId: result.messageId || `tg_${Date.now()}`,
      directUrl: result.directUrl,
      status: "sent",
      chatId: chatId || "configured-chat",
      sentAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: { message: err instanceof Error ? err.message : "Failed to dispatch Telegram message" } },
      { status: 500 },
    );
  }
}
