/**
 * WhatsApp Messaging Gateway for AI CMO Digests & Urgent Ranking Alerts.
 * Supports:
 * 1. Twilio WhatsApp API
 * 2. Meta WhatsApp Cloud API (Graph API)
 * 3. Fallback / Test simulator
 */

export type WhatsAppPayload = {
  to: string; // e.g. "+919876543210"
  message: string;
  config?: {
    gateway?: "twilio" | "meta" | "default";
    twilioAccountSid?: string;
    twilioAuthToken?: string;
    twilioFromNumber?: string;
    metaPhoneNumberId?: string;
    metaAccessToken?: string;
  };
};

export async function sendWhatsAppMessage(payload: WhatsAppPayload): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  const cleanTo = payload.to.replace(/[^\d+]/g, "");
  const gateway = payload.config?.gateway || "default";

  // 1. Try Twilio if credentials are provided in config or env
  const accountSid = payload.config?.twilioAccountSid || process.env.TWILIO_ACCOUNT_SID;
  const authToken = payload.config?.twilioAuthToken || process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = payload.config?.twilioFromNumber || process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";

  // Honour an explicit gateway choice. Without this, a stray TWILIO_ACCOUNT_SID in
  // the environment silently hijacks every send even when Meta is the configured
  // provider, and the admin never learns why their Meta setup appears unused.
  if (gateway === "twilio" && !(accountSid && authToken)) {
    return { success: false, error: "Twilio is selected but its Account SID / Auth Token are not configured." };
  }

  if (gateway !== "meta" && accountSid && authToken) {
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
      const body = new URLSearchParams({
        From: fromNumber.startsWith("whatsapp:") ? fromNumber : `whatsapp:${fromNumber}`,
        To: cleanTo.startsWith("whatsapp:") ? cleanTo : `whatsapp:${cleanTo}`,
        Body: payload.message,
      });

      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });

      const data = (await res.json()) as { sid?: string; message?: string; error_code?: number };
      if (res.ok && data.sid) {
        return { success: true, messageId: data.sid };
      }
      return { success: false, error: data.message || "Twilio delivery failed" };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : "Twilio network error" };
    }
  }

  // 2. Try Meta WhatsApp Cloud API if credentials provided
  const metaPhoneId = payload.config?.metaPhoneNumberId || process.env.META_WHATSAPP_PHONE_ID;
  const metaToken = payload.config?.metaAccessToken || process.env.META_WHATSAPP_ACCESS_TOKEN;

  if (metaPhoneId && metaToken) {
    try {
      const url = `https://graph.facebook.com/v21.0/${metaPhoneId}/messages`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${metaToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: cleanTo.replace(/^\+/, ""),
          type: "text",
          text: { preview_url: true, body: payload.message },
        }),
      });

      const data = (await res.json()) as { messages?: Array<{ id: string }>; error?: { message: string } };
      if (res.ok && data.messages?.[0]?.id) {
        return { success: true, messageId: data.messages[0].id };
      }
      return { success: false, error: data.error?.message || "Meta WhatsApp delivery failed" };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : "Meta network error" };
    }
  }

  if (gateway === "meta") {
    return { success: false, error: "Meta WhatsApp Cloud API is selected but its Phone Number ID / Access Token are not configured." };
  }

  // 3. Nothing is configured. Report that honestly: returning success here used to
  // make callers (digests, alerts, the admin console) record a delivery that never
  // happened, which is worse than a visible failure.
  return {
    success: false,
    error: "No WhatsApp gateway is configured. Add Twilio or Meta credentials in Admin → WhatsApp.",
  };
}
