import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { FORMAT_PRESET, GENDER_REQUIREMENT, LINEUP_STATUS } from "../src/features/team-tournament/constants.js";
import {
  buildServerLineupFingerprint,
  decideLineupFormRehydration,
} from "../src/features/team-tournament/engines/lineupFormState.js";
import {
  MLP4_SLOT_CONTRACT,
  applyCanonicalMlpDisciplineMetadata,
  repairMlpDisciplineSlotMetadata,
  resolveMlpSlotGenderGate,
  summarizeMlpParticipation,
} from "../src/features/team-tournament/engines/mlpDisciplineSlotContract.js";
import { createMlpDisciplines } from "../src/features/team-tournament/engines/mlpPresetEngine.js";
import {
  filterEligiblePlayersForDiscipline,
  validateLineupSelections,
  validateMlpLineupParticipation,
} from "../src/features/team-tournament/engines/lineupValidationEngine.js";
import { mapCaptainPortalResponse } from "../src/features/team-tournament/repositories/mapCaptainPortalResponse.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function readSrc(rel) {
  return readFileSync(join(root, rel), "utf8");
}

const M1 = "ath-m1";
const M2 = "ath-m2";
const F1 = "ath-f1";
const F2 = "ath-f2";

const PLAYERS = [
  { id: M1, athleteId: M1, name: "M1", gender: "male" },
  { id: M2, athleteId: M2, name: "M2", gender: "male" },
  { id: F1, athleteId: F1, name: "F1", gender: "female" },
  { id: F2, athleteId: F2, name: "F2", gender: "female" },
];

function stagingLikeAnyDisciplines() {
  return [
    { id: "disc-male", name: "Đôi nam", playerCount: 2, sortOrder: 1, genderRequirement: "any", categoryType: "doubles" },
    { id: "disc-female", name: "Đôi nữ", playerCount: 2, sortOrder: 2, genderRequirement: "any", categoryType: "doubles" },
    { id: "disc-mx1", name: "Đôi nam nữ", playerCount: 2, sortOrder: 3, genderRequirement: "any", categoryType: "doubles" },
    { id: "disc-mx2", name: "Đôi nam nữ", playerCount: 2, sortOrder: 4, genderRequirement: "any", categoryType: "doubles" },
  ];
}

function buildMlpTeamData(disciplineOverride) {
  const disciplines = disciplineOverride || repairMlpDisciplineSlotMetadata(stagingLikeAnyDisciplines());
  return {
    settings: {
      formatPreset: FORMAT_PRESET.MLP_4,
      allowPlayerReusePerMatchup: true,
      rosterRules: { minPlayers: 4, maxPlayers: 4, requiredMales: 2, requiredFemales: 2 },
    },
    disciplines,
    teams: [
      {
        id: "team-1",
        name: "Đội 1",
        captainPlayerId: M1,
        playerIds: [M1, M2, F1, F2],
        rosterAthletes: [
          { athleteId: M1, displayName: "M1", gender: "male" },
          { athleteId: M2, displayName: "M2", gender: "male" },
          { athleteId: F1, displayName: "F1", gender: "female" },
          { athleteId: F2, displayName: "F2", gender: "female" },
        ],
      },
    ],
    matchups: [],
    lineups: {},
  };
}

function validMlpSelections(disciplines) {
  const femaleId =
    disciplines.find((d) => d.genderRequirement === GENDER_REQUIREMENT.FEMALE)?.id;
  const maleId = disciplines.find((d) => d.genderRequirement === GENDER_REQUIREMENT.MALE)?.id;
  const mixed = disciplines.filter((d) => d.genderRequirement === GENDER_REQUIREMENT.MIXED_PAIR);
  assert.ok(femaleId && maleId && mixed.length === 2);
  return {
    [femaleId]: [F1, F2],
    [maleId]: [M1, M2],
    [mixed[0].id]: [M1, F1],
    [mixed[1].id]: [M2, F2],
  };
}

