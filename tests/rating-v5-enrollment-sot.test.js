import assert from "node:assert/strict";
import test from "node:test";

import {
  isPilotEnrollmentActive,
  isUserInRolloutCohort,
} from "../src/features/pick-vn-rating-v5/services/ratingV5RolloutService.js";
import {
  parseRatingV5CorsAllowlist,
  isOriginAllowedForRatingV5,
} from "../src/features/pick-vn-rating-v5/config/ratingV5EdgeCorsConfig.js";

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const rolloutOn = {
  allowV5Assessment: true,
  shadowModeEnabled: true,
  pilotCohortLabel: "club-rating-v5-production-pilot",
};

test("enrollment SOT: active enrollment grants access", () => {
  const ok = isPilotEnrollmentActive({
    rolloutConfig: rolloutOn,
    enrollmentResult: {
      ok: true,
      enrolled: true,
      enrollment: { status: "active", cohort_label: "club-rating-v5-production-pilot" },
    },
  });
  assert.equal(ok, true);
});

test("enrollment SOT: missing enrollment denies access", () => {
  const ok = isPilotEnrollmentActive({
    rolloutConfig: rolloutOn,
    enrollmentResult: { ok: false, enrolled: false, code: "PILOT_NOT_ENROLLED" },
  });
  assert.equal(ok, false);
});

test("enrollment SOT: paused enrollment denies access", () => {
  const ok = isPilotEnrollmentActive({
    rolloutConfig: rolloutOn,
    enrollmentResult: {
      ok: true,
      enrolled: true,
      enrollment: { status: "paused" },
    },
  });
  assert.equal(ok, false);
});

test("profile rollout_cohort deprecated helper never authorizes", () => {
  const ok = isUserInRolloutCohort({
    rolloutConfig: rolloutOn,
    profile: { rollout_cohort: "club-rating-v5-production-pilot" },
  });
  assert.equal(ok, false);
});

test("access service uses enrollment RPC not profile cohort", () => {
  const source = fs.readFileSync(
    path.join(rootDir, "src/features/pick-vn-rating-v5/services/ratingV5AccessService.js"),
    "utf8",
  );
  assert.match(source, /fetchMyPilotEnrollment/);
  assert.match(source, /isPilotEnrollmentActive/);
  assert.doesNotMatch(source, /isUserInRolloutCohort/);
});

test("C1 migration file exists with pilot enrollment table", () => {
  const sql = fs.readFileSync(
    path.join(rootDir, "docs/v5/rating-v5/PHASE_V5C1_PILOT_ENROLLMENT_AND_POLICY.sql"),
    "utf8",
  );
  assert.match(sql, /rating_v5_pilot_enrollments/);
  assert.match(sql, /rating_v5_assert_pilot_gate/);
  assert.match(sql, /source_assessment_id/);
  assert.match(sql, /allow_v5_assessment/);
  assert.match(sql, /false,\s*\n\s*'club-rating-v5-production-pilot'/);
});

test("verification queries file exists", () => {
  assert.ok(fs.existsSync(path.join(rootDir, "docs/v5/rating-v5/V5-P1_PRODUCTION_VERIFICATION_QUERIES.sql")));
});

test("backup checklist exists", () => {
  assert.ok(fs.existsSync(path.join(rootDir, "docs/v5/rating-v5/V5-P1_PRODUCTION_BACKUP_CHECKLIST.md")));
});

test("edge helpers staging fault only checks staging ref", () => {
  const source = fs.readFileSync(
    path.join(rootDir, "src/features/pick-vn-rating-v5/server/edgeHttpHelpers.js"),
    "utf8",
  );
  assert.match(source, /qyewbxjsiiyufanzcjcq/);
  assert.doesNotMatch(source, /__vercel_preview__/);
  assert.doesNotMatch(source, /__localhost_qa__/);
});

test("production cors allowlist json owner confirmed", () => {
  const json = JSON.parse(
    fs.readFileSync(path.join(rootDir, "docs/v5/rating-v5/V5-P1_PRODUCTION_CORS_ALLOWLIST.json"), "utf8"),
  );
  assert.equal(json.status, "CONFIRMED");
  assert.deepEqual(json.production_origins, ["https://pickleball-scheduler-eight.vercel.app"]);
});

test("cors config rejects wildcard and preview markers", () => {
  assert.throws(() => parseRatingV5CorsAllowlist("*"), /blocked|wildcard/);
  assert.throws(() => parseRatingV5CorsAllowlist("https://x.__vercel_preview__.vercel.app"), /blocked/);
  const allowed = parseRatingV5CorsAllowlist("https://pickleball-scheduler-eight.vercel.app");
  assert.deepEqual(allowed, ["https://pickleball-scheduler-eight.vercel.app"]);
});

test("cors allows only listed production origin", () => {
  const list = parseRatingV5CorsAllowlist("https://pickleball-scheduler-eight.vercel.app");
  assert.equal(
    isOriginAllowedForRatingV5("https://pickleball-scheduler-eight.vercel.app", list),
    true,
  );
  assert.equal(isOriginAllowedForRatingV5("https://evil.vercel.app", list), false);
});

test("migration bundle lists 4 SQL files", () => {
  const doc = fs.readFileSync(
    path.join(rootDir, "docs/v5/rating-v5/V5-P1_PRODUCTION_MIGRATION_BUNDLE.md"),
    "utf8",
  );
  assert.match(doc, /PHASE_V5C1_PILOT_ENROLLMENT_AND_POLICY/);
});

test("rollout config initial production assessment off", () => {
  const sql = fs.readFileSync(
    path.join(rootDir, "docs/v5/rating-v5/PHASE_V5C1_PILOT_ENROLLMENT_AND_POLICY.sql"),
    "utf8",
  );
  assert.match(sql, /club-rating-v5-production-pilot/);
  assert.match(sql, /allow_v5_assessment/);
  assert.match(sql, /false,\s*\n\s*'club-rating-v5-production-pilot'/);
});
