import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { ComposioGscProvider } from "@/server/integrations/search/composio-gsc";

/**
 * These tests drive the provider through a FAKE `composio` executable so they
 * run offline and deterministically, while still exercising the real parsing
 * logic — including the response shapes that actually broke the first sync.
 */

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gsc-provider-"));

function makeFakeBin(name: string, script: string): string {
  const file = path.join(tmp, name);
  fs.writeFileSync(file, `#!/usr/bin/env node\n${script}\n`, { mode: 0o755 });
  return file;
}

afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe("ComposioGscProvider response handling", () => {
  it("reads rows from an inline response", async () => {
    const bin = makeFakeBin(
      "inline.js",
      `console.log(JSON.stringify({ successful: true, data: { rows: [
         { keys: ["2026-09-15", "soap"], clicks: 1, impressions: 10, ctr: 0.1, position: 5 }
       ] } }));`,
    );
    const p = new ComposioGscProvider({ bin });
    const rows = await p.query({
      siteUrl: "https://x.test/",
      startDate: "2026-09-15",
      endDate: "2026-09-15",
      dimensions: ["date", "query"],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.keys[1]).toBe("soap");
  });

  /**
   * REGRESSION: Composio offloads large payloads to a temp file, returning
   * `{successful: true, storedInFile: true, outputFilePath}` with NO `data`
   * key. The first version of this provider crashed on exactly this
   * ("Cannot read properties of undefined") the moment a real multi-dimension
   * pull exceeded the inline size limit.
   */
  it("follows outputFilePath when the response is offloaded to a file", async () => {
    const payload = path.join(tmp, "payload.json");
    fs.writeFileSync(
      payload,
      JSON.stringify({
        successful: true,
        data: {
          rows: [
            { keys: ["2026-09-15", "a"], clicks: 0, impressions: 3, ctr: 0, position: 50 },
            { keys: ["2026-09-15", "b"], clicks: 2, impressions: 9, ctr: 0.22, position: 4 },
          ],
        },
        error: null,
      }),
    );
    const bin = makeFakeBin(
      "offload.js",
      `console.log(JSON.stringify({ successful: true, error: null, storedInFile: true,
         outputFilePath: ${JSON.stringify(payload)} }));`,
    );
    const p = new ComposioGscProvider({ bin });
    const rows = await p.query({
      siteUrl: "https://x.test/",
      startDate: "2026-09-15",
      endDate: "2026-09-15",
      dimensions: ["date", "query"],
    });
    expect(rows).toHaveLength(2);
    expect(rows[1]!.clicks).toBe(2);
  });

  /** GSC omits `rows` entirely (rather than sending []) when there is no data. */
  it("treats an absent rows key as an empty result", async () => {
    const bin = makeFakeBin(
      "norows.js",
      `console.log(JSON.stringify({ successful: true, data: { responseAggregationType: "byProperty" } }));`,
    );
    const p = new ComposioGscProvider({ bin });
    const rows = await p.query({
      siteUrl: "https://x.test/",
      startDate: "2026-09-15",
      endDate: "2026-09-15",
      dimensions: ["date"],
    });
    expect(rows).toEqual([]);
  });

  it("surfaces a failed call as an error", async () => {
    const bin = makeFakeBin(
      "fail.js",
      `console.log(JSON.stringify({ successful: false, error: "quota exceeded" }));`,
    );
    const p = new ComposioGscProvider({ bin, timeoutMs: 5000 });
    await expect(
      p.listProperties(),
    ).rejects.toThrow(/quota exceeded/);
  });

  it("parses the property list", async () => {
    const bin = makeFakeBin(
      "sites.js",
      `console.log(JSON.stringify({ successful: true, data: { siteEntry: [
         { siteUrl: "https://litenatures.in/", permissionLevel: "siteOwner" },
         { siteUrl: "sc-domain:easystudy.cloud", permissionLevel: "siteOwner" }
       ] } }));`,
    );
    const p = new ComposioGscProvider({ bin });
    const props = await p.listProperties();
    expect(props).toHaveLength(2);
    expect(props[0]!.siteUrl).toBe("https://litenatures.in/");
  });

  it("retries a transient failure before succeeding", async () => {
    const counter = path.join(tmp, "count.txt");
    const bin = makeFakeBin(
      "flaky.js",
      `const fs=require("fs");
       let n=0; try{ n=parseInt(fs.readFileSync(${JSON.stringify(counter)},"utf8"),10)||0 }catch{}
       fs.writeFileSync(${JSON.stringify(counter)}, String(n+1));
       if(n<1){ console.log(JSON.stringify({successful:false,error:"500 INTERNAL"})); }
       else { console.log(JSON.stringify({successful:true,data:{rows:[]}})); }`,
    );
    const p = new ComposioGscProvider({ bin });
    const rows = await p.query({
      siteUrl: "https://x.test/",
      startDate: "2026-09-15",
      endDate: "2026-09-15",
      dimensions: ["date"],
    });
    expect(rows).toEqual([]);
    expect(Number(fs.readFileSync(counter, "utf8"))).toBeGreaterThan(1);
  });
});