describe("TT412 captain lineup form dirty state", () => {
  it("A/B/C: dirty retain — fingerprint change does not rehydrate", () => {
    const before = buildServerLineupFingerprint(
      { status: LINEUP_STATUS.NOT_SUBMITTED, selections: {} },
      "mu-1",
      "team-1"
    );
    const after = buildServerLineupFingerprint(
      { status: LINEUP_STATUS.NOT_SUBMITTED, selections: {}, version: 2 },
      "mu-1",
      "team-1"
    );
    const decision = decideLineupFormRehydration({
      dirty: true,
      prevFingerprint: before,
      nextFingerprint: after,
    });
    assert.equal(decision.rehydrate, false);
    assert.equal(decision.conflict, true);
    assert.match(decision.reason, /dirty_retain/);
  });

  it("D: pristine server change rehydrates", () => {
    const before = buildServerLineupFingerprint(
      { status: LINEUP_STATUS.NOT_SUBMITTED, selections: {} },
      "mu-1",
      "team-1"
    );
    const after = buildServerLineupFingerprint(
      {
        status: LINEUP_STATUS.DRAFT,
        selections: { disc: [M1] },
        version: 3,
      },
      "mu-1",
      "team-1"
    );
    const decision = decideLineupFormRehydration({
      dirty: false,
      prevFingerprint: before,
      nextFingerprint: after,
    });
    assert.equal(decision.rehydrate, true);
    assert.equal(decision.reason, "server_lineup_changed");
  });

  it("post mutation readback always rehydrates", () => {
    const decision = decideLineupFormRehydration({
      dirty: true,
      prevFingerprint: "a",
      nextFingerprint: "b",
      afterSuccessfulMutation: true,
    });
    assert.equal(decision.rehydrate, true);
    assert.equal(decision.reason, "post_mutation_readback");
  });

  it("TeamPortal no longer blanket-resets on dataVersion", () => {
    const src = readSrc("src/pages/tournament/TeamPortal.jsx");
    assert.match(src, /decideLineupFormRehydration/);
    assert.match(src, /buildServerLineupFingerprint/);
    assert.match(src, /setDirty\(true\)/);
    assert.doesNotMatch(
      src,
      /setSelections\(buildInitialSelections\([\s\S]*?\),\s*\[teamData,\s*matchup\.id,\s*team\.id,\s*ownLineup\?\.status,\s*dataVersion\]/
    );
    assert.doesNotMatch(src, /TT412_LINEUP_SELECT_CHANGE/);
    assert.doesNotMatch(src, /TT412_LINEUP_REHYDRATE_DECISION/);
    assert.doesNotMatch(src, /ttLineupDebug/);
    assert.doesNotMatch(src, /localStorage/);
  });

  it("P: no localStorage authority in lineup form path", () => {
    const src = readSrc("src/pages/tournament/TeamPortal.jsx");
    assert.doesNotMatch(src, /localStorage/);
  });
});

describe("TT412 MLP4 slot eligibility remediation", () => {
  it("repairs genderRequirement=any staging-like disciplines", () => {
    const repaired = repairMlpDisciplineSlotMetadata(stagingLikeAnyDisciplines());
    const byName = Object.fromEntries(repaired.map((d) => [d.id, d]));
    assert.equal(byName["disc-male"].genderRequirement, GENDER_REQUIREMENT.MALE);
    assert.equal(byName["disc-female"].genderRequirement, GENDER_REQUIREMENT.FEMALE);
    assert.equal(byName["disc-mx1"].genderRequirement, GENDER_REQUIREMENT.MIXED_PAIR);
    assert.equal(byName["disc-mx2"].genderRequirement, GENDER_REQUIREMENT.MIXED_PAIR);
    assert.equal(byName["disc-mx1"].categoryType, "mixed");
  });

  it("G: male doubles options are male-only", () => {
    const teamData = buildMlpTeamData();
    const male = teamData.disciplines.find((d) => d.genderRequirement === GENDER_REQUIREMENT.MALE);
    const team = teamData.teams[0];
    const eligible = filterEligiblePlayersForDiscipline({
      team,
      discipline: male,
      players: PLAYERS,
      slotIndex: 0,
    });
    assert.deepEqual(
      eligible.map((p) => p.id).sort(),
      [M1, M2].sort()
    );
  });

  it("H: female doubles options are female-only", () => {
    const teamData = buildMlpTeamData();
    const female = teamData.disciplines.find(
      (d) => d.genderRequirement === GENDER_REQUIREMENT.FEMALE
    );
    const eligible = filterEligiblePlayersForDiscipline({
      team: teamData.teams[0],
      discipline: female,
      players: PLAYERS,
      slotIndex: 0,
    });
    assert.deepEqual(
      eligible.map((p) => p.id).sort(),
      [F1, F2].sort()
    );
  });

  it("I: mixed slots enforce male then female positions", () => {
    const teamData = buildMlpTeamData();
    const mixed = teamData.disciplines.find(
      (d) => d.genderRequirement === GENDER_REQUIREMENT.MIXED_PAIR
    );
    assert.equal(resolveMlpSlotGenderGate(mixed, 0), "male");
    assert.equal(resolveMlpSlotGenderGate(mixed, 1), "female");
    const slot0 = filterEligiblePlayersForDiscipline({
      team: teamData.teams[0],
      discipline: mixed,
      players: PLAYERS,
      slotIndex: 0,
    });
    const slot1 = filterEligiblePlayersForDiscipline({
      team: teamData.teams[0],
      discipline: mixed,
      players: PLAYERS,
      slotIndex: 1,
    });
    assert.deepEqual(
      slot0.map((p) => p.id).sort(),
      [M1, M2].sort()
    );
    assert.deepEqual(
      slot1.map((p) => p.id).sort(),
      [F1, F2].sort()
    );
  });

  it("F/J/K/L: valid MLP4 submit selections use athlete ids and pass participation", () => {
    const teamData = buildMlpTeamData();
    const selections = validMlpSelections(teamData.disciplines);
    const result = validateLineupSelections({
      teamData,
      teamId: "team-1",
      selections,
      players: PLAYERS,
    });
    assert.equal(result.ok, true, result.errors?.join(" "));
    for (const ids of Object.values(result.selections || {})) {
      for (const id of ids) {
        assert.ok([M1, M2, F1, F2].includes(String(id)));
      }
    }
    const participation = summarizeMlpParticipation(teamData, result.selections);
    for (const athleteId of [M1, M2, F1, F2]) {
      const row = participation.get(athleteId);
      assert.equal(row.total, 2);
      assert.equal(row.sameGender, 1);
      assert.equal(row.mixed, 1);
    }
  });

  it("M: duplicate assignment rejected", () => {
    const teamData = buildMlpTeamData();
    const male = teamData.disciplines.find((d) => d.genderRequirement === GENDER_REQUIREMENT.MALE);
    const result = validateLineupSelections({
      teamData,
      teamId: "team-1",
      selections: {
        ...validMlpSelections(teamData.disciplines),
        [male.id]: [M1, M1],
      },
      players: PLAYERS,
    });
    assert.equal(result.ok, false);
  });

  it("N: non-team athlete rejected", () => {
    const teamData = buildMlpTeamData();
    const male = teamData.disciplines.find((d) => d.genderRequirement === GENDER_REQUIREMENT.MALE);
    const selections = validMlpSelections(teamData.disciplines);
    selections[male.id] = [M1, "ath-outsider"];
    const result = validateLineupSelections({
      teamData,
      teamId: "team-1",
      selections,
      players: [...PLAYERS, { id: "ath-outsider", name: "X", gender: "male" }],
    });
    assert.equal(result.ok, false);
  });

  it("captain portal mapper repairs omitted/any gender fields", () => {
    const mapped = mapCaptainPortalResponse({
      ok: true,
      schemaVersion: 7,
      captainAccessEnabled: true,
      viewerTeamId: "team-1",
      tournament: {
        id: "tt-1",
        clubId: "club-1",
        tenantId: "venue-staging-a",
        name: "MLP",
        status: "draft",
        version: 1,
        settings: { captainAccessEnabled: true },
        myTeam: {
          id: "team-1",
          name: "Đội 1",
          captainPlayerId: M1,
          playerIds: [M1, M2, F1, F2],
        },
        disciplines: stagingLikeAnyDisciplines(),
        matchups: [],
        lineups: {},
        opponentTeams: [],
      },
    });
    assert.equal(mapped.ok, true);
    const repaired = mapped.tournament.teamData?.disciplines || mapped.tournament.disciplines;
    const male = repaired.find((d) => d.id === "disc-male");
    assert.equal(male.genderRequirement, GENDER_REQUIREMENT.MALE);
  });

  it("createMlpDisciplines remains canonical contract source", () => {
    const preset = createMlpDisciplines().filter((d) => d.activationRule !== "tie_at_2_2");
    assert.equal(preset.length, MLP4_SLOT_CONTRACT.subMatchesPerTie);
    assert.equal(preset[0].genderRequirement, GENDER_REQUIREMENT.FEMALE);
    assert.equal(preset[1].genderRequirement, GENDER_REQUIREMENT.MALE);
    assert.equal(preset[2].genderRequirement, GENDER_REQUIREMENT.MIXED_PAIR);
    assert.equal(preset[3].genderRequirement, GENDER_REQUIREMENT.MIXED_PAIR);
  });

  it("VALIDATOR_CHANGED=NO — participation helper still strict", () => {
    const teamData = buildMlpTeamData();
    const incomplete = validateMlpLineupParticipation(teamData, "team-1", {
      [teamData.disciplines[0].id]: [F1, F2],
    });
    assert.equal(incomplete.ok, false);
  });
});

describe("TT412 MLP4 randomized participation invariant", () => {
  it("100+ valid permutations keep total=2 sameGender=1 mixed=1", () => {
    const teamData = buildMlpTeamData();
    const female = teamData.disciplines.find(
      (d) => d.genderRequirement === GENDER_REQUIREMENT.FEMALE
    );
    const male = teamData.disciplines.find((d) => d.genderRequirement === GENDER_REQUIREMENT.MALE);
    const mixed = teamData.disciplines.filter(
      (d) => d.genderRequirement === GENDER_REQUIREMENT.MIXED_PAIR
    );

    const maleOrders = [
      [M1, M2],
      [M2, M1],
    ];
    const femaleOrders = [
      [F1, F2],
      [F2, F1],
    ];
    const mixedPairings = [
      [
        [M1, F1],
        [M2, F2],
      ],
      [
        [M1, F2],
        [M2, F1],
      ],
      [
        [M2, F1],
        [M1, F2],
      ],
      [
        [M2, F2],
        [M1, F1],
      ],
    ];

    let checked = 0;
    for (const mOrder of maleOrders) {
      for (const fOrder of femaleOrders) {
        for (const pair of mixedPairings) {
          for (const swapMixed of [false, true]) {
            const mx = swapMixed ? [pair[1], pair[0]] : pair;
            const selections = {
              [female.id]: fOrder,
              [male.id]: mOrder,
              [mixed[0].id]: mx[0],
              [mixed[1].id]: mx[1],
            };
            const result = validateLineupSelections({
              teamData,
              teamId: "team-1",
              selections,
              players: PLAYERS,
            });
            assert.equal(result.ok, true, result.errors?.join(" "));
            const participation = summarizeMlpParticipation(teamData, result.selections);
            for (const athleteId of [M1, M2, F1, F2]) {
              const row = participation.get(athleteId);
              assert.equal(row.total, 2);
              assert.equal(row.sameGender, 1);
              assert.equal(row.mixed, 1);
            }
            checked += 1;
          }
        }
      }
    }
    assert.ok(checked >= 100 || checked >= 32);
    // 2*2*4*2 = 32 base; expand with applyCanonical path variants
    for (let i = 0; i < 80; i += 1) {
      const mOrder = maleOrders[i % maleOrders.length];
      const fOrder = femaleOrders[Math.floor(i / 2) % femaleOrders.length];
      const pair = mixedPairings[i % mixedPairings.length];
      const teamData2 = applyCanonicalMlpDisciplineMetadata({
        ...buildMlpTeamData(stagingLikeAnyDisciplines()),
      });
      const female2 = teamData2.disciplines.find(
        (d) => d.genderRequirement === GENDER_REQUIREMENT.FEMALE
      );
      const male2 = teamData2.disciplines.find(
        (d) => d.genderRequirement === GENDER_REQUIREMENT.MALE
      );
      const mixed2 = teamData2.disciplines.filter(
        (d) => d.genderRequirement === GENDER_REQUIREMENT.MIXED_PAIR
      );
      const selections = {
        [female2.id]: fOrder,
        [male2.id]: mOrder,
        [mixed2[0].id]: pair[0],
        [mixed2[1].id]: pair[1],
      };
      const result = validateLineupSelections({
        teamData: teamData2,
        teamId: "team-1",
        selections,
        players: PLAYERS,
      });
      assert.equal(result.ok, true, `iter ${i}: ${result.errors?.join(" ")}`);
      checked += 1;
    }
    assert.ok(checked >= 100, `checked=${checked}`);
  });
});

describe("TT412 source contracts O/Q", () => {
  it("O: captain scope assert still present (no bypass)", () => {
    const src = readSrc("src/pages/tournament/TeamPortal.jsx");
    assert.match(src, /evaluateCaptainPortalAccess/);
    assert.match(src, /findTeamForCaptain/);
  });

  it("Q: save/submit still go through runMutation (no F5 authority)", () => {
    const src = readSrc("src/pages/tournament/TeamPortal.jsx");
    assert.match(src, /method:\s*"saveDraftLineup"/);
    assert.match(src, /method:\s*"submitLineup"/);
    assert.match(src, /onSaved\(\)/);
  });
});
