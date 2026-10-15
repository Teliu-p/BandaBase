import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(".");
const sqlFiles = [
  [
    "Set up isolated PostgreSQL policy fixture",
    "tests/db/band_list_item_policy_fixture.sql"
  ],
  [
    "Confirm the known legacy policy bypass is reproducible",
    "tests/db/band_list_item_policy_legacy_repro.sql"
  ],
  [
    "Apply the candidate policy migration to the isolated database",
    "supabase/migrations/20261011042500_harden_band_list_item_update_policy.sql"
  ],
  [
    "Verify allowed and rejected RLS updates after migration",
    "tests/db/band_list_item_policy_behavior.sql"
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

console.log("\nOK: isolated PostgreSQL UPDATE RLS tests passed.");
