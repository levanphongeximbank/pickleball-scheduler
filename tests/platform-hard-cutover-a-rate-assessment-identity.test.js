import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateRatingAssessmentIdentity,
  resolveRatingAssessmentId,
} from "../src/features/platform-hard-cutover/operatorAcceptanceRatingIdentity.js";

const SESSION = "13e0968b-53c5-4ba6-8ae0-dce12b1faf9c";
const TENANT = "venue-staging-a";
const A1 = "11111111-1111-1111-1111-111111111111";
const A2 = "22222222-2222-2222-2222-222222222222";

function rowsFor(playerId, tenantId) {
  return [
    { id: A1, player_id: playerId, tenant_id: tenantId },
    { id: A2, player_id: playerId, tenant_id: tenantId },
  ];
}

test("resolveRatingAssessmentId reads assessmentId from start-assessment RPC shape", () => {
  assert.equal(
    resolveRatingAssessmentId({ ok: true, assessmentId: A1, shadow: true }),
    A1
  );
  assert.equal(resolveRatingAssessmentId({ ok: true, shadow: true }), "");
  assert.equal(resolveRatingAssessmentId({ profile: { id: "p1" } }), "");
});

test("A-RATE PASS when two distinct assessment rows match session + tenant", () => {
  const result = evaluateRatingAssessmentIdentity({
    sessionUserId: SESSION,
    tenantId: TENANT,
    firstAssessmentId: A1,
    secondAssessmentId: A2,
    rows: rowsFor(SESSION, TENANT),
  });
  assert.equal(result.ok, true);
  assert.equal(result.details.samePlayer, true);
  assert.equal(result.details.sameTenant, true);
  assert.equal(result.details.assessmentRows, 2);
});

test("A-RATE FAIL when player_id mismatches session", () => {
  const result = evaluateRatingAssessmentIdentity({
    sessionUserId: SESSION,
    tenantId: TENANT,
    firstAssessmentId: A1,
    secondAssessmentId: A2,
    rows: rowsFor("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", TENANT),
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "RATING_PROFILE_MISMATCH");
  assert.equal(result.details.samePlayer, false);
});

test("A-RATE FAIL when tenant_id mismatches acceptance tenant", () => {
  const result = evaluateRatingAssessmentIdentity({
    sessionUserId: SESSION,
    tenantId: TENANT,
    firstAssessmentId: A1,
    secondAssessmentId: A2,
    rows: rowsFor(SESSION, "venue-other"),
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "RATING_PROFILE_MISMATCH");
  assert.equal(result.details.sameTenant, false);
});

test("A-RATE FAIL when one assessment row is missing", () => {
  const result = evaluateRatingAssessmentIdentity({
    sessionUserId: SESSION,
    tenantId: TENANT,
    firstAssessmentId: A1,
    secondAssessmentId: A2,
    rows: [{ id: A1, player_id: SESSION, tenant_id: TENANT }],
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "RATING_PROFILE_MISMATCH");
  assert.equal(result.details.assessmentRows, 1);
});

test("A-RATE FAIL when assessment IDs are missing or duplicated", () => {
  const missing = evaluateRatingAssessmentIdentity({
    sessionUserId: SESSION,
    tenantId: TENANT,
    firstAssessmentId: "",
    secondAssessmentId: A2,
    rows: rowsFor(SESSION, TENANT),
  });
  assert.equal(missing.ok, false);

  const dup = evaluateRatingAssessmentIdentity({
    sessionUserId: SESSION,
    tenantId: TENANT,
    firstAssessmentId: A1,
    secondAssessmentId: A1,
    rows: [
      { id: A1, player_id: SESSION, tenant_id: TENANT },
      { id: A1, player_id: SESSION, tenant_id: TENANT },
    ],
  });
  assert.equal(dup.ok, false);
  assert.match(dup.message, /distinct/i);
});

test("A-RATE FAIL on table/RPC read error", () => {
  const result = evaluateRatingAssessmentIdentity({
    sessionUserId: SESSION,
    tenantId: TENANT,
    firstAssessmentId: A1,
    secondAssessmentId: A2,
    rows: null,
    readError: "permission denied for table player_skill_assessments",
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "RATING_PROFILE_MISMATCH");
  assert.match(result.message, /permission denied/i);
});

test("empty profileId alone is never treated as PASS", () => {
  const result = evaluateRatingAssessmentIdentity({
    sessionUserId: SESSION,
    tenantId: TENANT,
    firstAssessmentId: "",
    secondAssessmentId: "",
    rows: [],
  });
  assert.equal(result.ok, false);
});
