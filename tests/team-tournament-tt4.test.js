import { test } from "node:test";
import assert from "node:assert/strict";

import { SUB_MATCH_STATUS } from "../src/features/team-tournament/constants.js";
import {
  TECHNICAL_RESULT_TYPE,
  FORFEIT_BLOCK_CODES,
  DEFAULT_TECHNICAL_SCORE_DEFAULTS,
  resolveTechnicalScoreDefaults,
  resolveTechnicalScore,
  validateForfeitReason,
  isSubMatchConfirmedNormal,
  resolveCanApplyForfeitFromServer,
  resolveForfeitReadiness,
  buildForfeitCommandPayload,
  summarizeStandingsImpact,
} from "../src/features/team-tournament/engines/forfeitWorkflowEngine.js";

test("validateForfeitReason requires reason", () => {
  const missing = validateForfeitReason("");
  assert.equal(missing.ok, false);
  assert.equal(missing.code, FORFEIT_BLOCK_CODES.REASON_REQUIRED);

  const ok = validateForfeitReason("Đội không có mặt");
  assert.equal(ok.ok, true);
  assert.equal(ok.reason, "Đội không có mặt");
});

test("technical score config from tournament settings", () => {
  const defaults = resolveTechnicalScoreDefaults({
    technicalScoreDefaults: { winnerPoints: 21, loserPoints: 0, affectsElo: false },
  });
  assert.equal(defaults.winnerPoints, 21);
  assert.equal(defaults.affectsElo, false);

  const score = resolveTechnicalScore({}, "team-a", "team-b", "team-a");
  assert.deepEqual(score, { teamA: 0, teamB: 11, games: [] });
});

test("no-show and injury result types accepted in payload", () => {
  const payload = buildForfeitCommandPayload({
    matchupId: "m1",
    subMatchId: "sm1",
    forfeitingTeamId: "team-a",
    resultType: TECHNICAL_RESULT_TYPE.NO_SHOW,
    reasonCode: TECHNICAL_RESULT_TYPE.NO_SHOW,
    reasonText: "Không có mặt sau 15 phút",
    subMatchVersion: 2,
  });
  assert.equal(payload.resultType, "no_show");
  assert.equal(payload.expectedVersion, 2);
});

test("invalid lineup and withdrawal before match", () => {
  for (const type of [
    TECHNICAL_RESULT_TYPE.INVALID_LINEUP,
    TECHNICAL_RESULT_TYPE.WITHDRAWAL_BEFORE_MATCH,
  ]) {
    const payload = buildForfeitCommandPayload({
      matchupId: "m1",
      subMatchId: "sm1",
      forfeitingTeamId: "team-b",
      resultType: type,
      reasonCode: type,
      reasonText: "Lý do hợp lệ cho test",
    });
    assert.equal(payload.resultType, type);
  }
});

test("team withdrawal payload uses team_withdrawal code", () => {
  const payload = buildForfeitCommandPayload({
    matchupId: "m1",
    subMatchId: "sm1",
    forfeitingTeamId: "team-a",
    resultType: TECHNICAL_RESULT_TYPE.TEAM_WITHDRAWAL,
    reasonCode: TECHNICAL_RESULT_TYPE.TEAM_WITHDRAWAL,
    reasonText: "Đội rút khỏi giải",
  });
  assert.equal(payload.resultType, "team_withdrawal");
});

test("confirmed result blocked", () => {
  const subMatch = {
    status: SUB_MATCH_STATUS.COMPLETED,
    resultConfirmedAt: "2026-01-01T00:00:00.000Z",
  };
  assert.equal(isSubMatchConfirmedNormal(subMatch), true);

  const readiness = resolveForfeitReadiness({
    subMatch,
    matchup: { id: "m1", teamAId: "a", teamBId: "b" },
    forfeitingTeamId: "a",
  });
  assert.equal(readiness.ok, false);
  assert.equal(readiness.code, FORFEIT_BLOCK_CODES.CONFIRMED_RESULT);
});

test("server forfeit ops respected", () => {
  const blocked = resolveCanApplyForfeitFromServer({
    canApplyForfeit: false,
    blockCode: FORFEIT_BLOCK_CODES.CONFIRMED_RESULT,
    blockMessage: "blocked",
  });
  assert.equal(blocked.canApply, false);

  const allowed = resolveCanApplyForfeitFromServer({
    canApplyForfeit: true,
    subMatchVersion: 3,
  });
  assert.equal(allowed.canApply, true);
  assert.equal(allowed.subMatchVersion, 3);
});

test("standings impact summary mentions no Elo", () => {
  const summary = summarizeStandingsImpact(DEFAULT_TECHNICAL_SCORE_DEFAULTS);
  assert.match(summary, /không cập nhật Elo/i);
});

test("affectsElo defaults false", () => {
  assert.equal(DEFAULT_TECHNICAL_SCORE_DEFAULTS.affectsElo, false);
});
