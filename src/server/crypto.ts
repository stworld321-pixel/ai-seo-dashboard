import crypto from "node:crypto";

/**
 * AES-256-GCM encryption for integration secrets (CMS tokens, OAuth refresh
 * tokens, API keys). The database stores ciphertext + iv + auth tag in three
 * separate columns; plaintext never occupies a column, a log line, or a React
 * prop. See docs/09-security.md.
 */

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // GCM standard
const KEY_BYTES = 32;

/**
 * Prisma 7 maps `Bytes` columns to `Uint8Array<ArrayBuffer>` — note the
 * explicit ArrayBuffer parameter, which excludes SharedArrayBuffer. Node's
 * Buffer is typed as `Uint8Array<ArrayBufferLike>` and is therefore NOT
 * assignable, so `toBytes()` below copies into a plain ArrayBuffer-backed
 * array before the value reaches the database.
 */
export type Encrypted = {
  cipher: Uint8Array<ArrayBuffer>;
  iv: Uint8Array<ArrayBuffer>;
  tag: Uint8Array<ArrayBuffer>;
};

function toBytes(b: Buffer): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(b.length));
  out.set(b);
  return out;
}

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY is not set. Generate one with: openssl rand -base64 32",
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes, got ${key.length}. ` +
        "Generate one with: openssl rand -base64 32",
    );
  }
  return key;
}

export function encrypt(plaintext: string): Encrypted {
  const iv = crypto.randomBytes(IV_BYTES);
  const c = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const cipher = Buffer.concat([c.update(plaintext, "utf8"), c.final()]);
  return { cipher: toBytes(cipher), iv: toBytes(iv), tag: toBytes(c.getAuthTag()) };
}

export function decrypt(e: Encrypted): string {
  const d = crypto.createDecipheriv(ALGORITHM, getKey(), e.iv);
  d.setAuthTag(e.tag);
  return Buffer.concat([d.update(e.cipher), d.final()]).toString("utf8");
}
/** Convenience wrappers for storing a JSON secret blob. */
export function encryptJson(value: unknown): Encrypted {
  return encrypt(JSON.stringify(value));
}

export function decryptJson<T>(e: Encrypted): T {
  return JSON.parse(decrypt(e)) as T;
}
