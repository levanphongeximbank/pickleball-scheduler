/**
 * PHASE 45B.3 — Athlete identity mapping repair tests.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  PAIRING_CANDIDATE_GATEWAY_VERSION,
  PAIRING_CANDIDATE_REASON_CODES as RC,
  mapPairingIdentity,
  mapPairingIdentities,
  extractAthleteId,
  collectLegacyAliases,
  classifyIdentityCoverage,
  buildPairingIdentityIndex,
  resolvePairingIdentityId,
  createPairingCandidateService,
  normalizeAthleteMembershipScopeRow,
} from "../src/features/pairing-candidates/index.js";

const BASE = {
  athleteId: "ath-1",
  userId: "user-1",
  displayName: "Alpha",
  gender: "male",
  rating: 3.5,
  athleteStatus: "active",
  membershipId: "mem-1",
  membershipStatus: "active",
  clubId: "club-a",
  tenantId: "tenant-a",
};

test("45B.3 gateway version bumped", () => {
  assert.equal(PAIRING_CANDIDATE_GATEWAY_VERSION, "45B.3.0");
});

test("athlete with aliases → mapped; pairingIdentityId = athletes.id", () => {
  const mapped = mapPairingIdentity({
    ...BASE,
    profilePlayerId: "player-1",
    legacyPlayerId: "blob-1",
  });
  assert.equal(mapped.ok, true);
  assert.equal(mapped.coverageBucket, "mapped");
  assert.equal(mapped.candidateSeed.pairingIdentityId, "ath-1");
  assert.equal(mapped.candidateSeed.athleteId, "ath-1");
  assert.equal(mapped.candidateSeed.metadata.profilePlayerId, "player-1");
  assert.equal(mapped.candidateSeed.metadata.legacyPlayerId, "blob-1");
  assert.deepEqual(mapped.candidateSeed.metadata.aliasIds.sort(), ["blob-1", "player-1"]);
});

test("athlete without aliases → unmapped but still eligible seed", () => {
  const mapped = mapPairingIdentity({
    ...BASE,
    profilePlayerId: null,
    legacyPlayerId: null,
  });
  assert.equal(mapped.ok, true);
  assert.equal(mapped.coverageBucket, "unmapped");
  assert.equal(mapped.candidateSeed.pairingIdentityId, "ath-1");
  assert.equal(mapped.candidateSeed.metadata.aliasIds.length, 0);
});

test("missing aliases never discard athlete when athletes.id present", async () => {
  const service = createPairingCandidateService({
    listScopeRows: async () => ({
      ok: true,
      rows: [
        {
          ...BASE,
          profilePlayerId: null,
          legacyPlayerId: null,
          player_id: null,
        },
      ],
      sourceBreakdown: { athleteRows: 1, membershipRows: 1, activeMembershipRows: 1 },
    }),
  });
  const result = await service.listCandidates({ clubId: "club-a" });
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].pairingIdentityId, "ath-1");
  assert.equal(result.diagnostics.identityCoverage.unmapped, 1);
  assert.equal(result.diagnostics.identityCoverage.mapped, 0);
});

test("missing athletes.id → MISSING_IDENTITY_LINK (aliases not invented as primary)", () => {
  const mapped = mapPairingIdentity({
    ...BASE,
    athleteId: null,
    athlete_id: null,
    id: "blob-only",
    player_id: "player-only",
    pairingIdentityId: "should-not-win",
  });
  assert.equal(mapped.ok, false);
  assert.equal(mapped.exclusion.reasonCode, RC.MISSING_IDENTITY_LINK);
  assert.equal(mapped.exclusion.pairingIdentityId, null);
  assert.ok(mapped.exclusion.details.offeredAliases.includes("blob-only"));
});

test("duplicate aliases — both athletes retained; athletes.id distinct", () => {
  const { seeds, identityCoverage, aliasDiagnostics, warnings } = mapPairingIdentities([
    { ...BASE, athleteId: "ath-a", displayName: "A", profilePlayerId: "shared-player" },
    { ...BASE, athleteId: "ath-b", displayName: "B", profilePlayerId: "shared-player" },
  ]);
  assert.equal(seeds.length, 2);
  assert.deepEqual(
    seeds.map((s) => s.pairingIdentityId).sort(),
    ["ath-a", "ath-b"]
  );
  assert.equal(identityCoverage.mapped, 2);
  assert.equal(aliasDiagnostics.duplicateAliases.length, 1);
  assert.equal(aliasDiagnostics.duplicateAliases[0].aliasId, "shared-player");
  assert.ok(warnings.some((w) => w.startsWith("duplicate_legacy_aliases:")));
});

test("mismatched aliases still map; athletes.id wins; diagnostic flagged", () => {
  const mapped = mapPairingIdentity({
    ...BASE,
    profilePlayerId: "player-1",
    legacyPlayerId: "blob-OTHER",
  });
  assert.equal(mapped.ok, true);
  assert.equal(mapped.coverageBucket, "mapped");
  assert.equal(mapped.candidateSeed.pairingIdentityId, "ath-1");
  assert.equal(mapped.candidateSeed.metadata.identity.mismatchedAliases, true);

  const batch = mapPairingIdentities([
    {
      ...BASE,
      profilePlayerId: "player-1",
      legacyPlayerId: "blob-OTHER",
    },
  ]);
  assert.equal(batch.aliasDiagnostics.mismatchedAliasCount, 1);
  assert.ok(batch.warnings.some((w) => w.startsWith("mismatched_aliases:")));
});

test("athletes.id always wins over conflicting pairingIdentityId / id / playerId", () => {
  const mapped = mapPairingIdentity({
    ...BASE,
    athleteId: "ath-canonical",
    pairingIdentityId: "legacy-as-primary",
    id: "blob-as-id",
    playerId: "player-as-playerid",
    profilePlayerId: "profile-alias",
  });
  assert.equal(mapped.candidateSeed.pairingIdentityId, "ath-canonical");
  assert.equal(mapped.candidateSeed.athleteId, "ath-canonical");
  assert.ok(
    mapped.candidateSeed.metadata.identity.ignoredPrimaryClaims.includes("legacy-as-primary")
  );
  assert.ok(mapped.candidateSeed.metadata.aliasIds.includes("legacy-as-primary"));
  assert.ok(mapped.candidateSeed.metadata.aliasIds.includes("blob-as-id"));
  assert.equal(extractAthleteId({ id: "blob-only", player_id: "p1" }), null);
});

test("derived coverage when only blob/legacy alias present", () => {
  assert.equal(
    classifyIdentityCoverage({ profilePlayerId: null, legacyPlayerId: "blob-1", aliasIds: ["blob-1"] }),
    "derived"
  );
  const mapped = mapPairingIdentity({
    ...BASE,
    profilePlayerId: null,
    legacyPlayerId: "blob-1",
  });
  assert.equal(mapped.coverageBucket, "derived");
});

test("resolvePairingIdentityId prefers athletes.id; alias resolves; duplicate alias ambiguous", () => {
  const { seeds } = mapPairingIdentities([
    { ...BASE, athleteId: "ath-a", profilePlayerId: "shared", legacyPlayerId: "blob-a" },
    { ...BASE, athleteId: "ath-b", profilePlayerId: "shared", legacyPlayerId: "blob-b" },
  ]);
  const index = buildPairingIdentityIndex(seeds);

  assert.deepEqual(resolvePairingIdentityId("ath-a", index), {
    ok: true,
    pairingIdentityId: "ath-a",
    via: "athlete",
  });
  assert.deepEqual(resolvePairingIdentityId("blob-a", index), {
    ok: true,
    pairingIdentityId: "ath-a",
    via: "alias",
  });
  const ambiguous = resolvePairingIdentityId("shared", index);
  assert.equal(ambiguous.ok, false);
  assert.equal(ambiguous.ambiguous, true);
  assert.deepEqual(ambiguous.athleteIds.sort(), ["ath-a", "ath-b"]);
});

test("identityCoverage diagnostics mapped/derived/unmapped", () => {
  const { identityCoverage } = mapPairingIdentities([
    { ...BASE, athleteId: "m1", profilePlayerId: "p1" },
    { ...BASE, athleteId: "d1", profilePlayerId: null, legacyPlayerId: "l1" },
    { ...BASE, athleteId: "u1", profilePlayerId: null, legacyPlayerId: null },
  ]);
  assert.deepEqual(identityCoverage, { mapped: 1, derived: 1, unmapped: 1 });
});

test("repository normalize never promotes player_id to athleteId", () => {
  const row = normalizeAthleteMembershipScopeRow({
    player_id: "player-legacy",
    id: "should-not-become-athlete",
    user_id: "user-1",
    display_name: "X",
  });
  assert.equal(row.athleteId, null);
  assert.equal(row.profilePlayerId, "player-legacy");
});

test("collectLegacyAliases ignores aliases equal to athletes.id", () => {
  const aliases = collectLegacyAliases(
    {
      profilePlayerId: "ath-1",
      legacyPlayerId: "ath-1",
      id: "ath-1",
    },
    "ath-1"
  );
  assert.equal(aliases.profilePlayerId, null);
  assert.equal(aliases.legacyPlayerId, null);
  assert.equal(aliases.aliasIds.length, 0);
});

test("service surfaces aliasDiagnostics without dropping candidates", async () => {
  const service = createPairingCandidateService({
    listScopeRows: async () => ({
      ok: true,
      rows: [
        { ...BASE, athleteId: "ath-a", profilePlayerId: "dup", legacyPlayerId: "x" },
        { ...BASE, athleteId: "ath-b", displayName: "Beta", profilePlayerId: "dup", legacyPlayerId: "y" },
      ],
      sourceBreakdown: { athleteRows: 2, membershipRows: 2, activeMembershipRows: 2 },
    }),
  });
  const result = await service.listCandidates({ clubId: "club-a" });
  assert.equal(result.candidates.length, 2);
  assert.equal(result.diagnostics.gatewayVersion, "45B.3.0");
  assert.equal(result.diagnostics.aliasDiagnostics.duplicateAliases.length, 1);
  assert.ok(result.diagnostics.warnings.some((w) => w.startsWith("duplicate_legacy_aliases:")));
});
