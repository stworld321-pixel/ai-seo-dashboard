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
  packed?: Uint8Array<ArrayBuffer>;
};

export function toBuffer(val: unknown): Buffer {
  if (!val) return Buffer.alloc(0);
  if (Buffer.isBuffer(val)) return val;
  if (val instanceof Uint8Array) {
    return Buffer.from(val.buffer, val.byteOffset, val.byteLength);
  }
  if (typeof val === "object" && val !== null) {
    const obj = val as Record<string, number>;
    const keys = Object.keys(obj).filter((k) => !isNaN(Number(k)));
    if (keys.length > 0) {
      const arr = new Uint8Array(keys.length);
      for (let i = 0; i < keys.length; i++) {
        arr[i] = obj[i];
      }
      return Buffer.from(arr.buffer);
    }
  }
  if (typeof val === "string") {
    if (/^[0-9a-fA-F]+$/.test(val) && val.length % 2 === 0) {
      return Buffer.from(val, "hex");
    }
    return Buffer.from(val, "utf8");
  }
  return Buffer.from(val as ArrayBufferLike);
}

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
  const tag = c.getAuthTag();
  const packed = Buffer.concat([iv, tag, cipher]);

  return {
    cipher: toBytes(cipher),
    iv: toBytes(iv),
    tag: toBytes(tag),
    packed: toBytes(packed),
  };
}

export function decrypt(
  e:
    | Encrypted
    | {
        cipher?: unknown;
        iv?: unknown;
        tag?: unknown;
        encryptedAccessToken?: unknown;
        encryptedRefreshToken?: unknown;
        tokenIv?: unknown;
        tokenTag?: unknown;
      }
    | unknown,
): string {
  const key = getKey();

  // If passed directly as a packed buffer/Uint8Array or object with cipher only
  const rawObj = (e && typeof e === "object" ? e : {}) as Record<string, unknown>;
  const cipherBuf = toBuffer(rawObj.cipher ?? rawObj.encryptedAccessToken ?? rawObj.encryptedRefreshToken ?? e);
  const ivBuf = toBuffer(rawObj.iv ?? rawObj.tokenIv);
  const tagBuf = toBuffer(rawObj.tag ?? rawObj.tokenTag);

  // Strategy 1: Standard separate IV + Tag + Cipher
  if (ivBuf.length === IV_BYTES && tagBuf.length === 16 && cipherBuf.length > 0) {
    try {
      const d = crypto.createDecipheriv(ALGORITHM, key, ivBuf);
      d.setAuthTag(tagBuf);
      return Buffer.concat([d.update(cipherBuf), d.final()]).toString("utf8");
    } catch {
      // Fall through to packed check if failed
    }
  }

  // Strategy 2: Packed payload [12 bytes IV][16 bytes Tag][Ciphertext]
  if (cipherBuf.length >= IV_BYTES + 16) {
    try {
      const packedIv = cipherBuf.subarray(0, IV_BYTES);
      const packedTag = cipherBuf.subarray(IV_BYTES, IV_BYTES + 16);
      const packedCipher = cipherBuf.subarray(IV_BYTES + 16);
      const d = crypto.createDecipheriv(ALGORITHM, key, packedIv);
      d.setAuthTag(packedTag);
      return Buffer.concat([d.update(packedCipher), d.final()]).toString("utf8");
    } catch {
      // Fall through
    }
  }

  throw new Error("Failed to decrypt data: invalid ciphertext, IV, or auth tag.");
}

/** Convenience wrappers for storing a JSON secret blob. */
export function encryptJson(value: unknown): Encrypted {
  return encrypt(JSON.stringify(value));
}

export function decryptJson<T>(e: Encrypted): T {
  return JSON.parse(decrypt(e)) as T;
}

