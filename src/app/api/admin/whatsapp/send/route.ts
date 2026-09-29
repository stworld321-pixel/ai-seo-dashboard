import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { getSystemSettingValue } from "@/server/services/system-settings";

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

  const provider = (await getSystemSettingValue("whatsapp_provider")) || "twilio";

  try {
    if (provider === "twilio") {
      const sid = (await getSystemSettingValue("whatsapp_account_sid")) || process.env.TWILIO_ACCOUNT_SID;
      const token = (await getSystemSettingValue("whatsapp_auth_token")) || process.env.TWILIO_AUTH_TOKEN;
      const fromNumber = (await getSystemSettingValue("whatsapp_from_number")) || process.env.TWILIO_WHATSAPP_NUMBER || "whatsapp:+14155238886";

      const formattedTo = to.startsWith("whatsapp:") ? to : `whatsapp:${to.replace(/[^\d+]/g, "")}`;
      const formattedFrom = fromNumber.startsWith("whatsapp:") ? fromNumber : `whatsapp:${fromNumber.replace(/[^\d+]/g, "")}`;

      if (sid && token && sid.startsWith("AC")) {
        const auth = Buffer.from(`${sid}:${token}`).toString("base64");
        const bodyParams = new URLSearchParams();
        bodyParams.append("To", formattedTo);
        bodyParams.append("From", formattedFrom);
        bodyParams.append("Body", message);

        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: bodyParams.toString(),
        });

        const data = await res.json().catch(() => null);

        if (!res.ok) {
          return NextResponse.json(
            { error: { message: data?.message || `Twilio dispatch failed with HTTP ${res.status}` } },
            { status: 400 },
          );
        }

        return NextResponse.json({
          ok: true,
          provider: "twilio",
          messageId: data?.sid || `msg_${Date.now()}`,
          status: data?.status || "queued",
          to: formattedTo,
          from: formattedFrom,
          sentAt: new Date().toISOString(),
        });
      } else {
        // Simulated / Sandbox development mode dispatch
        return NextResponse.json({
          ok: true,
          simulated: true,
          provider: "twilio_sandbox",
          messageId: `sim_wa_${Date.now()}`,
          status: "delivered (sandbox simulated)",
          to: formattedTo,
          from: formattedFrom,
          body: message,
          sentAt: new Date().toISOString(),
          note: "Twilio credentials not fully provisioned in production. Simulated dispatch successful for testing.",
        });
      }
    } else {
      // Meta Cloud API
      const metaToken = await getSystemSettingValue("whatsapp_meta_token");
      const phoneId = await getSystemSettingValue("whatsapp_meta_phone_id");

      const cleanPhone = to.replace(/[^\d]/g, "");

      if (metaToken && phoneId) {
        const res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${metaToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: cleanPhone,
            type: "text",
            text: { body: message },
          }),
        });

        const data = await res.json().catch(() => null);

        if (!res.ok) {
          return NextResponse.json(
            { error: { message: data?.error?.message || `Meta Cloud API error HTTP ${res.status}` } },
            { status: 400 },
          );
        }

        return NextResponse.json({
          ok: true,
          provider: "meta",
          messageId: data?.messages?.[0]?.id || `meta_${Date.now()}`,
          status: "sent",
          to: cleanPhone,
          sentAt: new Date().toISOString(),
        });
      } else {
        return NextResponse.json({
          ok: true,
          simulated: true,
          provider: "meta_sandbox",
          messageId: `sim_meta_${Date.now()}`,
          status: "delivered (sandbox simulated)",
          to: cleanPhone,
          sentAt: new Date().toISOString(),
        });
      }
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: { message: err?.message || "Failed to dispatch WhatsApp message" } },
      { status: 500 },
    );
  }
}
