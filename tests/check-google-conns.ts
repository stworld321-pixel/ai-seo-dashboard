import dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../src/server/db';

async function checkGoogleConns() {
  const conns = await prisma.googleConnection.findMany();
  console.log(`Found ${conns.length} google connections:`);
  for (const c of conns) {
    console.log(`Connection ID: ${c.id}`);
    console.log(`WebsiteId: ${c.websiteId}`);
    console.log(`Email: ${c.email}`);
    console.log(`Status: ${c.status}`);
    console.log(`ExpiresAt: ${c.tokenExpiresAt}`);
    console.log(`Has Encrypted Access Token:`, Boolean(c.encryptedAccessToken));
    console.log(`Has Encrypted Refresh Token:`, Boolean(c.encryptedRefreshToken));
    console.log(`Has IV:`, Boolean(c.tokenIv));
    console.log(`Has Tag:`, Boolean(c.tokenTag));
  }
}

checkGoogleConns();
