import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { ServerState } from "@prisma/dev/internal/state";

let socketServer;
let db;
let state;

async function shutdown() {
  try {
    await socketServer?.stop();
  } catch {}
  try {
    await db?.syncToFs();
    await db?.close();
  } catch {}
  try {
    await state?.close();
  } catch {}
  process.exit(0);
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);

async function main() {
  const name = process.argv[2] || "seo";
  try {
    state = await ServerState.createExclusively({
      name,
      persistenceMode: "stateful",
      debug: false,
      databasePort: 51214,
      shadowDatabasePort: 51215,
      port: 51213,
      streamsPort: 51216,
    });

    const dataDir = state.pgliteDataDirPath;
    fs.mkdirSync(dataDir, { recursive: true });

    db = await PGlite.create({
      dataDir,
      database: "template1",
      relaxedDurability: true,
    });

    const { rows } = await db.query(
      "SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname = 'postgres') AS exists",
    );
    if (rows[0]?.exists) {
      await db.exec("ALTER ROLE postgres WITH LOGIN SUPERUSER PASSWORD 'postgres'");
    } else {
      await db.exec("CREATE ROLE postgres WITH LOGIN SUPERUSER PASSWORD 'postgres'");
    }
    await db.exec("SET ROLE postgres");
    // Drop any leftover experimental WAL triggers from @prisma/dev so writes never block
    await db.exec('DROP SCHEMA IF EXISTS "_prisma_dev_wal" CASCADE');

    socketServer = new PGLiteSocketServer({
      db,
      port: 51214,
      host: "127.0.0.1",
      maxConnections: 10,
      idleTimeout: 0,
    });

    await socketServer.start();

    const dbUrl = "postgres://postgres:postgres@localhost:51214/template1?sslmode=disable";
    const shadowUrl = "postgres://postgres:postgres@localhost:51214/template1?sslmode=disable";

    const exportsPayload = {
      database: {
        connectionString: dbUrl,
        prismaORMConnectionString: dbUrl,
      },
      http: { url: "http://localhost:51213" },
      ppg: { url: "http://localhost:51213" },
      shadowDatabase: {
        connectionString: shadowUrl,
        prismaORMConnectionString: shadowUrl,
      },
    };

    await state.writeServerDump(exportsPayload, {});
    process.send?.({ type: "started", server: { ...exportsPayload, name } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(err);
    process.send?.({ type: "error", error: msg });
    process.exit(1);
  }
}

main();
