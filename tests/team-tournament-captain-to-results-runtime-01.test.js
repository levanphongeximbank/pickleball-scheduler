/**
 * Full captain-lineup runtime authority + four-team gender parity.
 * Club/profile RLS pool is NOT eligibility/validation authority.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { getPlayerGenderKey } from "../src/models/player.js";
import {
  FORMAT_PRESET,
  GENDER_REQUIREMENT,
} from "../src/features/team-tournament/constants.js";
import {
  CAPTAIN_PORTAL_SCOPED_ROSTER,
  buildCaptainLineupRuntime,
  preserveCaptainPortalRosterAthletes,
  resolveCaptainLineupAthletePool,
} from "../src/features/team-tournament/engines/captainPortalRosterProjection.js";
import { filterEligiblePlayersForLineupSlot } from "../src/features/team-tournament/engines/lineupOptionFilter.js";
import { applyCanonicalMlpDisciplineMetadata } from "../src/features/team-tournament/engines/mlpDisciplineSlotContract.js";
import { validateLineupSelections } from "../src/features/team-tournament/engines/lineupValidationEngine.js";
import { mapCaptainPortalResponse } from "../src/features/team-tournament/repositories/mapCaptainPortalResponse.js";
import { mapTournamentToAggregate } from "../src/features/team-tournament/repositories/teamTournamentRepositoryAggregate.js";
import { aggregateToTournamentView } from "../src/features/team-tournament/ui/teamTournamentUiOrchestrator.js";
import { getTeamData } from "../src/features/team-tournament/engines/teamTournamentEngine.js";
import { findTeamForCaptain } from "../src/features/team-tournament/engines/teamPermissionEngine.js";
import { getActiveMatchDisciplines } from "../src/features/team-tournament/engines/mlpPresetEngine.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const TEAMS = [
  {
    id: "team-hfpuyf7a",
    name: "Đội 1",
    captain: "c412a101-7e57-4000-8000-000000000004",
    roster: [
      { athleteId: "c412a101-7e57-4000-8000-000000000004", displayName: "TT412-SEED-M04", gender: "male" },
      { athleteId: "c412a101-7e57-4000-8000-000000000005", displayName: "TT412-SEED-M05", gender: "male" },
      { athleteId: "c412a101-7e57-4000-8000-000000000009", displayName: "TT412-SEED-F01", gender: "female" },
      { athleteId: "c412a101-7e57-4000-8000-00000000000d", displayName: "TT412-SEED-F05", gender: "female" },
    ],
  },
  {
    id: "team-4zql081i",
    name: "Đội 2",
    captain: "c412a101-7e57-4000-8000-000000000001",
    roster: [
      { athleteId: "c412a101-7e57-4000-8000-000000000001", displayName: "TT412-SEED-M01", gender: "male" },
      { athleteId: "c412a101-7e57-4000-8000-000000000006", displayName: "TT412-SEED-M06", gender: "male" },
      { athleteId: "c412a101-7e57-4000-8000-00000000000a", displayName: "TT412-SEED-F02", gender: "female" },
      { athleteId: "c412a101-7e57-4000-8000-00000000000e", displayName: "TT412-SEED-F06", gender: "female" },
    ],
  },
  {
    id: "team-svlogkw9",
    name: "Đội 3",
    captain: "c412a101-7e57-4000-8000-000000000003",
    roster: [
      { athleteId: "c412a101-7e57-4000-8000-000000000003", displayName: "TT412-SEED-M03", gender: "male" },
      { athleteId: "c412a101-7e57-4000-8000-000000000007", displayName: "TT412-SEED-M07", gender: "male" },
      { athleteId: "c412a101-7e57-4000-8000-00000000000b", displayName: "TT412-SEED-F03", gender: "female" },
      { athleteId: "c412a101-7e57-4000-8000-00000000000f", displayName: "TT412-SEED-F07", gender: "female" },
    ],
  },
  {
    id: "team-3xnvw71s",
    name: "Đội 4",
    captain: "c412a101-7e57-4000-8000-000000000002",
    roster: [
      { athleteId: "c412a101-7e57-4000-8000-000000000002", displayName: "TT412-SEED-M02", gender: "male" },
      { athleteId: "c412a101-7e57-4000-8000-000000000008", displayName: "TT412-SEED-M08", gender: "male" },
      { athleteId: "c412a101-7e57-4000-8000-00000000000c", displayName: "TT412-SEED-F04", gender: "female" },
      { athleteId: "c412a101-7e57-4000-8000-000000000010", displayName: "TT412-SEED-F08", gender: "female" },
    ],
  },
];

const RULES_V2_ENV = {
  VITE_COMPETITION_CORE_ENABLED: "true",
  VITE_COMPETITION_CORE_RULES_V2_ENABLED: "true",
};

function idsOf(list) {
  return list.map((p) => String(p.id)).sort();
}

function clubNullPool(roster) {
  return roster.flatMap((row) => [
    { id: row.athleteId, displayName: row.displayName, gender: null },
    {
      id: `qa-tt412-seed-${row.displayName.slice(-3).toLowerCase()}`,
      athleteId: row.athleteId,
      displayName: row.displayName,
      gender: null,
    },
  ]);
}

function portalPayload(team) {
  return {
    ok: true,
    schemaVersion: 7,
    captainAccessEnabled: true,
    viewerTeamId: team.id,
    viewer: { captain: true, viewerTeamId: team.id },
    tournament: {
      id: "team-tournament-4zllu71z",
      clubId: "club-ecebf64c78f948ccb2b59842441eb26c",
      tenantId: "venue-staging-a",
      name: "Giải đồng đội",
      status: "draft",
      version: 9,
      settings: {
        captainAccessEnabled: true,
        formatPreset: FORMAT_PRESET.MLP_4,
        dreambreakerEnabled: true,
        allowPlayerReusePerMatchup: true,
      },
      myTeam: {
        id: team.id,
        name: team.name,
        captainPlayerId: team.captain,
        playerIds: team.roster.map((r) => r.athleteId),
        rosterAthletes: team.roster,
      },
      opponentTeams: TEAMS.filter((row) => row.id !== team.id).map((row) => ({
        id: row.id,
        name: row.name,
      })),
      disciplines: [
        { id: "disc-male", name: "Đôi nam", playerCount: 2, sortOrder: 1, genderRequirement: "any", categoryType: "doubles" },
        { id: "disc-female", name: "Đôi nữ", playerCount: 2, sortOrder: 2, genderRequirement: "any", categoryType: "doubles" },
        { id: "disc-mx1", name: "Đôi nam nữ", playerCount: 2, sortOrder: 3, genderRequirement: "any", categoryType: "doubles" },
        { id: "disc-mx2", name: "Đôi nam nữ", playerCount: 2, sortOrder: 4, genderRequirement: "any", categoryType: "doubles" },
      ],
      matchups: [
        {
          id: `matchup-${team.id}`,
          teamAId: team.id,
          teamBId: TEAMS.find((row) => row.id !== team.id).id,
          status: "lineup_open",
        },
      ],
      lineups: {},
    },
  };
}

function loadCaptainRuntime(team) {
  const mapped = mapCaptainPortalResponse(portalPayload(team));
  assert.equal(mapped.ok, true);
  const tournament = aggregateToTournamentView(mapTournamentToAggregate(mapped.tournament, "cloud"));
  const teamData = applyCanonicalMlpDisciplineMetadata(getTeamData(tournament));
  const captainTeam = findTeamForCaptain(teamData, team.captain);
  const runtime = buildCaptainLineupRuntime({
    teamData,
    captainTeam,
    teamId: team.id,
    clubPlayers: clubNullPool(team.roster),
  });
  return { teamData, captainTeam, runtime };
}

function completeSelections(teamData, roster) {
  const female = teamData.disciplines.find((d) => d.genderRequirement === GENDER_REQUIREMENT.FEMALE);
  const male = teamData.disciplines.find((d) => d.genderRequirement === GENDER_REQUIREMENT.MALE);
  const mixed = teamData.disciplines.filter((d) => d.genderRequirement === GENDER_REQUIREMENT.MIXED_PAIR);
  const males = roster.filter((r) => r.gender === "male").map((r) => r.athleteId);
  const females = roster.filter((r) => r.gender === "female").map((r) => r.athleteId);
  return {
    female,
    male,
    mixed,
    selections: {
      [female.id]: [females[0], females[1]],
      [male.id]: [males[0], males[1]],
      [mixed[0].id]: [males[0], females[0]],
      [mixed[1].id]: [males[1], females[1]],
    },
  };
}

describe("captain-to-results runtime authority", () => {
  it("all four #412 teams: portal gender 2M2F, club pool ignored, eligible+validate PASS", () => {
    for (const team of TEAMS) {
      const { teamData, captainTeam, runtime } = loadCaptainRuntime(team);
      assert.equal(runtime.authority, CAPTAIN_PORTAL_SCOPED_ROSTER, team.name);
      assert.equal(runtime.athletePool.length, 4, team.name);
      const males = runtime.athletePool.filter((p) => getPlayerGenderKey(p) === "male");
      const females = runtime.athletePool.filter((p) => getPlayerGenderKey(p) === "female");
      assert.equal(males.length, 2, `${team.name} males`);
      assert.equal(females.length, 2, `${team.name} females`);
      for (const row of team.roster) {
        const poolRow = runtime.athletePool.find((p) => String(p.id) === row.athleteId);
        assert.equal(getPlayerGenderKey(poolRow), row.gender, `${team.name} ${row.displayName}`);
        assert.equal(poolRow.genderSource, CAPTAIN_PORTAL_SCOPED_ROSTER);
      }

      const clubPool = clubNullPool(team.roster);
      const resolved = resolveCaptainLineupAthletePool({
        team: captainTeam,
        teamData,
        teamId: team.id,
        clubPlayers: clubPool,
      });
      assert.ok(resolved.every((p) => p.genderSource === CAPTAIN_PORTAL_SCOPED_ROSTER));
      assert.ok(!resolved.some((p) => p.gender == null));

      const { female, male, mixed, selections } = completeSelections(teamData, team.roster);
      assert.deepEqual(
        idsOf(filterEligiblePlayersForLineupSlot({
          team: runtime.team,
          discipline: female,
          players: runtime.athletePool,
          selections: {},
          slotIndex: 0,
          allowReuse: true,
          teamData,
        })),
        females.map((p) => String(p.id)).sort()
      );
      assert.deepEqual(
        idsOf(filterEligiblePlayersForLineupSlot({
          team: runtime.team,
          discipline: male,
          players: runtime.athletePool,
          selections: {},
          slotIndex: 0,
          allowReuse: true,
          teamData,
        })),
        males.map((p) => String(p.id)).sort()
      );
      assert.deepEqual(
        idsOf(filterEligiblePlayersForLineupSlot({
          team: runtime.team,
          discipline: mixed[0],
          players: runtime.athletePool,
          selections: {},
          slotIndex: 0,
          allowReuse: true,
          teamData,
        })),
        males.map((p) => String(p.id)).sort()
      );
      assert.deepEqual(
        idsOf(filterEligiblePlayersForLineupSlot({
          team: runtime.team,
          discipline: mixed[0],
          players: runtime.athletePool,
          selections: {},
          slotIndex: 1,
          allowReuse: true,
          teamData,
        })),
        females.map((p) => String(p.id)).sort()
      );

      const result = validateLineupSelections({
        teamData,
        team: runtime.team,
        teamId: team.id,
        selections,
        players: clubPool,
      });
      assert.equal(result.ok, true, `${team.name} ${result.errors?.join(" ") || result.error}`);

      const v2 = validateLineupSelections({
        teamData,
        team: runtime.team,
        teamId: team.id,
        selections,
        players: clubPool,
        envSource: RULES_V2_ENV,
      });
      assert.equal(v2.ok, true, `${team.name} rulesV2 ${v2.errors?.join(" ") || v2.error}`);

      const wiped = {
        ...teamData,
        teams: teamData.teams.map((row) => {
          if (String(row.id) !== team.id) return row;
          const copy = { ...row };
          delete copy.rosterAthletes;
          return copy;
        }),
      };
      const preserved = preserveCaptainPortalRosterAthletes(teamData, wiped);
      const preservedRuntime = buildCaptainLineupRuntime({
        teamData: preserved,
        captainTeam: preserved.teams.find((row) => row.id === team.id),
        teamId: team.id,
        clubPlayers: clubPool,
      });
      assert.equal(preservedRuntime.authority, CAPTAIN_PORTAL_SCOPED_ROSTER, `${team.name} readback`);
      const afterReadback = validateLineupSelections({
        teamData: preserved,
        team: preservedRuntime.team,
        teamId: team.id,
        selections,
        players: clubPool,
      });
      assert.equal(afterReadback.ok, true, `${team.name} readback validate`);
    }
  });

  it("source contracts: one lineup runtime + debug flag + no club pool on lineup cards", () => {
    const src = readFileSync(join(root, "src/pages/tournament/TeamPortal.jsx"), "utf8");
    const validatorSrc = readFileSync(
      join(root, "src/features/team-tournament/engines/lineupValidationEngine.js"),
      "utf8"
    );
    assert.match(src, /buildCaptainLineupRuntime/);
    assert.match(src, /ttLineupDebug/);
    assert.match(src, /players=\{lineupPlayers\}/);
    assert.match(src, /pageMode:\s*"captainPortal"/);
    assert.match(validatorSrc, /MLP slot\/reuse\/participation is TT format authority/);
    assert.doesNotMatch(
      readFileSync(
        join(root, "src/features/competition-core/constraints/adapters/teamTournamentRulesBridge.js"),
        "utf8"
      ),
      /genderOnlyOverlay/
    );
    const active = getActiveMatchDisciplines([
      { id: "a", name: "Đôi nam", playerCount: 2, genderRequirement: GENDER_REQUIREMENT.MALE },
      { id: "b", name: "Đôi nữ", playerCount: 2, genderRequirement: GENDER_REQUIREMENT.FEMALE },
      { id: "c", name: "Đôi nam nữ", playerCount: 2, genderRequirement: GENDER_REQUIREMENT.MIXED_PAIR },
      { id: "d", name: "Đôi nam nữ", playerCount: 2, genderRequirement: GENDER_REQUIREMENT.MIXED_PAIR },
      { id: "e", name: "Dreambreaker", playerCount: 4, disciplineKind: "dreambreaker", activationRule: "dreambreaker" },
    ]);
    assert.equal(active.length, 4);
  });
});
