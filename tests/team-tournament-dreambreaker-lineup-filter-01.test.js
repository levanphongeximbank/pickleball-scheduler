/**
 * TEAM-TOURNAMENT-PR412-DREAMBREAKER-FIFTH-DISCIPLINE-LINEUP-REGRESSION-REMEDIATION-01
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  DISCIPLINE_CATEGORY,
  DREAMBREAKER_STATUS,
  FORMAT_PRESET,
  GENDER_REQUIREMENT,
  LINEUP_STATUS,
  SUB_MATCH_STATUS,
} from "../src/features/team-tournament/constants.js";
import { saveLineupDraft, submitLineup } from "../src/features/team-tournament/engines/lineupEngine.js";
import {
  validateLineupSelections,
  validateMlpLineupParticipation,
} from "../src/features/team-tournament/engines/lineupValidationEngine.js";
import {
  startDreambreaker,
  submitDreambreakerOrder,
} from "../src/features/team-tournament/engines/dreambreakerEngine.js";
import { computeMatchupResult } from "../src/features/team-tournament/engines/teamResultEngine.js";
import {
  CANONICAL_DREAMBREAKER_DISCIPLINE_ID,
  createMlpDisciplines,
  createMlpPreset,
  ensureCanonicalMlpTeamData,
  getActiveMatchDisciplines,
  getDreambreakerDiscipline,
  isActivationOnlyDreambreakerDiscipline,
} from "../src/features/team-tournament/engines/mlpPresetEngine.js";
import { createDisciplineRecord, createMatchupRecord, createTeamRecord, normalizeTeamData } from "../src/features/team-tournament/models/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const pkgDir = "docs/v5/migrations/team-tournament-dreambreaker-lineup-filter-01";

function readSrc(rel) {
  return readFileSync(join(root, rel), "utf8");
}

const M1 = "ath-m1";
const M2 = "ath-m2";
const F1 = "ath-f1";
const F2 = "ath-f2";
const M3 = "ath-m3";
const M4 = "ath-m4";
const F3 = "ath-f3";
const F4 = "ath-f4";

const PLAYERS = [
  { id: M1, athleteId: M1, name: "M1", gender: "male" },
  { id: M2, athleteId: M2, name: "M2", gender: "male" },
  { id: F1, athleteId: F1, name: "F1", gender: "female" },
  { id: F2, athleteId: F2, name: "F2", gender: "female" },
];

function validMlpSelections(disciplines) {
  const active = getActiveMatchDisciplines(disciplines);
  const femaleId = active.find((d) => d.genderRequirement === GENDER_REQUIREMENT.FEMALE)?.id;
  const maleId = active.find((d) => d.genderRequirement === GENDER_REQUIREMENT.MALE)?.id;
  const mixed = active.filter((d) => d.genderRequirement === GENDER_REQUIREMENT.MIXED_PAIR);
  assert.ok(femaleId && maleId && mixed.length === 2);
  return {
    [femaleId]: [F1, F2],
    [maleId]: [M1, M2],
    [mixed[0].id]: [M1, F1],
    [mixed[1].id]: [M2, F2],
  };
}

function buildLineupTeamData() {
  const preset = createMlpPreset();
  const teamA = createTeamRecord({
    id: "team-1",
    name: "Đội 1",
    captainPlayerId: M1,
    playerIds: [M1, M2, F1, F2],
  });
  const teamB = createTeamRecord({
    id: "team-2",
    name: "Đội 2",
    captainPlayerId: M3,
    playerIds: [M3, M4, F3, F4],
  });
  const matchup = createMatchupRecord("team-1", "team-2", {
    id: "matchup-1",
    disciplines: preset.disciplines,
    scheduledAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });
  return normalizeTeamData({
    ...preset,
    teams: [teamA, teamB],
    matchups: [matchup],
    lineups: {},
  });
}

function buildTiedMatchup({ submitOrders = false } = {}) {
  const preset = createMlpPreset();
  const teamA = createTeamRecord({ id: "team-a", playerIds: [M1, M2, F1, F2] });
  const teamB = createTeamRecord({ id: "team-b", playerIds: [M3, M4, F3, F4] });
  const mainDisciplines = getActiveMatchDisciplines(preset.disciplines);
  const subMatches = mainDisciplines.map((discipline, index) => ({
    id: `sub-${index}`,
    disciplineId: discipline.id,
    sortOrder: discipline.sortOrder,
    status: SUB_MATCH_STATUS.COMPLETED,
    score: { teamA: index < 2 ? 21 : 6, teamB: index < 2 ? 6 : 21, games: [] },
    winnerTeamId: index < 2 ? "team-a" : "team-b",
  }));
  let teamData = normalizeTeamData({
    ...preset,
    teams: [teamA, teamB],
    matchups: [
      {
        id: "matchup-1",
        teamAId: "team-a",
        teamBId: "team-b",
        status: "in_progress",
        subMatches,
      },
    ],
  });
  teamData = computeMatchupResult(teamData, "matchup-1").teamData;
  if (submitOrders) {
    teamData = submitDreambreakerOrder(teamData, {
      matchupId: "matchup-1",
      teamId: "team-a",
      order: [M1, M2, F1, F2],
    }).teamData;
    teamData = submitDreambreakerOrder(teamData, {
      matchupId: "matchup-1",
      teamId: "team-b",
      order: [M3, M4, F3, F4],
    }).teamData;
  }
  return teamData;
}

describe("A catalog still contains exactly 5 canonical MLP disciplines", () => {
  it("createMlpDisciplines keeps Dreambreaker in the full catalog", () => {
    const catalog = createMlpDisciplines();
    assert.equal(catalog.length, 5);
    const dream = getDreambreakerDiscipline(catalog);
    assert.ok(dream);
    assert.equal(dream.id, CANONICAL_DREAMBREAKER_DISCIPLINE_ID);
    assert.equal(dream.disciplineKind, "dreambreaker");
    assert.equal(dream.activationRule, "tie_at_2_2");
    assert.equal(dream.playerCount, 1);
    assert.equal(ensureCanonicalMlpTeamData({
      settings: { formatPreset: FORMAT_PRESET.MLP_4 },
      disciplines: catalog,
    }).disciplines.length, 5);
  });
});

describe("B/C initial captain lineup renders only 4 ordinary contents", () => {
  it("getActiveMatchDisciplines excludes Dreambreaker / VĐV 1", () => {
    const catalog = createMlpDisciplines();
    const active = getActiveMatchDisciplines(catalog);
    assert.equal(active.length, 4);
    assert.ok(active.every((item) => !isActivationOnlyDreambreakerDiscipline(item)));
    assert.ok(active.every((item) => item.playerCount === 2));
    assert.ok(!active.some((item) => String(item.name).includes("Dreambreaker")));
    assert.ok(!active.some((item) => item.id === CANONICAL_DREAMBREAKER_DISCIPLINE_ID));
  });

  it("generic singles stay ordinary lineup slots", () => {
    const singles = createDisciplineRecord({
      id: "disc-men-single",
      name: "Đơn nam",
      categoryType: DISCIPLINE_CATEGORY.SINGLES,
      genderRequirement: GENDER_REQUIREMENT.MALE,
      playerCount: 1,
    });
    assert.equal(singles.disciplineKind, "singles");
    assert.equal(singles.activationRule, "always");
    assert.equal(isActivationOnlyDreambreakerDiscipline(singles), false);
    assert.equal(getActiveMatchDisciplines([singles]).length, 1);
  });

  it("TeamPortal and override dialog use getActiveMatchDisciplines for lineup slots", () => {
    const portal = readSrc("src/pages/tournament/TeamPortal.jsx");
    const dialog = readSrc("src/components/tournament/team/TeamLineupOverrideDialog.jsx");
    const validation = readSrc("src/features/team-tournament/engines/lineupValidationEngine.js");
    const random = readSrc("src/features/team-tournament/engines/lineupRandomEngine.js");
    assert.match(portal, /getActiveMatchDisciplines\(teamData\.disciplines\)/);
    assert.match(portal, /for \(const discipline of getActiveMatchDisciplines\(teamData\.disciplines\)\)/);
    assert.doesNotMatch(portal, /teamData\.disciplines\.map\(\(discipline\)/);
    assert.match(dialog, /getActiveMatchDisciplines\(teamData\?\.disciplines/);
    assert.match(dialog, /lineupDisciplines\.map\(\(discipline\)/);
    assert.match(validation, /getActiveMatchDisciplines\(effectiveTeamData\.disciplines/);
    assert.match(random, /getActiveMatchDisciplines\(teamData\.disciplines\)/);
    const catalog = readSrc("src/components/tournament/team/TeamDisciplinesPanel.jsx");
    assert.match(catalog, /teamData\.disciplines\.map\(\(discipline\)/);
  });
});

describe("D no Dreambreaker cần 1 VĐV validation", () => {
  it("four-discipline selections pass without a Dreambreaker slot", () => {
    const teamData = buildLineupTeamData();
    assert.equal(teamData.disciplines.length, 5);
    const selections = validMlpSelections(teamData.disciplines);
    assert.equal(Object.keys(selections).length, 4);
    assert.ok(!selections[CANONICAL_DREAMBREAKER_DISCIPLINE_ID]);
    const result = validateLineupSelections({
      teamData,
      teamId: "team-1",
      selections,
      players: PLAYERS,
    });
    assert.equal(result.ok, true, result.errors?.join(" "));
    const joined = (result.errors || []).join(" ");
    assert.doesNotMatch(joined, /Dreambreaker cần 1 VĐV/);
  });
});

describe("E/F normal four-discipline lineup save and submit", () => {
  it("save draft works without Dreambreaker", () => {
    const teamData = buildLineupTeamData();
    const saved = saveLineupDraft(teamData, {
      matchupId: "matchup-1",
      teamId: "team-1",
      selections: validMlpSelections(teamData.disciplines),
      players: PLAYERS,
    });
    assert.equal(saved.ok, true, saved.error);
    assert.equal(saved.lineup.status, LINEUP_STATUS.DRAFT);
    assert.ok(!saved.lineup.selections[CANONICAL_DREAMBREAKER_DISCIPLINE_ID]);
  });

  it("submit works without Dreambreaker", () => {
    const teamData = buildLineupTeamData();
    const submitted = submitLineup(teamData, {
      matchupId: "matchup-1",
      teamId: "team-1",
      selections: validMlpSelections(teamData.disciplines),
      players: PLAYERS,
    });
    assert.equal(submitted.ok, true, submitted.error);
    assert.equal(submitted.lineup.status, LINEUP_STATUS.SUBMITTED);
    assert.equal(Object.keys(submitted.lineup.selections).length, 4);
  });
});

describe("G/H/I/J Dreambreaker lifecycle preserved", () => {
  it("G 2-2 later activates Dreambreaker", () => {
    const teamData = buildTiedMatchup();
    assert.equal(teamData.disciplines.length, 5);
    assert.ok(getDreambreakerDiscipline(teamData.disciplines));
    const status = teamData.matchups[0].dreambreaker?.status;
    assert.ok(
      status === DREAMBREAKER_STATUS.LINEUP_OPEN || status === DREAMBREAKER_STATUS.PENDING,
      status
    );
    assert.equal(teamData.matchups[0].subMatches.length, 4);
  });

  it("H captain order requires exactly 4 athletes", () => {
    const panel = readSrc("src/components/tournament/team/DreambreakerPanel.jsx");
    assert.match(panel, /Chọn thứ tự 4 VĐV \(1→4\)/);
    const teamData = buildTiedMatchup();
    const short = submitDreambreakerOrder(teamData, {
      matchupId: "matchup-1",
      teamId: "team-a",
      order: [M1, M2, F1],
    });
    assert.equal(short.ok, false);
    assert.match(short.error, /4 VĐV/);
  });

  it("I both orders → ready", () => {
    const teamData = buildTiedMatchup({ submitOrders: true });
    assert.equal(teamData.matchups[0].dreambreaker.status, DREAMBREAKER_STATUS.READY);
    assert.equal(teamData.matchups[0].dreambreaker.teamAOrder.length, 4);
    assert.equal(teamData.matchups[0].dreambreaker.teamBOrder.length, 4);
  });

  it("J referee start remains PASS", () => {
    const teamData = buildTiedMatchup({ submitOrders: true });
    const started = startDreambreaker(teamData, "matchup-1", {
      expectedVersion: teamData.matchups[0].dreambreaker.version,
    });
    assert.equal(started.ok, true, started.error);
    assert.equal(started.teamData.matchups[0].dreambreaker.status, DREAMBREAKER_STATUS.IN_PROGRESS);
    assert.ok(
      started.teamData.matchups[0].subMatches.some(
        (item) => item.disciplineId === CANONICAL_DREAMBREAKER_DISCIPLINE_ID
      )
    );
  });
});

describe("K/L SQL validator skip + ordinary rules stay strict", () => {
  it("K APPLY skips Dreambreaker; PRECHECK proves current includes it", () => {
    const apply = readSrc(`${pkgDir}/02_APPLY.sql`);
    const precheck = readSrc(`${pkgDir}/01_PRECHECK.sql`);
    const verify = readSrc(`${pkgDir}/03_VERIFY.sql`);
    const rollback = readSrc(`${pkgDir}/04_ROLLBACK.sql`);
    assert.match(apply, /DREAMBREAKER_SKIPPED_FROM_LINEUP_VALIDATION/);
    assert.match(apply, /NORMAL_DISCIPLINES_STILL_VALIDATED/);
    assert.match(apply, /discipline_kind, ''\)\) <> 'dreambreaker'/);
    assert.match(apply, /activation_rule, ''\)\) <> 'tie_at_2_2'/);
    assert.match(precheck, /CURRENT_INCLUDES_DREAMBREAKER_IN_LINEUP_VALIDATION/);
    assert.match(precheck, /DREAMBREAKER_SKIPPED_FROM_LINEUP_VALIDATION/);
    assert.match(verify, /DREAMBREAKER_SKIPPED_FROM_LINEUP_VALIDATION/);
    assert.match(verify, /NORMAL_DISCIPLINES_STILL_VALIDATED/);
    assert.match(verify, /RLS_CHANGED/);
    assert.match(verify, /RBAC_CHANGED/);
    assert.match(verify, /GRANTS_PRESERVED/);
    assert.doesNotMatch(rollback, /DREAMBREAKER_SKIPPED_FROM_LINEUP_VALIDATION/);
    assert.match(rollback, /from public\.team_tournament_disciplines d/);
  });

  it("L ordinary discipline validation remains strict", () => {
    const teamData = buildLineupTeamData();
    const male = getActiveMatchDisciplines(teamData.disciplines).find(
      (d) => d.genderRequirement === GENDER_REQUIREMENT.MALE
    );
    const incomplete = validateLineupSelections({
      teamData,
      teamId: "team-1",
      selections: {
        ...validMlpSelections(teamData.disciplines),
        [male.id]: [M1],
      },
      players: PLAYERS,
    });
    assert.equal(incomplete.ok, false);
    assert.match((incomplete.errors || []).join(" "), /cần 2 VĐV/);
    assert.doesNotMatch((incomplete.errors || []).join(" "), /Dreambreaker cần 1 VĐV/);

    const participation = validateMlpLineupParticipation(teamData, "team-1", {
      [getActiveMatchDisciplines(teamData.disciplines)[0].id]: [F1, F2],
    });
    assert.equal(participation.ok, false);
  });
});

describe("next-phase stage tie-break is documented only", () => {
  it("README documents DREAMBREAKER vs TOTAL_SUBMATCH_POINTS and marks unimplemented", () => {
    const readme = readSrc(`${pkgDir}/README.md`);
    assert.match(readme, /TOTAL_SUBMATCH_POINTS/);
    assert.match(readme, /STAGE_TIEBREAK_POLICY_IMPLEMENTED=NO/);
    assert.match(readme, /Đôi nam nữ 1/);
    assert.match(readme, /Do not implement TOTAL_SUBMATCH_POINTS/);
  });
});
