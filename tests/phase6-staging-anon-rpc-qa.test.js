import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync("scripts/phase6-staging-anon-rpc-qa.mjs", "utf8");

test("runtime QA exercises seven allowed and representative denied families", () => {
  const allowedBlock = source.slice(source.indexOf("const allowed"), source.indexOf("const denied"));
  assert.equal((allowedBlock.match(/^\s*\["/gm) ?? []).length, 7);
  for (const name of ["club_get_my_active_membership", "identity_list_users", "rating_v5_get_my_pilot_enrollment"]) {
    assert.ok(source.includes(name));
  }
});

test("referee write probe uses only a deliberately invalid token", () => {
  assert.match(source, /referee_update_match_score/);
  assert.match(source, /phase6-invalid-token-readonly/);
  assert.doesNotMatch(source, /service_role|SUPABASE_SERVICE_ROLE_KEY/);
});

