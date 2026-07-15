/**
 * PHASE 45B.5A — SelectPlayers canonical candidate cutover tests.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  loadSelectPlayersCandidatePool,
  toLegacySelectPlayersPlayer,
  listSelectPlayersScopeRows,
} from "../src/features/pairing-candidates/index.js";
import {
  getEligiblePlayersForCompetition,
} from "../src/ai/competition.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function member({
  id = "mem-1",
  user_id = "user-1",
  athlete_id = "ath-1",
  display_name = "Cloud Athlete",
  status = "active",
} = {}) {
  return { id, user_id, athlete_id, display_name, status, tenant_id: "tenant-a" };
}

test("cloud athletes appear even when blob roster would be empty", async () => {
  const result = await loadSelectPlayersCandidatePool("club-a", {
    listMembers: async () => ({ ok: true, members: [member()] }),
    fetchProfiles: async () => ({
      ok: true,
      profiles: [{ id: "user-1", player_id: "legacy-blob-id", gender: "male", display_name: "Cloud Athlete" }],
    }),
    fetchAthletes: async () => ({
      ok: true,
      athletes: [{ id: "ath-1", user_id: "user-1", display_name: "Cloud Athlete", status: "active" }],
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.players.length, 1);
  assert.equal(result.players[0].id, "ath-1");
  assert.equal(result.players[0].name, "Cloud Athlete");
  assert.equal(result.players[0].source, "pairing-candidate-gateway");
});

test("missing membership is reported (athlete without membership row)", async () => {
  // Force empty members → empty candidates with ready status / empty message,
  // and separately verify MISSING_MEMBERSHIP via scope+service inject with orphan athlete.
  const { createPairingCandidateService } = await import(
    "../src/features/pairing-candidates/index.js"
  );
  const { PAIRING_CANDIDATE_REASON_CODES } = await import(
    "../src/features/pairing-candidates/index.js"
  );

  const service = createPairingCandidateService({
    listScopeRows: async () => ({
      ok: true,
      rows: [
        {
          athleteId: "ath-orphan",
          userId: "user-orphan",
          displayName: "Orphan",
          gender: "male",
          athleteStatus: "active",
          membershipId: null,
          membershipStatus: null,
          clubId: "club-a",
        },
      ],
      sourceBreakdown: { athleteRows: 1, membershipRows: 0, activeMembershipRows: 0 },
    }),
  });

  const gateway = await service.listCandidates({ clubId: "club-a" });
  assert.equal(gateway.candidates.length, 0);
  assert.equal(gateway.excluded[0].reasonCode, PAIRING_CANDIDATE_REASON_CODES.MISSING_MEMBERSHIP);

  const pool = await loadSelectPlayersCandidatePool("club-a", { service });
  assert.equal(pool.ok, true);
  assert.equal(pool.empty, true);
  assert.match(pool.message, /MISSING_MEMBERSHIP|Không có/);
  assert.deepEqual(pool.players, []);
});

test("repository error is not rendered as 0 athletes success", async () => {
  const result = await loadSelectPlayersCandidatePool("club-a", {
    listMembers: async () => ({
      ok: false,
      code: "RPC_FAILED",
      error: "boom",
    }),
  });
  assert.equal(result.ok, false);
  assert.notEqual(result.code, "NO_ELIGIBLE_CANDIDATES");
  assert.match(String(result.message), /boom|canonical|thành viên|Không tải/i);
  assert.deepEqual(result.players, []);
});

test("legacy/profile ids are aliases only — primary id is athleteId", () => {
  const player = toLegacySelectPlayersPlayer({
    athleteId: "ath-9",
    pairingIdentityId: "ath-9",
    displayName: "Alias User",
    gender: "female",
    rating: 4,
    athleteStatus: "active",
    clubId: "club-a",
    userId: "user-9",
    metadata: {
      profilePlayerId: "player-legacy-9",
      legacyPlayerId: "blob-9",
      selectable: true,
    },
  });
  assert.equal(player.id, "ath-9");
  assert.equal(player.athleteId, "ath-9");
  assert.equal(player.profilePlayerId, "player-legacy-9");
  assert.equal(player.legacyPlayerId, "blob-9");
  assert.notEqual(player.id, player.profilePlayerId);
  assert.notEqual(player.id, player.legacyPlayerId);
});

test("current gender filters still work on adapted players", async () => {
  const result = await loadSelectPlayersCandidatePool("club-a", {
    listMembers: async () => ({
      ok: true,
      members: [
        member({ id: "m1", user_id: "u1", athlete_id: "a1", display_name: "Nam A" }),
        member({ id: "m2", user_id: "u2", athlete_id: "a2", display_name: "Nữ B" }),
      ],
    }),
    fetchProfiles: async () => ({
      ok: true,
      profiles: [
        { id: "u1", gender: "male", player_id: null },
        { id: "u2", gender: "female", player_id: null },
      ],
    }),
    fetchAthletes: async () => ({
      ok: true,
      athletes: [
        { id: "a1", user_id: "u1", display_name: "Nam A", status: "active" },
        { id: "a2", user_id: "u2", display_name: "Nữ B", status: "active" },
      ],
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.players.length, 2);
  const men = getEligiblePlayersForCompetition(result.players, "doubles_men");
  const women = getEligiblePlayersForCompetition(result.players, "doubles_women");
  assert.equal(men.length, 1);
  assert.equal(men[0].id, "a1");
  assert.equal(women.length, 1);
  assert.equal(women[0].id, "a2");
});

test("profiles fetch failure does not silently become empty athletes", async () => {
  const result = await loadSelectPlayersCandidatePool("club-a", {
    listMembers: async () => ({ ok: true, members: [member()] }),
    fetchProfiles: async () => ({
      ok: false,
      code: "PROFILES_READ_FAILED",
      error: "profiles down",
    }),
    fetchAthletes: async () => ({ ok: true, athletes: [] }),
  });
  assert.equal(result.ok, false);
  assert.match(String(result.message), /profiles down|profiles/i);
  assert.deepEqual(result.players, []);
});

test("SelectPlayers.jsx no longer discovers via loadPlayersFromStorage", () => {
  const src = readFileSync(path.join(root, "src/pages/SelectPlayers.jsx"), "utf8");
  assert.equal(src.includes("loadPlayersFromStorage"), false);
  assert.equal(src.includes("loadSelectPlayersCandidatePool"), true);
  assert.equal(src.includes("loadPlayersForClub"), false);
});

test("listSelectPlayersScopeRows maps membership athlete_id without blob", async () => {
  const scope = await listSelectPlayersScopeRows("club-a", {
    listMembers: async () => ({ ok: true, members: [member()] }),
    fetchProfiles: async () => ({
      ok: true,
      profiles: [{ id: "user-1", gender: "male", player_id: "p1" }],
    }),
    fetchAthletes: async () => ({
      ok: true,
      athletes: [{ id: "ath-1", user_id: "user-1", status: "active", display_name: "Cloud Athlete" }],
    }),
  });
  assert.equal(scope.ok, true);
  assert.equal(scope.rows[0].athleteId, "ath-1");
  assert.equal(scope.rows[0].legacyPlayerId, null);
  assert.equal(scope.rows[0].profilePlayerId, "p1");
});
