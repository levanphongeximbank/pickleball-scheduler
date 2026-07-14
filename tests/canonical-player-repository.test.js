import test from "node:test";
import assert from "node:assert/strict";

import {
  createCanonicalMembershipRepository,
  createCanonicalPlayerRepository,
  MAPPING_STATUS,
  buildDerivedAuthPlayerId,
  resolvePlayerForProfile,
} from "../src/features/club/repositories/index.js";
import { ACCC_FIXTURE } from "./fixtures/accc-cloud-only-club.js";

function buildAcccPlayerRepo() {
  const membershipRepository = createCanonicalMembershipRepository({
    isV2Enabled: () => true,
    listMembersRpc: async () => ({ ok: true, members: ACCC_FIXTURE.membershipRows }),
  });
  const clubRepository = {
    getClubById: async () => ({
      ok: true,
      data: { id: ACCC_FIXTURE.club.id, tenantId: ACCC_FIXTURE.tenantId },
    }),
    listClubsForTenant: async () => ({ ok: true, data: [ACCC_FIXTURE.club] }),
  };
  return createCanonicalPlayerRepository({
    isV2Enabled: () => true,
    membershipRepository,
    clubRepository,
    loadLegacyPlayers: () => ACCC_FIXTURE.blobPlayers,
    loadProfilesByUserIds: ACCC_FIXTURE.profilesByUserId,
  });
}

test("profiles.player_id valid → MAPPED", () => {
  const { record, warning } = resolvePlayerForProfile(
    { id: "u1", player_id: "player-1", display_name: "A" },
    { findPlayerById: () => ({ id: "player-1", name: "A" }) }
  );
  assert.equal(record.mappingStatus, MAPPING_STATUS.MAPPED);
  assert.equal(record.playerId, "player-1");
  assert.equal(warning, null);
});

test("player-auth-{userId} exists → DERIVED", () => {
  const derived = buildDerivedAuthPlayerId("auth-9");
  const { record } = resolvePlayerForProfile(
    { id: "auth-9", player_id: null, display_name: "Z" },
    { findPlayerById: (id) => (id === derived ? { id: derived, name: "Z" } : null) }
  );
  assert.equal(record.mappingStatus, MAPPING_STATUS.DERIVED);
  assert.equal(record.playerId, derived);
});

test("active member missing player → UNMAPPED warning", () => {
  const { record, warning } = resolvePlayerForProfile(
    { id: "u-x", player_id: null },
    { findPlayerById: () => null }
  );
  assert.equal(record.mappingStatus, MAPPING_STATUS.UNMAPPED);
  assert.equal(warning.code, "UNMAPPED_ACTIVE_MEMBER");
});

test("invalid player mapping → INVALID warning", () => {
  const { record, warning } = resolvePlayerForProfile(
    { id: "u1", player_id: "missing-player" },
    { findPlayerById: () => null }
  );
  assert.equal(record.mappingStatus, MAPPING_STATUS.INVALID);
  assert.equal(warning.code, "INVALID_PLAYER_MAPPING");
});

test("ACCC cloud-only: membership pool not empty; mapping summary accurate; no profile/tenant confusion", async () => {
  const repo = buildAcccPlayerRepo();
  const result = await repo.listPlayersForClub(ACCC_FIXTURE.club.id, {
    tenantId: ACCC_FIXTURE.tenantId,
  });
  assert.equal(result.ok, true);
  assert.notEqual(result.data.length, 0);
  assert.equal(result.data.length, 10);
  assert.equal(result.mappingSummary.activeMembers, 10);
  assert.equal(result.mappingSummary.mappedPlayers, 5);
  assert.equal(result.mappingSummary.unmappedMembers, 5);
  assert.ok(result.warnings.some((w) => w.code === "UNMAPPED_ACTIVE_MEMBER"));
  assert.equal(result.execution.blobIndependent, true);

  for (const player of result.data) {
    if (player.mappingStatus === MAPPING_STATUS.MAPPED) {
      assert.ok(player.playerId);
      assert.notEqual(player.playerId, player.profileId);
      assert.notEqual(player.playerId, player.authUserId);
    }
    assert.notEqual(player.clubId, ACCC_FIXTURE.tenantId);
    assert.equal(player.clubId, ACCC_FIXTURE.club.id);
  }
});

test("does not duplicate players from duplicate membership history", async () => {
  const repo = buildAcccPlayerRepo();
  const result = await repo.listPlayersForClub(ACCC_FIXTURE.club.id);
  const ids = result.data.map((p) => p.playerId || p.authUserId);
  assert.equal(new Set(ids).size, ids.length);
});

test("legacy flag OFF returns blob players with source legacy_blob", async () => {
  const repo = createCanonicalPlayerRepository({
    isV2Enabled: () => false,
    loadLegacyPlayers: () => [{ id: "p1", name: "Blob" }],
  });
  const result = await repo.listPlayersForClub("club-x");
  assert.equal(result.source, "legacy_blob");
  assert.equal(result.data[0].playerId, "p1");
  assert.equal(result.data[0].mappingStatus, MAPPING_STATUS.MAPPED);
});
