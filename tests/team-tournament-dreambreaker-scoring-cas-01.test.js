/**
 * TEAM-TOURNAMENT-PR412-DREAMBREAKER-SCORING-CONFIG-CAS-01
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
import { resolveDreambreakerExpectedVersion } from "../src/features/team-tournament/engines/captainDreambreakerPortalContract.js";
import {
  buildRefereeDreambreakerPointCommand,
  buildRefereeDreambreakerStartCommand,
  recordDreambreakerPoint,
  startDreambreaker,
  submitDreambreakerOrder,
} from "../src/features/team-tournament/engines/dreambreakerEngine.js";
import {
  DEFAULT_DREAMBREAKER_SCORING,
  getDreambreakerScoringHints,
  resolveDreambreakerScoringFormat,
} from "../src/features/team-tournament/engines/dreambreakerScoringContract.js";
import { createMlpPreset } from "../src/features/team-tournament/engines/mlpPresetEngine.js";
import { computeMatchupResult } from "../src/features/team-tournament/engines/teamResultEngine.js";
import { TT1B_REQUIRES_EXPECTED_VERSION } from "../src/features/team-tournament/services/teamTournamentRpcService.js";
import { createTeamRecord, normalizeTeamData } from "../src/features/team-tournament/models/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const pkgDir = "docs/v5/migrations/team-tournament-dreambreaker-scoring-cas-01";

function readSrc(rel) {
  return readFileSync(join(root, rel), "utf8");
}

function buildTwoTwoMatchup({
  includeDreambreakerDiscipline = true,
  matchupId = "matchup-1",
  scheduleMeta,
  dreambreakerScoringFormat,
} = {}) {
  const preset = createMlpPreset();
  const teamA = createTeamRecord({ id: "team-a", playerIds: ["m1", "m2", "f1", "f2"] });
  const teamB = createTeamRecord({ id: "team-b", playerIds: ["m3", "m4", "f3", "f4"] });
  const disciplines = includeDreambreakerDiscipline
    ? preset.disciplines
    : preset.disciplines.filter((item) => item.activationRule === "always");
  const mainDisciplines = disciplines.filter((item) => item.activationRule === "always");
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
    disciplines,
    teams: [teamA, teamB],
    matchups: [
      {
        id: matchupId,
        teamAId: "team-a",
        teamBId: "team-b",
        status: "in_progress",
        scheduleMeta,
        subMatches,
        dreambreaker: dreambreakerScoringFormat
          ? { scoringFormat: dreambreakerScoringFormat }
          : undefined,
      },
    ],
  });
}

function startReadyDreambreaker(teamData, matchupId = "matchup-1", version = 4) {
  let next = computeMatchupResult(teamData, matchupId).teamData;
  next = submitDreambreakerOrder(next, {
    matchupId,
    teamId: "team-a",
    order: ["m1", "m2", "f1", "f2"],
  }).teamData;
  next = submitDreambreakerOrder(next, {
    matchupId,
    teamId: "team-b",
    order: ["m3", "m4", "f3", "f4"],
  }).teamData;
  next = {
    ...next,
    matchups: next.matchups.map((matchup) =>
      matchup.id === matchupId
        ? {
            ...matchup,
            dreambreaker: {
              ...matchup.dreambreaker,
              version,
            },
          }
        : matchup
    ),
  };
  next = startDreambreaker(next, matchupId, { expectedVersion: version }).teamData;
  return next;
}

function scoreUntilComplete(teamData, matchupId, scoringTeamId) {
  let current = teamData;
  let last = null;
  for (let index = 0; index < 40; index += 1) {
    const expectedVersion = resolveDreambreakerExpectedVersion(
      current.matchups.find((item) => item.id === matchupId)
    );
    last = recordDreambreakerPoint(current, {
      matchupId,
      scoringTeamId,
      expectedVersion,
    });
    assert.equal(last.ok, true, last.error);
    current = last.teamData;
    if (last.completed) {
      break;
    }
  }
  return { teamData: current, last };
}

test("A no explicit matchup override resolves targetPoints=21 winBy=2", () => {
  const teamData = buildTwoTwoMatchup();
  const matchup = teamData.matchups[0];
  const scoring = resolveDreambreakerScoringFormat({
    matchup,
    disciplines: teamData.disciplines,
  });
  assert.equal(scoring.targetScore, 21);
  assert.equal(scoring.winBy, 2);
  assert.equal(scoring.rotationPoints, 4);
  assert.equal(DEFAULT_DREAMBREAKER_SCORING.targetScore, 21);
  assert.match(getDreambreakerScoringHints(matchup, teamData.disciplines), /Rally đến 21, cách 2/);
});

test("B matchup override targetPoints=15 is used by scoring and UI", () => {
  const teamData = startReadyDreambreaker(
    buildTwoTwoMatchup({
      scheduleMeta: { dreambreakerScoringFormat: { targetPoints: 15 } },
    })
  );
  const matchup = teamData.matchups[0];
  const scoring = resolveDreambreakerScoringFormat({
    matchup,
    disciplines: teamData.disciplines,
  });
  assert.equal(scoring.targetScore, 15);
  assert.equal(scoring.winBy, 2);
  assert.match(getDreambreakerScoringHints(matchup, teamData.disciplines), /Rally đến 15, cách 2/);

  const scored = scoreUntilComplete(teamData, "matchup-1", "team-a");
  const next = scored.teamData.matchups[0];
  assert.equal(scored.last.completed, true);
  assert.equal(next.dreambreaker.teamAScore, 15);
  assert.equal(next.dreambreaker.status, DREAMBREAKER_STATUS.COMPLETED);
});

test("C one matchup on 15 does not change another matchup on 21", () => {
  const preset = createMlpPreset();
  const teamA = createTeamRecord({ id: "team-a", playerIds: ["m1", "m2", "f1", "f2"] });
  const teamB = createTeamRecord({ id: "team-b", playerIds: ["m3", "m4", "f3", "f4"] });
  const main = preset.disciplines.filter((item) => item.activationRule === "always");
  const makeSubs = (prefix) =>
    main.map((discipline, index) => ({
      id: `${prefix}-${index}`,
      disciplineId: discipline.id,
      sortOrder: discipline.sortOrder,
      status: SUB_MATCH_STATUS.COMPLETED,
      score: { teamA: index < 2 ? 21 : 6, teamB: index < 2 ? 6 : 21, games: [] },
      winnerTeamId: index < 2 ? "team-a" : "team-b",
    }));

  const teamData = normalizeTeamData({
    ...preset,
    teams: [teamA, teamB],
    matchups: [
      {
        id: "matchup-15",
        teamAId: "team-a",
        teamBId: "team-b",
        status: "in_progress",
        scheduleMeta: { dreambreakerScoringFormat: { targetScore: 15 } },
        subMatches: makeSubs("s15"),
      },
      {
        id: "matchup-21",
        teamAId: "team-a",
        teamBId: "team-b",
        status: "in_progress",
        subMatches: makeSubs("s21"),
      },
    ],
  });

  const fifteen = resolveDreambreakerScoringFormat({
    matchup: teamData.matchups.find((item) => item.id === "matchup-15"),
    disciplines: teamData.disciplines,
  });
  const twentyOne = resolveDreambreakerScoringFormat({
    matchup: teamData.matchups.find((item) => item.id === "matchup-21"),
    disciplines: teamData.disciplines,
  });
  assert.equal(fifteen.targetScore, 15);
  assert.equal(twentyOne.targetScore, 21);
  assert.match(
    getDreambreakerScoringHints(
      teamData.matchups.find((item) => item.id === "matchup-15"),
      teamData.disciplines
    ),
    /Rally đến 15/
  );
  assert.match(
    getDreambreakerScoringHints(
      teamData.matchups.find((item) => item.id === "matchup-21"),
      teamData.disciplines
    ),
    /Rally đến 21/
  );
});

test("D synthetic Dreambreaker without catalog row uses default 21 not 11", () => {
  const teamData = startReadyDreambreaker(
    buildTwoTwoMatchup({ includeDreambreakerDiscipline: false })
  );
  const matchup = teamData.matchups[0];
  const scoring = resolveDreambreakerScoringFormat({
    matchup,
    disciplines: teamData.disciplines,
  });
  assert.equal(getDreambreakerDisciplineCount(teamData), 0);
  assert.equal(scoring.targetScore, 21);
  assert.equal(scoring.winBy, 2);
  assert.doesNotMatch(
    getDreambreakerScoringHints(matchup, teamData.disciplines),
    /Rally đến 11/
  );

  const scored = scoreUntilComplete(teamData, "matchup-1", "team-a");
  assert.equal(scored.last.completed, true);
  assert.equal(scored.teamData.matchups[0].dreambreaker.teamAScore, 21);
});

function getDreambreakerDisciplineCount(teamData) {
  return (teamData.disciplines || []).filter((item) => {
    const id = String(item?.id || "").toLowerCase();
    const kind = String(item?.disciplineKind || "").toLowerCase();
    const rule = String(item?.activationRule || "").toLowerCase();
    return id.includes("dreambreaker") || kind.includes("dreambreaker") || rule === "tie_at_2_2";
  }).length;
}

test("E accepted point with correct expectedVersion increments score and version once", () => {
  const teamData = startReadyDreambreaker(buildTwoTwoMatchup());
  const before = teamData.matchups[0];
  assert.equal(before.dreambreaker.version, 5);
  const subBefore = before.subMatches.find((item) => item.id === before.dreambreaker.subMatchId);
  const subVersionBefore = Number(subBefore?.version);
  const result = recordDreambreakerPoint(teamData, {
    matchupId: "matchup-1",
    scoringTeamId: "team-a",
    expectedVersion: 5,
  });
  assert.equal(result.ok, true);
  const after = result.teamData.matchups[0];
  assert.equal(after.dreambreaker.teamAScore, 1);
  assert.equal(after.dreambreaker.teamBScore, 0);
  assert.equal(after.dreambreaker.version, 6);
  if (Number.isFinite(subVersionBefore)) {
    const subAfter = after.subMatches.find((item) => item.id === after.dreambreaker.subMatchId);
    assert.equal(subAfter.version, subVersionBefore + 1);
  }
});

test("F stale expectedVersion is zero write", () => {
  const teamData = startReadyDreambreaker(buildTwoTwoMatchup());
  const before = teamData.matchups[0];
  const result = recordDreambreakerPoint(teamData, {
    matchupId: "matchup-1",
    scoringTeamId: "team-a",
    expectedVersion: before.dreambreaker.version - 1,
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "VERSION_CONFLICT");
  assert.equal(result.teamData, undefined);
  const still = teamData.matchups[0];
  assert.equal(still.dreambreaker.teamAScore, 0);
  assert.equal(still.dreambreaker.version, before.dreambreaker.version);
});

test("G two requests with the same expectedVersion accept at most one", () => {
  const teamData = startReadyDreambreaker(buildTwoTwoMatchup());
  const expectedVersion = resolveDreambreakerExpectedVersion(teamData.matchups[0]);
  const first = recordDreambreakerPoint(teamData, {
    matchupId: "matchup-1",
    scoringTeamId: "team-a",
    expectedVersion,
  });
  const second = recordDreambreakerPoint(first.teamData, {
    matchupId: "matchup-1",
    scoringTeamId: "team-a",
    expectedVersion,
  });
  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
  assert.equal(second.code, "VERSION_CONFLICT");
  assert.equal(first.teamData.matchups[0].dreambreaker.teamAScore, 1);
  assert.equal(first.teamData.matchups[0].dreambreaker.version, expectedVersion + 1);

  const apply = readSrc(`${pkgDir}/02_APPLY.sql`);
  assert.match(apply, /DREAMBREAKER_POINT_CAS_ATOMIC/);
  assert.match(apply, /and version = p_expected_version/);
  assert.match(apply, /CONCURRENT_DUPLICATE_POINT_BLOCKED/);
});

test("H point CAS is dreambreaker.version only", () => {
  const command = buildRefereeDreambreakerPointCommand(
    {
      id: "matchup-ilj0220c",
      teamAId: "team-a",
      teamBId: "team-b",
      version: 99,
      dreambreaker: { status: DREAMBREAKER_STATUS.IN_PROGRESS, version: 4 },
    },
    "team-a"
  );
  assert.equal(command.ok, true);
  assert.equal(command.payload.expectedVersion, 4);
  assert.notEqual(command.payload.expectedVersion, 99);

  const portal = readSrc("src/pages/tournament/TeamRefereePortal.jsx");
  assert.match(portal, /buildRefereeDreambreakerPointCommand/);
  assert.match(portal, /expectedVersion: command\.payload\.expectedVersion/);

  const apply = readSrc(`${pkgDir}/02_APPLY.sql`);
  assert.match(apply, /CANONICAL_VERSION_AUTHORITY = dreambreaker_states\.version/);
  assert.match(apply, /NO_TOURNAMENT_VERSION_CAS/);
  assert.match(apply, /NO_MATCHUP_VERSION_CAS/);
  assert.doesNotMatch(apply, /v_header\.version/);
  assert.doesNotMatch(apply, /v_matchup\.version =/);

  assert.ok(TT1B_REQUIRES_EXPECTED_VERSION.includes("team_tournament_record_dreambreaker_point"));
});

test("I existing Dreambreaker start/order/privacy behavior is preserved", () => {
  const apply = readSrc(`${pkgDir}/02_APPLY.sql`);
  assert.doesNotMatch(apply, /team_tournament_start_dreambreaker/);
  assert.doesNotMatch(apply, /team_tournament_submit_dreambreaker_order/);
  assert.doesNotMatch(apply, /get_captain_portal/);
  assert.doesNotMatch(apply, /TOTAL_SUBMATCH_POINTS/);

  const start = buildRefereeDreambreakerStartCommand({
    id: "matchup-ilj0220c",
    dreambreaker: { status: DREAMBREAKER_STATUS.READY, version: 3 },
  });
  assert.equal(start.ok, true);
  assert.equal(start.payload.expectedVersion, 3);

  const portal = readSrc("src/pages/tournament/TeamRefereePortal.jsx");
  assert.match(portal, /buildRefereeDreambreakerStartCommand/);
  assert.match(portal, /resolveTeamRefereeCloudPageAccess/);
});

test("SQL package contracts lock default 21 fallback and atomic CAS", () => {
  const files = ["01_PRECHECK.sql", "02_APPLY.sql", "03_VERIFY.sql", "04_ROLLBACK.sql", "README.md"];
  for (const name of files) {
    assert.ok(readSrc(`${pkgDir}/${name}`).length > 0, name);
  }

  const apply = readSrc(`${pkgDir}/02_APPLY.sql`);
  assert.match(apply, /DREAMBREAKER_SCORING_RESOLVE_01/);
  assert.match(apply, /dreambreakerScoringFormat/);
  assert.match(apply, /targetPoints/);
  assert.match(apply, /CANONICAL_DREAMBREAKER_DEFAULT_TARGET = 21/);
  assert.match(apply, /DREAMBREAKER_POINT_EXPECTED_VERSION_REQUIRED/);
  assert.match(apply, /Thiếu dreambreaker\.version\./);
  assert.doesNotMatch(apply, /coalesce\(\(v_disc\.scoring_format->>'targetScore'\)::int, 11\)/);

  const rollback = readSrc(`${pkgDir}/04_ROLLBACK.sql`);
  assert.match(rollback, /coalesce\(\(v_disc\.scoring_format->>'targetScore'\)::int, 11\)/);

  const precheck = readSrc(`${pkgDir}/01_PRECHECK.sql`);
  assert.match(precheck, /team-tournament-4zllu71z/);
  assert.match(precheck, /matchup-ilj0220c/);
  assert.match(precheck, /no_data_mutation/);

  const verify = readSrc(`${pkgDir}/03_VERIFY.sql`);
  assert.match(verify, /DEFAULT_TARGET_FALLBACK_21/);
  assert.match(verify, /DREAMBREAKER_POINT_CAS_ATOMIC/);
  assert.match(verify, /LIVE_FIXTURE_UNCONSUMED/);
  assert.match(verify, /no_data_mutation/);
});

test("current fixture shape without override resolves 21/2", () => {
  const matchup = {
    id: "matchup-ilj0220c",
    scheduleMeta: {
      stage: "",
      groupId: "grp-bang-a",
      roundNumber: 1,
      nextMatchupId: "",
      matchNumberInRound: 2,
    },
    dreambreaker: {
      status: DREAMBREAKER_STATUS.IN_PROGRESS,
      version: 4,
      teamAScore: 0,
      teamBScore: 0,
    },
  };
  const scoring = resolveDreambreakerScoringFormat({
    matchup,
    disciplines: [],
  });
  assert.equal(scoring.targetScore, 21);
  assert.equal(scoring.winBy, 2);
  assert.match(getDreambreakerScoringHints(matchup, []), /Rally đến 21, cách 2/);
});
