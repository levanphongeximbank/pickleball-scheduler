/**
 * Real-browser captain lineup gender pipeline.
 *
 * Reproduces PR #418 owner retest: options filter correctly (F01/F05, M04/M05)
 * while validateLineupSelections still failed closed on
 * c412a101-…0009 (TT412-SEED-F01) via a club-shaped playerMap hit
 * (displayName, no name, gender null).
 *
 * Contract: ONE CAPTAIN_PORTAL_SCOPED_ROSTER pool feeds options + validator.
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
  preserveCaptainPortalRosterAthletes,
  resolveCaptainLineupAthletePool,
} from "../src/features/team-tournament/engines/captainPortalRosterProjection.js";
import { findTeamForCaptain } from "../src/features/team-tournament/engines/teamPermissionEngine.js";
import { getTeamData } from "../src/features/team-tournament/engines/teamTournamentEngine.js";
import { mapTournamentToAggregate } from "../src/features/team-tournament/repositories/teamTournamentRepositoryAggregate.js";
import { aggregateToTournamentView } from "../src/features/team-tournament/ui/teamTournamentUiOrchestrator.js";
import { filterEligiblePlayersForLineupSlot } from "../src/features/team-tournament/engines/lineupOptionFilter.js";
import { applyCanonicalMlpDisciplineMetadata } from "../src/features/team-tournament/engines/mlpDisciplineSlotContract.js";
import { validateLineupSelections } from "../src/features/team-tournament/engines/lineupValidationEngine.js";
import { mapCaptainPortalResponse } from "../src/features/team-tournament/repositories/mapCaptainPortalResponse.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const M04 = "c412a101-7e57-4000-8000-000000000004";
const M05 = "c412a101-7e57-4000-8000-000000000005";
const F01 = "c412a101-7e57-4000-8000-000000000009";
const F05 = "c412a101-7e57-4000-8000-00000000000d";
const TEAM_ID = "team-hfpuyf7a";

const PORTAL_ROSTER = [
  { athleteId: M04, displayName: "TT412-SEED-M04", gender: "male" },
  { athleteId: M05, displayName: "TT412-SEED-M05", gender: "male" },
  { athleteId: F01, displayName: "TT412-SEED-F01", gender: "female" },
  { athleteId: F05, displayName: "TT412-SEED-F05", gender: "female" },
];

function idsOf(list) {
  return list.map((p) => String(p.id)).sort();
}

function readSrc(rel) {
  return readFileSync(join(root, rel), "utf8");
}

/**
 * Real club athlete-pool shape seen on Preview: displayName, no `name`,
 * gender null (profiles RLS), plus a slug alias row for the same athlete.
 */
function realBrowserClubPool() {
  return [
    { id: M04, displayName: "TT412-SEED-M04", gender: null },
    { id: M05, displayName: "TT412-SEED-M05", gender: null },
    { id: F01, displayName: "TT412-SEED-F01", gender: null },
    { id: F05, displayName: "TT412-SEED-F05", gender: null },
    {
      id: "qa-tt412-seed-f01",
      athleteId: F01,
      profilePlayerId: "qa-tt412-seed-f01",
      displayName: "TT412-SEED-F01",
      gender: null,
    },
    {
      id: "qa-tt412-seed-f05",
      athleteId: F05,
      profilePlayerId: "qa-tt412-seed-f05",
      displayName: "TT412-SEED-F05",
      gender: null,
    },
    {
      id: "qa-tt412-seed-m04",
      athleteId: M04,
      profilePlayerId: "qa-tt412-seed-m04",
      displayName: "TT412-SEED-M04",
      gender: null,
    },
    {
      id: "qa-tt412-seed-m05",
      athleteId: M05,
      profilePlayerId: "qa-tt412-seed-m05",
      displayName: "TT412-SEED-M05",
      gender: null,
    },
  ];
}

function captainPortalPayload() {
  return {
    ok: true,
    schemaVersion: 7,
    captainAccessEnabled: true,
    viewerTeamId: TEAM_ID,
    viewer: { captain: true, viewerTeamId: TEAM_ID },
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
        id: TEAM_ID,
        name: "Đội 1",
        captainPlayerId: M04,
        playerIds: [M04, M05, F01, F05],
        rosterAthletes: PORTAL_ROSTER,
      },
      opponentTeams: [{ id: "team-4zql081i", name: "Đội 2" }],
      disciplines: [
        { id: "disc-t6d3zebc", name: "Đôi nam", playerCount: 2, sortOrder: 1, genderRequirement: "any", categoryType: "doubles" },
        { id: "disc-0ot1sc1m", name: "Đôi nữ", playerCount: 2, sortOrder: 2, genderRequirement: "any", categoryType: "doubles" },
        { id: "disc-05t8iukv", name: "Đôi nam nữ", playerCount: 2, sortOrder: 3, genderRequirement: "any", categoryType: "doubles" },
        { id: "disc-cphujcgs", name: "Đôi nam nữ", playerCount: 2, sortOrder: 4, genderRequirement: "any", categoryType: "doubles" },
      ],
      matchups: [
        {
          id: "matchup-69c68xxv",
          teamAId: "team-4zql081i",
          teamBId: TEAM_ID,
          status: "lineup_open",
        },
      ],
      lineups: {},
    },
  };
}

