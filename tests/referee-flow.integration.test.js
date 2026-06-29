import test from "node:test";
import assert from "node:assert/strict";

import { createMatchRecord, MATCH_STATUS } from "../src/models/tournament/index.js";
import {
  assignRefereeToMatch,
  buildMatchLiveRecord,
  patchRefereeInTournament,
  resolveMatchLabels,
} from "../src/tournament/engines/refereeEngine.js";
import {
  REFEREE_MATCH_STATUS,
  resolveRefereeMatchStatus,
} from "../src/tournament/engines/refereeStatusEngine.js";
import { MATCH_LIVE_STATUS } from "../src/domain/matchLiveSync.js";
import {
  createScoreAdjustLogEntry,
  mergeAuditLogIntoMatch,
  SCORE_LOG_ACTION,
} from "../src/models/tournament/scoreLog.js";
import {
  appendScoreLogAfterEventSubmit,
  buildDirectorScoreLogEntry,
  mergeLiveAuditIntoEvent,
  resolveDirectorScoreLogSource,
  summarizeCombinedAudit,
} from "../src/tournament/engines/scoreHistoryEngine.js";
import {
  submitTournamentDirectorMatchScore,
} from "../src/tournament/engines/tournamentDirectorEngine.js";

test("integration: assign referee -> live adjustments -> finalize -> director processes bracket", () => {
  const event = {
    id: "event-1",
    entries: [
      { id: "e1", name: "Đội A", playerIds: ["p1", "p2"] },
      { id: "e2", name: "Đội B", playerIds: ["p3", "p4"] },
    ],
    groups: [{ id: "g1", name: "A" }],
    matches: [
      createMatchRecord({
        id: "m1",
        entryAId: "e1",
        entryBId: "e2",
        groupId: "g1",
        status: MATCH_STATUS.PLAYING,
        courtId: "1",
      }),
    ],
  };

  const assigned = assignRefereeToMatch(event.matches[0], "Anh Tuấn");
  assert.ok(assigned.referee.token);

  const liveRecord = buildMatchLiveRecord({
    clubId: "club-1",
    tournamentId: "tour-1",
    eventId: event.id,
    match: assigned.match,
    labels: resolveMatchLabels(assigned.match, { entries: event.entries }),
    tournamentName: "Giải test",
  });

  assert.equal(liveRecord.refereeToken, assigned.token);
  assert.equal(liveRecord.stageLabel, "Bảng g1");

  const auditTrail = [
    createScoreAdjustLogEntry({
      team: "A",
      delta: 1,
      oldScoreA: 0,
      oldScoreB: 0,
      scoreA: 1,
      scoreB: 0,
      matchId: "m1",
      refereeToken: assigned.token,
    }),
    createScoreAdjustLogEntry({
      team: "A",
      delta: 1,
      oldScoreA: 1,
      oldScoreB: 0,
      scoreA: 2,
      scoreB: 0,
      matchId: "m1",
      refereeToken: assigned.token,
    }),
    createScoreAdjustLogEntry({
      action: SCORE_LOG_ACTION.FINALIZED,
      source: "referee",
      actorName: "Anh Tuấn",
      scoreA: 11,
      scoreB: 8,
      matchId: "m1",
      refereeToken: assigned.token,
    }),
  ];

  const liveRow = {
    ...liveRecord,
    scoreA: 11,
    scoreB: 8,
    status: MATCH_LIVE_STATUS.FINALIZE_REQUESTED,
    auditLog: auditTrail,
  };

  assert.equal(
    resolveRefereeMatchStatus(assigned.match, liveRow),
    REFEREE_MATCH_STATUS.FINALIZE_PENDING
  );

  const scoreResult = submitTournamentDirectorMatchScore(event, "m1", {
    scoreA: 11,
    scoreB: 8,
  });

  assert.equal(scoreResult.ok, true);
  assert.equal(scoreResult.match.status, MATCH_STATUS.COMPLETED);

  const eventWithAudit = mergeLiveAuditIntoEvent(scoreResult.event, "m1", auditTrail);
  const savedMatch = eventWithAudit.matches.find((item) => item.id === "m1");

  assert.ok(savedMatch.scoreLog.length >= 3);
  assert.equal(savedMatch.scoreA, 11);
  assert.equal(savedMatch.scoreB, 8);

  const lockedRow = { ...liveRow, status: MATCH_LIVE_STATUS.LOCKED };
  assert.equal(
    resolveRefereeMatchStatus(savedMatch, lockedRow),
    REFEREE_MATCH_STATUS.FINALIZED
  );
});

test("integration: director override after referee logs admin_override", () => {
  const match = createMatchRecord({
    id: "m2",
    referee: { name: "Lan", token: "tok-2" },
    status: MATCH_STATUS.PLAYING,
  });

  const liveRow = {
    matchId: "m2",
    scoreA: 9,
    scoreB: 7,
    status: MATCH_LIVE_STATUS.PLAYING,
    refereeToken: "tok-2",
  };

  const source = resolveDirectorScoreLogSource(match, liveRow);
  assert.equal(source, "director_override");

  const overrideEntry = buildDirectorScoreLogEntry({
    source,
    scoreA: 11,
    scoreB: 9,
    matchId: "m2",
    refereeToken: "tok-2",
    oldScoreA: 9,
    oldScoreB: 7,
    note: "Xác nhận lại điểm",
  });

  const event = {
    id: "e1",
    matches: [match],
  };

  const patched = appendScoreLogAfterEventSubmit(event, "m2", overrideEntry);
  const nextMatch = patched.matches[0];

  assert.equal(resolveRefereeMatchStatus(nextMatch, liveRow), REFEREE_MATCH_STATUS.ADJUSTED);
  assert.match(summarizeCombinedAudit(nextMatch, liveRow, 5).join("\n"), /BTC ghi đè|BTC điều chỉnh/);
});

test("integration: patch referee into tournament blob preserves other matches", () => {
  const tournament = {
    events: [
      {
        id: "e1",
        matches: [
          createMatchRecord({ id: "m1" }),
          createMatchRecord({ id: "m2" }),
        ],
      },
    ],
  };

  const assigned = assignRefereeToMatch(tournament.events[0].matches[0], "TT 1");
  const patch = patchRefereeInTournament(tournament, {
    eventId: "e1",
    matchId: "m1",
    referee: assigned.referee,
    isDaily: false,
  });

  assert.equal(patch.events[0].matches[0].referee.name, "TT 1");
  assert.equal(patch.events[0].matches[1].referee, null);
});

test("integration: summarizeCombinedAudit hides duplicate match+live audit rows", () => {
  const entry = createScoreAdjustLogEntry({
    team: "B",
    delta: 1,
    scoreA: 0,
    scoreB: 1,
    matchId: "m3",
  });

  const match = mergeAuditLogIntoMatch(createMatchRecord({ id: "m3" }), [entry]);
  const liveRow = { auditLog: [entry] };

  const lines = summarizeCombinedAudit(match, liveRow, 10);
  assert.equal(lines.length, 1);
});
