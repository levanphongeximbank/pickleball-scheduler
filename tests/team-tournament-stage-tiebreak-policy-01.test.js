import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  COMPETITION_STAGE,
  DREAMBREAKER_STATUS,
  FORMAT_PRESET,
  MATCHUP_STATUS,
  STAGE_TIE_BREAK_POLICY,
  SUB_MATCH_STATUS,
} from "../src/features/team-tournament/constants.js";
import { createMlpPreset } from "../src/features/team-tournament/engines/mlpPresetEngine.js";
import { computeMatchupResult } from "../src/features/team-tournament/engines/teamResultEngine.js";
import { computeMatchupTieProgress } from "../src/features/team-tournament/engines/matchupTieEngine.js";
import {
  buildCaptainDreambreakerSubmitCommand,
  projectCaptainPortalMatchupDreambreaker,
} from "../src/features/team-tournament/engines/captainDreambreakerPortalContract.js";
import {
  buildRefereeDreambreakerStartCommand,
  maybeActivateDreambreaker,
  listDreambreakerMatchups,
  recordDreambreakerPoint,
  startDreambreaker,
  submitDreambreakerOrder,
} from "../src/features/team-tournament/engines/dreambreakerEngine.js";
import {
  generateTeamKnockoutMatchups,
  listKnockoutMatchups,
} from "../src/features/team-tournament/engines/teamKnockoutEngine.js";
import { computeTeamStandings } from "../src/features/team-tournament/engines/teamStandingsEngine.js";
import {
  assertStageTieBreakPolicyWritable,
  normalizeStageTieBreakPolicy,
  resolveEffectiveStageTieBreakPolicy,
  resolveMatchupCompetitionStage,
  TOTAL_POINTS_SECONDARY_TIE_CONTRACT,
  TOTAL_POINTS_SECONDARY_TIE_STATUS,
} from "../src/features/team-tournament/engines/teamStageTieBreakPolicy.js";
import {
  buildSetupConfigPayload,
  resolveFormatVenueDefaults,
  validateFormatVenueConfigForPersist,
} from "../src/features/team-tournament/engines/teamFormatVenueConfig.js";
import { createTeamRecord, normalizeTeamData } from "../src/features/team-tournament/models/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PKG = "docs/v5/migrations/team-tournament-stage-tiebreak-policy-01";

function readPkg(name) {
  return readFileSync(join(ROOT, PKG, name), "utf8");
}

function scoredSubMatches(disciplines, scores) {
  return disciplines
    .filter((discipline) => discipline.activationRule === "always")
    .map((discipline, index) => {
      const score = scores[index] || { teamA: 0, teamB: 0 };
      const winnerTeamId =
        score.teamA > score.teamB ? "team-a" : score.teamB > score.teamA ? "team-b" : "";
      return {
        id: `sub-${index}`,
        disciplineId: discipline.id,
        sortOrder: discipline.sortOrder,
        status: SUB_MATCH_STATUS.COMPLETED,
        score: { ...score, games: [] },
        winnerTeamId,
      };
    });
}

function buildMlpMatchup(options = {}) {
  const preset = createMlpPreset();
  preset.teams = [
    createTeamRecord({ id: "team-a", playerIds: ["m1", "m2", "f1", "f2"] }),
    createTeamRecord({ id: "team-b", playerIds: ["m3", "m4", "f3", "f4"] }),
  ];
  const main = preset.disciplines.filter((item) => item.activationRule === "always");
  const scores =
    options.scores || [
      { teamA: 11, teamB: 4 },
      { teamA: 11, teamB: 7 },
      { teamA: 8, teamB: 11 },
      { teamA: 6, teamB: 11 },
    ];
  preset.matchups = [
    {
      id: options.matchupId || "matchup-1",
      teamAId: "team-a",
      teamBId: "team-b",
      status: MATCHUP_STATUS.IN_PROGRESS,
      stage: options.stage || "",
      competitionStage: options.competitionStage || "",
      nextMatchupId: options.nextMatchupId || "",
      bracketRoundLabel: options.bracketRoundLabel || "",
      groupId: options.groupId || "g1",
      subMatches: scoredSubMatches(main, scores),
    },
  ];
  preset.settings = {
    ...preset.settings,
    formatPreset: FORMAT_PRESET.MLP_4,
    dreambreakerEnabled: true,
    ...(options.settings || {}),
  };
  return normalizeTeamData(preset);
}

