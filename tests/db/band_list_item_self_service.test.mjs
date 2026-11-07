import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(".");
const sqlFiles = [
  [
    "Create disposable fixture matching the current production UPDATE policy and triggers",
    "tests/db/band_list_item_self_service_fixture.sql"
  ],
  [
    "Reproduce the self-service field-edit gap before the migration",
    "tests/db/band_list_item_self_service_legacy_repro.sql"
  ],
  [
    "Apply the candidate trigger-only migration to disposable PostgreSQL",
    "supabase/migrations/20261106210000_harden_band_list_item_self_service_guard.sql"
  ],
  [
    "Verify self-service, manager, admin, creator and auto-confirmation behavior",
    "tests/db/band_list_item_self_service_behavior.sql"
  ]
];

if (!process.env.PGHOST || !process.env.PGDATABASE || !process.env.PGPASSWORD) {
  throw new Error(
    "Set PGHOST, PGDATABASE and PGPASSWORD to a disposable PostgreSQL test database."
  );
}

for (const [label, relativePath] of sqlFiles) {
  console.log("\n=== " + label + " ===");
  execFileSync(
    "psql",
    [
      "--no-psqlrc",
      "--set",
      "ON_ERROR_STOP=1",
      "--file",
      resolve(root, relativePath)
    ],
    {
      env: process.env,
      stdio: "inherit"
    }
  );
}

console.log("\nOK: band_list_items guard tests passed.");
