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
        // Previously returned ok:true with a fake "sim_" id, so the console
        // reported a delivery for a message that never left the server.
        return NextResponse.json(
          {
            error: {
              message:
                "Twilio is the selected provider but its Account SID / Auth Token are missing or malformed (the SID must start with \"AC\"). Configure them in Admin → WhatsApp, or switch the provider to Meta.",
            },
          },
          { status: 400 },
        );
      }
    } else {
      // Meta Cloud API
      const metaToken = await getSystemSettingValue("whatsapp_meta_token");
      const phoneId = await getSystemSettingValue("whatsapp_meta_phone_id");

      const cleanPhone = to.replace(/[^\d]/g, "");

      if (metaToken && phoneId) {
        const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
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
          const metaMessage = data?.error?.message || `Meta Cloud API error HTTP ${res.status}`;
          // Meta says a bare "Authorization Error" (code 100) both when the token
          // is wrong and when the System User simply has no WhatsApp Business
          // Account assigned to it — by far the more common cause, and impossible
          // to guess from the message alone.
          const hint =
            data?.error?.code === 100
              ? " — if the token itself tests fine, the System User behind it likely has no WhatsApp Business Account assigned. In Meta Business Settings assign the WABA to the System User with full control, then generate a NEW token (existing tokens do not pick up newly assigned assets)."
              : "";
          return NextResponse.json(
            { error: { message: `${metaMessage}${hint}`, code: data?.error?.code } },
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
        return NextResponse.json(
          {
            error: {
              message:
                "Meta is the selected provider but the Phone Number ID or Access Token is missing. Add both in Admin → WhatsApp and run Test Gateway first.",
            },
          },
          { status: 400 },
        );
      }
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: { message: err?.message || "Failed to dispatch WhatsApp message" } },
      { status: 500 },
    );
  }
}
