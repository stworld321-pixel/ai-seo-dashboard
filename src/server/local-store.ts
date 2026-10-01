import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

/**
 * Persistent local JSON database adapter used automatically by `src/server/db.ts`
 * whenever PostgreSQL is unreachable (e.g. when the local `prisma dev` daemon is
 * stopped or Neon credentials are not yet configured).
 *
 * Implements the Prisma model interface used across services, scripts, and pages,
 * and persists state to `.data/seo-db.json` (or `/tmp/seo-data/seo-db.json` on Vercel).
 */

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DATA_DIR = isServerless
  ? path.join(os.tmpdir(), "seo-data")
  : path.resolve(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "seo-db.json");
const BUNDLED_DB_FILE = path.resolve(process.cwd(), ".data", "seo-db.json");

const DATE_FIELDS = new Set([
  "date",
  "createdAt",
  "updatedAt",
  "lastRunAt",
  "lastCompleteDate",
  "lastSyncAt",
  "lastCrawledAt",
  "lastModifiedAt",
  "publishedAt",
  "detectedAt",
  "resolvedAt",
  "appliedAt",
  "startedAt",
  "finishedAt",
  "decidedAt",
  "readAt",
  "nextRunAt",
  "runAt",
  "weekStart",
  "weekEnd",
  "postedAt",
  "approvedAt",
  "postedAt_action",
  "addedAt",
  "tokenExpiresAt",
  "lastPublishedAt",
  "lastGscSyncAt",
  "lastGa4SyncAt",
]);

type Row = Record<string, unknown>;

export type OrderSpec = Record<string, "asc" | "desc"> | Array<Record<string, "asc" | "desc">> | undefined;

type StoreData = Record<string, Row[]>;

const MODEL_NAMES = [
  "organization",
  "user",
  "orgMember",
  "website",
  "integration",
  "gscDaily",
  "gscQueryDaily",
  "gscPageDaily",
  "gscQueryPageDaily",
  "gscDimensionDaily",
  "syncCursor",
  "keyword",
  "pageRecord",
  "content",
  "contentVersion",
  "opportunity",
  "seoIssue",
  "healthScoreSnapshot",
  "internalLinkSuggestion",
  "agentTask",
  "agentLog",
  "automationRule",
  "automationRun",
  "approval",
  "contentExperiment",
  "learningSignal",
  "notification",
  "aiPrompt",
  "aiPromptRun",
  "aiCompetitor",
  "geoOpportunity",
  "citationOpportunity",
  "entityNode",
  "entityRelationship",
  "redditOpportunity",
  "xOpportunity",
  "weeklyAiAudit",
  "weeklyAiAuditResult",
  "googleConnection",
  "gscProperty",
  "ga4Property",
  "publishingConnection",
  "systemSetting",
] as const;

function emptyStore(): StoreData {
  const s: StoreData = {};
  for (const m of MODEL_NAMES) s[m] = [];
  return s;
}

const BYTE_FIELDS = new Set([
  "secretCipher",
  "secretIv",
  "secretTag",
  "encryptedAccessToken",
  "encryptedRefreshToken",
  "tokenIv",
  "tokenTag",
  "encryptedSecret",
]);

function reviveDates(row: Row): Row {
  const out: Row = { ...row };
  for (const [k, v] of Object.entries(out)) {
    if (DATE_FIELDS.has(k) && typeof v === "string") {
      out[k] = new Date(v);
    } else if (
      BYTE_FIELDS.has(k) &&
      v &&
      typeof v === "object" &&
      "type" in v &&
      (v as unknown as { type: string; data: number[] }).type === "Buffer"
    ) {
      out[k] = Uint8Array.from((v as unknown as { data: number[] }).data);
    }
  }
  return out;
}

let memoryStore: StoreData | null = null;
let memoryStoreMtimeMs = 0;