test("1. non-tied normal result ignores policy", () => {
  const teamData = buildMlpMatchup({
    scores: [
      { teamA: 11, teamB: 5 },
      { teamA: 11, teamB: 5 },
      { teamA: 11, teamB: 5 },
      { teamA: 5, teamB: 11 },
    ],
    settings: {
      stageTieBreakPolicy: {
        group: STAGE_TIE_BREAK_POLICY.TOTAL_SUBMATCH_POINTS,
      },
    },
  });
  const result = computeMatchupResult(teamData, "matchup-1");
  assert.equal(result.ok, true);
  assert.equal(result.needsDreambreaker, false);
  assert.equal(result.result.winnerTeamId, "team-a");
  assert.equal(result.result.teamAWins, 3);
  assert.equal(result.result.teamBWins, 1);
});

test("2. 2-2 + DREAMBREAKER activates existing lifecycle", () => {
  const teamData = buildMlpMatchup();
  const result = computeMatchupResult(teamData, "matchup-1");
  assert.equal(result.needsDreambreaker, true);
  assert.equal(result.result.winnerTeamId, "");
  assert.equal(result.teamData.matchups[0].dreambreaker?.status, "lineup_open");
  assert.equal(result.result.teamAWins, 2);
  assert.equal(result.result.teamBWins, 2);
});

test("3. 2-2 + TOTAL_SUBMATCH_POINTS awards higher point total without Dreambreaker", () => {
  const teamData = buildMlpMatchup({
    settings: {
      stageTieBreakPolicy: {
        group: STAGE_TIE_BREAK_POLICY.TOTAL_SUBMATCH_POINTS,
      },
    },
  });
  const result = computeMatchupResult(teamData, "matchup-1");
  assert.equal(result.needsDreambreaker, false);
  assert.equal(result.result.winnerTeamId, "team-a");
  assert.equal(result.result.teamAPoints, 36);
  assert.equal(result.result.teamBPoints, 33);
  assert.equal(result.result.teamAWins, 2);
  assert.equal(result.result.teamBWins, 2);
  assert.equal(result.result.tieBreakStatus, "points");
  assert.equal(result.teamData.matchups[0].status, MATCHUP_STATUS.COMPLETED);
  assert.notEqual(result.teamData.matchups[0].dreambreaker?.status, "lineup_open");
  const activation = maybeActivateDreambreaker(result.teamData, "matchup-1");
  assert.equal(activation.activated, false);
  assert.equal(listDreambreakerMatchups(result.teamData).length, 0);
});

test("4. same tournament: group TOTAL_POINTS and semifinal DREAMBREAKER resolve independently", () => {
  const preset = createMlpPreset();
  const main = preset.disciplines.filter((item) => item.activationRule === "always");
  const twoTwo = scoredSubMatches(main, [
    { teamA: 11, teamB: 4 },
    { teamA: 11, teamB: 7 },
    { teamA: 8, teamB: 11 },
    { teamA: 6, teamB: 11 },
  ]);
  const teamData = normalizeTeamData({
    ...preset,
    teams: [
      createTeamRecord({ id: "team-a", playerIds: ["m1", "m2", "f1", "f2"] }),
      createTeamRecord({ id: "team-b", playerIds: ["m3", "m4", "f3", "f4"] }),
    ],
    settings: {
      ...preset.settings,
      formatPreset: FORMAT_PRESET.MLP_4,
      dreambreakerEnabled: true,
      stageTieBreakPolicy: {
        group: STAGE_TIE_BREAK_POLICY.TOTAL_SUBMATCH_POINTS,
        semifinal: STAGE_TIE_BREAK_POLICY.DREAMBREAKER,
      },
    },
    matchups: [
      {
        id: "group-1",
        teamAId: "team-a",
        teamBId: "team-b",
        stage: "",
        groupId: "g1",
        status: MATCHUP_STATUS.IN_PROGRESS,
        subMatches: twoTwo,
      },
      {
        id: "sf-1",
        teamAId: "team-a",
        teamBId: "team-b",
        stage: "knockout",
        competitionStage: COMPETITION_STAGE.SEMIFINAL,
        bracketRoundLabel: "Bán kết",
        status: MATCHUP_STATUS.IN_PROGRESS,
        subMatches: twoTwo.map((item, index) => ({ ...item, id: `sf-sub-${index}` })),
      },
    ],
  });

  const group = computeMatchupResult(teamData, "group-1");
  assert.equal(group.needsDreambreaker, false);
  assert.equal(group.result.winnerTeamId, "team-a");

  const semi = computeMatchupResult(group.teamData, "sf-1");
  assert.equal(semi.needsDreambreaker, true);
  assert.equal(semi.result.winnerTeamId, "");
  assert.equal(findStatus(semi.teamData, "sf-1"), "lineup_open");
});

