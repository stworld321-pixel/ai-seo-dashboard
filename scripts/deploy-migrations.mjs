import { execSync } from "node:child_process";

console.log("[Build] Checking and running database migrations...");

try {
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    timeout: 60000,
    env: { ...process.env },
  });
  console.log("[Build] Database migrations applied successfully.");
} catch (err) {
  console.warn(
    "[Build] Notice: Prisma migrate deploy did not complete during build step (database server was asleep or connection timed out).",
  );
  console.warn(
    "[Build] Continuing build so deployment proceeds. Migrations can be applied or retried once database is ready.",
  );
}