function loadStore(): StoreData {
  try {
    const fileToRead = fs.existsSync(DB_FILE)
      ? DB_FILE
      : fs.existsSync(BUNDLED_DB_FILE)
        ? BUNDLED_DB_FILE
        : null;

    if (fileToRead) {
      const stat = fs.statSync(fileToRead);
      if (memoryStore && stat.mtimeMs === memoryStoreMtimeMs) {
        return memoryStore;
      }
      const raw = JSON.parse(fs.readFileSync(fileToRead, "utf8")) as StoreData;
      const s = emptyStore();
      for (const m of MODEL_NAMES) {
        s[m] = (raw[m] ?? []).map(reviveDates);
      }
      memoryStore = s;
      memoryStoreMtimeMs = stat.mtimeMs;
      return s;
    }
  } catch {
    if (memoryStore) return memoryStore;
  }
  if (!memoryStore) {
    memoryStore = emptyStore();
  }
  return memoryStore;
}

function saveStore(store: StoreData) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(store, null, 2), "utf8");
    memoryStoreMtimeMs = fs.statSync(DB_FILE).mtimeMs;
  } catch {
    // Ignore write errors in read-only environments
  }
}

function toTimestamp(v: unknown): number {
  if (v instanceof Date) return v.getTime();
  if (typeof v === "string") return new Date(v).getTime();
  return 0;
}

function sameDateOrValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a instanceof Date || b instanceof Date) {
    const da = a instanceof Date ? a.toISOString().slice(0, 10) : String(a).slice(0, 10);
    const db = b instanceof Date ? b.toISOString().slice(0, 10) : String(b).slice(0, 10);
    return da === db;
  }
  if (typeof a === "string" && typeof b === "string") {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
  }
  return false;
}

function matchesWhere(row: Row, where?: Record<string, unknown>): boolean {
  if (!where) return true;
  for (const [key, cond] of Object.entries(where)) {
    if (cond === undefined) continue;

    if (key === "OR" && Array.isArray(cond)) {
      if (!cond.some((subWhere) => matchesWhere(row, subWhere as Record<string, unknown>))) {
        return false;
      }
      continue;
    }

    if (key === "AND" && Array.isArray(cond)) {
      if (!cond.every((subWhere) => matchesWhere(row, subWhere as Record<string, unknown>))) {
        return false;
      }
      continue;
    }

    // Compound unique key (e.g. websiteId_date: { websiteId, date })
    if (
      key.includes("_") &&
      !(key in row) &&
      cond !== null &&
      typeof cond === "object" &&
      !Array.isArray(cond) &&
      !(cond instanceof Date)
    ) {
      if (!matchesWhere(row, cond as Record<string, unknown>)) return false;
      continue;
    }

    const val = row[key];

    if (
      cond !== null &&
      typeof cond === "object" &&
      !(cond instanceof Date) &&
      !Array.isArray(cond)
    ) {
      const filterObj = cond as Record<string, unknown>;
      if ("gte" in filterObj && filterObj.gte !== undefined) {
        if (toTimestamp(val) < toTimestamp(filterObj.gte)) return false;
      }
      if ("gt" in filterObj && filterObj.gt !== undefined) {
        if (toTimestamp(val) <= toTimestamp(filterObj.gt)) return false;
      }
      if ("lte" in filterObj && filterObj.lte !== undefined) {
        if (toTimestamp(val) > toTimestamp(filterObj.lte)) return false;
      }
      if ("lt" in filterObj && filterObj.lt !== undefined) {
        if (toTimestamp(val) >= toTimestamp(filterObj.lt)) return false;
      }
      if ("contains" in filterObj && typeof filterObj.contains === "string") {
        if (typeof val !== "string" || !val.toLowerCase().includes(filterObj.contains.toLowerCase())) {
          return false;
        }
      }
      if ("not" in filterObj) {
        if (sameDateOrValue(val, filterObj.not)) return false;
      }
      if ("in" in filterObj && Array.isArray(filterObj.in)) {
        if (!filterObj.in.some((item) => sameDateOrValue(val, item))) return false;
      }
      continue;
    }

    if (!sameDateOrValue(val, cond)) return false;
  }
  return true;
}