function findStatus(teamData, matchupId) {
  return teamData.matchups.find((item) => item.id === matchupId)?.dreambreaker?.status;
}

test("5. total-points result retains normal aggregate 2-2", () => {
  const teamData = buildMlpMatchup({
    settings: {
      stageTieBreakPolicy: { group: STAGE_TIE_BREAK_POLICY.TOTAL_SUBMATCH_POINTS },
    },
  });
  const result = computeMatchupResult(teamData, "matchup-1");
  assert.equal(result.result.teamAWins, 2);
  assert.equal(result.result.teamBWins, 2);
  assert.notEqual(result.result.teamAWins, 3);
});

test("6. standings consume parent winner from total-points 2-2", () => {
  const computed = computeMatchupResult(
    buildMlpMatchup({
      settings: {
        stageTieBreakPolicy: { group: STAGE_TIE_BREAK_POLICY.TOTAL_SUBMATCH_POINTS },
      },
    }),
    "matchup-1"
  );
  const ranked = computeTeamStandings(computed.teamData);
  const teamA = ranked.standings.find((row) => row.teamId === "team-a");
  const teamB = ranked.standings.find((row) => row.teamId === "team-b");
  assert.equal(teamA.wins, 1);
  assert.equal(teamB.losses, 1);
  assert.equal(teamA.subMatchWins, 2);
  assert.equal(teamA.subMatchLosses, 2);
});

