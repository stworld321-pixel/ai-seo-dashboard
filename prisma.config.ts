import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 moved connection URLs out of schema.prisma and into this file.
 * The schema now declares only `provider`; `url` and `shadowDatabaseUrl` live here.
 *
 * Local development uses Prisma's own Postgres (PGlite), started with:
 *   npx prisma dev -n seo -d
 * Swapping to Neon/Supabase later means changing only DATABASE_URL in .env.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/seo",
    ...(process.env.SHADOW_DATABASE_URL
      ? { shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL }
      : {}),
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
