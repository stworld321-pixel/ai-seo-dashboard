import dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../src/server/db';

async function diagnose() {
  const websites = await prisma.website.findMany();
  console.log(`Found ${websites.length} websites:`);

  for (const w of websites) {
    console.log(`\n======================================================`);
    console.log(`Website: ${w.name} (${w.url}) ID: ${w.id}`);
    console.log(`GSC Property: ${w.gscProperty}`);
    console.log(`GA4 Property: ${w.ga4PropertyId}`);
    console.log(`Last GSC Sync: ${w.lastGscSyncAt}`);

    const integrations = await prisma.integration.findMany({ where: { websiteId: w.id } });
    console.log(`Integrations (${integrations.length}):`);
    integrations.forEach(i => {
      console.log(`   - Kind: ${i.kind}, Provider: ${i.provider}, Status: ${i.status}, Config:`, i.config);
    });

    const dailyCount = await prisma.gscDaily.count({ where: { websiteId: w.id } });
    const queryDailyCount = await prisma.gscQueryDaily.count({ where: { websiteId: w.id } });
    const pageDailyCount = await prisma.gscPageDaily.count({ where: { websiteId: w.id } });

    console.log(`gscDaily rows count: ${dailyCount}`);
    console.log(`gscQueryDaily rows count: ${queryDailyCount}`);
    console.log(`gscPageDaily rows count: ${pageDailyCount}`);

    const dailyRows = await prisma.gscDaily.findMany({
      where: { websiteId: w.id },
      orderBy: { date: 'asc' }
    });
    console.log(`\nDaily Rows (${dailyRows.length} total):`);
    dailyRows.forEach(r => {
      console.log(`  ${r.date.toISOString().slice(0, 10)}: Clicks=${r.clicks}, Impr=${r.impressions}, CTR=${(r.ctr*100).toFixed(1)}%, Pos=${r.position.toFixed(1)}`);
    });

    const totalClicks = dailyRows.reduce((a, b) => a + b.clicks, 0);
    const totalImpr = dailyRows.reduce((a, b) => a + b.impressions, 0);
    const avgPos = totalImpr > 0 ? (dailyRows.reduce((a, b) => a + b.position * b.impressions, 0) / totalImpr) : 0;
    const avgCtr = totalImpr > 0 ? (totalClicks / totalImpr) * 100 : 0;
    console.log(`\nSUM in DB: Clicks=${totalClicks}, Impr=${totalImpr}, CTR=${avgCtr.toFixed(2)}%, AvgPos=${avgPos.toFixed(1)}`);
  }
}

diagnose();