function sortRows(rows: Row[], orderBy?: Record<string, "asc" | "desc"> | Record<string, "asc" | "desc">[]): Row[] {
  if (!orderBy) return rows;
  const specs = Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...rows].sort((a, b) => {
    for (const spec of specs) {
      for (const [field, dir] of Object.entries(spec)) {
        const va = a[field];
        const vb = b[field];
        let cmp = 0;
        if (va instanceof Date || vb instanceof Date) {
          cmp = toTimestamp(va) - toTimestamp(vb);
        } else if (typeof va === "number" && typeof vb === "number") {
          cmp = va - vb;
        } else {
          cmp = String(va ?? "").localeCompare(String(vb ?? ""));
        }
        if (cmp !== 0) return dir === "desc" ? -cmp : cmp;
      }
    }
    return 0;
  });
}

function applyIncludes(model: string, row: Row, include?: Record<string, unknown>, store?: StoreData): Row {
  if (!include || !store) return row;
  const out: Row = { ...row };
  if (model === "content" && include.versions) {
    out.versions = (store.contentVersion ?? []).filter((v) => v.contentId === row.id);
  }
  if (include.website && row.websiteId) {
    out.website = (store.website ?? []).find((w) => w.id === row.websiteId) ?? null;
  }
  if (model === "automationRun" && include.rule) {
    out.rule = (store.automationRule ?? []).find((r) => r.id === row.ruleId) ?? null;
  }
  if (model === "aiPrompt" && include.runs) {
    let runs = (store.aiPromptRun ?? []).filter((r) => r.promptId === row.id);
    const runSpec = typeof include.runs === "object" && include.runs !== null ? (include.runs as { orderBy?: OrderSpec; take?: number }) : undefined;
    if (runSpec?.orderBy) {
      runs = sortRows(runs, runSpec.orderBy);
    }
    if (typeof runSpec?.take === "number") {
      runs = runs.slice(0, runSpec.take);
    }
    out.runs = runs;
  }
  if (model === "geoOpportunity" && include.prompt) {
    out.prompt = row.promptId ? ((store.aiPrompt ?? []).find((p) => p.id === row.promptId) ?? null) : null;
  }
  return out;
}

function defaultsForModel(model: string, data: Row): Row {
  const now = new Date();
  const row: Row = { ...data };
  if (!row.id && !["gscDaily", "syncCursor"].includes(model)) {
    row.id = `loc_${crypto.randomBytes(8).toString("hex")}`;
  }
  if (
    !row.createdAt &&
    [
      "organization",
      "user",
      "website",
      "integration",
      "content",
      "contentVersion",
      "agentTask",
      "agentLog",
      "approval",
      "notification",
      "aiPrompt",
      "weeklyAiAudit",
    ].includes(model)
  ) {
    row.createdAt = now;
  }
  if (
    !row.detectedAt &&
    [
      "opportunity",
      "seoIssue",
      "geoOpportunity",
      "citationOpportunity",
      "redditOpportunity",
      "xOpportunity",
    ].includes(model)
  ) {
    row.detectedAt = now;
  }
  if (!row.runAt && model === "aiPromptRun") {
    row.runAt = now;
  }
  if (!row.startedAt && model === "automationRun") {
    row.startedAt = now;
  }
  if (["keyword", "learningSignal", "aiPrompt"].includes(model)) {
    row.updatedAt = now;
  }
  if (model === "opportunity" && !row.status) {
    row.status = "OPEN";
  }
  if (model === "seoIssue" && !row.status) {
    row.status = "open";
  }
  if (model === "approval" && !row.status) {
    row.status = "pending";
  }
  if (model === "internalLinkSuggestion" && !row.status) {
    row.status = "suggested";
  }
  return reviveDates(row);
}

