export const SESSION_COOKIE_NAME = "seo_session";

export type SessionPayload = {
  userId: string;
  email: string;
  name: string;
  isAdmin?: boolean;
  role?: string;
  orgId?: string;
  orgName?: string;
  exp: number;
};

function getSecret(): string {
  return (
    process.env.NEXTAUTH_SECRET ||
    process.env.ENCRYPTION_KEY ||
    "ai-seo-command-center-default-secret-key"
  );
}

// Edge & Node safe Base64Url encoding / decoding
export function base64UrlEncode(str: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(str, "utf8").toString("base64url");
  }
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function base64UrlDecode(str: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(str, "base64url").toString("utf8");
  }
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + "==".slice((2 - (str.length & 3)) & 3);
  return decodeURIComponent(escape(atob(b64)));
}

async function getHmacKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function binaryStringToUint8Array(str: string): Uint8Array<ArrayBuffer> {
  const buffer = new ArrayBuffer(str.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBinaryString(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return binary;
}

export async function createSessionToken(
  payload: Omit<SessionPayload, "exp">,
  ttlDays = 30,
): Promise<string> {
  const fullPayload: SessionPayload = {
    ...payload,
    exp: Date.now() + ttlDays * 24 * 60 * 60 * 1000,
  };
  const dataB64 = base64UrlEncode(JSON.stringify(fullPayload));
  const key = await getHmacKey(getSecret());
  const enc = new TextEncoder();
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, enc.encode(dataB64));
  const sig = base64UrlEncode(uint8ArrayToBinaryString(new Uint8Array(signatureBuffer)));
  return `${dataB64}.${sig}`;
}

export async function verifySessionToken(
  token: string | undefined | null,
): Promise<SessionPayload | null> {
  if (!token || !token.includes(".")) return null;
  const [dataB64, sig] = token.split(".");
  if (!dataB64 || !sig) return null;

  try {
    const key = await getHmacKey(getSecret());
    const enc = new TextEncoder();
    const sigBinary = base64UrlDecode(sig);
    const sigBytes = binaryStringToUint8Array(sigBinary);

    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      enc.encode(dataB64),
    );

    if (!isValid) return null;

    const parsed = JSON.parse(base64UrlDecode(dataB64)) as SessionPayload;
    if (!parsed.userId || !parsed.email || parsed.exp < Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
