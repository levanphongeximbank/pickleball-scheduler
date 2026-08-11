/**
 * TEAM-TOURNAMENT-PR412-DREAMBREAKER-FINAL-CLOSURE-01
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  DREAMBREAKER_STATUS,
  SUB_MATCH_STATUS,
} from "../src/features/team-tournament/constants.js";
import {
  buildRefereeDreambreakerPointCommand,
  buildRefereeDreambreakerStartCommand,
  getDreambreakerCourtPlayers,
  recordDreambreakerPoint,
  startDreambreaker,
  submitDreambreakerOrder,
  undoDreambreakerPoint,
} from "../src/features/team-tournament/engines/dreambreakerEngine.js";
import { attachPersistedDreambreakerProjection } from "../src/features/team-tournament/engines/dreambreakerProjection.js";
import {
  DEFAULT_DREAMBREAKER_SCORING,
  getDreambreakerScoringHints,
  resolveDreambreakerScoringFormat,
} from "../src/features/team-tournament/engines/dreambreakerScoringContract.js";
import { isDreambreakerSubMatch } from "../src/features/team-tournament/engines/forfeitEngine.js";
import { createMlpPreset } from "../src/features/team-tournament/engines/mlpPresetEngine.js";
import { buildRefereeMatchupView } from "../src/features/team-tournament/engines/teamRefereeEngine.js";
import { computeMatchupResult } from "../src/features/team-tournament/engines/teamResultEngine.js";
import {
  createTeamRecord,
  normalizeDreambreakerState,
  normalizeTeamData,
} from "../src/features/team-tournament/models/index.js";
import { TT1B_REQUIRES_EXPECTED_VERSION } from "../src/features/team-tournament/services/teamTournamentRpcService.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const pkgDir = "docs/v5/migrations/team-tournament-dreambreaker-final-closure-01";

function readSrc(rel) {
  return readFileSync(join(root, rel), "utf8");
}

const ORDERS = {
  teamA: ["M04", "M05", "F01", "F05"],
  teamB: ["M03", "M07", "F03", "F07"],
};

function buildTwoTwoData({
  matchupId = "matchup-ilj0220c",
  scheduleMeta,
  scoringFormat,
} = {}) {
  const preset = createMlpPreset();
  const teamA = createTeamRecord({
    id: "team-a",
    playerIds: ORDERS.teamA,
  });
  const teamB = createTeamRecord({
    id: "team-b",
    playerIds: ORDERS.teamB,
  });
  const mainDisciplines = preset.disciplines.filter((item) => item.activationRule === "always");
  const subMatches = mainDisciplines.map((discipline, index) => ({
    id: `sub-${matchupId}-${index}`,
    disciplineId: discipline.id,
    sortOrder: discipline.sortOrder,
    status: SUB_MATCH_STATUS.COMPLETED,
    score: { teamA: index < 2 ? 21 : 6, teamB: index < 2 ? 6 : 21, games: [] },
    winnerTeamId: index < 2 ? "team-a" : "team-b",
  }));

  return normalizeTeamData({
    ...preset,
    teams: [teamA, teamB],
    matchups: [
      {
        id: matchupId,
        teamAId: "team-a",
        teamBId: "team-b",
        status: "in_progress",
        scheduleMeta: {
          ...(scheduleMeta || {}),
          ...(scoringFormat ? { dreambreakerScoringFormat: scoringFormat } : {}),
        },
        subMatches,
      },
    ],
  });
}

function readyAndStart(data) {
  let next = submitDreambreakerOrder(data, {
    matchupId: "matchup-ilj0220c",
    teamId: "team-a",
    order: ORDERS.teamA,
  }).teamData;
  next = submitDreambreakerOrder(next, {
    matchupId: "matchup-ilj0220c",
    teamId: "team-b",
    order: ORDERS.teamB,
  }).teamData;
  return startDreambreaker(next, "matchup-ilj0220c", { forceLock: true }).teamData;
}

function scoreMany(data, teamId, count) {
  let next = data;
  for (let index = 0; index < count; index += 1) {
    const matchup = next.matchups[0];
    const result = recordDreambreakerPoint(next, {
      matchupId: matchup.id,
      scoringTeamId: teamId,
      expectedVersion: matchup.dreambreaker.version,
    });
    assert.equal(result.ok, true, result.error || `point ${index + 1} should accept`);
    next = result.teamData;
  }
  return next;
}

test("start + orders produce one Dreambreaker submatch and READY/IN_PROGRESS", () => {
  const started = readyAndStart(buildTwoTwoData());
  const matchup = started.matchups[0];
  assert.equal(matchup.dreambreaker.status, DREAMBREAKER_STATUS.IN_PROGRESS);
  const dbSubs = matchup.subMatches.filter((item) => String(item.id).startsWith("db-") || item.id === matchup.dreambreaker.subMatchId);
  assert.equal(dbSubs.length, 1);
  const startCmd = buildRefereeDreambreakerStartCommand({
    id: matchup.id,
    dreambreaker: { version: 3 },
  });
  assert.equal(startCmd.ok, true);
});

test("reader/reload preserves rotation, scoringFormat, and current pair", () => {
  const reader = {
    matchupId: "matchup-ilj0220c",
    status: DREAMBREAKER_STATUS.IN_PROGRESS,
    teamAOrder: ORDERS.teamA,
    teamBOrder: ORDERS.teamB,
    teamAScore: 4,
    teamBScore: 0,
    version: 8,
    scoringFormat: { targetScore: 21, winBy: 2, rotationPoints: 4 },
    rotation: {
      segmentIndex: 1,
      pointsInSegment: 0,
      pointHistory: [{ segmentIndex: 0 }, { segmentIndex: 0 }, { segmentIndex: 0 }, { segmentIndex: 0 }],
      injurySkips: [],
    },
    subMatchId: "db-matchup-ilj0220c",
  };
  const projected = attachPersistedDreambreakerProjection({
    matchups: [{ id: "matchup-ilj0220c", teamAId: "team-a", teamBId: "team-b" }],
    dreambreaker: { "matchup-ilj0220c": reader },
  });
  const normalized = normalizeDreambreakerState(projected.matchups[0].dreambreaker);
  assert.equal(normalized.rotation.segmentIndex, 1);
  assert.equal(normalized.rotation.pointsInSegment, 0);
  assert.equal(normalized.scoringFormat.targetScore, 21);
  assert.equal(normalized.subMatchId, "db-matchup-ilj0220c");
  const court = getDreambreakerCourtPlayers(projected.matchups[0]);
  assert.equal(court.teamAPlayerId, "M05");
  assert.equal(court.teamBPlayerId, "M07");
  assert.notEqual(normalized.rotation.segmentIndex, 0);
});

test("rotation 0→1→2→3 every 4 total rallies", () => {
  let data = readyAndStart(buildTwoTwoData());
  const expected = [
    ["M04", "M03"],
    ["M05", "M07"],
    ["F01", "F03"],
    ["F05", "F07"],
  ];
  for (let segment = 0; segment < 4; segment += 1) {
    const court = getDreambreakerCourtPlayers(data.matchups[0]);
    assert.equal(court.segmentIndex, segment);
    assert.equal(court.teamAPlayerId, expected[segment][0]);
    assert.equal(court.teamBPlayerId, expected[segment][1]);
    data = scoreMany(data, "team-a", 4);
    assert.equal(data.matchups[0].dreambreaker.rotation.pointHistory.at(-1).segmentIndex, segment);
  }
  const wrap = getDreambreakerCourtPlayers(data.matchups[0]);
  assert.equal(wrap.segmentIndex, 4);
  assert.equal(wrap.teamAPlayerId, "M04");
  assert.equal(wrap.teamBPlayerId, "M03");
});

test("configurable scoring default 21 and alternate 15", () => {
  const def = resolveDreambreakerScoringFormat({
    matchup: { scheduleMeta: { groupId: "grp-bang-a" } },
    disciplines: [],
  });
  assert.equal(def.targetScore, DEFAULT_DREAMBREAKER_SCORING.targetScore);
  assert.equal(def.targetScore, 21);
  const alt = resolveDreambreakerScoringFormat({
    matchup: { scheduleMeta: { dreambreakerScoringFormat: { targetPoints: 15 } } },
    disciplines: [],
  });
  assert.equal(alt.targetScore, 15);
  assert.match(getDreambreakerScoringHints({ scheduleMeta: {} }, []), /Rally đến 21, cách 2/);
  assert.doesNotMatch(getDreambreakerScoringHints({ scheduleMeta: {} }, []), /Freeze/);
});

test("CAS / stale / concurrent / idempotency contracts", () => {
  assert.ok(TT1B_REQUIRES_EXPECTED_VERSION.includes("team_tournament_record_dreambreaker_point"));
  assert.ok(TT1B_REQUIRES_EXPECTED_VERSION.includes("team_tournament_undo_dreambreaker_point"));
  let data = readyAndStart(buildTwoTwoData());
  const version = data.matchups[0].dreambreaker.version;
  const accepted = recordDreambreakerPoint(data, {
    matchupId: "matchup-ilj0220c",
    scoringTeamId: "team-a",
    expectedVersion: version,
  });
  assert.equal(accepted.ok, true);
  const stale = recordDreambreakerPoint(accepted.teamData, {
    matchupId: "matchup-ilj0220c",
    scoringTeamId: "team-a",
    expectedVersion: version,
  });
  assert.equal(stale.ok, false);
  assert.equal(stale.code, "VERSION_CONFLICT");
  const pointCmd = buildRefereeDreambreakerPointCommand(data.matchups[0], "team-a");
  assert.equal(pointCmd.payload.expectedVersion, version);
  const cloud = readSrc("src/features/team-tournament/services/dreambreakerCloudCommands.js");
  assert.match(cloud, /db-point:\$\{tournamentId\}:\$\{payload\.matchupId\}/);
  assert.match(cloud, /db-undo:\$\{tournamentId\}:\$\{payload\.matchupId\}/);
});

test("undo normal and undo at rotation boundary restore pair", () => {
  let data = readyAndStart(buildTwoTwoData());
  data = scoreMany(data, "team-a", 4);
  assert.equal(data.matchups[0].dreambreaker.rotation.segmentIndex, 1);
  const undone = undoDreambreakerPoint(data, "matchup-ilj0220c", {
    expectedVersion: data.matchups[0].dreambreaker.version,
  });
  assert.equal(undone.ok, true);
  assert.equal(undone.teamData.matchups[0].dreambreaker.rotation.segmentIndex, 0);
  assert.equal(undone.teamData.matchups[0].dreambreaker.rotation.pointsInSegment, 3);
  assert.equal(undone.teamData.matchups[0].dreambreaker.teamAScore, 3);
  const court = getDreambreakerCourtPlayers(undone.teamData.matchups[0]);
  assert.equal(court.teamAPlayerId, "M04");
});

test("undo after completed reopens Dreambreaker without 3-2 parent", () => {
  let data = readyAndStart(buildTwoTwoData({ scoringFormat: { targetScore: 21, winBy: 2 } }));
  data = scoreMany(data, "team-a", 21);
  const completed = data.matchups[0];
  assert.equal(completed.dreambreaker.status, DREAMBREAKER_STATUS.COMPLETED);
  assert.equal(completed.result.winnerTeamId, "team-a");
  assert.equal(completed.result.teamAWins, 2);
  assert.equal(completed.result.teamBWins, 2);
  const undone = undoDreambreakerPoint(data, "matchup-ilj0220c", {
    expectedVersion: completed.dreambreaker.version,
  });
  assert.equal(undone.ok, true);
  const matchup = undone.teamData.matchups[0];
  assert.equal(matchup.dreambreaker.status, DREAMBREAKER_STATUS.IN_PROGRESS);
  assert.equal(matchup.dreambreaker.teamAScore, 20);
  assert.equal(matchup.result.winnerTeamId, "");
  assert.equal(matchup.subMatches.find((item) => item.id === matchup.dreambreaker.subMatchId).status, SUB_MATCH_STATUS.PLAYING);
  const extra = recordDreambreakerPoint(data, {
    matchupId: "matchup-ilj0220c",
    scoringTeamId: "team-a",
    expectedVersion: completed.dreambreaker.version,
  });
  assert.equal(extra.ok, false);
});

test("injury control is hidden and not a live scoring authority", () => {
  const panel = readSrc("src/components/tournament/team/DreambreakerPanel.jsx");
  const portal = readSrc("src/pages/tournament/TeamRefereePortal.jsx");
  assert.doesNotMatch(panel, /Chấn thương/);
  assert.doesNotMatch(portal, /onDreambreakerInjury/);
  assert.doesNotMatch(portal, /refereeDreambreakerInjury/);
});

test("completion win-by-2 for 21 and 15", () => {
  const cases = [
    { target: 21, scores: [21, 20], completeAt: [22, 20] },
    { target: 15, scores: [15, 14], completeAt: [16, 14] },
  ];
  for (const item of cases) {
    let data = readyAndStart(
      buildTwoTwoData({ scoringFormat: { targetScore: item.target, winBy: 2 } })
    );
    data = scoreMany(data, "team-a", item.target);
    assert.equal(data.matchups[0].dreambreaker.status, DREAMBREAKER_STATUS.COMPLETED);
    data = readyAndStart(
      buildTwoTwoData({ scoringFormat: { targetScore: item.target, winBy: 2 } })
    );
    data = scoreMany(data, "team-a", item.scores[0] - 1);
    data = scoreMany(data, "team-b", item.scores[1]);
    data = scoreMany(data, "team-a", 1);
    assert.equal(data.matchups[0].dreambreaker.status, DREAMBREAKER_STATUS.IN_PROGRESS);
    assert.equal(data.matchups[0].dreambreaker.teamAScore, item.scores[0]);
    assert.equal(data.matchups[0].dreambreaker.teamBScore, item.scores[1]);
    data = scoreMany(data, "team-a", 1);
    assert.equal(data.matchups[0].dreambreaker.status, DREAMBREAKER_STATUS.COMPLETED);
    assert.equal(data.matchups[0].dreambreaker.teamAScore, item.completeAt[0]);
    assert.equal(data.matchups[0].dreambreaker.teamBScore, item.completeAt[1]);
  }
});

test("parent winner stays 2-2 and generic card excludes Dreambreaker", () => {
  let data = readyAndStart(buildTwoTwoData());
  data = scoreMany(data, "team-a", 21);
  const computed = computeMatchupResult(data, "matchup-ilj0220c");
  assert.equal(computed.result.winnerTeamId, "team-a");
  assert.equal(computed.result.teamAWins, 2);
  assert.equal(computed.result.teamBWins, 2);
  const view = buildRefereeMatchupView(data, "matchup-ilj0220c", []);
  assert.equal(view.ok, true);
  assert.equal(view.matchup.subMatches.some((item) => isDreambreakerSubMatch(data, item, data.matchups[0])), false);
  assert.equal(
    view.matchup.subMatches.some((item) => String(item.disciplineName || item.subMatchId).toLowerCase().includes("dreambreaker")),
    false
  );
});

test("completed reload hides +1 and keeps one Dreambreaker submatch", () => {
  let data = readyAndStart(buildTwoTwoData());
  data = scoreMany(data, "team-a", 21);
  const matchup = data.matchups[0];
  assert.equal(matchup.dreambreaker.status, DREAMBREAKER_STATUS.COMPLETED);
  assert.equal(matchup.status, "completed");
  const dbSubs = matchup.subMatches.filter(
    (item) => item.id === matchup.dreambreaker.subMatchId || String(item.id).startsWith("db-")
  );
  assert.equal(dbSubs.length, 1);
  const panel = readSrc("src/components/tournament/team/DreambreakerPanel.jsx");
  assert.match(panel, /Dreambreaker kết thúc/);
  assert.match(panel, /Hoàn tác điểm cuối/);
});

test("auth/tenant isolation unchanged and Super Admin helpers untouched", () => {
  const apply = readSrc(`${pkgDir}/02_APPLY.sql`);
  assert.doesNotMatch(apply, /CREATE POLICY/);
  assert.doesNotMatch(apply, /is_super_admin/);
  assert.match(apply, /team_tournament_assert_tenant/);
  const verify = readSrc(`${pkgDir}/03_VERIFY.sql`);
  assert.match(verify, /AUTHENTICATED_GRANTS_PRESERVED/);
  assert.match(verify, /ANON_GRANTS_UNCHANGED/);
});

test("SQL package is additive final closure and does not replay scoring-cas", () => {
  const files = ["01_PRECHECK.sql", "02_APPLY.sql", "03_VERIFY.sql", "04_ROLLBACK.sql", "README.md"];
  for (const name of files) {
    assert.ok(readSrc(`${pkgDir}/${name}`).length > 0, name);
  }
  const apply = readSrc(`${pkgDir}/02_APPLY.sql`);
  assert.match(apply, /DREAMBREAKER_FINAL_CLOSURE_01/);
  assert.match(apply, /'rotation', coalesce\(db\.rotation/);
  assert.match(apply, /'scoringFormat'/);
  assert.match(apply, /'subMatchId', db\.sub_match_external_id/);
  assert.match(apply, /DREAMBREAKER_UNDO_PARENT_RECOMPUTE/);
  assert.match(apply, /team_tournament_recompute_standings_cache/);
  assert.doesNotMatch(apply, /CANONICAL_DREAMBREAKER_DEFAULT_TARGET = 11/);
  const precheck = readSrc(`${pkgDir}/01_PRECHECK.sql`);
  assert.match(precheck, /SCORING_CAS_ALREADY_APPLIED/);
  assert.match(precheck, /no_data_mutation/);
});
