import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const packageDir = path.join(
  root,
  "docs/platform-hard-cutover-01/phase-04/sql/rating-v5-staging-owner-pilot-activation"
);
const evidencePath = path.join(
  root,
  "docs/platform-hard-cutover-01/phase-04/staging-rehearsal/evidence/22_A_RATE_STAGING_OWNER_PILOT_ACTIVATION_2026-07-30.json"
);

function read(name) {
  return fs.readFileSync(path.join(packageDir, name), "utf8");
}

test("staging owner pilot activation package files exist", () => {
  const files = fs.readdirSync(packageDir);
  assert.ok(files.includes("10_ROLLOUT_CONFIG.sql"));
  assert.ok(files.includes("20_PILOT_ENROLLMENT.sql"));
  assert.ok(files.includes("90_ROLLBACK.sql"));
  assert.ok(files.includes("99_VERIFY.sql"));
  assert.ok(files.includes("README.md"));
});

test("rollout SQL enables default assessment for staging cohort only", () => {
  const sql = read("10_ROLLOUT_CONFIG.sql");
  assert.match(sql, /id\s*=\s*'default'|'\s*default\s*'/);
  assert.match(sql, /phase4-owner-acceptance/);
  assert.match(sql, /shadow_mode_enabled/);
  assert.match(sql, /allow_v5_assessment/);
  assert.match(sql, /on conflict \(id\) do update/i);
  assert.doesNotMatch(sql, /expuvcohlcjzvrrauvud/);
  assert.doesNotMatch(sql, /calibration_manage/);
  assert.doesNotMatch(sql, /TRUNCATE|DROP TABLE/i);
  assert.doesNotMatch(sql, /insert into public\.role_permissions/i);
});

test("enrollment SQL pins exactly one actor uuid and venue-staging-a", () => {
  const sql = read("20_PILOT_ENROLLMENT.sql");
  assert.match(sql, /13e0968b-53c5-4ba6-8ae0-dce12b1faf9c/);
  assert.match(sql, /venue-staging-a/);
  assert.match(sql, /phase4-owner-acceptance/);
  assert.match(sql, /status[\s\S]*'active'/);
  assert.match(sql, /on conflict \(player_id, cohort_label\)/i);
  assert.doesNotMatch(sql, /f7eacd7b-6d78-431e-a40e-ed21d3ce3876/);
  assert.doesNotMatch(sql, /TRUNCATE|DROP TABLE/i);
  assert.doesNotMatch(sql, /insert into public\.role_permissions/i);
});

test("rollback targets exact package keys only", () => {
  const sql = read("90_ROLLBACK.sql");
  assert.match(sql, /delete from public\.rating_v5_pilot_enrollments/i);
  assert.match(sql, /13e0968b-53c5-4ba6-8ae0-dce12b1faf9c/);
  assert.match(sql, /phase4-owner-acceptance/);
  assert.match(sql, /delete from public\.rating_v5_rollout_config/i);
  assert.doesNotMatch(sql, /TRUNCATE|DROP TABLE|DELETE FROM public\.profiles/i);
});

test("evidence pins actor without display name and forbids dual enroll", () => {
  const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
  assert.equal(evidence.targetProjectRef, "qyewbxjsiiyufanzcjcq");
  assert.equal(evidence.productionRefBlocked, "expuvcohlcjzvrrauvud");
  assert.equal(evidence.actor.maskedPlayerId, "13e0***af9c");
  assert.equal(evidence.actor.pinMethod, "clubs.created_by_user_id");
  assert.equal(evidence.actor.enrollBothVenueOwners, false);
  assert.equal(evidence.productionMutations, 0);
});
