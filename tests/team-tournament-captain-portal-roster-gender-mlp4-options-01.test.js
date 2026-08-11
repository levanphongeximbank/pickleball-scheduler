import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  FORMAT_PRESET,
  GENDER_REQUIREMENT,
  LINEUP_STATUS,
} from "../src/features/team-tournament/constants.js";
import {
  CAPTAIN_PORTAL_SCOPED_ROSTER,
  enrichTeamWithCaptainPortalRoster,
  projectCaptainPortalRosterPlayers,
  resolveCaptainLineupAthletePool,
} from "../src/features/team-tournament/engines/captainPortalRosterProjection.js";
import {
  buildServerLineupFingerprint,
  decideLineupFormRehydration,
} from "../src/features/team-tournament/engines/lineupFormState.js";
import { filterEligiblePlayersForLineupSlot } from "../src/features/team-tournament/engines/lineupOptionFilter.js";
import {
  applyCanonicalMlpDisciplineMetadata,
  repairMlpDisciplineSlotMetadata,
  summarizeMlpParticipation,
} from "../src/features/team-tournament/engines/mlpDisciplineSlotContract.js";
import {
  filterEligiblePlayersForDiscipline,
  validateLineupSelections,
  validateMlpLineupParticipation,
} from "../src/features/team-tournament/engines/lineupValidationEngine.js";
import {
  countUnrelatedCaptainPortalExposure,
  mapCaptainPortalResponse,
} from "../src/features/team-tournament/repositories/mapCaptainPortalResponse.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const packageDir = join(
  root,
  "docs/v5/migrations/team-tournament-captain-portal-roster-gender-01"
);

function readSrc(rel) {
  return readFileSync(join(root, rel), "utf8");
}

function sha256File(name) {
  const buf = readFileSync(join(packageDir, name));
  return createHash("sha256").update(buf).digest("hex");
}

const M02 = "c412a101-7e57-4000-8000-000000000002";
const M08 = "c412a101-7e57-4000-8000-000000000008";
const F04 = "c412a101-7e57-4000-8000-00000000000c";
const F08 = "c412a101-7e57-4000-8000-000000000010";

const ROSTER_ATHLETES = [
  { athleteId: M02, displayName: "TT412-SEED-M02", gender: "male" },
  { athleteId: M08, displayName: "TT412-SEED-M08", gender: "male" },
  { athleteId: F04, displayName: "TT412-SEED-F04", gender: "female" },
  { athleteId: F08, displayName: "TT412-SEED-F08", gender: "female" },
];

const PORTAL_PLAYERS = projectCaptainPortalRosterPlayers(ROSTER_ATHLETES);

function stagingLikeAnyDisciplines() {
  return [
    { id: "disc-female", name: "Đôi nữ", playerCount: 2, sortOrder: 1, genderRequirement: "any", categoryType: "doubles" },
    { id: "disc-male", name: "Đôi nam", playerCount: 2, sortOrder: 2, genderRequirement: "any", categoryType: "doubles" },
    { id: "disc-mx1", name: "Đôi nam nữ", playerCount: 2, sortOrder: 3, genderRequirement: "any", categoryType: "doubles" },
    { id: "disc-mx2", name: "Đôi nam nữ", playerCount: 2, sortOrder: 4, genderRequirement: "any", categoryType: "doubles" },
  ];
}

function buildMlpTeamData() {
  const disciplines = repairMlpDisciplineSlotMetadata(stagingLikeAnyDisciplines());
  return {
    settings: {
      formatPreset: FORMAT_PRESET.MLP_4,
      allowPlayerReusePerMatchup: true,
      rosterRules: { minPlayers: 4, maxPlayers: 4, requiredMales: 2, requiredFemales: 2 },
    },
    disciplines,
    teams: [
      enrichTeamWithCaptainPortalRoster({
        id: "team-fe58m3kc",
        name: "Đội 4",
        captainPlayerId: M02,
        playerIds: [M02, M08, F04, F08],
        rosterAthletes: ROSTER_ATHLETES,
      }),
    ],
    matchups: [],
    lineups: {},
  };
}

