import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendTelegramMessage } from "@/server/integrations/messaging/telegram";

describe("sendTelegramMessage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("handles instant direct_t_me zero-setup mode", async () => {
    const result = await sendTelegramMessage({
      chatId: "@my_channel",
      message: "Direct Telegram message",
      config: {
        gateway: "direct_t_me",
      },
    });

    expect(result.success).toBe(true);
    expect(result.provider).toBe("direct_t_me");
    expect(result.directUrl).toContain("https://t.me/my_channel?text=");
  });

  it("fails if Bot Token is missing in bot_api mode", async () => {
    const result = await sendTelegramMessage({
      chatId: "123456789",
      message: "Testing Bot",
      config: {
        gateway: "bot_api",
        botToken: "",
        chatId: "123456789",
      },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Telegram Bot Token is missing");
  });

  it("fails if Chat ID is missing in bot_api mode", async () => {
    const result = await sendTelegramMessage({
      message: "Testing Bot",
      config: {
        gateway: "bot_api",
        botToken: "123456:mockToken",
        chatId: "",
      },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Telegram Chat ID is missing");
  });

  it("dispatches successfully via Telegram Bot API when valid credentials are provided", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, result: { message_id: 998877 } }), { status: 200 }),
    );

    const result = await sendTelegramMessage({
      chatId: "123456789",
      message: "Test Telegram Notification",
      config: {
        gateway: "bot_api",
        botToken: "123456:mockToken",
        chatId: "123456789",
      },
    });

    expect(fetchSpy).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.provider).toBe("bot_api");
    expect(result.messageId).toBe("998877");
  });

  it("handles invalid token 401 error gracefully", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: false, error_code: 401, description: "Unauthorized" }), { status: 401 }),
    );

    const result = await sendTelegramMessage({
      chatId: "123456789",
      message: "Test Unauthorized",
      config: {
        gateway: "bot_api",
        botToken: "invalid_token",
        chatId: "123456789",
      },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid Telegram Bot Token");
  });
});
