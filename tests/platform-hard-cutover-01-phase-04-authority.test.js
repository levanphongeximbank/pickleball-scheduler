import test from "node:test";
import assert from "node:assert/strict";

import {
  RUNTIME_AUTHORITY_MATRIX,
  listRuntimeAuthorityDomains,
  getRuntimeAuthorityEntry,
  isPlatformHardCutoverEnabled,
  isCompetitionRemoteSsotEnabled,
  HARD_CUTOVER_FLAG,
  COMPETITION_REMOTE_SSOT_FLAG,
} from "../src/features/platform-hard-cutover/runtimeAuthorityMatrix.js";
import {
  assertLocalCloudDbAllowed,
  assertMatchLiveDirectWriteAllowed,
  assertMockPersistenceAllowed,
  assertNoClubAiDataAccess,
  rejectSilentFallback,
  LEGACY_AUTHORITY_ERROR,
} from "../src/features/platform-hard-cutover/legacyAuthorityPolicy.js";

test("runtime authority matrix: one entry per domain, no duplicate domains", () => {
  const domains = listRuntimeAuthorityDomains();
  assert.equal(domains.length, RUNTIME_AUTHORITY_MATRIX.length);
  assert.equal(new Set(domains).size, domains.length);
  for (const row of RUNTIME_AUTHORITY_MATRIX) {
    assert.ok(row.productionAdapter);
    assert.ok(row.expectedBackend);
    assert.ok(row.failClosedError);
    assert.ok(Array.isArray(row.forbiddenFallback));
    assert.ok(row.forbiddenFallback.length >= 1);
  }
});

test("legacy policy: club_ai_data always locked", () => {
  const result = assertNoClubAiDataAccess();
  assert.equal(result.ok, false);
  assert.equal(result.code, LEGACY_AUTHORITY_ERROR.CLUB_AI_DATA_LOCKED);
});

test("legacy policy: local cloud db forbidden under hard cutover", () => {
  const result = assertLocalCloudDbAllowed({
    [HARD_CUTOVER_FLAG]: "true",
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, LEGACY_AUTHORITY_ERROR.LOCAL_CLOUD_DB_FORBIDDEN);
});

test("legacy policy: match live direct write allowed until SSOT/hard-cutover flags", () => {
  const open = assertMatchLiveDirectWriteAllowed({
    [HARD_CUTOVER_FLAG]: "false",
    [COMPETITION_REMOTE_SSOT_FLAG]: "false",
  });
  assert.equal(open.ok, true);

  const blocked = assertMatchLiveDirectWriteAllowed({
    [COMPETITION_REMOTE_SSOT_FLAG]: "true",
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, LEGACY_AUTHORITY_ERROR.MATCH_LIVE_DIRECT_WRITE_FORBIDDEN);
});

test("legacy policy: mock persistence forbidden under hard cutover", () => {
  const blocked = assertMockPersistenceAllowed("mock", {
    [HARD_CUTOVER_FLAG]: "true",
  });
  assert.equal(blocked.ok, false);
});

test("legacy policy: silent fallback rejected", () => {
  const result = rejectSilentFallback("no blob fallback");
  assert.equal(result.ok, false);
  assert.equal(result.code, LEGACY_AUTHORITY_ERROR.SILENT_FALLBACK_FORBIDDEN);
});

test("flags: hard cutover and competition SSOT readers", () => {
  assert.equal(isPlatformHardCutoverEnabled({ [HARD_CUTOVER_FLAG]: "true" }), true);
  assert.equal(isCompetitionRemoteSsotEnabled({ [COMPETITION_REMOTE_SSOT_FLAG]: "true" }), true);
  assert.equal(getRuntimeAuthorityEntry("competition_match_result")?.allowedFlag, COMPETITION_REMOTE_SSOT_FLAG);
});
