/**
 * Phase 1J-A — Staging directory fixture pack (deterministic, CI-safe).
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  PM_1J_A_ALL_PLAYER_IDS,
  PM_1J_A_ALL_USER_IDS,
  PM_1J_A_ELIGIBLE_ROW,
  PM_1J_A_FIXTURE,
  PM_1J_A_FIXTURE_ROWS,
  PM_1J_A_HIDDEN_ROW,
  PM_1J_A_MASKED_ROW,
  PM_1J_A_PRODUCTION_REF,
  PM_1J_A_ROLES,
  PM_1J_A_STAGING_REF,
  PM_1J_A_SUSPENDED_ROW,
  PM_1J_A_UNVERIFIED_ROW,
  assertStagingProjectRef,
  buildFixtureProfilePayload,
  getFixtureRowByPlayerId,
  getFixtureRowByRole,
  isFixturePlayerId,
  pm1jAUserId,
} from "../src/features/player/fixtures/phase1jAStagingFixture.js";

test("1J-A fixtures — staging/production refs locked", () => {
  assert.equal(PM_1J_A_STAGING_REF, "qyewbxjsiiyufanzcjcq");
  assert.equal(PM_1J_A_PRODUCTION_REF, "expuvcohlcjzvrrauvud");
  assert.equal(assertStagingProjectRef(`https://${PM_1J_A_STAGING_REF}.supabase.co`), PM_1J_A_STAGING_REF);
  assert.throws(
    () => assertStagingProjectRef(`https://${PM_1J_A_PRODUCTION_REF}.supabase.co`),
    /REFUSING Production/
  );
});

test("1J-A fixtures — five deterministic roles with unique ids", () => {
  assert.equal(PM_1J_A_FIXTURE_ROWS.length, 5);
  assert.equal(new Set(PM_1J_A_ALL_PLAYER_IDS).size, 5);
  assert.equal(new Set(PM_1J_A_ALL_USER_IDS).size, 5);
  for (const row of PM_1J_A_FIXTURE_ROWS) {
    assert.match(row.playerId, /^qa-pm1ja-/);
    assert.match(row.email, /@staging\.local$/);
    assert.equal(row.fixtureMarker, PM_1J_A_FIXTURE.marker);
  }
});

test("1J-A fixtures — deterministic UUID helper", () => {
  assert.equal(pm1jAUserId(1), "c7000000-7e57-4000-8000-000000000001");
  assert.equal(PM_1J_A_ELIGIBLE_ROW.userId, pm1jAUserId(1));
});

test("1J-A fixtures — eligible row satisfies directory eligibility inputs", () => {
  const payload = buildFixtureProfilePayload(PM_1J_A_ELIGIBLE_ROW);
  assert.equal(payload.player_id, "qa-pm1ja-eligible");
  assert.equal(payload.display_name, "PM1JA Eligible Public Athlete");
  assert.equal(payload.identity_verification_status, "verified");
  assert.equal(payload.status, "active");
  assert.equal(payload.privacy_settings.publicProfileEnabled, true);
  assert.equal(payload.privacy_settings.showGender, true);
  assert.equal(payload.privacy_settings.showHandedness, true);
  assert.equal(payload.privacy_settings.showActivityRegion, true);
});

test("1J-A fixtures — exclusion rows authored correctly", () => {
  const hidden = buildFixtureProfilePayload(PM_1J_A_HIDDEN_ROW);
  assert.equal(hidden.privacy_settings.publicProfileEnabled, false);

  const suspended = buildFixtureProfilePayload(PM_1J_A_SUSPENDED_ROW);
  assert.equal(suspended.status, "suspended");
  assert.equal(suspended.privacy_settings.publicProfileEnabled, true);

  const unverified = buildFixtureProfilePayload(PM_1J_A_UNVERIFIED_ROW);
  assert.equal(unverified.identity_verification_status, "unverified");
  assert.equal(unverified.privacy_settings.publicProfileEnabled, true);
});

test("1J-A fixtures — masked row keeps public enabled but hides sport fields", () => {
  const masked = buildFixtureProfilePayload(PM_1J_A_MASKED_ROW);
  assert.equal(masked.privacy_settings.publicProfileEnabled, true);
  assert.equal(masked.privacy_settings.showGender, false);
  assert.equal(masked.privacy_settings.showHandedness, false);
  assert.equal(masked.privacy_settings.showActivityRegion, false);
  assert.equal(masked.gender, "female");
  assert.equal(masked.handedness, "right");
  assert.ok(masked.activity_region);
});

test("1J-A fixtures — lookup helpers and namespace guard", () => {
  assert.equal(getFixtureRowByRole(PM_1J_A_ROLES.ELIGIBLE)?.playerId, "qa-pm1ja-eligible");
  assert.equal(getFixtureRowByPlayerId("qa-pm1ja-masked")?.role, PM_1J_A_ROLES.MASKED);
  assert.equal(isFixturePlayerId("qa-pm1ja-eligible"), true);
  assert.equal(isFixturePlayerId("player-real-001"), false);
});

test("1J-A fixtures — directory expectations cover required proof matrix", () => {
  const expectations = Object.fromEntries(
    PM_1J_A_FIXTURE_ROWS.map((row) => [row.role, row.directoryExpectation])
  );
  assert.equal(expectations.eligible, "visible");
  assert.equal(expectations.hidden, "excluded");
  assert.equal(expectations.suspended, "excluded");
  assert.equal(expectations.unverified, "excluded");
  assert.equal(expectations.masked, "visible_masked");
});
