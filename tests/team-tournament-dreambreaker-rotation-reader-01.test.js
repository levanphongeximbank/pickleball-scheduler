/**
 * TEAM-TOURNAMENT-PR412-DREAMBREAKER-ROTATION-READER-01
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { DREAMBREAKER_STATUS } from "../src/features/team-tournament/constants.js";
import { getDreambreakerCourtPlayers } from "../src/features/team-tournament/engines/dreambreakerEngine.js";
import { attachPersistedDreambreakerProjection } from "../src/features/team-tournament/engines/dreambreakerProjection.js";
import {
  DEFAULT_DREAMBREAKER_SCORING,
  resolveDreambreakerScoringFormat,
} from "../src/features/team-tournament/engines/dreambreakerScoringContract.js";
import { normalizeDreambreakerState } from "../src/features/team-tournament/models/index.js";
import { TT1B_REQUIRES_EXPECTED_VERSION } from "../src/features/team-tournament/services/teamTournamentRpcService.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const pkgDir = "docs/v5/migrations/team-tournament-dreambreaker-rotation-reader-01";

function readSrc(rel) {
  return readFileSync(join(root, rel), "utf8");
}

const LIVE_ROTATION = {
  segmentIndex: 1,
  pointsInSegment: 0,
  pointHistory: [
    { teamId: "team-hfpuyf7a", segmentIndex: 0, teamAScore: 1, teamBScore: 0 },
    { teamId: "team-hfpuyf7a", segmentIndex: 0, teamAScore: 2, teamBScore: 0 },
    { teamId: "team-hfpuyf7a", segmentIndex: 0, teamAScore: 3, teamBScore: 0 },
    { teamId: "team-hfpuyf7a", segmentIndex: 0, teamAScore: 4, teamBScore: 0 },
  ],
  injurySkips: [],
};

const LIVE_READER = {
  matchupId: "matchup-ilj0220c",
  status: DREAMBREAKER_STATUS.IN_PROGRESS,
  teamAOrder: ["M04", "M05", "F01", "F05"],
  teamBOrder: ["M03", "M07", "F03", "F07"],
  teamAScore: 4,
  teamBScore: 0,
  version: 8,
  ordersLockedAt: "2026-08-11T10:12:53.000Z",
  rotation: LIVE_ROTATION,
};

function projectReader(reader = LIVE_READER) {
  return attachPersistedDreambreakerProjection({
    matchups: [
      {
        id: "matchup-ilj0220c",
        teamAId: "team-a",
        teamBId: "team-b",
      },
    ],
    dreambreaker: {
      "matchup-ilj0220c": reader,
    },
  });
}

test("A get_setup package exposes persisted rotation.segmentIndex", () => {
  const apply = readSrc(`${pkgDir}/02_APPLY.sql`);
  assert.match(apply, /DREAMBREAKER_ROTATION_READER_01/);
  assert.match(apply, /'rotation', coalesce\(db\.rotation, '\{\}'::jsonb\)/);
  assert.match(apply, /segmentIndex/);
  assert.doesNotMatch(apply, /team_tournament_record_dreambreaker_point/);
});

test("B get_setup package exposes pointsInSegment, pointHistory, injurySkips", () => {
  const apply = readSrc(`${pkgDir}/02_APPLY.sql`);
  assert.match(apply, /pointsInSegment/);
  assert.match(apply, /pointHistory/);
  assert.match(apply, /injurySkips/);

  const projected = projectReader();
  const rotation = projected.matchups[0].dreambreaker.rotation;
  assert.equal(rotation.pointsInSegment, 0);
  assert.equal(rotation.pointHistory.length, 4);
  assert.deepEqual(rotation.injurySkips, []);
});

test("C persisted segmentIndex=1 survives canonical read/normalize and pair resolution", () => {
  const projected = projectReader();
  const dreambreaker = projected.matchups[0].dreambreaker;
  assert.equal(dreambreaker.rotation.segmentIndex, 1);
  assert.equal(dreambreaker.teamAScore, 4);
  assert.equal(dreambreaker.version, 8);

  const court = getDreambreakerCourtPlayers(projected.matchups[0]);
  assert.equal(court.segmentIndex, 1);
  assert.equal(court.teamAPlayerId, "M05");
  assert.equal(court.teamBPlayerId, "M07");
});

test("D orders M04/M05/F01/F05 vs M03/M07/F03/F07 at segmentIndex=1 resolve M05 vs M07", () => {
  const court = getDreambreakerCourtPlayers({
    teamAId: "team-a",
    teamBId: "team-b",
    dreambreaker: {
      status: DREAMBREAKER_STATUS.IN_PROGRESS,
      teamAOrder: ["M04", "M05", "F01", "F05"],
      teamBOrder: ["M03", "M07", "F03", "F07"],
      rotation: { segmentIndex: 1, pointsInSegment: 0, pointHistory: [], injurySkips: [] },
    },
  });
  assert.equal(court.teamAPlayerId, "M05");
  assert.equal(court.teamBPlayerId, "M07");
  assert.equal((court.segmentIndex % 4) + 1, 2);
});

test("E reader must not default segmentIndex=0 when persisted rotation exists", () => {
  const withoutRotation = normalizeDreambreakerState({
    status: DREAMBREAKER_STATUS.IN_PROGRESS,
    teamAOrder: ["M04", "M05", "F01", "F05"],
    teamBOrder: ["M03", "M07", "F03", "F07"],
    teamAScore: 4,
    teamBScore: 0,
  });
  assert.equal(withoutRotation.rotation.segmentIndex, 0);

  const withPersisted = normalizeDreambreakerState({
    status: DREAMBREAKER_STATUS.IN_PROGRESS,
    teamAOrder: ["M04", "M05", "F01", "F05"],
    teamBOrder: ["M03", "M07", "F03", "F07"],
    teamAScore: 4,
    teamBScore: 0,
    rotation: { segmentIndex: 1, pointsInSegment: 0, pointHistory: [], injurySkips: [] },
  });
  assert.equal(withPersisted.rotation.segmentIndex, 1);
  assert.notEqual(withPersisted.rotation.segmentIndex, 0);
});

test("F missing/legacy rotation remains safe and does not use localStorage", () => {
  const normalized = normalizeDreambreakerState({
    status: DREAMBREAKER_STATUS.IN_PROGRESS,
    teamAOrder: ["M04"],
    teamBOrder: ["M03"],
    rotation: {},
  });
  assert.equal(normalized.rotation.segmentIndex, 0);
  assert.equal(normalized.rotation.pointsInSegment, 0);
  assert.deepEqual(normalized.rotation.pointHistory, []);
  assert.deepEqual(normalized.rotation.injurySkips, []);

  const projection = readSrc("src/features/team-tournament/engines/dreambreakerProjection.js");
  const portal = readSrc("src/pages/tournament/TeamRefereePortal.jsx");
  const panel = readSrc("src/components/tournament/team/DreambreakerPanel.jsx");
  assert.doesNotMatch(projection, /localStorage/);
  assert.doesNotMatch(portal, /localStorage/);
  assert.doesNotMatch(panel, /localStorage/);
});

test("G point RPC/CAS contract remains required on dreambreaker.version", () => {
  assert.ok(TT1B_REQUIRES_EXPECTED_VERSION.includes("team_tournament_record_dreambreaker_point"));
  const apply = readSrc(`${pkgDir}/02_APPLY.sql`);
  assert.doesNotMatch(apply, /team_tournament_record_dreambreaker_point/);
  const verify = readSrc(`${pkgDir}/03_VERIFY.sql`);
  assert.match(verify, /DREAMBREAKER_POINT_CAS_ATOMIC/);
  const pointApply = readSrc(
    "docs/v5/migrations/team-tournament-dreambreaker-scoring-cas-01/02_APPLY.sql"
  );
  assert.match(pointApply, /DREAMBREAKER_POINT_CAS_ATOMIC/);
  assert.match(pointApply, /and version = p_expected_version/);
});

test("H targetPoints default 21 and per-match override remain unchanged", () => {
  const scoring = resolveDreambreakerScoringFormat({
    matchup: {
      id: "matchup-ilj0220c",
      scheduleMeta: { groupId: "grp-bang-a", roundNumber: 1 },
    },
    disciplines: [],
  });
  assert.equal(scoring.targetScore, DEFAULT_DREAMBREAKER_SCORING.targetScore);
  assert.equal(scoring.targetScore, 21);
  assert.equal(scoring.winBy, 2);

  const overridden = resolveDreambreakerScoringFormat({
    matchup: {
      scheduleMeta: { dreambreakerScoringFormat: { targetPoints: 15 } },
    },
    disciplines: [],
  });
  assert.equal(overridden.targetScore, 15);
  assert.equal(overridden.winBy, 2);
});

test("I tenant access semantics remain unchanged", () => {
  const apply = readSrc(`${pkgDir}/02_APPLY.sql`);
  assert.doesNotMatch(apply, /team_tournament_assert_tenant/);
  assert.doesNotMatch(apply, /CREATE POLICY/);
  assert.doesNotMatch(apply, /enable row level security/i);
  assert.doesNotMatch(apply, /user_has_permission/);
  const verify = readSrc(`${pkgDir}/03_VERIFY.sql`);
  assert.match(verify, /team_tournament_assert_tenant/);
  assert.match(verify, /AUTHENTICATED_GRANTS_PRESERVED/);
  assert.match(verify, /ANON_GRANTS_UNCHANGED/);
});

test("SQL package contracts lock reader-only patch", () => {
  const files = ["01_PRECHECK.sql", "02_APPLY.sql", "03_VERIFY.sql", "04_ROLLBACK.sql", "README.md"];
  for (const name of files) {
    assert.ok(readSrc(`${pkgDir}/${name}`).length > 0, name);
  }
  const precheck = readSrc(`${pkgDir}/01_PRECHECK.sql`);
  assert.match(precheck, /CURRENT_READER_OMITS_ROTATION/);
  assert.match(precheck, /team-tournament-4zllu71z/);
  assert.match(precheck, /matchup-ilj0220c/);
  assert.match(precheck, /no_data_mutation/);
  const verify = readSrc(`${pkgDir}/03_VERIFY.sql`);
  assert.match(verify, /READER_RETURNS_PERSISTED_ROTATION/);
  assert.match(verify, /segmentIndex/);
  assert.match(verify, /pointsInSegment/);
  assert.match(verify, /pointHistory/);
  assert.match(verify, /injurySkips/);

  const rollback = readSrc(`${pkgDir}/04_ROLLBACK.sql`);
  assert.match(rollback, /DREAMBREAKER_ROTATION_READER_01/);
  assert.match(rollback, /'ordersLockedAt', db\.orders_locked_at/);
  assert.doesNotMatch(
    rollback.split("$new$")[1] || "",
    /'rotation', coalesce\(db\.rotation/
  );
});
