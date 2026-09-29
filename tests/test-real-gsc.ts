import dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../src/server/db';
import { getValidGoogleAccessToken } from '../src/server/integrations/google/oauth';

async function testGscCall() {
  const websites = await prisma.website.findMany();
  for (const w of websites) {
    console.log(`Checking website ${w.name} (${w.id})...`);
    const token = await getValidGoogleAccessToken(w.id);
    console.log(`Access Token present:`, Boolean(token));

    if (token) {
      const selectedProperty = w.gscProperty || w.url;
      console.log(`GSC Property: ${selectedProperty}`);
      const encodedSiteUrl = encodeURIComponent(selectedProperty);
      const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodedSiteUrl}/searchAnalytics/query`;

      // 1. Query with dimensions: ["date"]
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 28);
      const startDate = start.toISOString().slice(0, 10);
      const endDate = end.toISOString().slice(0, 10);

      console.log(`Querying GSC API for dates ${startDate} to ${endDate} with dimensions: ["date"]...`);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate,
          endDate,
          dimensions: ['date'],
          rowLimit: 5000,
        }),
      });

      console.log('GSC API status:', res.status);
      if (res.ok) {
        const json = await res.json();
        console.log('Total daily rows returned:', json.rows?.length);
        if (json.rows) {
          let sumClicks = 0;
          let sumImpr = 0;
          let weightedPos = 0;
          json.rows.forEach((r: any) => {
            sumClicks += r.clicks;
            sumImpr += r.impressions;
            weightedPos += r.position * r.impressions;
            console.log(`  ${r.keys[0]}: Clicks=${r.clicks}, Impr=${r.impressions}, CTR=${(r.ctr*100).toFixed(1)}%, Pos=${r.position.toFixed(1)}`);
          });
          const avgPos = sumImpr > 0 ? weightedPos / sumImpr : 0;
          const avgCtr = sumImpr > 0 ? (sumClicks / sumImpr) * 100 : 0;
          console.log(`\n=== REAL GSC SITE TOTALS (Last 28 Days) ===`);
          console.log(`Total Clicks: ${sumClicks}`);
          console.log(`Total Impressions: ${sumImpr}`);
          console.log(`Average CTR: ${avgCtr.toFixed(2)}%`);
          console.log(`Average Position: ${avgPos.toFixed(1)}`);
        }
      } else {
        const err = await res.text();
        console.log('GSC API error:', err);
      }
    }
  }
}

testGscCall();