function loadPortalTeamData() {
  const mapped = mapCaptainPortalResponse(captainPortalPayload());
  assert.equal(mapped.ok, true);
  const aggregate = mapTournamentToAggregate(mapped.tournament, "cloud");
  const tournament = aggregateToTournamentView(aggregate);
  const teamData = applyCanonicalMlpDisciplineMetadata(getTeamData(tournament));
  const captainTeam = findTeamForCaptain(teamData, M04);
  assert.ok(captainTeam);
  return { teamData, captainTeam };
}

function completeSelections(teamData) {
  const female = teamData.disciplines.find((d) => d.genderRequirement === GENDER_REQUIREMENT.FEMALE);
  const male = teamData.disciplines.find((d) => d.genderRequirement === GENDER_REQUIREMENT.MALE);
  const mixed = teamData.disciplines.filter((d) => d.genderRequirement === GENDER_REQUIREMENT.MIXED_PAIR);
  return {
    female,
    male,
    mixed,
    selections: {
      [female.id]: [F01, F05],
      [male.id]: [M04, M05],
      [mixed[0].id]: [M04, F01],
      [mixed[1].id]: [M05, F05],
    },
  };
}

function genderOf(pool, id) {
  const row = (pool || []).find(
    (p) => String(p.id) === id || String(p.athleteId) === id
  );
  return getPlayerGenderKey(row);
}

function assertCompleteLineupPass(teamData, team, clubPlayers) {
  const formPool = resolveCaptainLineupAthletePool({
    team,
    teamData,
    teamId: team?.id || TEAM_ID,
    clubPlayers,
  });
  assert.equal(genderOf(formPool, F01), "female", "F01 gender at form pool");
  assert.equal(genderOf(formPool, F05), "female", "F05 gender at form pool");
  assert.equal(genderOf(formPool, M04), "male", "M04 gender at form pool");
  assert.equal(genderOf(formPool, M05), "male", "M05 gender at form pool");
  assert.ok(
    formPool.every(
      (row) =>
        !PORTAL_ROSTER.some((r) => r.athleteId === String(row.id || row.athleteId)) ||
        row.genderSource === CAPTAIN_PORTAL_SCOPED_ROSTER
    )
  );

  const { female, male, mixed, selections } = completeSelections(teamData);
  assert.deepEqual(
    idsOf(
      filterEligiblePlayersForLineupSlot({
        team,
        discipline: female,
        players: formPool,
        selections: {},
        slotIndex: 0,
        allowReuse: true,
        teamData,
      })
    ),
    [F01, F05].sort()
  );
  assert.deepEqual(
    idsOf(
      filterEligiblePlayersForLineupSlot({
        team,
        discipline: male,
        players: formPool,
        selections: {},
        slotIndex: 0,
        allowReuse: true,
        teamData,
      })
    ),
    [M04, M05].sort()
  );
  assert.deepEqual(
    idsOf(
      filterEligiblePlayersForLineupSlot({
        team,
        discipline: mixed[0],
        players: formPool,
        selections: {},
        slotIndex: 0,
        allowReuse: true,
        teamData,
      })
    ),
    [M04, M05].sort()
  );
  assert.deepEqual(
    idsOf(
      filterEligiblePlayersForLineupSlot({
        team,
        discipline: mixed[0],
        players: formPool,
        selections: {},
        slotIndex: 1,
        allowReuse: true,
        teamData,
      })
    ),
    [F01, F05].sort()
  );

  const result = validateLineupSelections({
    teamData,
    team,
    teamId: TEAM_ID,
    selections,
    players: formPool,
  });
  assert.equal(result.ok, true, result.errors?.join(" ") || result.error);
  return { formPool, result };
}

