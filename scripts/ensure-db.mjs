import { fork } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getServerStatus, isServerRunning } from "@prisma/dev/internal/state";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const envPath = path.join(rootDir, ".env");
const daemonScript = path.join(rootDir, "scripts", "pglite-daemon.mjs");

const SERVER_NAME = "seo";
const DB_PORT = 51214;
const DEFAULT_DB_URL = `postgres://postgres:postgres@localhost:${DB_PORT}/template1?sslmode=disable`;

function checkPort(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host });
    socket.setTimeout(800);
    socket.once("connect", () => {
      socket.end();
      resolve(true);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function updateEnvFile(dbUrl, directUrl, shadowUrl) {
  let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";

  const replacements = {
    DATABASE_URL: dbUrl,
    DIRECT_URL: directUrl,
    SHADOW_DATABASE_URL: shadowUrl,
  };

  for (const [key, val] of Object.entries(replacements)) {
    const line = `${key}="${val}"`;
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(content)) {
      content = content.replace(regex, line);
    } else {
      content = `${line}\n${content}`;
    }
  }

  // Ensure ENCRYPTION_KEY, NEXTAUTH_SECRET, CRON_SECRET are populated if empty
  for (const secretKey of ["ENCRYPTION_KEY", "NEXTAUTH_SECRET", "CRON_SECRET"]) {
    const emptyRegex = new RegExp(`^${secretKey}=""\\s*$`, "m");
    if (emptyRegex.test(content)) {
      const secret = crypto.randomBytes(32).toString("base64");
      content = content.replace(emptyRegex, `${secretKey}="${secret}"`);
    }
  }

  fs.writeFileSync(envPath, content, "utf8");
}

async function startDaemon() {
  // 1. Check if PGlite socket server is already listening on DB_PORT
  const isPortActive = await checkPort(DB_PORT);
  if (isPortActive) {
    updateEnvFile(DEFAULT_DB_URL, DEFAULT_DB_URL, DEFAULT_DB_URL);
    console.log(`[db] Local Prisma Postgres '${SERVER_NAME}' is already active on port ${DB_PORT}.`);
    return;
  }

  // 2. Check Prisma Dev server state
  const existing = await getServerStatus(SERVER_NAME).catch(() => null);
  if (existing && isServerRunning(existing) && existing.exports?.database) {
    const dbUrl = existing.exports.database.connectionString;
    const shadowUrl = existing.exports.shadowDatabase.connectionString;
    updateEnvFile(dbUrl, dbUrl, shadowUrl);
    console.log(`[db] Local Prisma Postgres '${SERVER_NAME}' is already running (PID ${existing.pid}).`);
    console.log(`DATABASE_URL="${dbUrl}"`);
    console.log(`DIRECT_URL="${dbUrl}"`);
    console.log(`SHADOW_DATABASE_URL="${shadowUrl}"`);
    return;
  }

  console.log(`[db] Starting local Prisma Postgres (PGlite) daemon '${SERVER_NAME}'...`);

  await new Promise((resolve, reject) => {
    const child = fork(daemonScript, [SERVER_NAME], {
      detached: true,
      stdio: ["ignore", "ignore", "ignore", "ipc"],
    });

    const timeout = setTimeout(() => {
      child.disconnect?.();
      child.unref();
      reject(new Error("Timed out waiting for @prisma/dev daemon to start"));
    }, 30000);

    child.on("message", async (msg) => {
      if (!msg || typeof msg !== "object") return;
      if (msg.type === "started" && msg.server) {
        clearTimeout(timeout);
        const dbUrl = msg.server.database.connectionString;
        const shadowUrl = msg.server.shadowDatabase.connectionString;
        updateEnvFile(dbUrl, dbUrl, shadowUrl);
        console.log(`[db] Started local Prisma Postgres '${SERVER_NAME}' (PID ${child.pid}).`);
        console.log(`DATABASE_URL="${dbUrl}"`);
        console.log(`DIRECT_URL="${dbUrl}"`);
        console.log(`SHADOW_DATABASE_URL="${shadowUrl}"`);
        child.disconnect();
        child.unref();
        resolve(msg.server);
      } else if (msg.type === "error") {
        clearTimeout(timeout);
        child.disconnect?.();
        child.unref();

        // If error is that server is already running, verify port connectivity
        if (msg.error && msg.error.includes("already running")) {
          const portOpen = await checkPort(DB_PORT);
          if (portOpen) {
            updateEnvFile(DEFAULT_DB_URL, DEFAULT_DB_URL, DEFAULT_DB_URL);
            console.log(`[db] Local Prisma Postgres '${SERVER_NAME}' is active on port ${DB_PORT}.`);
            resolve({ database: { connectionString: DEFAULT_DB_URL } });
            return;
          }
        }
        reject(new Error(msg.error || "Failed to start @prisma/dev daemon"));
      }
    });

    child.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

startDaemon().catch((err) => {
  console.error("[db] Error starting local database:", err);
  process.exit(1);
});
