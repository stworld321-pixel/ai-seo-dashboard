import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createLocalModelDelegate, isLocalStoreEmpty } from "./local-store";

/**
 * Prisma 7 client with automatic resilient fallback to `.data/seo-db.json`
 * when the local Postgres daemon (`prisma dev`) is stopped or unreachable.
 */

declare global {
  // eslint-disable-next-line no-var
  var __prisma_v6: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var __pgOffline: boolean | undefined;
}

function isConnectionError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: string }).code;
  const msg = String((err as { message?: string }).message ?? "");
  return (
    code === "P1001" ||
    code === "P2021" ||
    code === "P2022" ||
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    msg.includes("does not exist in the current database") ||
    msg.includes("Can't reach database server") ||
    msg.includes("DatabaseNotReachable") ||
    msg.includes("Connection terminated") ||
    msg.includes("connection timeout") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("ENOTFOUND") ||
    msg.includes("DATABASE_URL is not set")
  );
}

/**
 * The JSON fallback is a local-dev convenience only. In production it silently
 * writes to a /tmp file that Vercel wipes between invocations, which looks like
 * "connected to the database but losing data". Fail loud there instead.
 */
const ALLOW_FALLBACK = process.env.NODE_ENV !== "production" && !process.env.VERCEL;

let isSeeding = false;
async function ensureSeeded() {
  // Do not auto-seed demo data so workspaces start clean
  return;
}

function createUnderlyingClient(): PrismaClient | null {
  const connectionString = process.env.DATABASE_URL;
  // localhost:51214 is this project's own local Prisma Postgres, started by
  // scripts/ensure-db.mjs (DB_PORT = 51214) as part of `npm run dev`. Treating
  // it as a placeholder meant every local request silently used the JSON file
  // instead of the database the dev server had just started. It is only a
  // mistake in production, where a localhost URL cannot be what was intended.
  const isLocalDevDatabase = Boolean(connectionString?.includes("localhost:51214"));
  const isUnusable =
    !connectionString ||
    connectionString.includes("user:pass@host") ||
    (isLocalDevDatabase && !ALLOW_FALLBACK);

  if (isUnusable) {
    if (!ALLOW_FALLBACK) {
      throw new Error(
        `DATABASE_URL is ${connectionString ? "still a local/placeholder value" : "not set"} in this environment. ` +
          "Set it in the Vercel project's Environment Variables and redeploy — a .env file is never uploaded. " +
          "Verify with /api/db-health?secret=$CRON_SECRET.",
      );
    }
    globalThis.__pgOffline = true;
    return null;
  }
  try {
    const adapter = new PrismaPg({
      connectionString,
      max: 5,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 5000,
    });
    return new PrismaClient({
      adapter,
      log: [],
    });
  } catch (err) {
    if (!ALLOW_FALLBACK) throw err;
    globalThis.__pgOffline = true;
    return null;
  }
}

function createResilientClient(): PrismaClient {
  const rawClient = createUnderlyingClient();
  const delegates = new Map<string, ReturnType<typeof createLocalModelDelegate>>();

  function getLocalDelegate(model: string) {
    let d = delegates.get(model);
    if (!d) {
      d = createLocalModelDelegate(model, ensureSeeded);
      delegates.set(model, d);
    }
    return d;
  }

  const proxy = new Proxy({} as PrismaClient, {
    get(_target, prop: string) {
      if (prop === "then" || prop === "$$typeof") return undefined;

      if (prop === "$disconnect" || prop === "$connect") {
        return async () => {
          if (rawClient && !globalThis.__pgOffline) {
            await (rawClient[prop as "$disconnect"] as () => Promise<void>)().catch(() => {});
          }
        };
      }

      if (prop === "$transaction") {
        return async (arg: unknown) => {
          if (rawClient && !globalThis.__pgOffline) {
            try {
              return await (rawClient.$transaction as (a: unknown) => Promise<unknown>)(arg);
            } catch (err) {
              if (!isConnectionError(err) || !ALLOW_FALLBACK) throw err;
              globalThis.__pgOffline = true;
            }
          }
          if (Array.isArray(arg)) {
            return Promise.all(arg);
          }
          if (typeof arg === "function") {
            return (arg as (tx: PrismaClient) => Promise<unknown>)(proxy);
          }
          return [];
        };
      }

      const localDelegate = getLocalDelegate(prop);
      const pgDelegate = rawClient ? (rawClient as unknown as Record<string, Record<string, (...a: unknown[]) => Promise<unknown>>>)[prop] : undefined;

      return new Proxy(localDelegate, {
        get(lTarget, method: string) {
          const localFn = (lTarget as Record<string, (...a: unknown[]) => Promise<unknown>>)[method];
          if (typeof localFn !== "function") return undefined;

          return async (...args: unknown[]) => {
            if (pgDelegate && !globalThis.__pgOffline && typeof pgDelegate[method] === "function") {
              try {
                return await pgDelegate[method]!(...args);
              } catch (err) {
                if (!isConnectionError(err) || !ALLOW_FALLBACK) throw err;
                globalThis.__pgOffline = true;
              }
            }
            return localFn.apply(lTarget, args);
          };
        },
      });
    },
  });

  return proxy;
}

export const prisma: PrismaClient = globalThis.__prisma_v6 ?? createResilientClient();

if (process.env.NODE_ENV !== "production") globalThis.__prisma_v6 = prisma;