test("7. knockout progression consumes parent winner from total-points", () => {
  let teamData = createMlpPreset();
  teamData.teams = [
    createTeamRecord({ id: "a1", name: "A1", playerIds: ["a1m1", "a1m2", "a1f1", "a1f2"] }),
    createTeamRecord({ id: "a2", name: "A2", playerIds: ["a2m1", "a2m2", "a2f1", "a2f2"] }),
    createTeamRecord({ id: "b1", name: "B1", playerIds: ["b1m1", "b1m2", "b1f1", "b1f2"] }),
    createTeamRecord({ id: "b2", name: "B2", playerIds: ["b2m1", "b2m2", "b2f1", "b2f2"] }),
  ];
  teamData.groups = [
    { id: "g-a", name: "A", teamIds: ["a1", "a2"] },
    { id: "g-b", name: "B", teamIds: ["b1", "b2"] },
  ];
  const mains = teamData.disciplines.filter((item) => item.activationRule === "always");
  teamData.matchups = [
    {
      id: "rr-a",
      teamAId: "a1",
      teamBId: "a2",
      groupId: "g-a",
      status: MATCHUP_STATUS.COMPLETED,
      subMatches: scoredSubMatches(mains, [
        { teamA: 11, teamB: 0 },
        { teamA: 11, teamB: 0 },
        { teamA: 11, teamB: 0 },
        { teamA: 11, teamB: 0 },
      ]).map((item) => ({ ...item, winnerTeamId: "a1" })),
      result: { teamAWins: 4, teamBWins: 0, teamAPoints: 44, teamBPoints: 0, winnerTeamId: "a1" },
    },
    {
      id: "rr-b",
      teamAId: "b1",
      teamBId: "b2",
      groupId: "g-b",
      status: MATCHUP_STATUS.COMPLETED,
      subMatches: scoredSubMatches(mains, [
        { teamA: 11, teamB: 0 },
        { teamA: 11, teamB: 0 },
        { teamA: 11, teamB: 0 },
        { teamA: 11, teamB: 0 },
      ]).map((item) => ({ ...item, winnerTeamId: "b1" })),
      result: { teamAWins: 4, teamBWins: 0, teamAPoints: 44, teamBPoints: 0, winnerTeamId: "b1" },
    },
  ];
  teamData.settings = {
    ...teamData.settings,
    formatPreset: FORMAT_PRESET.MLP_4,
    dreambreakerEnabled: true,
    stageTieBreakPolicy: {
      group: STAGE_TIE_BREAK_POLICY.TOTAL_SUBMATCH_POINTS,
      semifinal: STAGE_TIE_BREAK_POLICY.TOTAL_SUBMATCH_POINTS,
      final: STAGE_TIE_BREAK_POLICY.DREAMBREAKER,
    },
  };
  teamData = normalizeTeamData(teamData);
  const built = generateTeamKnockoutMatchups(teamData, { qualifiersPerGroup: 2 });
  assert.equal(built.ok, true);

  const first = listKnockoutMatchups(built.teamData).find(
    (row) => row.teamAId && row.teamBId && row.status !== MATCHUP_STATUS.COMPLETED
  );
  assert.ok(first);
  assert.equal(resolveMatchupCompetitionStage(built.teamData, first), COMPETITION_STAGE.SEMIFINAL);

  const withScores = normalizeTeamData({
    ...built.teamData,
    matchups: built.teamData.matchups.map((row) =>
      row.id === first.id
        ? {
            ...row,
            status: MATCHUP_STATUS.IN_PROGRESS,
            subMatches: scoredSubMatches(mains, [
              { teamA: 11, teamB: 4 },
              { teamA: 11, teamB: 7 },
              { teamA: 8, teamB: 11 },
              { teamA: 6, teamB: 11 },
            ]).map((item, index) => ({
              ...item,
              id: `ko-sub-${index}`,
              winnerTeamId:
                index < 2 ? first.teamAId : first.teamBId,
              score:
                index < 2
                  ? { teamA: 11, teamB: index === 0 ? 4 : 7, games: [] }
                  : { teamA: index === 2 ? 8 : 6, teamB: 11, games: [] },
            })),
          }
        : row
    ),
  });

  const computed = computeMatchupResult(withScores, first.id);
  assert.equal(computed.needsDreambreaker, false);
  assert.equal(computed.result.winnerTeamId, first.teamAId);
  assert.equal(computed.result.teamAWins, 2);
  assert.equal(computed.result.teamBWins, 2);
  const next = computed.teamData.matchups.find((row) => row.id === first.nextMatchupId);
  assert.ok(next);
  assert.ok(next.teamAId === first.teamAId || next.teamBId === first.teamAId);
});

test("8. reload persists configured policy through settings normalize", () => {
  const policy = {
    group: STAGE_TIE_BREAK_POLICY.TOTAL_SUBMATCH_POINTS,
    quarterfinal: STAGE_TIE_BREAK_POLICY.DREAMBREAKER,
    semifinal: STAGE_TIE_BREAK_POLICY.DREAMBREAKER,
    final: STAGE_TIE_BREAK_POLICY.DREAMBREAKER,
    round_of_16: STAGE_TIE_BREAK_POLICY.DREAMBREAKER,
  };
  const persisted = validateFormatVenueConfigForPersist({
    formatPreset: FORMAT_PRESET.MLP_4,
    groupCount: 1,
    qualificationCount: 2,
    stageTieBreakPolicy: policy,
  });
  assert.equal(persisted.ok, true);
  assert.deepEqual(persisted.payload.stageTieBreakPolicy.group, STAGE_TIE_BREAK_POLICY.TOTAL_SUBMATCH_POINTS);

  const reloaded = normalizeTeamData({
    settings: { formatPreset: FORMAT_PRESET.MLP_4, stageTieBreakPolicy: policy },
  });
  assert.equal(reloaded.settings.stageTieBreakPolicy.group, STAGE_TIE_BREAK_POLICY.TOTAL_SUBMATCH_POINTS);
  const defaults = resolveFormatVenueDefaults(reloaded);
  assert.equal(defaults.stageTieBreakPolicy.group, STAGE_TIE_BREAK_POLICY.TOTAL_SUBMATCH_POINTS);
});

