import dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../src/server/db';
import crypto from 'node:crypto';

function toBuffer(val: any): Buffer {
  if (!val) return Buffer.alloc(0);
  if (Buffer.isBuffer(val)) return val;
  if (val instanceof Uint8Array) return Buffer.from(val);
  if (typeof val === 'string') return Buffer.from(val, 'base64');
  if (typeof val === 'object') {
    if (Array.isArray(val)) return Buffer.from(val);
    if (Array.isArray(val.data)) return Buffer.from(val.data);
    // Dictionary with numeric indices: { '0': 71, '1': 74, ... }
    const values = Object.keys(val)
      .filter(k => /^\d+$/.test(k))
      .sort((a, b) => Number(a) - Number(b))
      .map(k => val[k]);
    if (values.length > 0) return Buffer.from(values);
  }
  return Buffer.from(val);
}

function safeDecrypt(e: { cipher: any; iv: any; tag: any }): string {
  const rawKey = process.env.ENCRYPTION_KEY!;
  const key = Buffer.from(rawKey, 'base64');
  const iv = toBuffer(e.iv);
  const tag = toBuffer(e.tag);
  const cipher = toBuffer(e.cipher);

  const d = crypto.createDecipheriv('aes-256-gcm', key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(cipher), d.final()]).toString('utf8');
}

async function run() {
  const c = await prisma.googleConnection.findFirst({ where: { status: 'connected' } });
  if (c) {
    const access = safeDecrypt({
      cipher: c.encryptedAccessToken,
      iv: c.tokenIv,
      tag: c.tokenTag,
    });
    console.log('Decrypted Access Token SUCCESS! Length:', access.length, 'Token:', access.slice(0, 25) + '...');

    if (c.encryptedRefreshToken) {
      const refresh = safeDecrypt({
        cipher: c.encryptedRefreshToken,
        iv: c.tokenIv,
        tag: c.tokenTag,
      });
      console.log('Decrypted Refresh Token SUCCESS! Length:', refresh.length, 'Token:', refresh.slice(0, 25) + '...');
    }
  }
}

run();
