import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { sendWhatsAppMessage } from "@/server/integrations/messaging/whatsapp";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser?.isAdmin) {
    return NextResponse.json({ error: { message: "Forbidden: Admin access required." } }, { status: 403 });
  }

  const json = await request.json().catch(() => ({}));
  const to = (json.to as string)?.trim();
  const message = (json.message as string)?.trim();

  if (!to || !message) {
    return NextResponse.json(
      { error: { message: "Recipient phone number ('to') and 'message' content are required." } },
      { status: 400 },
    );
  }

  try {
    const result = await sendWhatsAppMessage({
      to,
      message,
      config: json.config,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: { message: result.error || "Failed to dispatch WhatsApp message" } },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      provider: result.provider,
      messageId: result.messageId || `msg_${Date.now()}`,
      directUrl: result.directUrl,
      status: "sent",
      to,
      sentAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: { message: err instanceof Error ? err.message : "Failed to dispatch WhatsApp message" } },
      { status: 500 },
    );
  }
}

