import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendWhatsAppMessage } from "@/server/integrations/messaging/whatsapp";

describe("sendWhatsAppMessage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fails early if the phone number has fewer than 7 digits", async () => {
    const result = await sendWhatsAppMessage({
      to: "123",
      message: "Hello",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid recipient phone number");
  });

  it("fails if Twilio is chosen but credentials are missing", async () => {
    const result = await sendWhatsAppMessage({
      to: "+919876543210",
      message: "Testing Twilio",
      config: {
        gateway: "twilio",
        twilioAccountSid: "",
        twilioAuthToken: "",
      },
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Twilio is selected, but Account SID or Auth Token are not configured");
  });

  it("fails if Twilio Account SID does not start with AC", async () => {
    const result = await sendWhatsAppMessage({
      to: "+919876543210",
      message: "Testing Twilio",
      config: {
        gateway: "twilio",
        twilioAccountSid: "INVALID_SID_123",
        twilioAuthToken: "token123",
      },
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Twilio Account SID must start with 'AC'");
  });

  it("dispatches successfully via Twilio when valid credentials are provided", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ sid: "SM1234567890abcdef" }), { status: 200 }),
    );

    const result = await sendWhatsAppMessage({
      to: "+919876543210",
      message: "Test message via Twilio",
      config: {
        gateway: "twilio",
        twilioAccountSid: "AC_MOCK_ACCOUNT_SID_FOR_UNIT_TEST",
        twilioAuthToken: "mock_auth_token_for_test",
        twilioFromNumber: "whatsapp:+14155238886",
      },
    });

    expect(fetchSpy).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.provider).toBe("twilio");
    expect(result.messageId).toBe("SM1234567890abcdef");
  });

  it("fails if Meta is chosen but phone ID or access token is missing", async () => {
    const result = await sendWhatsAppMessage({
      to: "+919876543210",
      message: "Testing Meta",
      config: {
        gateway: "meta",
        metaPhoneNumberId: "",
        metaAccessToken: "",
      },
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Meta WhatsApp Cloud API is selected, but the Phone Number ID or Access Token is missing");
  });

  it("dispatches successfully via Meta WhatsApp Cloud API with normalized digits", async () => {
    let capturedBody: any = null;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementationOnce(async (_url, options) => {
      capturedBody = JSON.parse(options?.body as string);
      return new Response(JSON.stringify({ messages: [{ id: "wamid.HBgLMTIzNDU2Nzg5" }] }), { status: 200 });
    });

    const result = await sendWhatsAppMessage({
      to: "+91-9876-543210",
      message: "Test message via Meta",
      config: {
        gateway: "meta",
        metaPhoneNumberId: "10009876543210",
        metaAccessToken: "EAABMockMetaToken123",
      },
    });

    expect(fetchSpy).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.provider).toBe("meta");
    expect(result.messageId).toBe("wamid.HBgLMTIzNDU2Nzg5");
    expect(capturedBody.to).toBe("919876543210");
    expect(capturedBody.text.body).toBe("Test message via Meta");
  });

  it("handles Meta Graph API error codes with helpful diagnostics", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "Invalid OAuth access token.", code: 190 } }), { status: 401 }),
    );

    const result = await sendWhatsAppMessage({
      to: "+919876543210",
      message: "Test expired token",
      config: {
        gateway: "meta",
        metaPhoneNumberId: "10009876543210",
        metaAccessToken: "EAABExpiredToken",
      },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Access Token expired or invalid");
  });
});
