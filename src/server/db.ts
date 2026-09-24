import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Prisma 7 requires a driver adapter to be passed to the client constructor.
 * A single instance is cached on globalThis so Next.js hot reloads don't open
 * a new connection pool on every edit.
 */

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Start the local database with `npx prisma dev -n seo -d`, " +
        "or point it at a hosted Postgres.",
    );
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma: PrismaClient = globalThis.__prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalThis.__prisma = prisma;
