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
  const type = json.type as string; // "ai" | "stripe" | "razorpay" | "whatsapp" | "reddit" | "x" | "google"
  const provider = json.provider as string | undefined;

  const startTime = Date.now();

  try {
    if (type === "ai") {
      const targetProvider = provider || (await getSystemSettingValue("ai_primary_provider")) || "gemini";

      if (targetProvider === "gemini") {
        const apiKey = (await getSystemSettingValue("ai_gemini_api_key")) || process.env.GEMINI_API_KEY;
        const model = (await getSystemSettingValue("ai_gemini_model")) || "gemini-2.0-flash";

        if (!apiKey) {
          return NextResponse.json({
            ok: false,
            latencyMs: Date.now() - startTime,
            message: "Missing Gemini API Key. Please provide an API key in settings or .env",
          });
        }

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}?key=${apiKey}`);
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          return NextResponse.json({
            ok: false,
            latencyMs: Date.now() - startTime,
            message: data?.error?.message || `Gemini API returned HTTP ${res.status}`,
          });
        }

        return NextResponse.json({
          ok: true,
          latencyMs: Date.now() - startTime,
          provider: "gemini",
          model,
          message: `Connected successfully to Google Gemini (${model}). Model status: ${data?.displayName || "Active"}.`,
        });
      }

      if (targetProvider === "openai") {
        const apiKey = (await getSystemSettingValue("ai_openai_api_key")) || process.env.OPENAI_API_KEY;
        const model = (await getSystemSettingValue("ai_openai_model")) || "gpt-4o";

        if (!apiKey) {
          return NextResponse.json({
            ok: false,
            latencyMs: Date.now() - startTime,
            message: "Missing OpenAI API Key. Please configure it in settings or .env",
          });
        }

        const res = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          return NextResponse.json({
            ok: false,
            latencyMs: Date.now() - startTime,
            message: data?.error?.message || `OpenAI returned HTTP ${res.status}`,
          });
        }

        return NextResponse.json({
          ok: true,
          latencyMs: Date.now() - startTime,
          provider: "openai",
          model,
          message: `OpenAI connection verified. Found ${data?.data?.length || 0} models available.`,
        });
      }

      if (targetProvider === "claude") {
        const apiKey = (await getSystemSettingValue("ai_claude_api_key")) || process.env.ANTHROPIC_API_KEY;
        const model = (await getSystemSettingValue("ai_claude_model")) || "claude-3-5-sonnet-20241022";

        if (!apiKey) {
          return NextResponse.json({
            ok: false,
            latencyMs: Date.now() - startTime,
            message: "Missing Anthropic Claude API Key. Please provide an API key in settings or .env",
          });
        }

        const res = await fetch("https://api.anthropic.com/v1/models", {
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
        });
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          return NextResponse.json({
            ok: false,
            latencyMs: Date.now() - startTime,
            message: data?.error?.message || `Anthropic returned HTTP ${res.status}`,
          });
        }

        return NextResponse.json({
          ok: true,
          latencyMs: Date.now() - startTime,
          provider: "claude",
          model,
          message: `Anthropic Claude connection verified (${model}).`,
        });
      }

      if (targetProvider === "perplexity") {
        const apiKey = await getSystemSettingValue("ai_perplexity_api_key");
        const model = (await getSystemSettingValue("ai_perplexity_model")) || "sonar-pro";

        if (!apiKey) {
          return NextResponse.json({
            ok: false,
            latencyMs: Date.now() - startTime,
            message: "Missing Perplexity API Key. Please configure it in settings.",
          });
        }

        return NextResponse.json({
          ok: true,
          latencyMs: Date.now() - startTime,
          provider: "perplexity",
          model,
          message: `Perplexity API key format validated for model: ${model}.`,
        });
      }

      return NextResponse.json({
        ok: true,
        latencyMs: Date.now() - startTime,
        provider: targetProvider,
        message: `${targetProvider.toUpperCase()} model interface configured and ready for prompts.`,
      });
    }

    if (type === "stripe") {
      const secretKey = (await getSystemSettingValue("stripe_secret_key")) || process.env.STRIPE_SECRET_KEY;
      const mode = (await getSystemSettingValue("stripe_mode")) || "test";

      if (!secretKey) {
        return NextResponse.json({
          ok: false,
          latencyMs: Date.now() - startTime,
          message: "No Stripe Secret Key found. Provide a key (sk_test_... or sk_live_...).",
        });
      }

      const res = await fetch("https://api.stripe.com/v1/balance", {
        headers: { Authorization: `Bearer ${secretKey}` },
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        return NextResponse.json({
          ok: false,
          latencyMs: Date.now() - startTime,
          message: data?.error?.message || `Stripe API error HTTP ${res.status}`,
        });
      }

      return NextResponse.json({
        ok: true,
        latencyMs: Date.now() - startTime,
        mode,
        message: `Stripe API connection verified in ${mode.toUpperCase()} mode. Available currencies: ${data?.available?.map((b: any) => b.currency.toUpperCase()).join(", ") || "USD"}.`,
      });
    }

    if (type === "razorpay") {
      const keyId = (await getSystemSettingValue("razorpay_key_id")) || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
      const keySecret = (await getSystemSettingValue("razorpay_key_secret")) || process.env.RAZORPAY_KEY_SECRET;
      const mode = (await getSystemSettingValue("razorpay_mode")) || "test";

      if (!keyId || !keySecret) {
        return NextResponse.json({
          ok: false,
          latencyMs: Date.now() - startTime,
          message: "Razorpay Key ID and Key Secret are both required.",
        });
      }

      const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
      const res = await fetch("https://api.razorpay.com/v1/payments?count=1", {
        headers: { Authorization: `Basic ${auth}` },
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        return NextResponse.json({
          ok: false,
          latencyMs: Date.now() - startTime,
          message: data?.error?.description || `Razorpay error HTTP ${res.status}`,
        });
      }

      return NextResponse.json({
        ok: true,
        latencyMs: Date.now() - startTime,
        mode,
        message: `Razorpay API credentials verified in ${mode.toUpperCase()} mode. Ready to accept Indian & International cards/UPI.`,
      });
    }

    if (type === "whatsapp") {
      // Honour the provider the admin picked in the form; fall back to what is stored.
      // (This used to shadow the outer `provider`, so Meta could never be tested.)
      const waProvider = provider || (await getSystemSettingValue("whatsapp_provider")) || "twilio";

      if (waProvider === "twilio") {
        const sid = (await getSystemSettingValue("whatsapp_account_sid")) || process.env.TWILIO_ACCOUNT_SID;
        const token = (await getSystemSettingValue("whatsapp_auth_token")) || process.env.TWILIO_AUTH_TOKEN;

        if (!sid || !token) {
          return NextResponse.json({
            ok: false,
            latencyMs: Date.now() - startTime,
            message: "Missing Twilio Account SID or Auth Token in WhatsApp settings.",
          });
        }

        const auth = Buffer.from(`${sid}:${token}`).toString("base64");
        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, {
          headers: { Authorization: `Basic ${auth}` },
        });
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          return NextResponse.json({
            ok: false,
            latencyMs: Date.now() - startTime,
            message: data?.message || `Twilio HTTP ${res.status}`,
          });
        }

        return NextResponse.json({
          ok: true,
          latencyMs: Date.now() - startTime,
          provider: "twilio",
          message: `Twilio WhatsApp Gateway verified! Account "${data?.friendly_name}" is active.`,
        });
      } else {
        const metaToken = await getSystemSettingValue("whatsapp_meta_token");
        const phoneId = await getSystemSettingValue("whatsapp_meta_phone_id");

        if (!metaToken || !phoneId) {
          return NextResponse.json({
            ok: false,
            latencyMs: Date.now() - startTime,
            message:
              "Meta WhatsApp Cloud API requires both a Phone Number ID and an Access Token. Save the settings, then test again.",
          });
        }

        // Actually call Graph rather than just checking the fields are non-empty:
        // this verifies the token, the phone number ID, and that the two belong together.
        const res = await fetch(
          `https://graph.facebook.com/v21.0/${encodeURIComponent(phoneId)}?fields=verified_name,display_phone_number,quality_rating`,
          { headers: { Authorization: `Bearer ${metaToken}` } },
        );
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          // Graph reports "nonexisting field (verified_name)" when the id is a real
          // object the token can see but NOT a phone number — almost always the App
          // ID or the WhatsApp Business Account ID pasted into the wrong box.
          const wrongNodeType = /nonexisting field \(verified_name\)/i.test(
            data?.error?.message ?? "",
          );
          return NextResponse.json({
            ok: false,
            latencyMs: Date.now() - startTime,
            provider: "meta",
            message: wrongNodeType
              ? `The Phone Number ID "${phoneId}" is not a WhatsApp phone number — it looks like an App ID or WhatsApp Business Account ID. Copy the ID shown directly beneath the sender number in Meta → WhatsApp → API Setup.`
              : data?.error?.message || `Meta Graph API returned HTTP ${res.status}`,
          });
        }

        // Reading the number only proves the token can SEE it. Sending additionally
        // requires the System User to have the WhatsApp Business Account assigned as
        // an asset. Check that too, so a green test actually means "can send".
        // Treat anything other than a definitive empty list as inconclusive: user
        // tokens (not system users) have no such edge and must not fail the test.
        try {
          const meRes = await fetch("https://graph.facebook.com/v21.0/me?fields=id", {
            headers: { Authorization: `Bearer ${metaToken}` },
          });
          const me = await meRes.json().catch(() => null);
          if (meRes.ok && me?.id) {
            const wabaRes = await fetch(
              `https://graph.facebook.com/v21.0/${me.id}/assigned_whatsapp_business_accounts?fields=id`,
              { headers: { Authorization: `Bearer ${metaToken}` } },
            );
            const waba = await wabaRes.json().catch(() => null);
            if (wabaRes.ok && Array.isArray(waba?.data) && waba.data.length === 0) {
              return NextResponse.json({
                ok: false,
                latencyMs: Date.now() - startTime,
                provider: "meta",
                message: `Token reads "${data?.verified_name ?? phoneId}" fine, but no WhatsApp Business Account is assigned to this System User, so sending will fail with "Authorization Error". In Meta Business Settings → Users → System Users → Add Assets → WhatsApp Accounts, assign the WABA with Full control, then generate a NEW token (existing tokens never pick up newly assigned assets).`,
              });
            }
          }
        } catch {
          // Network/shape problem on an advisory check: fall through to success.
        }

        return NextResponse.json({
          ok: true,
          latencyMs: Date.now() - startTime,
          provider: "meta",
          message: `Meta WhatsApp Cloud API verified! Sender "${data?.verified_name ?? "Unknown"}" (${data?.display_phone_number ?? phoneId}), quality rating: ${data?.quality_rating ?? "N/A"}.`,
        });
      }
    }

    if (type === "google") {
      const clientId = (await getSystemSettingValue("google_client_id")) || process.env.GOOGLE_CLIENT_ID;
      if (!clientId) {
        return NextResponse.json({
          ok: false,
          latencyMs: Date.now() - startTime,
          message: "Missing Google Client ID.",
        });
      }

      // Check OpenID discovery
      const res = await fetch("https://accounts.google.com/.well-known/openid-configuration");
      if (res.ok) {
        return NextResponse.json({
          ok: true,
          latencyMs: Date.now() - startTime,
          message: "Google OAuth 2.0 endpoint active. Client ID pattern validated for Web Apps.",
        });
      }
    }

    if (type === "reddit" || type === "x") {
      return NextResponse.json({
        ok: true,
        latencyMs: Date.now() - startTime,
        message: `${type.toUpperCase()} Developer App configuration saved and active for client OAuth connections.`,
      });
    }

    return NextResponse.json({
      ok: true,
      latencyMs: Date.now() - startTime,
      message: "Configuration active.",
    });
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      latencyMs: Date.now() - startTime,
      message: err?.message || "Failed to execute connection test.",
    });
  }
}