export function createLocalModelDelegate(model: string, ensureSeeded: () => Promise<void>) {
  return {
    async findMany(args?: {
      where?: Record<string, unknown>;
      orderBy?: OrderSpec;
      include?: Record<string, unknown>;
      take?: number;
    }) {
      await ensureSeeded();
      const store = loadStore();
      const table = store[model] ?? [];
      let matched = table.filter((r) => matchesWhere(r, args?.where));
      matched = sortRows(matched, args?.orderBy);
      if (typeof args?.take === "number") {
        matched = matched.slice(0, args.take);
      }
      return matched.map((r) => applyIncludes(model, r, args?.include, store));
    },

    async findFirst(args?: {
      where?: Record<string, unknown>;
      orderBy?: OrderSpec;
      include?: Record<string, unknown>;
    }) {
      const list = await this.findMany({ ...args, take: 1 });
      return list[0] ?? null;
    },

    async findUnique(args: { where: Record<string, unknown>; include?: Record<string, unknown> }) {
      return this.findFirst(args);
    },

    async count(args?: { where?: Record<string, unknown> }) {
      await ensureSeeded();
      const store = loadStore();
      const table = store[model] ?? [];
      return table.filter((r) => matchesWhere(r, args?.where)).length;
    },

    async create(args: { data: Row }) {
      const store = loadStore();
      const row = defaultsForModel(model, args.data);
      store[model] = store[model] ?? [];
      store[model]!.push(row);
      saveStore(store);
      return row;
    },

    async createMany(args: { data: Row[] }) {
      const store = loadStore();
      store[model] = store[model] ?? [];
      for (const item of args.data) {
        store[model]!.push(defaultsForModel(model, item));
      }
      saveStore(store);
      return { count: args.data.length };
    },

    async update(args: { where: Record<string, unknown>; data: Row }) {
      await ensureSeeded();
      const store = loadStore();
      const table = store[model] ?? [];
      const idx = table.findIndex((r) => matchesWhere(r, args.where));
      if (idx === -1) {
        throw new Error(`Record not found in ${model}`);
      }
      const updated = reviveDates({ ...table[idx], ...args.data, updatedAt: new Date() });
      table[idx] = updated;
      saveStore(store);
      return updated;
    },

    async updateMany(args: { where?: Record<string, unknown>; data: Row }) {
      const store = loadStore();
      const table = store[model] ?? [];
      let count = 0;
      for (let i = 0; i < table.length; i++) {
        if (matchesWhere(table[i]!, args.where)) {
          table[i] = reviveDates({ ...table[i]!, ...args.data, updatedAt: new Date() });
          count++;
        }
      }
      if (count > 0) saveStore(store);
      return { count };
    },

    async upsert(args: { where: Record<string, unknown>; create: Row; update: Row }) {
      const store = loadStore();
      const table = (store[model] = store[model] ?? []);
      const idx = table.findIndex((r) => matchesWhere(r, args.where));
      if (idx === -1) {
        const created = defaultsForModel(model, args.create);
        table.push(created);
        saveStore(store);
        return created;
      }
      const updated = reviveDates({ ...table[idx], ...args.update });
      table[idx] = updated;
      saveStore(store);
      return updated;
    },

    async delete(args: { where: Record<string, unknown> }) {
      const store = loadStore();
      const table = store[model] ?? [];
      const idx = table.findIndex((r) => matchesWhere(r, args.where));
      if (idx === -1) {
        return null;
      }
      const [removed] = table.splice(idx, 1);
      saveStore(store);
      return removed;
    },

    async deleteMany(args?: { where?: Record<string, unknown> }) {
      const store = loadStore();
      const table = store[model] ?? [];
      const remaining = table.filter((r) => !matchesWhere(r, args?.where));
      const deletedCount = table.length - remaining.length;
      store[model] = remaining;
      saveStore(store);
      return { count: deletedCount };
    },

    async groupBy(args: {
      by: string[];
      where?: Record<string, unknown>;
      _sum?: Record<string, boolean>;
      _avg?: Record<string, boolean>;
      take?: number;
    }) {
      await ensureSeeded();
      const store = loadStore();
      const table = (store[model] ?? []).filter((r) => matchesWhere(r, args.where));
      const groups = new Map<string, Row & { __count?: number }>();

      for (const r of table) {
        const key = args.by.map((k) => String(r[k] ?? "")).join("\0");
        let g = groups.get(key);
        if (!g) {
          g = { __count: 0 };
          for (const k of args.by) g[k] = r[k];
          if (args._sum) {
            const sums: Record<string, number> = {};
            for (const sk of Object.keys(args._sum)) sums[sk] = 0;
            g._sum = sums;
          }
          if (args._avg) {
            const avgs: Record<string, number> = {};
            for (const ak of Object.keys(args._avg)) avgs[ak] = 0;
            g._avg = avgs;
          }
          groups.set(key, g);
        }
        g.__count = (g.__count ?? 0) + 1;
        if (args._sum && g._sum) {
          const sums = g._sum as Record<string, number>;
          for (const sk of Object.keys(args._sum)) {
            sums[sk] = (sums[sk] ?? 0) + Number(r[sk] ?? 0);
          }
        }
        if (args._avg && g._avg) {
          const avgs = g._avg as Record<string, number>;
          for (const ak of Object.keys(args._avg)) {
            avgs[ak] = (avgs[ak] ?? 0) + Number(r[ak] ?? 0);
          }
        }
      }

      let out = [...groups.values()].map((g) => {
        const count = g.__count || 1;
        if (args._avg && g._avg) {
          const avgs = g._avg as Record<string, number>;
          for (const ak of Object.keys(args._avg)) {
            avgs[ak] = avgs[ak]! / count;
          }
        }
        const clone = { ...g };
        delete clone.__count;
        return clone;
      });

      if (typeof args.take === "number") {
        out = out.slice(0, args.take);
      }
      return out;
    },
  };
}