describe("captain lineup gender pipeline — real browser shape", () => {
  it("portal payload → map → teamData → form pool → validate PASS", () => {
    const { teamData, captainTeam } = loadPortalTeamData();
    const f01Roster = (captainTeam.rosterAthletes || []).find((r) => r.athleteId === F01);
    assert.equal(f01Roster?.gender, "female");
    assert.equal(f01Roster?.displayName, "TT412-SEED-F01");

    const clubPlayers = realBrowserClubPool();
    const { formPool } = assertCompleteLineupPass(teamData, captainTeam, clubPlayers);
    const f01 = formPool.find((p) => String(p.id) === F01 || String(p.athleteId) === F01);
    assert.equal(String(f01.id), F01);
    assert.equal(getPlayerGenderKey(f01), "female");
    assert.equal(f01.genderSource, CAPTAIN_PORTAL_SCOPED_ROSTER);
  });

  it("selected UUID 0009 resolves to scoped female even when club exact-hit is nameless/null", () => {
    const { teamData, captainTeam } = loadPortalTeamData();
    const clubPlayers = realBrowserClubPool();
    const formPool = resolveCaptainLineupAthletePool({
      team: captainTeam,
      teamData,
      teamId: TEAM_ID,
      clubPlayers,
    });
    const { female } = completeSelections(teamData);
    const result = validateLineupSelections({
      teamData,
      team: captainTeam,
      teamId: TEAM_ID,
      selections: {
        [female.id]: [F01, F05],
      },
      players: clubPlayers,
      partial: true,
    });
    assert.equal(result.ok, true, result.errors?.join(" ") || result.error);
    const resolved = formPool.find((p) => String(p.id) === F01);
    assert.equal(getPlayerGenderKey(resolved), "female");
    assert.notEqual(String(resolved?.name || ""), F01);
  });

  it("poll / saveDraft / submit get_setup readback without rosterAthletes still validates", () => {
    const { teamData, captainTeam } = loadPortalTeamData();
    const clubPlayers = realBrowserClubPool();
    assertCompleteLineupPass(teamData, captainTeam, clubPlayers);

    const getSetupWipe = {
      ...teamData,
      teams: teamData.teams.map((team) => {
        if (String(team.id) !== TEAM_ID) return { ...team, rosterAthletes: [] };
        const rest = { ...team };
        delete rest.rosterAthletes;
        return { ...rest, playerIds: [M04, M05, F01, F05] };
      }),
    };
    assert.equal(
      (getSetupWipe.teams.find((t) => t.id === TEAM_ID) || {}).rosterAthletes,
      undefined
    );

    for (const label of ["poll", "saveDraft", "submit"]) {
      const preserved = preserveCaptainPortalRosterAthletes(teamData, getSetupWipe);
      const preservedTeam = preserved.teams.find((t) => t.id === TEAM_ID);
      assert.equal(
        preservedTeam?.rosterAthletes?.length,
        4,
        `${label} must keep rosterAthletes`
      );
      assert.equal(
        preservedTeam.rosterAthletes.find((r) => r.athleteId === F01)?.gender,
        "female",
        `${label} F01 gender`
      );
      assertCompleteLineupPass(preserved, preservedTeam, clubPlayers);
    }
  });

  it("card team with roster + teamData without roster still share one scoped pool", () => {
    const { teamData, captainTeam } = loadPortalTeamData();
    const clubPlayers = realBrowserClubPool();
    const strippedTeamData = {
      ...teamData,
      teams: teamData.teams.map((team) => {
        if (String(team.id) !== TEAM_ID) return team;
        const rest = { ...team };
        delete rest.rosterAthletes;
        return rest;
      }),
    };
    const formPool = resolveCaptainLineupAthletePool({
      team: captainTeam,
      teamData: strippedTeamData,
      teamId: TEAM_ID,
      clubPlayers,
    });
    assert.equal(genderOf(formPool, F01), "female");
    const { selections } = completeSelections(strippedTeamData);
    const result = validateLineupSelections({
      teamData: strippedTeamData,
      team: captainTeam,
      teamId: TEAM_ID,
      selections,
      players: clubPlayers,
    });
    assert.equal(result.ok, true, result.errors?.join(" ") || result.error);
  });

  it("source contracts: options + validate share resolveCaptainLineupAthletePool; poll preserves roster", () => {
    const portalSrc = readSrc("src/pages/tournament/TeamPortal.jsx");
    const hookSrc = readSrc("src/features/team-tournament/ui/useTeamTournamentPage.js");
    const validationSrc = readSrc(
      "src/features/team-tournament/engines/lineupValidationEngine.js"
    );
    assert.match(portalSrc, /resolveCaptainLineupAthletePool/);
    assert.match(portalSrc, /players:\s*lineupPlayers/);
    assert.match(portalSrc, /team,\s*\n\s*teamId:\s*team\.id/);
    assert.match(validationSrc, /resolveCaptainLineupAthletePool/);
    assert.match(validationSrc, /resolveRosterMemberIdentity/);
    assert.match(hookSrc, /preserveCaptainPortalRosterAthletes/);
    assert.match(hookSrc, /pageModeRef/);
  });

  it("still fail-closed when scoped roster gender is missing", () => {
    const { teamData } = loadPortalTeamData();
    const team = {
      ...teamData.teams.find((t) => t.id === TEAM_ID),
      rosterAthletes: PORTAL_ROSTER.map((row) => ({
        ...row,
        gender: null,
      })),
    };
    const stripped = {
      ...teamData,
      teams: teamData.teams.map((row) => (row.id === TEAM_ID ? team : row)),
    };
    const { selections } = completeSelections(stripped);
    const result = validateLineupSelections({
      teamData: stripped,
      team,
      teamId: TEAM_ID,
      selections,
      players: realBrowserClubPool(),
    });
    assert.equal(result.ok, false);
    assert.match(String(result.errors?.join(" ") || result.error || ""), /giới tính/i);
  });
});
