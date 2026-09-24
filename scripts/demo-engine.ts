/**
 * Runs the opportunity engine over the saved real GSC data and prints the
 * result. Sanity-check tool: `npx tsx scripts/demo-engine.ts`
 */
import { runOpportunityEngine, todaysActions } from "../src/server/intelligence/opportunity-engine";
import { liteQueries, litePages } from "../tests/fixtures/litenatures";

const queries = liteQueries();
const pages = litePages();
const { opportunities, curve } = runOpportunityEngine({ queries, pages });

console.log("=== litenatures.in | 2026-08-27 .. 2026-09-23 ===");
console.log(
  `queries=${queries.length} pages=${pages.length} ` +
    `impressions=${curve.diagnostics.totalImpressions} clicks=${curve.diagnostics.totalClicks}`,
);
console.log(`CTR curve fitted: ${curve.fitted} (buckets=${curve.diagnostics.bucketsFitted})`);
console.log(`opportunities detected: ${opportunities.length}\n`);

console.log("--- WHAT SHOULD I DO TODAY? ---");
for (const o of todaysActions(opportunities, 5)) {
  console.log(`\nP${o.priority}  [${o.type}]  ${o.keyword ?? o.targetUrl}`);
  console.log(`  Why: ${o.why}`);
  console.log(`  Estimated clicks: ${o.estimatedClicks ?? "not modelled (no click history)"}`);
  console.log(`  Evidence: ${JSON.stringify(o.evidence)}`);
  console.log(`  Actions: ${o.recommendation.map((r) => r.action).join(" | ")}`);
}
