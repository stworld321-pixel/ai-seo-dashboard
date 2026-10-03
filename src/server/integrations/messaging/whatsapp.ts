import { getSystemSettingValue } from "@/server/services/system-settings";

export type WhatsAppPayload = {
  to: string; // e.g. "+919876543210" or "919876543210"
  message: string;
  config?: {
    gateway?: "twilio" | "meta" | "custom_webhook" | "direct_wa_me" | "default";
    twilioAccountSid?: string;
    twilioAuthToken?: string;
    twilioFromNumber?: string;
    metaPhoneNumberId?: string;
    metaAccessToken?: string;
    webhookUrl?: string;
    webhookToken?: string;
  };
};

export async function sendWhatsAppMessage(payload: WhatsAppPayload): Promise<{
  success: boolean;
  messageId?: string;
  provider?: string;
  directUrl?: string;
  error?: string;
}> {
  // Normalize phone number
  const rawTo = payload.to.trim().replace(/^whatsapp:/i, "");
  const digits = rawTo.replace(/[^\d]/g, "");
  if (!digits || digits.length < 7) {
    return { success: false, error: `Invalid recipient phone number "${payload.to}". Please provide a full phone number with country code.` };
  }
  const e164 = rawTo.startsWith("+") ? rawTo : `+${digits}`;
  const twilioTo = `whatsapp:${e164}`;
  const metaTo = digits;

  // Resolve gateway choice
  const configuredProvider = (await getSystemSettingValue("whatsapp_provider")) || "direct_wa_me";
  const gateway = payload.config?.gateway && payload.config.gateway !== "default"
    ? payload.config.gateway
    : configuredProvider;

  // 0. Direct 1-Click WhatsApp (Zero Setup / Instant QR & Link)
  if (gateway === "direct_wa_me") {
    const waUrl = `https://wa.me/${digits}?text=${encodeURIComponent(payload.message)}`;
    return {
      success: true,
      provider: "direct_wa_me",
      messageId: `direct_${Date.now()}`,
      directUrl: waUrl,
    };
  }

  // 1. Custom HTTP Gateway / Webhook (UltraMsg, Evolution API, Green API, Wasapi, etc.)
  if (gateway === "custom_webhook") {
    const webhookUrl = (
      payload.config?.webhookUrl ||
      (await getSystemSettingValue("whatsapp_webhook_url")) ||
      ""
    ).trim();
    const webhookToken = (
      payload.config?.webhookToken ||
      (await getSystemSettingValue("whatsapp_webhook_token")) ||
      ""
    ).trim();

    if (!webhookUrl) {
      return {
        success: false,
        error: "Custom Webhook is selected, but the Webhook Endpoint URL is empty. Please enter your gateway URL in Admin → WhatsApp.",
      };
    }

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (webhookToken) {
        headers["Authorization"] = `Bearer ${webhookToken}`;
        headers["x-api-key"] = webhookToken;
      }

      const res = await fetch(webhookUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          to: digits,
          e164Phone: e164,
          phone: digits,
          message: payload.message,
          text: payload.message,
          timestamp: new Date().toISOString(),
        }),
      });

      const data = (await res.json().catch(() => null)) as { id?: string; messageId?: string; error?: string } | null;
      if (res.ok) {
        return {
          success: true,
          provider: "custom_webhook",
          messageId: data?.id || data?.messageId || `wh_${Date.now()}`,
        };
      }

      return {
        success: false,
        provider: "custom_webhook",
        error: data?.error || `Webhook gateway failed with HTTP ${res.status}`,
      };
    } catch (err: unknown) {
      return {
        success: false,
        provider: "custom_webhook",
        error: err instanceof Error ? err.message : "Failed to reach WhatsApp custom webhook endpoint",
      };
    }
  }

  // 2. Meta WhatsApp Cloud API
  if (gateway === "meta") {
    const metaPhoneId = (
      payload.config?.metaPhoneNumberId ||
      (await getSystemSettingValue("whatsapp_meta_phone_id")) ||
      process.env.META_WHATSAPP_PHONE_ID ||
      ""
    ).trim();
    const metaToken = (
      payload.config?.metaAccessToken ||
      (await getSystemSettingValue("whatsapp_meta_token")) ||
      process.env.META_WHATSAPP_ACCESS_TOKEN ||
      ""
    ).trim();

    if (!metaPhoneId || !metaToken) {
      return {
        success: false,
        error: "Meta WhatsApp Cloud API is selected, but the Phone Number ID or Access Token is missing. Configure them in Admin → WhatsApp.",
      };
    }

    try {
      const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(metaPhoneId)}/messages`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${metaToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: metaTo,
          type: "text",
          text: { preview_url: false, body: payload.message },
        }),
      });

      const data = (await res.json().catch(() => null)) as {
        messages?: Array<{ id: string }>;
        error?: { message: string; code?: number };
      } | null;

      if (res.ok && data?.messages?.[0]?.id) {
        return { success: true, messageId: data.messages[0].id, provider: "meta" };
      }

      const errCode = data?.error?.code;
      let errMsg = data?.error?.message || `Meta WhatsApp delivery failed with HTTP ${res.status}`;
      if (errCode === 190) {
        errMsg += " (Access Token expired or invalid. Generate a new System User Permanent Token in Meta Business Settings).";
      } else if (errCode === 100) {
        errMsg += " (Check that the WhatsApp Business Account is assigned to the System User token, and verify the Phone Number ID).";
      } else if (errCode === 131030) {
        errMsg += " (In Meta development/sandbox mode, the recipient must be added to the Allowed Phone Numbers list).";
      }

      return { success: false, error: errMsg, provider: "meta" };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : "Meta network error", provider: "meta" };
    }
  }

  // 2. Twilio WhatsApp API
  const accountSid = (
    payload.config?.twilioAccountSid ||
    (await getSystemSettingValue("whatsapp_account_sid")) ||
    process.env.TWILIO_ACCOUNT_SID ||
    ""
  ).trim();
  const authToken = (
    payload.config?.twilioAuthToken ||
    (await getSystemSettingValue("whatsapp_auth_token")) ||
    process.env.TWILIO_AUTH_TOKEN ||
    ""
  ).trim();
  const fromNumber = (
    payload.config?.twilioFromNumber ||
    (await getSystemSettingValue("whatsapp_from_number")) ||
    process.env.TWILIO_WHATSAPP_NUMBER ||
    process.env.TWILIO_WHATSAPP_FROM ||
    "whatsapp:+14155238886"
  ).trim();

  if (accountSid && authToken) {
    if (!accountSid.startsWith("AC")) {
      return { success: false, error: "Twilio Account SID must start with 'AC'. Check your Twilio Console." };
    }

    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
      const body = new URLSearchParams({
        From: fromNumber.startsWith("whatsapp:") ? fromNumber : `whatsapp:${fromNumber}`,
        To: twilioTo,
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

      const data = (await res.json().catch(() => null)) as { sid?: string; message?: string; error_code?: number } | null;
      if (res.ok && data?.sid) {
        return { success: true, messageId: data.sid, provider: "twilio" };
      }
      return { success: false, error: data?.message || `Twilio delivery failed (HTTP ${res.status})`, provider: "twilio" };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : "Twilio network error", provider: "twilio" };
    }
  }

  if (gateway === "twilio") {
    return { success: false, error: "Twilio is selected, but Account SID or Auth Token are not configured. Add them in Admin → WhatsApp." };
  }

  return {
    success: false,
    error: "No WhatsApp gateway configured. Configure Twilio or Meta WhatsApp Cloud API credentials in Admin → WhatsApp.",
  };
}
