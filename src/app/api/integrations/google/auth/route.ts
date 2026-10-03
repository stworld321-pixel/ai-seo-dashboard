import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getDefaultWebsite } from "@/server/services/dashboard";
import { getGoogleOAuthUrl, getGoogleClientCredentials } from "@/server/integrations/google/oauth";

function resolveRedirectUri(request: Request): string {
  const host = request.headers.get("host") || "localhost:3000";
  const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  return `${protocol}://${host}/api/integrations/google/callback`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const websiteId = searchParams.get("websiteId") ?? undefined;
  const website = await getDefaultWebsite(websiteId);

  if (!website) {
    return NextResponse.json({ error: { message: "Website not found" } }, { status: 404 });
  }

  const redirectUri = resolveRedirectUri(request);
  const { clientId, clientSecret } = getGoogleClientCredentials();

  if (!clientId || !clientSecret) {
    return NextResponse.json({
      needsOAuthConfig: true,
      redirectUri,
      message:
        "Enter your Google Cloud OAuth Client ID and Client Secret to sign in with your Gmail account.",
    });
  }

  const oauthUrl = getGoogleOAuthUrl(website.id, redirectUri);

  // If the browser navigates directly to this URL (e.g. from window.location.href or direct link),
  // automatically redirect to Google's consent screen instead of displaying raw JSON
  const isHtmlNavigation =
    request.headers.get("sec-fetch-dest") === "document" ||
    request.headers.get("sec-fetch-mode") === "navigate" ||
    request.headers.get("accept")?.includes("text/html");

  if (isHtmlNavigation || searchParams.get("redirect") === "true") {
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

  // Persist to .env so it survives server restarts
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
    // Non-fatal if .env write fails
  }

  const website = await getDefaultWebsite(body.websiteId);
  if (!website) {
    return NextResponse.json({ error: { message: "Website not found" } }, { status: 404 });
  }

  const redirectUri = resolveRedirectUri(request);
  const oauthUrl = getGoogleOAuthUrl(website.id, redirectUri);
  return NextResponse.json({ url: oauthUrl, redirectUri });
}
