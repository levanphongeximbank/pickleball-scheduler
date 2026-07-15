/**
 * PHASE 45B.2 — Pairing read gateway contract & behavior tests.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  PAIRING_CANDIDATE_REASON_CODES as RC,
  PAIRING_CANDIDATE_STATUS,
  isPairingCandidateResponse,
  createPairingCandidateService,
  createCanonicalAthleteRepository,
  joinAthletesAndMemberships,
  mapPairingIdentity,
  applyOptionalPrivatePairingSeam,
} from "../src/features/pairing-candidates/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const gatewayDir = path.join(root, "src/features/pairing-candidates");

function makeService(rows, extras = {}) {
  return createPairingCandidateService({
    listScopeRows: async () => ({
      ok: true,
      rows,
      sourceBreakdown: {
        athleteRows: extras.athleteRows ?? rows.length,
        membershipRows: extras.membershipRows ?? rows.filter((r) => r.membershipId).length,
        activeMembershipRows:
          extras.activeMembershipRows ??
          rows.filter((r) => String(r.membershipStatus).toLowerCase() === "active").length,
        registeredRows: extras.registeredRows,
      },
    }),
    evaluatePrivatePairingRules: extras.evaluatePrivatePairingRules,
  });
}

const ACTIVE = {
  athleteId: "ath-1",
  userId: "user-1",
  displayName: "Alpha Player",
  gender: "male",
  rating: 3.5,
  athleteStatus: "active",
  membershipId: "mem-1",
  membershipStatus: "active",
  clubId: "club-a",
  tenantId: "tenant-a",
  profilePlayerId: "player-1",
};

test("1. active athlete + active membership becomes candidate", async () => {
  const service = makeService([ACTIVE]);
  const result = await service.listCandidates({ clubId: "club-a" });
  assert.equal(result.status, PAIRING_CANDIDATE_STATUS.READY);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].pairingIdentityId, "ath-1");
  assert.equal(result.candidates[0].athleteId, "ath-1");
  assert.equal(result.excluded.length, 0);
});

test("2. athlete missing membership → MISSING_MEMBERSHIP", async () => {
  const service = makeService([
    {
      ...ACTIVE,
      membershipId: null,
      membershipStatus: null,
      profilePlayerId: null,
    },
  ]);
  const result = await service.listCandidates({ clubId: "club-a" });
  assert.equal(result.candidates.length, 0);
  assert.equal(result.excluded[0].reasonCode, RC.MISSING_MEMBERSHIP);
});

test("3. inactive membership → MEMBERSHIP_INACTIVE", async () => {
  const service = makeService([{ ...ACTIVE, membershipStatus: "left" }]);
  const result = await service.listCandidates({ clubId: "club-a" });
  assert.equal(result.excluded[0].reasonCode, RC.MEMBERSHIP_INACTIVE);
});

test("4. inactive athlete → ATHLETE_INACTIVE", async () => {
  const service = makeService([{ ...ACTIVE, athleteStatus: "inactive" }]);
  const result = await service.listCandidates({ clubId: "club-a" });
  assert.equal(result.excluded[0].reasonCode, RC.ATHLETE_INACTIVE);
});

test("5. wrong club/scope → WRONG_SCOPE", async () => {
  const service = makeService([{ ...ACTIVE, clubId: "club-b" }]);
  const result = await service.listCandidates({ clubId: "club-a" });
  assert.equal(result.excluded[0].reasonCode, RC.WRONG_SCOPE);
});

test("5b. missing clubId on query → status=error WRONG_SCOPE", async () => {
  const service = makeService([ACTIVE]);
  const result = await service.listCandidates({});
  assert.equal(result.status, PAIRING_CANDIDATE_STATUS.ERROR);
  assert.equal(result.diagnostics.error.code, RC.WRONG_SCOPE);
  assert.equal(isPairingCandidateResponse(result), true);
});

test("6. missing athleteId → MISSING_IDENTITY_LINK", async () => {
  const service = makeService([
    {
      ...ACTIVE,
      athleteId: null,
      profilePlayerId: null,
    },
  ]);
  const result = await service.listCandidates({ clubId: "club-a" });
  assert.equal(result.excluded[0].reasonCode, RC.MISSING_IDENTITY_LINK);
});

test("7. registration required but absent → NOT_REGISTERED", async () => {
  const service = makeService([{ ...ACTIVE, registrationStatus: null }]);
  const result = await service.listCandidates({
    clubId: "club-a",
    requireRegistration: true,
    tournamentId: "t1",
  });
  assert.equal(result.excluded[0].reasonCode, RC.NOT_REGISTERED);
});

test("8. withdrawn → WITHDRAWN", async () => {
  const service = makeService([{ ...ACTIVE, registrationStatus: "withdrawn" }]);
  const result = await service.listCandidates({
    clubId: "club-a",
    requireRegistration: true,
  });
  assert.equal(result.excluded[0].reasonCode, RC.WITHDRAWN);
});

test("9. missing required gender → MISSING_GENDER", async () => {
  const service = makeService([{ ...ACTIVE, gender: null }]);
  const result = await service.listCandidates({ clubId: "club-a", genderMode: "men" });
  assert.equal(result.excluded[0].reasonCode, RC.MISSING_GENDER);
});

test("10. missing required rating → MISSING_RATING", async () => {
  const service = makeService([{ ...ACTIVE, rating: null }]);
  const result = await service.listCandidates({
    clubId: "club-a",
    ratingBand: { min: 3, max: 4 },
  });
  assert.equal(result.excluded[0].reasonCode, RC.MISSING_RATING);
});

test("11. busy → BUSY", async () => {
  const service = makeService([ACTIVE]);
  const result = await service.listCandidates({
    clubId: "club-a",
    busyPlayerIds: ["ath-1"],
  });
  assert.equal(result.excluded[0].reasonCode, RC.BUSY);
});

test("12. already assigned → ALREADY_ASSIGNED", async () => {
  const service = makeService([ACTIVE]);
  const result = await service.listCandidates({
    clubId: "club-a",
    assignedPlayerIds: ["ath-1"],
    teamId: "team-1",
  });
  assert.equal(result.excluded[0].reasonCode, RC.ALREADY_ASSIGNED);
});

test("13. multiple exclusions populate summary.byReason", async () => {
  const service = makeService([
    { ...ACTIVE, athleteId: "a1", displayName: "A", membershipStatus: null, membershipId: null },
    { ...ACTIVE, athleteId: "a2", displayName: "B", athleteStatus: "inactive" },
    { ...ACTIVE, athleteId: "a3", displayName: "C", gender: null },
  ]);
  const result = await service.listCandidates({ clubId: "club-a", genderMode: "women" });
  assert.ok(result.summary.byReason[RC.MISSING_MEMBERSHIP] >= 1);
  assert.ok(result.summary.byReason[RC.ATHLETE_INACTIVE] >= 1);
  assert.ok(result.summary.byReason[RC.MISSING_GENDER] >= 1);
  assert.equal(result.summary.excludedCount, result.excluded.length);
});

test("14. sourceBreakdown counts are correct", async () => {
  const service = makeService([ACTIVE, { ...ACTIVE, athleteId: "ath-2", displayName: "Beta" }], {
    athleteRows: 2,
    membershipRows: 2,
    activeMembershipRows: 2,
  });
  const result = await service.listCandidates({ clubId: "club-a" });
  assert.equal(result.diagnostics.sourceBreakdown.athleteRows, 2);
  assert.equal(result.diagnostics.sourceBreakdown.membershipRows, 2);
  assert.equal(result.diagnostics.sourceBreakdown.activeMembershipRows, 2);
  assert.equal(result.diagnostics.sourceBreakdown.preEligibilityRows, 2);
  assert.equal(result.diagnostics.sourceBreakdown.eligibleRows, 2);
});

test("15. identityCoverage counts are correct", async () => {
  const service = makeService([
    { ...ACTIVE, athleteId: "m1", profilePlayerId: "p1", legacyPlayerId: null },
    {
      ...ACTIVE,
      athleteId: "d1",
      displayName: "Derived",
      profilePlayerId: null,
      legacyPlayerId: "legacy-1",
    },
    {
      ...ACTIVE,
      athleteId: "u1",
      displayName: "Unmapped",
      profilePlayerId: null,
      legacyPlayerId: null,
    },
  ]);
  const result = await service.listCandidates({ clubId: "club-a" });
  assert.equal(result.diagnostics.identityCoverage.mapped, 1);
  assert.equal(result.diagnostics.identityCoverage.derived, 1);
  assert.equal(result.diagnostics.identityCoverage.unmapped, 1);
  assert.equal(result.candidates.length, 3);
});

test("16. repository error returns status=error", async () => {
  const service = createPairingCandidateService({
    listScopeRows: async () => ({
      ok: false,
      error: { code: "REPOSITORY_ERROR", message: "boom" },
    }),
  });
  const result = await service.listCandidates({ clubId: "club-a" });
  assert.equal(result.status, PAIRING_CANDIDATE_STATUS.ERROR);
  assert.equal(result.diagnostics.error.code, "REPOSITORY_ERROR");
  assert.equal(isPairingCandidateResponse(result), true);
});

test("17. fatal conflict returns status=blocked", async () => {
  const service = createPairingCandidateService({
    listScopeRows: async () => ({
      ok: true,
      rows: [ACTIVE],
      sourceBreakdown: { athleteRows: 1, membershipRows: 1, activeMembershipRows: 1 },
    }),
    evaluatePrivatePairingRules: async () => ({
      fatalConflicts: true,
      message: "conflict",
    }),
  });
  const result = await service.listCandidates({
    clubId: "club-a",
    applyPrivatePairingRules: true,
  });
  assert.equal(result.status, PAIRING_CANDIDATE_STATUS.BLOCKED);
  assert.equal(result.diagnostics.error.code, RC.FATAL_RULE_CONFLICT);
  assert.ok(result.excluded.every((e) => e.reasonCode === RC.FATAL_RULE_CONFLICT));
});

test("18. soft rule scoring does not exclude", async () => {
  const applied = applyOptionalPrivatePairingSeam(
    [{ athleteId: "ath-1", pairingIdentityId: "ath-1", metadata: {} }],
    { softScores: { "ath-1": 12 } }
  );
  assert.equal(applied.candidates.length, 1);
  assert.equal(applied.excluded.length, 0);
  assert.equal(applied.candidates[0].metadata.softScore, 12);
});

test("19. deterministic candidate order", async () => {
  const service = makeService([
    { ...ACTIVE, athleteId: "z", displayName: "Zulu" },
    { ...ACTIVE, athleteId: "a", displayName: "Alpha" },
    { ...ACTIVE, athleteId: "b", displayName: "Alpha" },
  ]);
  const result = await service.listCandidates({ clubId: "club-a" });
  assert.deepEqual(
    result.candidates.map((c) => c.athleteId),
    ["a", "b", "z"]
  );
});

test("20. gateway never returns a bare array", async () => {
  const service = makeService([]);
  const result = await service.listCandidates({ clubId: "club-a" });
  assert.equal(Array.isArray(result), false);
  assert.equal(isPairingCandidateResponse(result), true);
});

test("21. gateway source files do not import blob storage", () => {
  const files = readdirSync(gatewayDir)
    .filter((f) => f.endsWith(".js"))
    // App adapter (45B.5A+) may import cloud RPC helpers named *clubStorageV2*;
    // core gateway modules must remain blob-free.
    .filter((f) => f !== "selectPlayersCandidateAdapter.js");
  assert.ok(files.length >= 6);
  const forbiddenImportPatterns = [
    /from\s+["'][^"']*domain\/clubStorage[^"']*["']/,
    /from\s+["'][^"']*clubExtensionStorage[^"']*["']/,
    /from\s+["'][^"']*selectPlayers\.data[^"']*["']/,
    /\bloadPlayersForClub\b/,
    /\blocalStorage\b/,
  ];
  for (const file of files) {
    const src = readFileSync(path.join(gatewayDir, file), "utf8");
    for (const pattern of forbiddenImportPatterns) {
      assert.equal(
        pattern.test(src),
        false,
        `${file} must not match ${pattern}`
      );
    }
  }
});

test("22. identity mapper definitions — mapped/derived/unmapped", () => {
  assert.equal(mapPairingIdentity(ACTIVE).coverageBucket, "mapped");
  assert.equal(
    mapPairingIdentity({
      ...ACTIVE,
      profilePlayerId: null,
      legacyPlayerId: "legacy",
    }).coverageBucket,
    "derived"
  );
  assert.equal(
    mapPairingIdentity({
      ...ACTIVE,
      profilePlayerId: null,
      legacyPlayerId: null,
    }).coverageBucket,
    "unmapped"
  );
});

test("joinAthletesAndMemberships marks missing membership", () => {
  const joined = joinAthletesAndMemberships({
    athletes: [{ id: "ath-x", user_id: "u-x", display_name: "X", status: "active" }],
    memberships: [],
    scope: { clubId: "club-a" },
  });
  assert.equal(joined.rows[0].membershipStatus, null);
  assert.equal(joined.athleteRows, 1);
  assert.equal(joined.membershipRows, 0);
});

test("canonical repository is read-only (no write methods)", () => {
  const repo = createCanonicalAthleteRepository({
    listScopeRows: async () => ({ ok: true, rows: [] }),
  });
  assert.equal(typeof repo.listInScope, "function");
  assert.equal(typeof repo.save, "undefined");
  assert.equal(typeof repo.update, "undefined");
  assert.equal(typeof repo.create, "undefined");
  assert.equal(typeof repo.delete, "undefined");
});

test("policy blocked seam returns blocked", async () => {
  const service = createPairingCandidateService({
    listScopeRows: async () => ({
      ok: true,
      rows: [ACTIVE],
      sourceBreakdown: { athleteRows: 1, membershipRows: 1, activeMembershipRows: 1 },
    }),
    evaluatePrivatePairingRules: async () => ({ policyBlocked: true }),
  });
  const result = await service.listCandidates({
    clubId: "club-a",
    applyPrivatePairingRules: true,
  });
  assert.equal(result.status, PAIRING_CANDIDATE_STATUS.BLOCKED);
  assert.equal(result.diagnostics.error.code, RC.POLICY_BLOCKED);
});
