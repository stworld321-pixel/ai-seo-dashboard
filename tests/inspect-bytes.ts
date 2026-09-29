import dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../src/server/db';

async function inspectBytes() {
  const c = await prisma.googleConnection.findFirst({ where: { status: 'connected' } });
  if (c) {
    console.log('tokenIv type:', typeof c.tokenIv, 'constructor:', (c.tokenIv as any)?.constructor?.name);
    console.log('tokenIv value:', c.tokenIv);
    console.log('tokenTag type:', typeof c.tokenTag, 'constructor:', (c.tokenTag as any)?.constructor?.name);
    console.log('tokenTag value:', c.tokenTag);
    console.log('encryptedAccessToken type:', typeof c.encryptedAccessToken, 'constructor:', (c.encryptedAccessToken as any)?.constructor?.name);
  }
}

inspectBytes();
