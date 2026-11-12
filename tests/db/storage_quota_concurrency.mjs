import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";

const env = process.env;
if (!env.PGHOST || !env.PGDATABASE || !env.PGPASSWORD) {
  throw new Error("Set PGHOST, PGDATABASE and PGPASSWORD to a disposable PostgreSQL database.");
}

function runConcurrentInsert(id) {
  const sql = `
BEGIN;
SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
INSERT INTO storage.objects (id, bucket_id, name, metadata, user_metadata)
VALUES (
  '${id}', 'materials',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/${id}/file.bin',
  '{"size":"600"}'::jsonb,
  '{"bandabase_upload_size":"600"}'::jsonb
);
SELECT pg_catalog.pg_sleep(0.8);
COMMIT;
`;
  return new Promise(resolvePromise => {
    const child = spawn("psql", ["--no-psqlrc", "--set", "ON_ERROR_STOP=1", "--command", sql], {
      env, stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", chunk => { stdout += chunk; });
    child.stderr.on("data", chunk => { stderr += chunk; });
    child.on("error", error => resolvePromise({ code: -1, stdout, stderr: String(error) }));
    child.on("close", code => resolvePromise({ code, stdout, stderr }));
  });
}

execFileSync("psql", [
  "--no-psqlrc", "--set", "ON_ERROR_STOP=1", "--command",
  "DELETE FROM storage.objects; UPDATE bandabase_private.storage_quota_config SET max_bytes = 1000 WHERE singleton = true;"
], { env, stdio: "inherit" });

const first = runConcurrentInsert("20000000-0000-4000-8000-000000000001");
await new Promise(resolvePromise => setTimeout(resolvePromise, 120));
const second = runConcurrentInsert("20000000-0000-4000-8000-000000000002");
const results = await Promise.all([first, second]);

assert.equal(
  results.filter(result => result.code === 0).length, 1,
  "Exactly one concurrent 600-byte upload must succeed: " + JSON.stringify(results)
);
assert.equal(
  results.filter(result => result.code !== 0 &&
    /BandaBase alcanzó el límite de almacenamiento/i.test(result.stderr)).length, 1,
  "The losing concurrent upload must be rejected: " + JSON.stringify(results)
);

const verification = execFileSync("psql", [
  "--no-psqlrc", "--tuples-only", "--no-align", "--command",
  "SELECT count(*)::text || ':' || COALESCE(sum((metadata->>'size')::bigint),0)::text FROM storage.objects;"
], { env, encoding: "utf8" }).trim();
assert.equal(verification, "1:600");
console.log("OK: concurrent uploads serialize and cannot exceed the Storage quota.");
