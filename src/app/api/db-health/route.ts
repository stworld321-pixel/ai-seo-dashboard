import { NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

/**
 * Is the deployment actually talking to Postgres, or silently running on the
 * JSON fallback in `src/server/local-store.ts`? Uses `pg` directly so it cannot
 * fall back and lie about it.
 *
 * GET /api/db-health?secret=$CRON_SECRET
 */
export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    return NextResponse.json({ ok: false, reason: "DATABASE_URL is not set in this environment" }, { status: 500 });
  }

  let host = "unparseable";
  try {
    host = new URL(url).host;
  } catch {}

  const pool = new Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 8000 });
  try {
    const { rows } = await pool.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public' order by 1",
    );
    const tables = rows.map((r) => r.table_name);
    return NextResponse.json({
      ok: tables.includes("User"),
      host,
      tableCount: tables.length,
      tables,
      hint: tables.length === 0 ? "Connected, but no tables — run `prisma migrate deploy` against this database" : undefined,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, host, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  } finally {
    await pool.end().catch(() => {});
  }
}