test("9. legacy/existing tournament defaults safely to DREAMBREAKER", () => {
  const teamData = buildMlpMatchup({ settings: {} });
  assert.equal(
    resolveEffectiveStageTieBreakPolicy(teamData, teamData.matchups[0]),
    STAGE_TIE_BREAK_POLICY.DREAMBREAKER
  );
  assert.equal(normalizeStageTieBreakPolicy(undefined).group, STAGE_TIE_BREAK_POLICY.DREAMBREAKER);
  const payload = buildSetupConfigPayload({
    formatPreset: FORMAT_PRESET.MLP_4,
    groupCount: 1,
  });
  assert.equal(payload.stageTieBreakPolicy, undefined);
});

test("10. cross-tenant mutation denied by existing setup prepare (SQL contract)", () => {
  const apply = readPkg("02_APPLY.sql");
  assert.match(apply, /team_tournament_setup_mutation_prepare/);
  assert.match(apply, /team_tournament_update_setup_config/);
  assert.doesNotMatch(apply, /is_super_admin\(\)\s+then\s+return/i);
});

test("11. policy cannot change past lifecycle lock boundary", () => {
  const teamData = buildMlpMatchup({
    settings: {
      stageTieBreakPolicy: { group: STAGE_TIE_BREAK_POLICY.DREAMBREAKER },
    },
  });
  const locked = assertStageTieBreakPolicyWritable(teamData, {
    group: STAGE_TIE_BREAK_POLICY.TOTAL_SUBMATCH_POINTS,
  });
  assert.equal(locked.ok, false);
  assert.equal(locked.code, "STAGE_TIEBREAK_POLICY_LOCKED");

  const lineupOnly = normalizeTeamData({
    ...teamData,
    matchups: teamData.matchups.map((item) => ({
      ...item,
      status: MATCHUP_STATUS.LINEUP_OPEN,
      subMatches: item.subMatches.map((sub) => ({
        ...sub,
        status: SUB_MATCH_STATUS.WAITING,
        winnerTeamId: "",
        score: { teamA: 0, teamB: 0 },
      })),
    })),
  });
  const writable = assertStageTieBreakPolicyWritable(lineupOnly, {
    group: STAGE_TIE_BREAK_POLICY.TOTAL_SUBMATCH_POINTS,
  });
  assert.equal(writable.ok, true);
});

test("12. no Dreambreaker submatch created under TOTAL_SUBMATCH_POINTS unequal totals", () => {
  const result = computeMatchupResult(
    buildMlpMatchup({
      settings: {
        stageTieBreakPolicy: { group: STAGE_TIE_BREAK_POLICY.TOTAL_SUBMATCH_POINTS },
      },
    }),
    "matchup-1"
  );
  const matchup = result.teamData.matchups[0];
  const dreambreakerSubs = matchup.subMatches.filter((sub) =>
    String(sub.disciplineId || "").toLowerCase().includes("dream")
  );
  assert.equal(dreambreakerSubs.length, 0);
  assert.notEqual(matchup.dreambreaker?.status, "lineup_open");
  assert.equal(computeMatchupTieProgress(result.teamData, matchup).needsDreambreaker, false);
});

const EQUAL_TOTAL_POINTS_SCORES = [
  { teamA: 11, teamB: 7 },
  { teamA: 11, teamB: 7 },
  { teamA: 7, teamB: 11 },
  { teamA: 7, teamB: 11 },
];

function buildEqualTotalPointsMatchup() {
  return buildMlpMatchup({
    scores: EQUAL_TOTAL_POINTS_SCORES,
    settings: {
      stageTieBreakPolicy: { group: STAGE_TIE_BREAK_POLICY.TOTAL_SUBMATCH_POINTS },
    },
  });
}

function completeFallbackDreambreaker(teamData) {
  let next = submitDreambreakerOrder(teamData, {
    matchupId: "matchup-1",
    teamId: "team-a",
    order: ["m1", "m2", "f1", "f2"],
  }).teamData;
  next = submitDreambreakerOrder(next, {
    matchupId: "matchup-1",
    teamId: "team-b",
    order: ["m3", "m4", "f3", "f4"],
  }).teamData;
  next = startDreambreaker(next, "matchup-1").teamData;
  for (let index = 0; index < 21; index += 1) {
    const scored = recordDreambreakerPoint(next, {
      matchupId: "matchup-1",
      scoringTeamId: "team-a",
    });
    next = scored.teamData;
    if (scored.completed) {
      break;
    }
  }
  return computeMatchupResult(next, "matchup-1");
}

