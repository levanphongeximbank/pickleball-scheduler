import test from "node:test";
import assert from "node:assert/strict";

import {
  createCanonicalClubRepository,
  createCanonicalMembershipRepository,
  createCanonicalPlayerRepository,
  LOCAL_DEFAULT_CLUB_ID,
} from "../src/features/club/repositories/index.js";
import {
  assertPairingPlayerIdsAreCanonical,
  createPrivatePairingPlayerPickerAdapter,
} from "../src/features/private-pairing-rules/ui/privatePairingPlayerPickerAdapter.js";
import { ACCC_FIXTURE } from "./fixtures/accc-cloud-only-club.js";

function buildAcccAdapter() {
  const membershipRepository = createCanonicalMembershipRepository({
    isV2Enabled: () => true,
    listMembersRpc: async () => ({ ok: true, members: ACCC_FIXTURE.membershipRows }),
  });
  const clubRepository = createCanonicalClubRepository({
    isV2Enabled: () => true,
    listRegistryRpc: async () => ({
      ok: true,
      clubs: [ACCC_FIXTURE.club, ACCC_FIXTURE.defaultClub],
    }),
    getClubRpc: async (id) =>
      id === ACCC_FIXTURE.club.id
        ? { ok: true, club: ACCC_FIXTURE.club }
        : { ok: false, code: "NOT_FOUND" },
  });
  const playerRepository = createCanonicalPlayerRepository({
    isV2Enabled: () => true,
    membershipRepository,
    clubRepository,
    loadLegacyPlayers: () => [],
    loadProfilesByUserIds: ACCC_FIXTURE.profilesByUserId,
  });
  return createPrivatePairingPlayerPickerAdapter({
    isClubCanonical: () => true,
    isPlayerCanonical: () => true,
    clubRepository,
    playerRepository,
  });
}

test("Private Pairing ACCC: cloud members visible with empty blob; default-club excluded", async () => {
  const adapter = buildAcccAdapter();
  const clubs = await adapter.listSourceClubs({
    tenantId: ACCC_FIXTURE.tenantId,
    userContext: { isPlatformAdmin: true },
  });
  assert.equal(clubs.ok, true);
  assert.ok(clubs.data.some((c) => c.id === ACCC_FIXTURE.club.id));
  assert.ok(!clubs.data.some((c) => c.id === LOCAL_DEFAULT_CLUB_ID));

  const players = await adapter.listPickerPlayers({
    clubId: ACCC_FIXTURE.club.id,
    tenantId: ACCC_FIXTURE.tenantId,
    userContext: { isPlatformAdmin: true },
    profilesByUserId: ACCC_FIXTURE.profilesByUserId,
  });
  assert.equal(players.ok, true);
  assert.ok(players.data.length >= 10);
  assert.equal(players.options.length, 5);
  assert.equal(players.mappingSummary.mappedPlayers, 5);
  assert.equal(players.mappingSummary.unmappedMembers, 5);
  assert.ok(players.options.every((o) => String(o.id).startsWith("player-accc-")));
});

test("GLOBAL source club path uses selected club_id; CLUB scope must not store tenant as club", async () => {
  const adapter = buildAcccAdapter();
  const players = await adapter.listPickerPlayers({
    clubId: ACCC_FIXTURE.club.id,
    tenantId: ACCC_FIXTURE.tenantId,
    profilesByUserId: ACCC_FIXTURE.profilesByUserId,
  });
  assert.ok(players.options.length > 0);
  // ensure options carry clubId not tenantId
  assert.ok(players.options.every((o) => o.clubId === ACCC_FIXTURE.club.id));
  assert.ok(players.options.every((o) => o.clubId !== ACCC_FIXTURE.tenantId));
});

test("primary/target persist canonical playerId only; reject unmapped; exclude primary from targets", () => {
  const options = [
    { id: "player-accc-01", name: "One" },
    { id: "player-accc-02", name: "Two" },
  ];
  const ok = assertPairingPlayerIdsAreCanonical(
    { primaryPlayerId: "player-accc-01", targetPlayerIds: ["player-accc-02"] },
    options
  );
  assert.equal(ok.ok, true);

  const self = assertPairingPlayerIdsAreCanonical(
    { primaryPlayerId: "player-accc-01", targetPlayerIds: ["player-accc-01"] },
    options
  );
  assert.equal(self.ok, false);

  const unmapped = assertPairingPlayerIdsAreCanonical(
    { primaryPlayerId: "user-06", targetPlayerIds: ["player-accc-02"] },
    options
  );
  assert.equal(unmapped.ok, false);
  assert.equal(unmapped.code, "PLAYER_MAPPING_REQUIRED");
});

test("flag OFF adapter keeps legacy blob behavior", async () => {
  const adapter = createPrivatePairingPlayerPickerAdapter({
    isClubCanonical: () => false,
    isPlayerCanonical: () => false,
    legacyListClubs: () => [
      { id: "club-local", name: "Local", tenantId: "t1" },
      { id: LOCAL_DEFAULT_CLUB_ID, name: "CLB Mặc định", isDefault: true },
    ],
    legacyLoadPlayers: () => [{ id: "blob-1", name: "Blob Player" }],
  });
  const clubs = await adapter.listSourceClubs({ tenantId: "t1" });
  assert.equal(clubs.source, "legacy_blob");
  assert.ok(!clubs.data.some((c) => c.id === LOCAL_DEFAULT_CLUB_ID));

  const players = await adapter.listPickerPlayers({ clubId: "club-local" });
  assert.equal(players.source, "legacy_blob");
  assert.equal(players.options[0].id, "blob-1");
});
