import test from "node:test";
import assert from "node:assert/strict";

import * as playerPublicApi from "../src/features/player/index.js";
import {
  RESOLUTION_OUTCOME,
  resolveByAuthUser,
  resolveCanonicalPlayerId,
  getPlayerProfile,
  normalizePlayerProfile,
  searchPlayers,
} from "../src/features/player/index.js";

import {
  resolvePlayerForProfile,
  MAPPING_STATUS,
  buildDerivedAuthPlayerId,
} from "../src/features/club/repositories/index.js";

function directory(map) {
  const store = new Map(Object.entries(map));
  return (playerId) => {
    const id = String(playerId || "").trim();
    if (!id) return null;
    return store.has(id) ? store.get(id) : null;
  };
}

test("1B public API surface — stable contracts only", () => {
  const exported = Object.keys(playerPublicApi).sort();
  // Phase 1C adds updatePlayerProfile; Phase 1B contracts remain present.
  for (const key of [
    "RESOLUTION_OUTCOME",
    "getPlayerProfile",
    "normalizePlayerProfile",
    "resolveByAuthUser",
    "resolveCanonicalPlayerId",
    "searchPlayers",
  ]) {
    assert.ok(exported.includes(key), `missing public export: ${key}`);
  }
});

test("1B INVALID — empty auth user id", () => {
  const result = resolveByAuthUser("");
  assert.equal(result.ok, true);
  assert.equal(result.outcome, RESOLUTION_OUTCOME.INVALID);
  assert.equal(result.playerId, null);
  assert.equal(result.meta.selectable, false);
});

test("1B INVALID — empty player reference", () => {
  const result = resolveCanonicalPlayerId(null);
  assert.equal(result.outcome, RESOLUTION_OUTCOME.INVALID);
});

test("1B INVALID — route alias athlete-* without link", () => {
  const result = resolveCanonicalPlayerId("athlete-abc");
  assert.equal(result.outcome, RESOLUTION_OUTCOME.INVALID);
});

test("1B MAPPED — profiles.player_id valid in directory", () => {
  const result = resolveByAuthUser("auth-1", {
    profile: { id: "auth-1", player_id: "player-1", display_name: "Ada" },
    findPlayerById: directory({ "player-1": { id: "player-1", name: "Ada", gender: "Nữ" } }),
  });
  assert.equal(result.outcome, RESOLUTION_OUTCOME.MAPPED);
  assert.equal(result.playerId, "player-1");
  assert.equal(result.meta.selectable, true);
});

test("1B DERIVED — player-auth-{authUserId} confirmed in directory", () => {
  const authUserId = "auth-9";
  const derived = buildDerivedAuthPlayerId(authUserId);

  const result = resolveByAuthUser(authUserId, {
    profile: { id: authUserId, player_id: null, display_name: "Zoe" },
    findPlayerById: directory({ [derived]: { id: derived, name: "Zoe" } }),
  });
  assert.equal(result.outcome, RESOLUTION_OUTCOME.DERIVED);
  assert.equal(result.playerId, derived);
});

test("1B UNMAPPED — valid auth user, no safe mapping", () => {
  const result = resolveByAuthUser("auth-x", {
    profile: { id: "auth-x", player_id: null },
    findPlayerById: directory({}),
  });
  assert.equal(result.outcome, RESOLUTION_OUTCOME.UNMAPPED);
  assert.equal(result.playerId, null);
  assert.ok(result.warnings.includes("UNMAPPED_ACTIVE_MEMBER"));
});

test("1B INVALID mapping — profiles.player_id points to missing player", () => {
  const result = resolveByAuthUser("auth-1", {
    profile: { id: "auth-1", player_id: "missing-player" },
    findPlayerById: directory({}),
  });
  assert.equal(result.outcome, RESOLUTION_OUTCOME.INVALID);
  assert.ok(result.warnings.includes("INVALID_PLAYER_MAPPING"));
});

test("1B AMBIGUOUS — conflicting candidate player ids; no silent first-match", () => {
  const authUserId = "auth-dup";
  const derived = buildDerivedAuthPlayerId(authUserId);
  const result = resolveByAuthUser(authUserId, {
    profile: { id: authUserId, player_id: "player-A", display_name: "Dup" },
    findPlayerById: directory({
      "player-A": { id: "player-A", name: "A" },
      [derived]: { id: derived, name: "B" },
    }),
    candidatePlayerIds: ["player-A", derived],
  });

  assert.equal(result.outcome, RESOLUTION_OUTCOME.AMBIGUOUS);
  assert.equal(result.playerId, null);
  assert.equal(result.meta.selectable, false);
  assert.ok(result.candidatePlayerIds.includes("player-A"));
  assert.ok(result.candidatePlayerIds.includes(derived));
  // Must not silently return the first candidate
  assert.notEqual(result.playerId, result.candidatePlayerIds[0]);
});