export function isLocalStoreEmpty(): boolean {
  return !fs.existsSync(DB_FILE);
}

export function purgeWebsiteFromLocalStore(websiteId: string, orgId?: string): {
  deleted: boolean;
  deletedName: string | null;
  nextWebsiteId: string | null;
} {
  const store = loadStore();
  const sites = store.website ?? [];
  const target = sites.find((w) => String(w.id) === websiteId);
  if (!target) {
    return {
      deleted: false,
      deletedName: null,
      nextWebsiteId: sites[0] ? String(sites[0].id) : null,
    };
  }

  // Collect prompt IDs and content IDs for cascading grandchild cleanup
  const promptIds = new Set(
    (store.aiPrompt ?? [])
      .filter((p) => String(p.websiteId) === websiteId)
      .map((p) => String(p.id)),
  );
  const contentIds = new Set(
    (store.content ?? [])
      .filter((c) => String(c.websiteId) === websiteId)
      .map((c) => String(c.id)),
  );
  const auditIds = new Set(
    (store.weeklyAiAudit ?? [])
      .filter((a) => String(a.websiteId) === websiteId)
      .map((a) => String(a.id)),
  );

  for (const model of MODEL_NAMES) {
    const table = store[model] ?? [];
    if (model === "website") {
      store[model] = table.filter((r) => String(r.id) !== websiteId);
    } else if (model === "aiPromptRun") {
      store[model] = table.filter(
        (r) => String(r.websiteId) !== websiteId && !promptIds.has(String(r.promptId)),
      );
    } else if (model === "contentVersion") {
      store[model] = table.filter((r) => !contentIds.has(String(r.contentId)));
    } else if (model === "weeklyAiAuditResult") {
      store[model] = table.filter((r) => !auditIds.has(String(r.auditId)));
    } else {
      store[model] = table.filter((r) => {
        if ("websiteId" in r) return String(r.websiteId) !== websiteId;
        return true;
      });
    }
  }

  // Write once to disk atomically
  saveStore(store);

  const remaining = orgId
    ? (store.website ?? []).find((r) => String(r.orgId) === orgId)
    : store.website?.[0];
  return {
    deleted: true,
    deletedName: typeof target.name === "string" ? target.name : null,
    nextWebsiteId: remaining ? String(remaining.id) : null,
  };
}
