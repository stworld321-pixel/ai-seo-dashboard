import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 moved connection URLs out of schema.prisma and into this file.
 * The schema now declares only `provider`; `url` and `shadowDatabaseUrl` live here.
 *
 * Local development uses Prisma's own Postgres (PGlite), started with:
 *   npm run db:start
 */

// Prisma CLI (migrate/studio) needs a direct, non-pooled connection; runtime uses DATABASE_URL.
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/seo";

// Only `migrate dev` needs a shadow database, and it must not be the main one.
// `migrate deploy` (used in the Vercel build) ignores it entirely.
const shadow = process.env.SHADOW_DATABASE_URL;
const shadowDatabaseUrl =
  shadow && shadow !== url && shadow !== process.env.DATABASE_URL ? shadow : undefined;

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
