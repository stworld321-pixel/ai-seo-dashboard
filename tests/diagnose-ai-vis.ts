import { prisma } from "@/server/db";
import {
  getAiVisibilityMetrics,
  getEngineComparison,
  getWhatShouldIDoNext,
  ensureAiVisibilityData,
  runFullAiVisibilityAudit,
  runWeeklyAudit,
  executePromptRun,
} from "@/server/services/ai-visibility";

async function runDiagnosis() {
  console.log("=== Starting AI Visibility Diagnosis ===");

  const websites = await prisma.website.findMany();
  console.log(`Found ${websites.length} websites in DB:`, websites.map((w) => `${w.id} (${w.name})`));

  for (const w of websites) {
    console.log(`\n--- Testing Website: ${w.name} (${w.id}) ---`);

    try {
      console.log("1. Testing getAiVisibilityMetrics...");
      const metrics = await getAiVisibilityMetrics(w.id);
      console.log("   Metrics OK:", {
        visibilityScore: metrics.visibilityScore,
        totalCitations: metrics.totalCitations,
        brandMentions: metrics.brandMentions,
        promptsTracked: metrics.promptsTracked,
      });
    } catch (err) {
      console.error("   ❌ getAiVisibilityMetrics FAILED:", err);
    }

    try {
      console.log("2. Testing getEngineComparison...");
      const comp = await getEngineComparison(w.id);
      console.log(`   EngineComparison OK: ${comp.length} rows`);
    } catch (err) {
      console.error("   ❌ getEngineComparison FAILED:", err);
    }

    try {
      console.log("3. Testing getWhatShouldIDoNext...");
      const recs = await getWhatShouldIDoNext(w.id);
      console.log(`   Recommendations OK: ${recs.length} items`);
    } catch (err) {
      console.error("   ❌ getWhatShouldIDoNext FAILED:", err);
    }

    try {
      console.log("4. Testing WeeklyAiAudit query...");
      const audits = await prisma.weeklyAiAudit.findMany({
        where: { websiteId: w.id },
        orderBy: { weekStart: "desc" },
        include: { results: { include: { prompt: true } } },
        take: 5,
      });
      console.log(`   Weekly audits OK: ${audits.length} found`);
    } catch (err) {
      console.error("   ❌ WeeklyAiAudit query FAILED:", err);
    }

    try {
      console.log("5. Testing CitationOpportunity & AiPromptRun query...");
      const [runs, citOpps] = await Promise.all([
        prisma.aiPromptRun.findMany({
          where: { websiteId: w.id, response: { not: null } },
          include: { prompt: true },
          orderBy: { runAt: "desc" },
          take: 20,
        }),
        prisma.citationOpportunity.findMany({
          where: { websiteId: w.id },
          orderBy: { detectedAt: "desc" },
        }),
      ]);
      console.log(`   Runs: ${runs.length}, Citation opps: ${citOpps.length}`);
    } catch (err) {
      console.error("   ❌ Citations query FAILED:", err);
    }

    try {
      console.log("6. Testing EntityNode & relationships query...");
      const entities = await prisma.entityNode.findMany({
        where: { websiteId: w.id },
        include: { relationships: { include: { target: true } } },
      });
      console.log(`   Entity nodes OK: ${entities.length} found`);
    } catch (err) {
      console.error("   ❌ EntityNode query FAILED:", err);
    }
  }

  // Test 7: Test with a brand new website with 0 data
  console.log("\n--- Testing BRAND NEW Website (0 data) ---");
  const tempSite = await prisma.website.create({
    data: {
      id: `test_ai_${Date.now()}`,
      name: "Acme Test Corp",
      url: "https://acme-test-corp-xyz.com",
      orgId: "temp-org",
      country: "USA",
    },
  });

  try {
    console.log("Testing ensureAiVisibilityData on empty site...");
    await ensureAiVisibilityData(tempSite.id);
    const metrics = await getAiVisibilityMetrics(tempSite.id);
    console.log("   Brand new site metrics OK:", metrics);
    const comp = await getEngineComparison(tempSite.id);
    console.log("   Brand new site comp OK:", comp.length);
  } catch (err) {
    console.error("   ❌ Empty site test FAILED:", err);
  } finally {
    // Cleanup
    await prisma.website.delete({ where: { id: tempSite.id } }).catch(() => {});
  }

  console.log("\n=== Diagnosis Finished ===");
}

runDiagnosis().catch(console.error);
