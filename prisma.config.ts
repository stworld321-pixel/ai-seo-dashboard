import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 moved connection URLs out of schema.prisma and into this file.
 * The schema now declares only `provider`; `url` and `shadowDatabaseUrl` live here.
 *
 * Local development uses Prisma's own Postgres (PGlite), started with:
 *   npm run db:start
 */

function ensureTimeout(rawUrl?: string): string | undefined {
  if (!rawUrl) return undefined;
  let clean = rawUrl.trim().replace(/^["']|["']$/g, "");
  if (!clean.includes("connect_timeout=")) {
    const separator = clean.includes("?") ? "&" : "?";
    clean = `${clean}${separator}connect_timeout=45`;
  }
  return clean;
}

// Prisma CLI (migrate/studio) needs a direct, non-pooled connection; runtime uses DATABASE_URL.
const rawUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/seo";
const url = ensureTimeout(rawUrl)!;

// Only `migrate dev` needs a shadow database, and it must not be the main one.
// `migrate deploy` (used in the Vercel build) ignores it entirely.
const shadow = process.env.SHADOW_DATABASE_URL;
const shadowDatabaseUrl =
  shadow && shadow !== rawUrl && shadow !== process.env.DATABASE_URL ? ensureTimeout(shadow) : undefined;

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url,
    ...(shadowDatabaseUrl ? { shadowDatabaseUrl } : {}),
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