test("1B AMBIGUOUS — two blob players for same auth user", () => {
  const authUserId = "auth-two-blob";
  const result = resolveByAuthUser(authUserId, {
    profile: { id: authUserId, player_id: null },
    findPlayerById: directory({}),
    clubId: "club-1",
    sourceRepository: {
      makeFindPlayerById: () => directory({}),
      listBlobPlayersForAuthUser: () => [
        { playerId: "blob-1", authUserId, displayName: "One" },
        { playerId: "blob-2", authUserId, displayName: "Two" },
      ],
      getProfile: async () => null,
      getAthleteByUserId: async () => null,
      getAthleteById: async () => null,
      getBlobPlayer: () => null,
    },
  });

  assert.equal(result.outcome, RESOLUTION_OUTCOME.AMBIGUOUS);
  assert.deepEqual(result.candidatePlayerIds.sort(), ["blob-1", "blob-2"]);
  assert.equal(result.playerId, null);
});

test("1B gender normalization — legacy labels via normalizePlayerProfile", () => {
  assert.equal(normalizePlayerProfile({ gender: "Nam" }).gender, "male");
  assert.equal(normalizePlayerProfile({ gender: "Nữ" }).gender, "female");
  assert.equal(normalizePlayerProfile({ gender: "M" }).gender, "male");
  assert.equal(normalizePlayerProfile({ gender: "F" }).gender, "female");
  assert.equal(normalizePlayerProfile({ gender: "other" }).gender, "unknown");
  assert.equal(normalizePlayerProfile({ gender: "Khác" }).gender, "unknown");
  // Empty gender string → no invented gender (null), not forced unknown
  assert.equal(normalizePlayerProfile({ gender: "" }).gender, null);
});

test("1B normalized profile — missing optional fields stay null (no invented data)", () => {
  const profile = normalizePlayerProfile({
    playerId: "player-1",
    displayName: "Lan",
    gender: "Nam",
  });
  assert.equal(profile.playerId, "player-1");
  assert.equal(profile.displayName, "Lan");
  assert.equal(profile.gender, "male");
  assert.equal(profile.birthDate, null);
  assert.equal(profile.handedness, null);
  assert.equal(profile.activityRegion, null);
  assert.equal(profile.privacySettings, null);
  assert.equal(profile.verificationStatus, null);
  assert.equal(profile.email, null);
});

test("1B getPlayerProfile — MAPPED loads normalized profile with gender adapter", () => {
  const result = getPlayerProfile("player-1", {
    findPlayerById: directory({
      "player-1": { id: "player-1", name: "Lan", gender: "Nữ", phone: "090" },
    }),
    profile: {
      id: "auth-1",
      player_id: "player-1",
      display_name: "Lan",
      email: "lan@example.com",
      status: "active",
    },
  });
  assert.equal(result.outcome, RESOLUTION_OUTCOME.MAPPED);
  assert.ok(result.profile);
  assert.equal(result.profile.gender, "female");
  assert.equal(result.profile.phone, "090");
  assert.equal(result.profile.email, "lan@example.com");
  assert.equal(result.profile.birthDate, null);
  assert.equal(result.profile.handedness, null);
});

test("1B getPlayerProfile — AMBIGUOUS returns null profile", () => {
  const authUserId = "auth-amb";
  const derived = buildDerivedAuthPlayerId(authUserId);
  const result = getPlayerProfile(derived, {
    profile: { id: authUserId, player_id: "other-player" },
    findPlayerById: directory({
      [derived]: { id: derived, name: "A" },
      "other-player": { id: "other-player", name: "B" },
    }),
    candidatePlayerIds: [derived, "other-player"],
  });
  assert.equal(result.outcome, RESOLUTION_OUTCOME.AMBIGUOUS);
  assert.equal(result.profile, null);
});

test("1B write surface not part of public API", () => {
  assert.equal("createPlayerProfile" in playerPublicApi, false);
  assert.equal("deletePlayerProfile" in playerPublicApi, false);
  assert.equal("adaptProfileRow" in playerPublicApi, false);
  assert.equal("createPlayerSourceRepository" in playerPublicApi, false);
  assert.equal("buildAuthLinkedPlayerId" in playerPublicApi, false);
  // Phase 1C adds the single approved write export:
  assert.equal("updatePlayerProfile" in playerPublicApi, true);
});

test("1B searchPlayers — read-only filter over injected roster", () => {
  const result = searchPlayers(
    { query: "lan", gender: "Nữ" },
    {
      mode: "internal",
      players: [
        { id: "p1", name: "Lan", gender: "Nữ" },
        { id: "p2", name: "Nam A", gender: "Nam" },
        { id: "p3", name: "Lan 2", gender: "female" },
      ],
    }
  );
  assert.equal(result.ok, true);
  assert.equal(result.meta.readOnly, true);
  assert.equal(result.meta.mode, "internal");
  assert.equal(result.data.length, 2);
  assert.ok(result.data.every((p) => p.gender === "female"));
});

test("1B compatibility — existing canonical resolvePlayerForProfile unchanged", () => {
  const { record, warning } = resolvePlayerForProfile(
    { id: "u1", player_id: "player-1", display_name: "A" },
    { findPlayerById: () => ({ id: "player-1", name: "A" }) }
  );
  assert.equal(record.mappingStatus, MAPPING_STATUS.MAPPED);
  assert.equal(warning, null);

  const derived = buildDerivedAuthPlayerId("auth-9");
  const derivedResult = resolvePlayerForProfile(
    { id: "auth-9", player_id: null },
    { findPlayerById: (id) => (id === derived ? { id: derived, name: "Z" } : null) }
  );
  assert.equal(derivedResult.record.mappingStatus, MAPPING_STATUS.DERIVED);
});
