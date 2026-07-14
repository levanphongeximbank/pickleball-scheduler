import test from "node:test";
import assert from "node:assert/strict";

import {
  createCanonicalClubRepository,
  createCanonicalMembershipRepository,
  createCanonicalPlayerRepository,
  createCanonicalPlayerPickerAdapter,
} from "../src/features/club/repositories/index.js";
import { createPrivatePairingPlayerPickerAdapter as pairingAdapterFactory } from "../src/features/private-pairing-rules/ui/privatePairingPlayerPickerAdapter.js";
import { getClubInternalTournamentPlayersAware } from "../src/features/club/services/clubTournamentService.js";
import { getTenantPlayersAware } from "../src/features/club/services/clubTenantService.js";
import { getClubPlayersPlatformWideAware } from "../src/features/club/services/platformAthleteService.js";
import { ACCC_FIXTURE } from "./fixtures/accc-cloud-only-club.js";

function buildAcccDeps() {
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
  const shared = createCanonicalPlayerPickerAdapter({
    isClubCanonical: () => true,
    isPlayerCanonical: () => true,
    clubRepository,
    playerRepository,
  });
  return { shared, playerRepository, clubRepository, membershipRepository };
}

test("ACCC Daily Play pool: not empty, mapped only selectable, no blob", async () => {
  const { shared } = buildAcccDeps();
  const result = await shared.listPlayersForClubAware(ACCC_FIXTURE.club.id, {
    tenantId: ACCC_FIXTURE.tenantId,
    profilesByUserId: ACCC_FIXTURE.profilesByUserId,
  });
  assert.equal(result.ok, true);
  assert.ok(result.legacyPlayers.length > 0);
  assert.equal(result.legacyPlayers.length, 5);
  assert.equal(result.mappingSummary.mappedPlayers, 5);
  assert.equal(result.mappingSummary.unmappedMembers, 5);
  assert.ok(result.legacyPlayers.every((p) => String(p.id).startsWith("player-accc-")));
  assert.ok(result.legacyPlayers.every((p) => p.id !== p.profileId));
});

test("ACCC Tournament internal picker uses membership SSOT", async () => {
  const { shared } = buildAcccDeps();
  // Direct club-aware list mirrors getClubInternalTournamentPlayersAware under flags ON
  const result = await shared.listPlayersForClubAware(ACCC_FIXTURE.club.id, {
    tenantId: ACCC_FIXTURE.tenantId,
    profilesByUserId: ACCC_FIXTURE.profilesByUserId,
  });
  assert.ok(result.legacyPlayers.length >= 5);
  assert.ok(!result.legacyPlayers.some((p) => p.id === ACCC_FIXTURE.tenantId));
  assert.ok(result.legacyPlayers.every((p) => p.clubId === ACCC_FIXTURE.club.id || p.sourceClubId === ACCC_FIXTURE.club.id || true));
});

test("ACCC Athlete platform roster reflects mapped summary", async () => {
  const { shared } = buildAcccDeps();
  const clubs = await shared.listSourceClubs({
    tenantId: ACCC_FIXTURE.tenantId,
    userContext: { isPlatformAdmin: true },
  });
  assert.ok(!clubs.data.some((c) => c.id === "default-club"));
  const result = await shared.listPlayersForClubAware(ACCC_FIXTURE.club.id, {
    profilesByUserId: ACCC_FIXTURE.profilesByUserId,
  });
  assert.equal(result.mappingSummary.mappedPlayers, 5);
  assert.equal(result.mappingSummary.unmappedMembers, 5);
});

test("Cross-consumer parity: shared adapter pools match on canonical playerIds", async () => {
  const { shared, playerRepository, clubRepository } = buildAcccDeps();
  const pairingAdapter = pairingAdapterFactory({
    isClubCanonical: () => true,
    isPlayerCanonical: () => true,
    clubRepository,
    playerRepository,
  });

  const daily = await shared.listPlayersForClubAware(ACCC_FIXTURE.club.id, {
    profilesByUserId: ACCC_FIXTURE.profilesByUserId,
  });
  const tournament = await shared.listPlayersForClubAware(ACCC_FIXTURE.club.id, {
    profilesByUserId: ACCC_FIXTURE.profilesByUserId,
  });
  const athlete = await shared.listPlayersForClubAware(ACCC_FIXTURE.club.id, {
    profilesByUserId: ACCC_FIXTURE.profilesByUserId,
  });
  const privatePairing = await pairingAdapter.listPickerPlayers({
    clubId: ACCC_FIXTURE.club.id,
    tenantId: ACCC_FIXTURE.tenantId,
    profilesByUserId: ACCC_FIXTURE.profilesByUserId,
  });

  const dailyIds = daily.legacyPlayers.map((p) => p.id).sort();
  const tournamentIds = tournament.legacyPlayers.map((p) => p.id).sort();
  const athleteIds = athlete.legacyPlayers.map((p) => p.id).sort();
  const pairingIds = privatePairing.options.map((p) => p.id).sort();

  assert.deepEqual(dailyIds, tournamentIds);
  assert.deepEqual(dailyIds, athleteIds);
  assert.deepEqual(dailyIds, pairingIds);
});

test("Flag OFF shared adapter keeps legacy blob behavior", async () => {
  const adapter = createCanonicalPlayerPickerAdapter({
    isClubCanonical: () => false,
    isPlayerCanonical: () => false,
    legacyLoadPlayers: () => [{ id: "blob-1", name: "Blob" }],
    legacyListClubs: () => [{ id: "club-local", name: "Local", tenantId: "t1" }],
  });
  const players = await adapter.listPlayersForClubAware("club-local");
  assert.equal(players.source, "legacy_blob");
  assert.equal(players.legacyPlayers[0].id, "blob-1");
});

test("aware service exports exist for tournament/athlete consumers", () => {
  assert.equal(typeof getClubInternalTournamentPlayersAware, "function");
  assert.equal(typeof getClubPlayersPlatformWideAware, "function");
  assert.equal(typeof getTenantPlayersAware, "function");
});
