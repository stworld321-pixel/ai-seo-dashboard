import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { resetWhatsAppSettings, getSystemSettings } from "@/server/services/system-settings";

export const dynamic = "force-dynamic";

export async function POST() {
  const currentUser = await getCurrentUser();
  if (!currentUser?.isAdmin) {
    return NextResponse.json({ error: { message: "Forbidden: Admin access required." } }, { status: 403 });
  }

  await resetWhatsAppSettings();
  const updatedSettings = await getSystemSettings({ unmaskSecrets: false });

  return NextResponse.json({
    ok: true,
    message: "WhatsApp configuration has been reset to defaults.",
    settings: updatedSettings,
  });
}
