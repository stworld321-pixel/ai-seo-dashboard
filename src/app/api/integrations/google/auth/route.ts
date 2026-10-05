import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getDefaultWebsite } from "@/server/services/dashboard";
import {
  getGoogleOAuthUrl,
  getGoogleClientCredentials,
  resolveRedirectUri,
} from "@/server/integrations/google/oauth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const websiteId = searchParams.get("websiteId") ?? undefined;
  const website = await getDefaultWebsite(websiteId);

  if (!website) {
    return NextResponse.json({ error: { message: "Website not found" } }, { status: 404 });
  }

  const redirectUri = resolveRedirectUri(request);
  const { clientId, clientSecret } = await getGoogleClientCredentials();

  if (!clientId || !clientSecret) {
    return NextResponse.json({
      needsOAuthConfig: true,
      redirectUri,
      message:
        "Enter your Google Cloud OAuth Client ID and Client Secret to sign in with your Gmail account.",
    });
  }

  const oauthUrl = await getGoogleOAuthUrl(website.id, redirectUri, clientId);

  // If redirect query param is present or user navigated directly
  if (searchParams.get("redirect") === "true") {
    return NextResponse.redirect(oauthUrl);
  }

  return NextResponse.json({ url: oauthUrl, redirectUri });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    websiteId?: string;
    clientId?: string;
    clientSecret?: string;
  };

  const clientId = body.clientId?.trim();
  const clientSecret = body.clientSecret?.trim();
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: { message: "Google OAuth Client ID and Client Secret are required." } },
      { status: 400 },
    );
  }

  process.env.GOOGLE_CLIENT_ID = clientId;
  process.env.GOOGLE_CLIENT_SECRET = clientSecret;

  // Persist to database so it works on Vercel and survives serverless restarts
  try {
    const { updateSystemSettings } = await import("@/server/services/system-settings");
    await updateSystemSettings({
      google_client_id: clientId,
      google_client_secret: clientSecret,
    });
  } catch (err) {
    console.warn("Failed to persist Google credentials to database:", err);
  }

  // Persist to .env so it survives local server restarts
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
    for (const [k, v] of [
      ["GOOGLE_CLIENT_ID", clientId],
      ["GOOGLE_CLIENT_SECRET", clientSecret],
    ] as const) {
      const line = `${k}="${v}"`;
      const regex = new RegExp(`^${k}=.*$`, "m");
      if (regex.test(content)) {
        content = content.replace(regex, line);
      } else {
        content = `${content.trimEnd()}\n${line}\n`;
      }
    }
    fs.writeFileSync(envPath, content, "utf8");
  } catch {
    // Non-fatal if .env write fails on Vercel
  }

  const website = await getDefaultWebsite(body.websiteId);
  if (!website) {
    return NextResponse.json({ error: { message: "Website not found" } }, { status: 404 });
  }

  const redirectUri = resolveRedirectUri(request);
  const oauthUrl = await getGoogleOAuthUrl(website.id, redirectUri, clientId);
  return NextResponse.json({ url: oauthUrl, redirectUri });
}
