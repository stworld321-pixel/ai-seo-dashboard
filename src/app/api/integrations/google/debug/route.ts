import { NextResponse } from "next/server";
import {
  getGoogleClientCredentials,
  resolveRedirectUri,
  getGoogleOAuthUrl,
} from "@/server/integrations/google/oauth";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const redirectUri = resolveRedirectUri(request);
  const { clientId, clientSecret } = await getGoogleClientCredentials();
  const website = await prisma.website.findFirst();

  let oauthUrl: string | null = null;
  if (clientId && website) {
    oauthUrl = await getGoogleOAuthUrl(website.id, redirectUri, clientId);
  }

  const clientIdSuffix = clientId ? clientId.slice(-15) : "missing";
  const clientIdPrefix = clientId ? clientId.slice(0, 15) : "";
  const maskedClientId = clientId ? `${clientIdPrefix}...${clientIdSuffix}` : "NOT_CONFIGURED";

  return NextResponse.json({
    status: clientId && clientSecret ? "CONFIGURED" : "MISSING_CREDENTIALS",
    exactRedirectUriSentToGoogle: redirectUri,
    authorizedOriginNeeded: new URL(redirectUri).origin,
    maskedClientId,
    hasClientSecret: Boolean(clientSecret),
    googleCloudConsoleCredentialsUrl: "https://console.cloud.google.com/apis/credentials",
    directOAuthTestUrl: oauthUrl,
    instructions: {
      step1: "Go to https://console.cloud.google.com/apis/credentials and click on your OAuth 2.0 Client ID.",
      step2: `Under 'Authorized JavaScript origins', add: ${new URL(redirectUri).origin}`,
      step3: `Under 'Authorized redirect URIs', add: ${redirectUri}`,
      step4: "Click 'SAVE' at the bottom of the Google Cloud page and wait 2 minutes for Google's servers to sync.",
    },
  });
}