test("13. 2-2 + TOTAL_SUBMATCH_POINTS + 36-36 falls back to canonical Dreambreaker", () => {
  assert.equal(TOTAL_POINTS_SECONDARY_TIE_CONTRACT, "DREAMBREAKER_FALLBACK");
  const result = computeMatchupResult(buildEqualTotalPointsMatchup(), "matchup-1");
  assert.equal(result.needsDreambreaker, true);
  assert.equal(result.result.winnerTeamId, "");
  assert.equal(result.result.teamAWins, 2);
  assert.equal(result.result.teamBWins, 2);
  assert.equal(result.result.teamAPoints, 36);
  assert.equal(result.result.teamBPoints, 36);
  assert.equal(result.result.tieBreakStatus, TOTAL_POINTS_SECONDARY_TIE_STATUS);
  assert.equal(result.result.tieBreakPolicy, STAGE_TIE_BREAK_POLICY.TOTAL_SUBMATCH_POINTS);
  assert.notEqual(result.teamData.matchups[0].status, MATCHUP_STATUS.COMPLETED);
  assert.equal(result.teamData.matchups[0].dreambreaker?.status, DREAMBREAKER_STATUS.LINEUP_OPEN);
  const progress = computeMatchupTieProgress(result.teamData, result.teamData.matchups[0]);
  assert.equal(progress.needsDreambreaker, true);
  assert.equal(progress.dreambreakerEnabled, true);
  assert.equal(listDreambreakerMatchups(result.teamData).length, 1);
});

test("14. fallback Dreambreaker winner becomes parent winner without fabricating 3-2", () => {
  const finished = completeFallbackDreambreaker(
    computeMatchupResult(buildEqualTotalPointsMatchup(), "matchup-1").teamData
  );
  const matchup = finished.teamData.matchups[0];
  assert.equal(finished.needsDreambreaker, false);
  assert.equal(finished.result.winnerTeamId, "team-a");
  assert.equal(finished.result.teamAWins, 2);
  assert.equal(finished.result.teamBWins, 2);
  assert.equal(finished.result.teamAPoints, 36);
  assert.equal(finished.result.teamBPoints, 36);
  assert.equal(finished.result.tieBreakStatus, "dreambreaker");
  assert.notEqual(finished.result.teamAWins, 3);
  assert.equal(matchup.status, MATCHUP_STATUS.COMPLETED);
  assert.equal(matchup.dreambreaker?.status, DREAMBREAKER_STATUS.COMPLETED);
});

test("15. captain payload/order is required only on secondary-tie fallback", () => {
  const fallback = computeMatchupResult(buildEqualTotalPointsMatchup(), "matchup-1");
  const matchup = fallback.teamData.matchups[0];
  assert.equal(listDreambreakerMatchups(fallback.teamData, { teamId: "team-a" }).length, 1);
  const projected = projectCaptainPortalMatchupDreambreaker(matchup, "team-a");
  assert.equal(projected.dreambreaker.status, DREAMBREAKER_STATUS.LINEUP_OPEN);
  const command = buildCaptainDreambreakerSubmitCommand({
    matchup,
    teamId: "team-a",
    viewerTeamId: "team-a",
    rosterIds: ["m1", "m2", "f1", "f2"],
    order: ["m1", "m2", "f1", "f2"],
  });
  assert.equal(command.ok, true);
  const submitted = submitDreambreakerOrder(fallback.teamData, {
    matchupId: "matchup-1",
    teamId: "team-a",
    order: ["m1", "m2", "f1", "f2"],
  });
  assert.equal(submitted.ok, true);

  const unequal = computeMatchupResult(
    buildMlpMatchup({
      settings: {
        stageTieBreakPolicy: { group: STAGE_TIE_BREAK_POLICY.TOTAL_SUBMATCH_POINTS },
      },
    }),
    "matchup-1"
  );
  assert.equal(listDreambreakerMatchups(unequal.teamData).length, 0);
  const blocked = submitDreambreakerOrder(unequal.teamData, {
    matchupId: "matchup-1",
    teamId: "team-a",
    order: ["m1", "m2", "f1", "f2"],
  });
  assert.equal(blocked.ok, false);
});

