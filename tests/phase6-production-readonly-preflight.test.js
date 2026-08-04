import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("scripts/phase6-production-readonly-preflight.mjs", "utf8");

test("Production preflight is pinned and contains no mutation verbs", () => {
  assert.match(source, /expuvcohlcjzvrrauvud/);
  assert.doesNotMatch(source, /apply_migration|update_storage_config|\.insert\(|\.update\(|\.delete\(/);
  assert.match(source, /databaseMutations:\s*0/);
  assert.match(source, /storageMutations:\s*0/);
});

test("Production preflight records only aggregate Storage evidence", () => {
  assert.match(source, /objectCount/);
  assert.match(source, /bytes/);
  assert.doesNotMatch(source, /access_token|refresh_token|password/i);
  assert.match(source, /user-avatars/);
  assert.match(source, /tournament-broadcast-vods/);
});

test("Production preflight supports a gitignored local credential file", () => {
  assert.match(source, /\.env\.phase6-production\.local/);
  assert.match(source, /PHASE6_PRODUCTION_ENV_FILE/);
  assert.doesNotMatch(source, /console\.log\([^)]*(serviceKey|anonKey|SUPABASE_SERVICE_ROLE_KEY)/);
});