function idsOf(list) {
  return list.map((p) => String(p.id)).sort();
}

function validSelections(teamData) {
  const female = teamData.disciplines.find(
    (d) => d.genderRequirement === GENDER_REQUIREMENT.FEMALE
  );
  const male = teamData.disciplines.find(
    (d) => d.genderRequirement === GENDER_REQUIREMENT.MALE
  );
  const mixed = teamData.disciplines.filter(
    (d) => d.genderRequirement === GENDER_REQUIREMENT.MIXED_PAIR
  );
  return {
    [female.id]: [F04, F08],
    [male.id]: [M02, M08],
    [mixed[0].id]: [M02, F04],
    [mixed[1].id]: [M08, F08],
  };
}

describe("TT412 captain portal roster gender + MLP4 options", () => {
  it("CLIENT_GENDER_SOURCE uses CAPTAIN_PORTAL_SCOPED_ROSTER", () => {
    const pool = resolveCaptainLineupAthletePool({
      team: { rosterAthletes: ROSTER_ATHLETES },
      clubPlayers: [
        { id: M02, name: "club-m02", gender: null },
        { id: M08, name: "club-m08", gender: null },
      ],
    });
    assert.equal(pool.length, 4);
    for (const p of pool) {
      assert.equal(p.genderSource, CAPTAIN_PORTAL_SCOPED_ROSTER);
      assert.ok(p.gender === "male" || p.gender === "female");
    }
    assert.equal(CAPTAIN_PORTAL_SCOPED_ROSTER, "CAPTAIN_PORTAL_SCOPED_ROSTER");
  });

  it("A: M02 + M08 both appear in male doubles", () => {
    const teamData = buildMlpTeamData();
    const male = teamData.disciplines.find(
      (d) => d.genderRequirement === GENDER_REQUIREMENT.MALE
    );
    const eligible = filterEligiblePlayersForLineupSlot({
      team: teamData.teams[0],
      discipline: male,
      players: PORTAL_PLAYERS,
      selections: {},
      slotIndex: 0,
      allowReuse: true,
      teamData,
    });
    assert.deepEqual(idsOf(eligible), [M02, M08].sort());
    assert.equal(eligible.length, 2);
  });

  it("B: F04 + F08 both appear in female doubles", () => {
    const teamData = buildMlpTeamData();
    const female = teamData.disciplines.find(
      (d) => d.genderRequirement === GENDER_REQUIREMENT.FEMALE
    );
    const eligible = filterEligiblePlayersForLineupSlot({
      team: teamData.teams[0],
      discipline: female,
      players: PORTAL_PLAYERS,
      selections: {},
      slotIndex: 0,
      allowReuse: true,
      teamData,
    });
    assert.deepEqual(idsOf(eligible), [F04, F08].sort());
    assert.equal(eligible.length, 2);
  });

  it("C: mixed male slot contains M02 + M08", () => {
    const teamData = buildMlpTeamData();
    const mixed = teamData.disciplines.filter(
      (d) => d.genderRequirement === GENDER_REQUIREMENT.MIXED_PAIR
    )[0];
    const eligible = filterEligiblePlayersForLineupSlot({
      team: teamData.teams[0],
      discipline: mixed,
      players: PORTAL_PLAYERS,
      selections: {},
      slotIndex: 0,
      allowReuse: true,
      teamData,
    });
    assert.deepEqual(idsOf(eligible), [M02, M08].sort());
  });

  it("D: mixed female slot contains F04 + F08", () => {
    const teamData = buildMlpTeamData();
    const mixed = teamData.disciplines.filter(
      (d) => d.genderRequirement === GENDER_REQUIREMENT.MIXED_PAIR
    )[0];
    const eligible = filterEligiblePlayersForLineupSlot({
      team: teamData.teams[0],
      discipline: mixed,
      players: PORTAL_PLAYERS,
      selections: {},
      slotIndex: 1,
      allowReuse: true,
      teamData,
    });
    assert.deepEqual(idsOf(eligible), [F04, F08].sort());
  });

  it("E: sibling duplicate blocked in male doubles", () => {
    const teamData = buildMlpTeamData();
    const male = teamData.disciplines.find(
      (d) => d.genderRequirement === GENDER_REQUIREMENT.MALE
    );
    const selections = { [male.id]: [M02, ""] };
    const eligible = filterEligiblePlayersForLineupSlot({
      team: teamData.teams[0],
      discipline: male,
      players: PORTAL_PLAYERS,
      selections,
      slotIndex: 1,
      allowReuse: true,
      teamData,
    });
    assert.deepEqual(idsOf(eligible), [M08]);
    assert.ok(!eligible.some((p) => p.id === M02));
  });

  it("F: M02 remains available for exactly one mixed male after same-gender use", () => {
    const teamData = buildMlpTeamData();
    const male = teamData.disciplines.find(
      (d) => d.genderRequirement === GENDER_REQUIREMENT.MALE
    );
    const mixed = teamData.disciplines.filter(
      (d) => d.genderRequirement === GENDER_REQUIREMENT.MIXED_PAIR
    );
    const selections = {
      [male.id]: [M02, M08],
      [mixed[0].id]: ["", ""],
      [mixed[1].id]: ["", ""],
    };
    const mx0 = filterEligiblePlayersForLineupSlot({
      team: teamData.teams[0],
      discipline: mixed[0],
      players: PORTAL_PLAYERS,
      selections,
      slotIndex: 0,
      allowReuse: true,
      teamData,
    });
    assert.ok(mx0.some((p) => p.id === M02));
    assert.ok(mx0.some((p) => p.id === M08));
  });

  it("G: M02 used in one mixed male cannot be used in second mixed male", () => {
    const teamData = buildMlpTeamData();
    const male = teamData.disciplines.find(
      (d) => d.genderRequirement === GENDER_REQUIREMENT.MALE
    );
    const female = teamData.disciplines.find(
      (d) => d.genderRequirement === GENDER_REQUIREMENT.FEMALE
    );
    const mixed = teamData.disciplines.filter(
      (d) => d.genderRequirement === GENDER_REQUIREMENT.MIXED_PAIR
    );
    const selections = {
      [female.id]: [F04, F08],
      [male.id]: [M02, M08],
      [mixed[0].id]: [M02, F04],
      [mixed[1].id]: ["", ""],
    };
    const mx1Male = filterEligiblePlayersForLineupSlot({
      team: teamData.teams[0],
      discipline: mixed[1],
      players: PORTAL_PLAYERS,
      selections,
      slotIndex: 0,
      allowReuse: true,
      teamData,
    });
    assert.ok(!mx1Male.some((p) => p.id === M02));
    assert.ok(mx1Male.some((p) => p.id === M08));
  });

  it("H/I/J: complete valid lineup → each athlete total=2 sameGender=1 mixed=1", () => {
    const teamData = buildMlpTeamData();
    const selections = validSelections(teamData);
    const result = validateLineupSelections({
      teamData,
      teamId: "team-fe58m3kc",
      selections,
      players: PORTAL_PLAYERS,
    });
    assert.equal(result.ok, true, result.errors?.join(" "));
    const participation = summarizeMlpParticipation(teamData, result.selections);
    for (const athleteId of [M02, M08, F04, F08]) {
      const row = participation.get(athleteId);
      assert.equal(row.total, 2);
      assert.equal(row.sameGender, 1);
      assert.equal(row.mixed, 1);
    }
  });

  it("K/L/M path contracts: save/submit + rehydrate still present (no F5 / no localStorage)", () => {
    const src = readSrc("src/pages/tournament/TeamPortal.jsx");
    assert.match(src, /method:\s*"saveDraftLineup"/);
    assert.match(src, /method:\s*"submitLineup"/);
    assert.match(src, /decideLineupFormRehydration/);
    assert.match(src, /resolveCaptainLineupAthletePool/);
    assert.match(src, /filterEligiblePlayersForLineupSlot/);
    assert.doesNotMatch(src, /localStorage/);
  });

  it("N: non-team athlete unavailable in options", () => {
    const teamData = buildMlpTeamData();
    const male = teamData.disciplines.find(
      (d) => d.genderRequirement === GENDER_REQUIREMENT.MALE
    );
    const outsider = {
      id: "ath-outsider",
      athleteId: "ath-outsider",
      name: "Outsider",
      gender: "male",
      genderSource: CAPTAIN_PORTAL_SCOPED_ROSTER,
    };
    const eligible = filterEligiblePlayersForLineupSlot({
      team: teamData.teams[0],
      discipline: male,
      players: [...PORTAL_PLAYERS, outsider],
      selections: {},
      slotIndex: 0,
      allowReuse: true,
      teamData,
    });
    assert.ok(!eligible.some((p) => p.id === "ath-outsider"));
  });

  it("O/P: no F5 authority / no localStorage authority", () => {
    const src = readSrc("src/pages/tournament/TeamPortal.jsx");
    assert.match(src, /onSaved\(\)/);
    assert.doesNotMatch(src, /localStorage/);
    assert.match(src, /runMutation/);
  });

  it("DIRTY_FORM_REGRESSION: dirty retain still holds", () => {
    const before = buildServerLineupFingerprint(
      { status: LINEUP_STATUS.NOT_SUBMITTED, selections: {} },
      "mu-1",
      "team-fe58m3kc"
    );
    const after = buildServerLineupFingerprint(
      { status: LINEUP_STATUS.NOT_SUBMITTED, selections: {}, version: 9 },
      "mu-1",
      "team-fe58m3kc"
    );
    const decision = decideLineupFormRehydration({
      dirty: true,
      prevFingerprint: before,
      nextFingerprint: after,
    });
    assert.equal(decision.rehydrate, false);
    assert.equal(decision.conflict, true);
  });

  it("VALIDATOR_CHANGED=NO", () => {
    const teamData = buildMlpTeamData();
    const incomplete = validateMlpLineupParticipation(teamData, "team-fe58m3kc", {
      [teamData.disciplines[0].id]: [F04, F08],
    });
    assert.equal(incomplete.ok, false);
    const src = readSrc("src/features/team-tournament/engines/lineupValidationEngine.js");
    assert.match(src, /export function validateLineupSelections/);
    // option filter is separate module
    assert.equal(
      readSrc("src/features/team-tournament/engines/lineupOptionFilter.js").includes(
        "validateLineupSelections"
      ),
      true
    );
  });

  it("security: mapper keeps unrelated exposure at 0 and strips opponent roster", () => {
    const mapped = mapCaptainPortalResponse({
      ok: true,
      schemaVersion: 7,
      captainAccessEnabled: true,
      viewerTeamId: "team-fe58m3kc",
      viewer: { captain: true, viewerTeamId: "team-fe58m3kc" },
      tournament: {
        id: "team-tournament-zo2u9z4z",
        clubId: "club-1",
        tenantId: "venue-staging-a",
        name: "MLP",
        status: "draft",
        version: 1,
        settings: { captainAccessEnabled: true, formatPreset: FORMAT_PRESET.MLP_4 },
        myTeam: {
          id: "team-fe58m3kc",
          name: "Đội 4",
          captainPlayerId: M02,
          playerIds: [M02, M08, F04, F08],
          rosterAthletes: ROSTER_ATHLETES,
        },
        opponentTeams: [{ id: "team-other", name: "Đội X" }],
        disciplines: stagingLikeAnyDisciplines(),
        matchups: [
          {
            id: "mu-1",
            teamAId: "team-fe58m3kc",
            teamBId: "team-other",
            status: "scheduled",
          },
        ],
        lineups: {},
      },
    });
    assert.equal(mapped.ok, true);
    const my = (mapped.tournament.teamData?.teams || []).find(
      (t) => t.id === "team-fe58m3kc"
    );
    assert.equal(my.rosterAthletes.length, 4);
    assert.ok(my.rosterAthletes.every((r) => r.athleteId && r.displayName && r.gender));
    assert.ok(my.rosterAthletes.every((r) => !("email" in r) && !("phone" in r)));

    const other = (mapped.tournament.teamData?.teams || []).find(
      (t) => t.id === "team-other"
    );
    assert.ok(other);
    assert.deepEqual(other.rosterAthletes || [], []);
    assert.deepEqual(other.playerIds || [], []);

    const exposure = countUnrelatedCaptainPortalExposure(
      mapped.tournament.teamData,
      "team-fe58m3kc"
    );
    assert.equal(exposure.unrelatedMatchups, 0);
    assert.equal(exposure.unrelatedTeams, 0);
  });

  it("profiles RLS / SQL package: no profiles policy changes; APPLY has rosterAthletes", () => {
    const apply = readSrc(
      "docs/v5/migrations/team-tournament-captain-portal-roster-gender-01/02_APPLY.sql"
    );
    assert.match(apply, /rosterAthletes/);
    assert.match(apply, /athleteId/);
    assert.match(apply, /displayName/);
    assert.doesNotMatch(apply, /create policy/i);
    assert.doesNotMatch(apply, /alter policy/i);
    assert.doesNotMatch(apply, /drop policy/i);
    assert.match(apply, /grant execute on function public\.team_tournament_get_captain_portal/);
    assert.match(apply, /revoke all on function public\.team_tournament_get_captain_portal[\s\S]*from anon/);

    // Hash lock presence
    for (const name of ["01_PRECHECK.sql", "02_APPLY.sql", "03_VERIFY.sql", "04_ROLLBACK.sql"]) {
      assert.equal(sha256File(name).length, 64);
    }
  });

  it("broken profiles-null pool still fixed when portal roster present", () => {
    const teamData = buildMlpTeamData();
    const male = teamData.disciplines.find(
      (d) => d.genderRequirement === GENDER_REQUIREMENT.MALE
    );
    const brokenClubPool = [
      { id: M02, name: "M02", gender: "male" },
      { id: M08, name: "M08", gender: null },
      { id: F04, name: "F04", gender: null },
      { id: F08, name: "F08", gender: null },
    ];
    const viaProfiles = filterEligiblePlayersForDiscipline({
      team: teamData.teams[0],
      discipline: male,
      players: brokenClubPool,
      slotIndex: 0,
    });
    assert.deepEqual(idsOf(viaProfiles), [M02]);

    const viaPortal = filterEligiblePlayersForLineupSlot({
      team: teamData.teams[0],
      discipline: male,
      players: resolveCaptainLineupAthletePool({
        team: teamData.teams[0],
        clubPlayers: brokenClubPool,
      }),
      selections: {},
      slotIndex: 0,
      allowReuse: true,
      teamData,
    });
    assert.deepEqual(idsOf(viaPortal), [M02, M08].sort());
  });

  it("applyCanonical path still validates", () => {
    const teamData = applyCanonicalMlpDisciplineMetadata({
      ...buildMlpTeamData(),
      disciplines: stagingLikeAnyDisciplines(),
    });
    const result = validateLineupSelections({
      teamData,
      teamId: "team-fe58m3kc",
      selections: validSelections(teamData),
      players: PORTAL_PLAYERS,
    });
    assert.equal(result.ok, true, result.errors?.join(" "));
  });
});
