/**
 * Direct Google OAuth 2.0 & Official API Client.
 *
 * Scopes requested:
 * - https://www.googleapis.com/auth/webmasters.readonly (Search Console)
 * - https://www.googleapis.com/auth/analytics.readonly (Google Analytics 4)
 * - https://www.googleapis.com/auth/userinfo.email (Account Identification)
 *
 * Security:
 * - AES-256-GCM encryption at rest for tokens
 * - Never returns raw tokens to the client
 * - Automatic token refreshing
 */

import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/server/db";
import { encrypt, decrypt } from "@/server/crypto";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

export function resolveRedirectUri(request?: Request): string {
  if (request) {
    const forwardedProto = request.headers.get("x-forwarded-proto");
    const forwardedHost = request.headers.get("x-forwarded-host");
    const host = forwardedHost || request.headers.get("host");

    if (host) {
      const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
      const proto = forwardedProto || (isLocal ? "http" : "https");
      return `${proto}://${host}/api/integrations/google/callback`;
    }
  }

  const envUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (envUrl) {
    return `${envUrl.replace(/\/+$/, "")}/api/integrations/google/callback`;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/+$/, "")}/api/integrations/google/callback`;
  }

  return "http://localhost:3000/api/integrations/google/callback";
}

export async function getGoogleClientCredentials(): Promise<{ clientId: string; clientSecret: string }> {
  let clientId = process.env.GOOGLE_CLIENT_ID?.trim() || "";
  let clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() || "";

  // Check database SystemSetting if not in env
  if (!clientId || !clientSecret) {
    try {
      const { getSystemSettingValue } = await import("@/server/services/system-settings");
      if (!clientId) clientId = (await getSystemSettingValue("google_client_id")).trim();
      if (!clientSecret) clientSecret = (await getSystemSettingValue("google_client_secret")).trim();
    } catch {
      // ignore
    }
  }

  // Fallback to local .env file
  if (!clientId || !clientSecret) {
    try {
      const envPath = path.resolve(process.cwd(), ".env");
      if (fs.existsSync(envPath)) {
        const raw = fs.readFileSync(envPath, "utf8");
        const idMatch = raw.match(/^GOOGLE_CLIENT_ID=["']?([^"'\r\n]+)["']?/m);
        const secretMatch = raw.match(/^GOOGLE_CLIENT_SECRET=["']?([^"'\r\n]+)["']?/m);
        if (!clientId && idMatch?.[1]) {
          clientId = idMatch[1].trim();
          process.env.GOOGLE_CLIENT_ID = clientId;
        }
        if (!clientSecret && secretMatch?.[1]) {
          clientSecret = secretMatch[1].trim();
          process.env.GOOGLE_CLIENT_SECRET = clientSecret;
        }
      }
    } catch {
      // ignore
    }
  }

  return { clientId, clientSecret };
}

export async function getGoogleOAuthUrl(websiteId: string, redirectUri: string, explicitClientId?: string): Promise<string> {
  const clientId = explicitClientId || (await getGoogleClientCredentials()).clientId;
  const state = Buffer.from(JSON.stringify({ websiteId, timestamp: Date.now() })).toString("base64url");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "select_account consent", // Always ask which Gmail account to connect and return refresh_token
    state,
  });

  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

export type TokenExchangeResult = {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  scopes: string[];
  email?: string;
};

export async function exchangeGoogleAuthCode(
  code: string,
  redirectUri: string,
): Promise<TokenExchangeResult> {
  const { clientId, clientSecret } = await getGoogleClientCredentials();

  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is not configured. Please add them in Vercel environment variables or Admin Settings.");
  }

  const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google OAuth code exchange failed (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
  };

  // Fetch authenticated user's email
  let email: string | undefined;
  try {
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    if (userRes.ok) {
      const userJson = (await userRes.json()) as { email?: string };
      email = userJson.email;
    }
  } catch {
    // Non-fatal if userinfo fails
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    scopes: data.scope ? data.scope.split(" ") : GOOGLE_SCOPES,
    email,
  };
}

/**
 * Saves or updates GoogleConnection for a website with AES-256-GCM encryption.
 */
export async function saveGoogleConnection(
  websiteId: string,
  tokens: TokenExchangeResult,
) {
  const encAccess = encrypt(tokens.accessToken);
  const encRefresh = tokens.refreshToken ? encrypt(tokens.refreshToken) : null;
  const tokenExpiresAt = new Date(Date.now() + tokens.expiresIn * 1000);

  const existing = await prisma.googleConnection.findFirst({
    where: { websiteId },
  });

  if (existing) {
    return prisma.googleConnection.update({
      where: { id: existing.id },
      data: {
        email: tokens.email ?? existing.email,
        encryptedAccessToken: encAccess.packed ?? encAccess.cipher,
        encryptedRefreshToken: encRefresh ? (encRefresh.packed ?? encRefresh.cipher) : existing.encryptedRefreshToken,
        tokenIv: encAccess.iv,
        tokenTag: encAccess.tag,
        tokenExpiresAt,
        scopes: tokens.scopes,
        status: "connected",
      },
    });
  }

  return prisma.googleConnection.create({
    data: {
      websiteId,
      email: tokens.email,
      encryptedAccessToken: encAccess.packed ?? encAccess.cipher,
      encryptedRefreshToken: encRefresh ? (encRefresh.packed ?? encRefresh.cipher) : null,
      tokenIv: encAccess.iv,
      tokenTag: encAccess.tag,
      tokenExpiresAt,
      scopes: tokens.scopes,
      status: "connected",
    },
  });
}

/**
 * Gets a valid decrypted Google Access Token for a website, auto-refreshing if expired.
 */
export async function getValidGoogleAccessToken(websiteId?: string): Promise<string | null> {
  let connection = websiteId
    ? await prisma.googleConnection.findFirst({
        where: { websiteId, status: "connected" },
        orderBy: { updatedAt: "desc" },
      })
    : null;

  if (!connection) {
    connection = await prisma.googleConnection.findFirst({
      where: { status: "connected" },
      orderBy: { updatedAt: "desc" },
    });
  }

  if (!connection || !connection.encryptedAccessToken) {
    return null;
  }

  const now = new Date();
  const isExpired = connection.tokenExpiresAt ? connection.tokenExpiresAt.getTime() - now.getTime() < 60000 : true;

  if (!isExpired) {
    try {
      return decrypt({
        cipher: connection.encryptedAccessToken,
        iv: connection.tokenIv,
        tag: connection.tokenTag,
      });
    } catch {
      // Decryption error, proceed to refresh attempt
    }
  }

  // Need refresh
  if (connection.encryptedRefreshToken) {
    try {
      const refreshToken = decrypt({
        cipher: connection.encryptedRefreshToken,
        iv: connection.tokenIv,
        tag: connection.tokenTag,
      });

      const { clientId, clientSecret } = await getGoogleClientCredentials();

      const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as { access_token: string; expires_in: number };
        const newEnc = encrypt(data.access_token);
        await prisma.googleConnection.update({
          where: { id: connection.id },
          data: {
            encryptedAccessToken: newEnc.packed ?? newEnc.cipher,
            tokenIv: newEnc.iv,
            tokenTag: newEnc.tag,
            tokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
          },
        });
        return data.access_token;
      }
    } catch {
      // Refresh failed
    }
  }

  return null;
}

/**
 * Discovers accessible Google Search Console properties.
 */
export async function fetchGoogleSearchConsoleProperties(accessToken: string): Promise<
  Array<{ siteUrl: string; permissionLevel: string; isDomain: boolean }>
> {
  const res = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Google Search Console API error (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as {
    siteEntry?: Array<{ siteUrl: string; permissionLevel: string }>;
  };

  if (!data.siteEntry) return [];

  return data.siteEntry.map((entry) => ({
    siteUrl: entry.siteUrl,
    permissionLevel: entry.permissionLevel,
    isDomain: entry.siteUrl.startsWith("sc-domain:"),
  }));
}

/**
 * Discovers accessible GA4 properties.
 */
export async function fetchGoogleAnalytics4Properties(accessToken: string): Promise<
  Array<{ accountId: string; accountName: string; propertyId: string; propertyName: string }>
> {
  const res = await fetch("https://analyticsadmin.googleapis.com/v1beta/accountSummaries", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Google Analytics Admin API error (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as {
    accountSummaries?: Array<{
      account: string;
      displayName: string;
      propertySummaries?: Array<{
        property: string;
        displayName: string;
      }>;
    }>;
  };

  const results: Array<{ accountId: string; accountName: string; propertyId: string; propertyName: string }> = [];

  for (const acc of data.accountSummaries ?? []) {
    const accountId = acc.account.replace("accounts/", "");
    for (const prop of acc.propertySummaries ?? []) {
      const propertyId = prop.property.replace("properties/", "");
      results.push({
        accountId,
        accountName: acc.displayName,
        propertyId,
        propertyName: prop.displayName,
      });
    }
  }

  return results;
}
