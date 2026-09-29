import { NextResponse } from "next/server";
import { getDefaultWebsite } from "@/server/services/dashboard";
import { sendWhatsAppMessage } from "@/server/integrations/messaging/whatsapp";

export async function POST(request: Request) {
  const json = (await request.json().catch(() => ({}))) as {
    websiteId?: string;
    phoneNumber?: string;
    gateway?: "twilio" | "meta" | "default";
    twilioAccountSid?: string;
    twilioAuthToken?: string;
    twilioFromNumber?: string;
    metaPhoneNumberId?: string;
    metaAccessToken?: string;
  };

  const website = await getDefaultWebsite(json.websiteId);
  const siteName = website?.name || "Your Website";
  const siteUrl = website?.url || "https://example.com";

  if (!json.phoneNumber || !json.phoneNumber.trim()) {
    return NextResponse.json(
      { error: { message: "WhatsApp phone number is required." } },
      { status: 400 },
    );
  }

  const sampleMessage = `🤖 *AI CMO Daily Brief — ${siteName}*
🌐 *Site:* ${siteUrl}

📈 *Today's SEO Health:* 85/100
🎯 *Impressions (28d):* 2,410 (+8.2%)
🚀 *Top Keyword Jump:* "web design chennai" moved up to #4 (+2 spots)
⚠️ *Alerts:* 1 high-intent question detected on Reddit / X awaiting review.

Reply to this message anytime to chat with your AI CMO!`;

  const result = await sendWhatsAppMessage({
    to: json.phoneNumber.trim(),
    message: sampleMessage,
    config: {
      gateway: json.gateway,
      twilioAccountSid: json.twilioAccountSid,
      twilioAuthToken: json.twilioAuthToken,
      twilioFromNumber: json.twilioFromNumber,
      metaPhoneNumberId: json.metaPhoneNumberId,
      metaAccessToken: json.metaAccessToken,
    },
  });

  if (!result.success) {
    return NextResponse.json(
      { error: { message: result.error || "Failed to send WhatsApp test message." } },
      { status: 500 },
    );
  }

  return NextResponse.json({
    data: {
      success: true,
      messageId: result.messageId,
      deliveredTo: json.phoneNumber,
      note: "Test message dispatched successfully!",
    },
  });
}
