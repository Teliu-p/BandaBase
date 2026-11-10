import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(".");
const files = [
  "tests/db/storage_quota_fixture.sql",
  "supabase/migrations/20261110045910_enforce_storage_quota.sql",
  "tests/db/storage_quota_behavior.sql"
];

if (!process.env.PGHOST || !process.env.PGDATABASE || !process.env.PGPASSWORD) {
  throw new Error("Set PGHOST, PGDATABASE and PGPASSWORD to a disposable PostgreSQL database.");
}

for (const file of files) {
  console.log("\\n=== " + file + " ===");
  execFileSync("psql", [
    "--no-psqlrc", "--set", "ON_ERROR_STOP=1", "--file", resolve(root, file)
  ], { env: process.env, stdio: "inherit" });
}

execFileSync(process.execPath, [
  resolve(root, "tests/db/storage_quota_concurrency.mjs")
], { env: process.env, stdio: "inherit" });

console.log("\\nOK: Storage quota database regression tests passed.");
