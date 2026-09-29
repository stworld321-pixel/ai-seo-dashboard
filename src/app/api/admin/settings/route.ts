import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { getSystemSettings, updateSystemSettings } from "@/server/services/system-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser?.isAdmin) {
    return NextResponse.json({ error: { message: "Forbidden: Admin access required." } }, { status: 403 });
  }

  const settings = await getSystemSettings({ unmaskSecrets: false });
  return NextResponse.json({ data: settings });
}

export async function PATCH(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser?.isAdmin) {
    return NextResponse.json({ error: { message: "Forbidden: Admin access required." } }, { status: 403 });
  }

  const json = await request.json().catch(() => null);
  if (!json || typeof json !== "object") {
    return NextResponse.json({ error: { message: "Invalid payload" } }, { status: 400 });
  }

  const result = await updateSystemSettings(json);
  const updatedSettings = await getSystemSettings({ unmaskSecrets: false });

  return NextResponse.json({
    data: {
      ...result,
      settings: updatedSettings,
    },
  });
}
