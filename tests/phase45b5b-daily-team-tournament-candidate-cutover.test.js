/**
 * PHASE 45B.5B — Daily / Team / Tournament candidate cutover tests.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  loadDailyPlayCandidatePool,
  loadTeamBuilderClubCandidatePool,
  loadTeamBuilderTenantCandidatePool,
  loadTournamentPickerClubCandidatePool,
  loadTournamentPickerTenantCandidatePool,
  toLegacyScreenPickerPlayer,
} from "../src/features/pairing-candidates/index.js";
import { filterTournamentPickerPlayers } from "../src/utils/tournamentPlayerPicker.js";
import { filterPlayersForEventType } from "../src/tournament/engines/teamPairingEngine.js";
import { getPlayerGenderKey } from "../src/models/player.js";
import { EVENT_TYPE } from "../src/models/tournament/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function cloudDeps(extra = {}) {
  return {
    listMembers: async () => ({
      ok: true,
      members: [
        {
          id: "mem-1",
          user_id: "user-1",
          athlete_id: "ath-1",
          display_name: "Cloud One",
          status: "active",
          tenant_id: "tenant-a",
        },
      ],
    }),
    fetchProfiles: async () => ({
      ok: true,
      profiles: [
        {
          id: "user-1",
          player_id: "legacy-1",
          gender: "male",
          display_name: "Cloud One",
        },
      ],
    }),
    fetchAthletes: async () => ({
      ok: true,
      athletes: [
        {
          id: "ath-1",
          user_id: "user-1",
          display_name: "Cloud One",
          status: "active",
          tenant_id: "tenant-a",
        },
      ],
    }),
    ...extra,
  };
}

test("Daily Play discovery uses pairingCandidateService (athletes.id primary)", async () => {
  const result = await loadDailyPlayCandidatePool("club-a", cloudDeps());
  assert.equal(result.ok, true);
  assert.equal(result.players.length, 1);
  assert.equal(result.players[0].id, "ath-1");
  assert.equal(result.players[0].source, "pairing-candidate-gateway");
});

test("Team Builder club discovery — repository error not silent empty", async () => {
  const result = await loadTeamBuilderClubCandidatePool("club-a", {
    listMembers: async () => ({ ok: false, code: "RPC_FAILED", error: "boom" }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.players.length, 0);
  assert.match(result.message, /blob|canonical|boom|tải/i);
});

test("Team Builder tenant discovery merges clubs by athletes.id", async () => {
  const result = await loadTeamBuilderTenantCandidatePool("tenant-a", {
    listClubs: async () => ({
      ok: true,
      clubs: [
        { id: "club-a", name: "Club A" },
        { id: "club-b", name: "Club B" },
      ],
    }),
    listMembers: async (clubId) => ({
      ok: true,
      members: [
        {
          id: `mem-${clubId}`,
          user_id: clubId === "club-a" ? "user-1" : "user-2",
          athlete_id: clubId === "club-a" ? "ath-1" : "ath-2",
          display_name: clubId === "club-a" ? "Alpha" : "Beta",
          status: "active",
          tenant_id: "tenant-a",
        },
      ],
    }),
    fetchProfiles: async (ids) => ({
      ok: true,
      profiles: ids.map((id) => ({
        id,
        player_id: `legacy-${id}`,
        gender: id === "user-1" ? "male" : "female",
        display_name: id,
      })),
    }),
    fetchAthletes: async (ids) => ({
      ok: true,
      athletes: ids.map((id) => ({
        id: id === "user-1" ? "ath-1" : "ath-2",
        user_id: id,
        display_name: id,
        status: "active",
        tenant_id: "tenant-a",
      })),
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.players.length, 2);
  assert.deepEqual(
    result.players.map((p) => p.id).sort(),
    ["ath-1", "ath-2"]
  );
});

test("Tournament picker tenant failure when any club fails", async () => {
  const result = await loadTournamentPickerTenantCandidatePool("tenant-a", {
    listClubs: async () => ({
      ok: true,
      clubs: [
        { id: "club-a", name: "Club A" },
        { id: "club-b", name: "Club B" },
      ],
    }),
    listMembers: async (clubId) => {
      if (clubId === "club-b") {
        return { ok: false, code: "RPC_FAILED", error: "club-b down" };
      }
      return {
        ok: true,
        members: [
          {
            id: "mem-1",
            user_id: "user-1",
            athlete_id: "ath-1",
            display_name: "Alpha",
            status: "active",
          },
        ],
      };
    },
    fetchProfiles: async () => ({
      ok: true,
      profiles: [{ id: "user-1", player_id: "p1", gender: "male" }],
    }),
    fetchAthletes: async () => ({
      ok: true,
      athletes: [{ id: "ath-1", user_id: "user-1", status: "active" }],
    }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.players.length, 0);
  assert.match(String(result.message || ""), /club-b|blob|canonical|tải/i);
});

test("Tournament picker preserves gender/event filters on adapted players", async () => {
  const pool = await loadTournamentPickerClubCandidatePool("club-a", cloudDeps());
  assert.equal(pool.ok, true);
  const filtered = filterTournamentPickerPlayers(pool.players, {
    genderFilter: "male",
    eventType: EVENT_TYPE.MEN_DOUBLE,
  });
  assert.equal(filtered.length, 1);
  assert.equal(getPlayerGenderKey(filtered[0].gender), "male");

  const eventFiltered = filterPlayersForEventType(pool.players, EVENT_TYPE.WOMEN_DOUBLE);
  assert.equal(eventFiltered.length, 0);
});

test("legacy/profile ids remain aliases — primary id is athletes.id", () => {
  const player = toLegacyScreenPickerPlayer({
    pairingIdentityId: "ath-9",
    athleteId: "ath-9",
    displayName: "Nine",
    gender: "female",
    rating: 4,
    athleteStatus: "active",
    clubId: "club-x",
    tenantId: "tenant-x",
    membershipStatus: "active",
    userId: "user-9",
    metadata: {
      profilePlayerId: "profile-legacy",
      legacyPlayerId: "blob-legacy",
      identity: { coverageBucket: "mapped" },
    },
  });
  assert.equal(player.id, "ath-9");
  assert.equal(player.profilePlayerId, "profile-legacy");
  assert.equal(player.legacyPlayerId, "blob-legacy");
  assert.equal(player.mappingStatus, "MAPPED");
  assert.equal(player.sourceClubId, "club-x");
});

test("screens no longer discover via useClubPlayerPool / listPlayersForClubAware / blob", () => {
  const targets = [
    "src/pages/tournament/DailyPlaySetup.jsx",
    "src/pages/tournament/TeamTournamentSetup.jsx",
    "src/pages/tournament/OfficialTournamentSetup.jsx",
    "src/pages/tournament/InternalTournamentSetup.jsx",
    "src/pages/tournament/IndividualRegistrationPage.jsx",
    "src/components/tournament/TeamRosterPanel.jsx",
  ];
  for (const rel of targets) {
    const src = readFileSync(path.join(root, rel), "utf8");
    assert.equal(
      /useClubPlayerPool|useTenantPlayerPool|listPlayersForClubAware|getClubInternalTournamentPlayersAware|getTenantPlayersAware|loadPlayersForClub\b/.test(
        src
      ),
      false,
      `${rel} must not use legacy discovery loaders`
    );
    assert.match(
      src,
      /pairing-candidates|PairingCandidate|CandidatePool|teamTournamentAthletePool|listAvailableAthletes/,
      `${rel} must use pairing candidate gateway or unified TT athlete pool`
    );
  }
});

test("Private Pairing / AI pairing engine files untouched by this phase discovery cutover", () => {
  // Ensure we did not rewrite private pairing picker or AI engines in this phase.
  const privatePicker = readFileSync(
    path.join(root, "src/features/private-pairing-rules/ui/privatePairingPlayerPickerAdapter.js"),
    "utf8"
  );
  assert.equal(privatePicker.includes("loadDailyPlayCandidatePool"), false);
  assert.equal(privatePicker.includes("screenCandidateAdapters"), false);
});
