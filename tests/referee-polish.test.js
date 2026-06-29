import test from "node:test";
import assert from "node:assert/strict";

import { MATCH_LIVE_STATUS } from "../src/domain/matchLiveSync.js";
import { createMatchRecord } from "../src/models/tournament/index.js";
import {
  createScoreAdjustLogEntry,
  formatScoreLogEntry,
  REFEREE_LINK_LOCKED_MESSAGE,
  SCORE_LOG_ACTION,
} from "../src/models/tournament/scoreLog.js";
import {
  REFEREE_MATCH_STATUS,
  isRefereeMatchLocked,
  resolveRefereeMatchStatus,
} from "../src/tournament/engines/refereeStatusEngine.js";
import { summarizeCombinedAudit } from "../src/tournament/engines/scoreHistoryEngine.js";

test("createScoreAdjustLogEntry records team delta and old/new scores", () => {
  const entry = createScoreAdjustLogEntry({
    team: "A",
    delta: 1,
    oldScoreA: 3,
    oldScoreB: 2,
    scoreA: 4,
    scoreB: 2,
    matchId: "m1",
    refereeToken: "tok-1",
  });

  assert.equal(entry.team, "A");
  assert.equal(entry.delta, 1);
  assert.equal(entry.oldScoreA, 3);
  assert.equal(entry.scoreA, 4);
  assert.match(formatScoreLogEntry(entry), /Đội A \+1/);
});

test("resolveRefereeMatchStatus detects live and finalized states", () => {
  const match = createMatchRecord({
    id: "m1",
    referee: { name: "Lan", token: "abc" },
    status: "playing",
  });

  assert.equal(
    resolveRefereeMatchStatus(match, { status: MATCH_LIVE_STATUS.PLAYING, scoreA: 2, scoreB: 1 }),
    REFEREE_MATCH_STATUS.LIVE
  );
  assert.equal(
    resolveRefereeMatchStatus(match, { status: MATCH_LIVE_STATUS.LOCKED }),
    REFEREE_MATCH_STATUS.FINALIZED
  );
});

test("isRefereeMatchLocked blocks finalize and locked statuses", () => {
  assert.equal(isRefereeMatchLocked({ status: MATCH_LIVE_STATUS.LOCKED }), true);
  assert.equal(isRefereeMatchLocked({ status: MATCH_LIVE_STATUS.PLAYING }), false);
});

test("summarizeCombinedAudit deduplicates match and live audit entries", () => {
  const entry = createScoreAdjustLogEntry({
    team: "B",
    delta: 1,
    oldScoreA: 0,
    oldScoreB: 0,
    scoreA: 0,
    scoreB: 1,
  });

  const lines = summarizeCombinedAudit(
    { scoreLog: [entry] },
    { auditLog: [entry] },
    10
  );

  assert.equal(lines.length, 1);
});

test("REFEREE_LINK_LOCKED_MESSAGE is user friendly", () => {
  assert.match(REFEREE_LINK_LOCKED_MESSAGE, /khóa/i);
});

test("finalized action label is rendered", () => {
  const line = formatScoreLogEntry({
    source: "referee",
    action: SCORE_LOG_ACTION.FINALIZED,
    actorName: "Lan",
    scoreA: 11,
    scoreB: 8,
  });

  assert.match(line, /Chốt kết quả/);
});
