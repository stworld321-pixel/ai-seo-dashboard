import { getSystemSettingValue } from "@/server/services/system-settings";

export type TelegramPayload = {
  chatId?: string; // e.g. "123456789" or "@channelname"
  message: string;
  parseMode?: "HTML" | "MarkdownV2" | "Markdown";
  config?: {
    gateway?: "direct_t_me" | "bot_api" | "default";
    botToken?: string;
    chatId?: string;
  };
};

export async function sendTelegramMessage(payload: TelegramPayload): Promise<{
  success: boolean;
  messageId?: string;
  provider?: string;
  directUrl?: string;
  botUsername?: string;
  error?: string;
}> {
  const configuredProvider = (await getSystemSettingValue("telegram_provider")) || "bot_api";
  const gateway = payload.config?.gateway && payload.config.gateway !== "default"
    ? payload.config.gateway
    : configuredProvider;

  // 1. Direct 1-Click Telegram (Zero Setup / Instant Web & App link)
  if (gateway === "direct_t_me") {
    const rawTarget = (payload.chatId || payload.config?.chatId || "").trim().replace(/^@/, "");
    const directUrl = rawTarget
      ? `https://t.me/${rawTarget}?text=${encodeURIComponent(payload.message)}`
      : `https://t.me/share/url?url=${encodeURIComponent(payload.message)}`;

    return {
      success: true,
      provider: "direct_t_me",
      messageId: `tme_${Date.now()}`,
      directUrl,
    };
  }

  // 2. Telegram Bot API
  const botToken = (
    payload.config?.botToken ||
    (await getSystemSettingValue("telegram_bot_token")) ||
    process.env.TELEGRAM_BOT_TOKEN ||
    ""
  ).trim();

  const targetChatId = (
    payload.chatId ||
    payload.config?.chatId ||
    (await getSystemSettingValue("telegram_chat_id")) ||
    process.env.TELEGRAM_CHAT_ID ||
    ""
  ).trim();

  if (!botToken) {
    return {
      success: false,
      error: "Telegram Bot Token is missing. Create a bot with @BotFather and add your token in Admin → Telegram.",
    };
  }

  if (!targetChatId) {
    return {
      success: false,
      error: "Telegram Chat ID is missing. Provide a chat ID (e.g. 123456789 or @channelname) in settings or recipient field.",
    };
  }

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: targetChatId,
        text: payload.message,
        parse_mode: payload.parseMode || "HTML",
        disable_web_page_preview: false,
      }),
    });

    const data = (await res.json().catch(() => null)) as {
      ok?: boolean;
      result?: { message_id: number; chat?: { title?: string; username?: string } };
      description?: string;
      error_code?: number;
    } | null;

    if (res.ok && data?.ok && data.result) {
      return {
        success: true,
        provider: "bot_api",
        messageId: String(data.result.message_id),
      };
    }

    let errMsg = data?.description || `Telegram API failed with HTTP ${res.status}`;
    if (data?.error_code === 401 || /unauthorized/i.test(errMsg)) {
      errMsg = "Invalid Telegram Bot Token. Check the token provided by @BotFather.";
    } else if (data?.error_code === 400 && /chat not found/i.test(errMsg)) {
      errMsg = `Chat ID "${targetChatId}" not found. Ensure the user has started the bot (by opening the bot and clicking /start), or check your channel ID.`;
    } else if (data?.error_code === 403 && /bot was blocked by the user/i.test(errMsg)) {
      errMsg = "The bot was blocked by this user on Telegram.";
    }

    return {
      success: false,
      provider: "bot_api",
      error: errMsg,
    };
  } catch (err: unknown) {
    return {
      success: false,
      provider: "bot_api",
      error: err instanceof Error ? err.message : "Failed to connect to Telegram API",
    };
  }
}