test("16. referee READY/start is available only after fallback captain orders", () => {
  const activated = computeMatchupResult(buildEqualTotalPointsMatchup(), "matchup-1");
  const beforeOrders = startDreambreaker(activated.teamData, "matchup-1");
  assert.equal(beforeOrders.ok, false);

  let ready = submitDreambreakerOrder(activated.teamData, {
    matchupId: "matchup-1",
    teamId: "team-a",
    order: ["m1", "m2", "f1", "f2"],
  }).teamData;
  ready = submitDreambreakerOrder(ready, {
    matchupId: "matchup-1",
    teamId: "team-b",
    order: ["m3", "m4", "f3", "f4"],
  }).teamData;
  assert.equal(ready.matchups[0].dreambreaker?.status, DREAMBREAKER_STATUS.READY);
  const started = startDreambreaker(ready, "matchup-1");
  assert.equal(started.ok, true);
  assert.equal(started.teamData.matchups[0].dreambreaker?.status, DREAMBREAKER_STATUS.IN_PROGRESS);
  assert.ok(
    started.teamData.matchups[0].subMatches.some((sub) =>
      String(sub.disciplineId || "").toLowerCase().includes("dream")
    )
  );

  const unequal = computeMatchupResult(
    buildMlpMatchup({
      settings: {
        stageTieBreakPolicy: { group: STAGE_TIE_BREAK_POLICY.TOTAL_SUBMATCH_POINTS },
      },
    }),
    "matchup-1"
  );
  assert.equal(startDreambreaker(unequal.teamData, "matchup-1").ok, false);
  const startCommand = buildRefereeDreambreakerStartCommand(unequal.teamData.matchups[0]);
  assert.equal(startCommand.ok, false);
});

test("17. reload persistence keeps fallback Dreambreaker required", () => {
  const computed = computeMatchupResult(buildEqualTotalPointsMatchup(), "matchup-1");
  const reloaded = normalizeTeamData(JSON.parse(JSON.stringify(computed.teamData)));
  assert.equal(
    reloaded.settings.stageTieBreakPolicy.group,
    STAGE_TIE_BREAK_POLICY.TOTAL_SUBMATCH_POINTS
  );
  assert.equal(reloaded.matchups[0].result.needsDreambreaker, true);
  assert.equal(reloaded.matchups[0].result.tieBreakStatus, TOTAL_POINTS_SECONDARY_TIE_STATUS);
  assert.equal(reloaded.matchups[0].dreambreaker?.status, DREAMBREAKER_STATUS.LINEUP_OPEN);
  const again = computeMatchupResult(reloaded, "matchup-1");
  assert.equal(again.needsDreambreaker, true);
  assert.equal(again.result.winnerTeamId, "");
  assert.equal(again.teamData.matchups[0].dreambreaker?.status, DREAMBREAKER_STATUS.LINEUP_OPEN);
});

test("SQL package is locked local-only and documents DREAMBREAKER_FALLBACK", () => {
  const readme = readPkg("README.md");
  assert.match(readme, /DO NOT APPLY/);
  assert.match(readme, /STAGE_TIEBREAK_POLICY_IMPLEMENTED=YES/);
  assert.match(readme, /TOTAL_POINTS_SECONDARY_TIE_CONTRACT=DREAMBREAKER_FALLBACK/);
  assert.match(readme, /DREAMBREAKER/);

  const apply = readPkg("02_APPLY.sql");
  assert.match(apply, /stageTieBreakPolicy/);
  assert.match(apply, /TOTAL_SUBMATCH_POINTS/);
  assert.match(apply, /STAGE_TIEBREAK_POLICY_LOCKED/);
  assert.match(apply, /dreambreaker_fallback/);
  assert.match(apply, /TOTAL_POINTS_SECONDARY_TIE_CONTRACT=DREAMBREAKER_FALLBACK/);
  assert.doesNotMatch(apply, /secondary_tie_unresolved/);
  assert.doesNotMatch(apply, /STAGE_POLICY_NOT_DREAMBREAKER/);

  const verify = readPkg("03_VERIFY.sql");
  assert.match(verify, /No data mutation|Read-only/i);
  assert.match(verify, /dreambreaker_fallback/);
  assert.match(verify, /still uses unresolved secondary-tie behavior/);

  const rollback = readPkg("04_ROLLBACK.sql");
  assert.match(rollback, /drop function if exists public.team_tournament_resolve_stage_tiebreak_policy/);
});
