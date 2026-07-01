import test from "node:test";
import assert from "node:assert/strict";

import { createMatchRecord, MATCH_STATUS } from "../src/models/tournament/index.js";
import { transferMatchToCourt } from "../src/tournament/engines/courtEngine.js";
import { PLAY_MODE } from "../src/features/court-engine/constants/playModes.js";
import { createCourtSession } from "../src/features/court-engine/models/courtSession.js";
import {
  checkInPlayer,
  cancelCheckIn,
  markNoShow,
} from "../src/features/court-engine/services/checkInService.js";
import {
  addToQueue,
  removeFromQueue,
  setQueuePriority,
  setQueueLocked,
  computeWaitMinutes,
  getActiveQueueEntries,
} from "../src/features/court-engine/services/queueService.js";
import {
  generateCourtAssignments,
  confirmAssignments,
} from "../src/features/court-engine/engines/autoCourtAssignmentEngine.js";
import {
  startMatchTimer,
  pauseMatchTimer,
  resumeMatchTimer,
  endMatchTimer,
  getMatchElapsedMinutes,
  resolveTimerStatus,
} from "../src/features/court-engine/services/courtTimerService.js";
import {
  assignRefereeToCourt,
  buildRefereeRosterFromStaff,
} from "../src/features/court-engine/services/refereeDispatchService.js";
import { transferAssignment } from "../src/features/court-engine/services/courtTransferService.js";
import { ASSIGNMENT_STATUS, COURT_RUNTIME_STATUS } from "../src/features/court-engine/constants/statuses.js";

const players = [
  { id: "p1", name: "A", rating: 4.0, gender: "Nam" },
  { id: "p2", name: "B", rating: 4.1, gender: "Nam" },
  { id: "p3", name: "C", rating: 3.9, gender: "Nữ" },
  { id: "p4", name: "D", rating: 4.0, gender: "Nữ" },
  { id: "p5", name: "E", rating: 3.5, gender: "Nam" },
  { id: "p6", name: "F", rating: 3.6, gender: "Nam" },
  { id: "p7", name: "G", rating: 3.7, gender: "Nam" },
  { id: "p8", name: "H", rating: 3.8, gender: "Nam" },
];

const courts = [
  { id: "1", name: "Sân 1", active: true },
  { id: "2", name: "Sân 2", active: true },
];


function buildSessionWithQueue(playerIds) {
  let session = createCourtSession({ clubId: "club-1", name: "Test" });
  playerIds.forEach((playerId) => {
    const check = checkInPlayer(session, playerId);
    session = check.session;
    const queued = addToQueue(session, playerId);
    session = queued.session;
  });
  return session;
}

test("check-in success and duplicate blocked", () => {
  let session = createCourtSession({ clubId: "club-1" });
  const first = checkInPlayer(session, "p1");
  assert.equal(first.ok, true);
  session = first.session;

  const duplicate = checkInPlayer(session, "p1");
  assert.equal(duplicate.ok, false);
});

test("cancel check-in and no-show", () => {
  let session = createCourtSession({ clubId: "club-1" });
  session = checkInPlayer(session, "p1").session;

  const cancelled = cancelCheckIn(session, "p1");
  assert.equal(cancelled.ok, true);

  session = checkInPlayer(session, "p2").session;
  const noShow = markNoShow(session, "p2");
  assert.equal(noShow.ok, true);
  assert.equal(noShow.session.checkIns.find((item) => item.playerId === "p2").status, "no_show");
});

test("queue add remove priority lock", () => {
  let session = createCourtSession({ clubId: "club-1" });
  session = checkInPlayer(session, "p1").session;

  const added = addToQueue(session, "p1");
  assert.equal(added.ok, true);

  const priority = setQueuePriority(added.session, "p1", 2);
  assert.equal(priority.ok, true);

  const locked = setQueueLocked(priority.session, "p1", true);
  assert.equal(locked.ok, true);
  assert.equal(locked.session.queue[0].locked, true);

  const removed = removeFromQueue(locked.session, "p1");
  assert.equal(removed.ok, true);
});

test("computeWaitMinutes increases over time", () => {
  const entry = { waitingSince: new Date(Date.now() - 5 * 60000).toISOString() };
  assert.ok(computeWaitMinutes(entry) >= 4);
});

test("auto assignment: 1 court 4 players", () => {
  const session = buildSessionWithQueue(["p1", "p2", "p3", "p4"]);
  const queueEntries = getActiveQueueEntries(session);
  const result = generateCourtAssignments({
    sessionId: session.id,
    courts: [courts[0]],
    queueEntries,
    players,
    config: { playMode: PLAY_MODE.DOUBLES },
    courtStates: {},
  });

  assert.equal(result.assignments.length, 1);
  assert.equal(result.assignments[0].players.length, 4);
  assert.ok(result.assignments[0].reasons.length > 0);
});

test("auto assignment: 2 courts 8 players", () => {
  const session = buildSessionWithQueue(["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"]);
  const result = generateCourtAssignments({
    courts,
    queueEntries: getActiveQueueEntries(session),
    players,
    config: { playMode: PLAY_MODE.DOUBLES },
  });

  assert.equal(result.assignments.length, 2);
});

test("auto assignment: locked court skipped", () => {
  const session = buildSessionWithQueue(["p1", "p2", "p3", "p4"]);
  const result = generateCourtAssignments({
    courts,
    queueEntries: getActiveQueueEntries(session),
    players,
    courtStates: {
      1: { status: COURT_RUNTIME_STATUS.LOCKED, locked: true },
      2: { status: COURT_RUNTIME_STATUS.EMPTY },
    },
    config: { playMode: PLAY_MODE.DOUBLES },
  });

  assert.equal(result.assignments.length, 1);
  assert.equal(String(result.assignments[0].courtId), "2");
});

test("auto assignment: locked player excluded", () => {
  let session = buildSessionWithQueue(["p1", "p2", "p3", "p4"]);
  session = setQueueLocked(session, "p1", true).session;
  const result = generateCourtAssignments({
    courts: [courts[0]],
    queueEntries: getActiveQueueEntries(session),
    players,
    lockedPlayerIds: ["p1"],
    config: { playMode: PLAY_MODE.DOUBLES },
  });

  assert.equal(result.assignments.length, 0);
  assert.ok(result.warnings.some((item) => item.includes("Không đủ")));
  assert.ok(result.warnings.some((item) => item.includes("p1") || item.includes("khóa")));
});

test("auto assignment: not enough players warns", () => {
  const session = buildSessionWithQueue(["p1", "p2", "p3"]);
  const result = generateCourtAssignments({
    courts: [courts[0]],
    queueEntries: getActiveQueueEntries(session),
    players,
    config: { playMode: PLAY_MODE.DOUBLES },
  });

  assert.equal(result.assignments.length, 0);
  assert.ok(result.warnings.length > 0);
});

test("confirm assignments does not mutate preview queue until confirm", () => {
  const session = buildSessionWithQueue(["p1", "p2", "p3", "p4"]);
  const preview = generateCourtAssignments({
    courts: [courts[0]],
    queueEntries: getActiveQueueEntries(session),
    players,
    config: { playMode: PLAY_MODE.DOUBLES },
  });

  assert.equal(getActiveQueueEntries(session).length, 4);

  const confirmed = confirmAssignments(session, preview.assignments);
  assert.ok(confirmed.ok);
  assert.equal(getActiveQueueEntries(confirmed.session).length, 0);
});

test("referee assign and offline blocked", () => {
  let session = createCourtSession({ clubId: "club-1" });
  const roster = buildRefereeRosterFromStaff([
    { id: "r1", name: "TT 1", role: "REFEREE", active: true },
    { id: "r2", name: "TT 2", role: "REFEREE", active: false },
  ]);
  assert.equal(roster.length, 2);
  assert.equal(roster[1].status, "offline");

  const assign = assignRefereeToCourt(session, { refereeId: "r1", courtId: "1" });
  assert.equal(assign.ok, true);

  const busy = assignRefereeToCourt(assign.session, { refereeId: "r1", courtId: "2" });
  assert.equal(busy.ok, false);
});

test("timer start pause resume end", () => {
  let session = createCourtSession({ clubId: "club-1" });
  session = {
    ...session,
    assignments: [
      {
        id: "a1",
        courtId: "1",
        status: ASSIGNMENT_STATUS.ASSIGNED,
        players: ["p1", "p2", "p3", "p4"],
        estimatedDurationMinutes: 20,
      },
    ],
  };

  const started = startMatchTimer(session, "a1");
  assert.equal(started.ok, true);
  assert.ok(started.session.assignments[0].startedAt);

  const paused = pauseMatchTimer(started.session, "a1");
  assert.equal(paused.session.assignments[0].status, ASSIGNMENT_STATUS.PAUSED);

  const resumed = resumeMatchTimer(paused.session, "a1");
  assert.equal(resumed.session.assignments[0].status, ASSIGNMENT_STATUS.PLAYING);

  const ended = endMatchTimer(resumed.session, "a1");
  assert.equal(ended.session.assignments[0].status, ASSIGNMENT_STATUS.COMPLETED);
});

test("timer overrun status", () => {
  const assignment = {
    status: ASSIGNMENT_STATUS.PLAYING,
    startedAt: new Date(Date.now() - 30 * 60000).toISOString(),
    estimatedDurationMinutes: 20,
  };
  assert.equal(resolveTimerStatus(assignment, { overrunWarningMinutes: 5 }), COURT_RUNTIME_STATUS.OVERRUN);
  assert.ok(getMatchElapsedMinutes(assignment) >= 29);
});

test("court transfer preserves timer", () => {
  let session = createCourtSession({ clubId: "club-1" });
  const startedAt = new Date(Date.now() - 10 * 60000).toISOString();
  session = {
    ...session,
    assignments: [
      {
        id: "a1",
        courtId: "1",
        status: ASSIGNMENT_STATUS.PLAYING,
        startedAt,
        players: ["p1", "p2", "p3", "p4"],
      },
    ],
    courtStates: {
      1: { status: COURT_RUNTIME_STATUS.PLAYING },
      2: { status: COURT_RUNTIME_STATUS.EMPTY },
    },
  };

  const result = transferAssignment(session, "a1", "2", { reason: "Sân hỏng đèn" });
  assert.equal(result.ok, true);
  assert.equal(result.session.assignments[0].courtId, "2");
  assert.equal(result.session.assignments[0].startedAt, startedAt);
  assert.equal(result.session.transferLogs.length, 1);
});

test("court transfer rejects busy target", () => {
  let session = createCourtSession({ clubId: "club-1" });
  session = {
    ...session,
    assignments: [
      { id: "a1", courtId: "1", status: ASSIGNMENT_STATUS.PLAYING, players: [] },
      { id: "a2", courtId: "2", status: ASSIGNMENT_STATUS.PLAYING, players: [] },
    ],
    courtStates: {
      1: { status: COURT_RUNTIME_STATUS.PLAYING },
      2: { status: COURT_RUNTIME_STATUS.PLAYING },
    },
  };

  const result = transferAssignment(session, "a1", "2", { reason: "Test" });
  assert.equal(result.ok, false);
});

test("court transfer requires reason", () => {
  let session = createCourtSession({ clubId: "club-1" });
  session = {
    ...session,
    assignments: [{ id: "a1", courtId: "1", status: ASSIGNMENT_STATUS.PLAYING, players: [] }],
    courtStates: { 1: { status: COURT_RUNTIME_STATUS.PLAYING }, 2: { status: COURT_RUNTIME_STATUS.EMPTY } },
  };

  const result = transferAssignment(session, "a1", "2", { reason: "" });
  assert.equal(result.ok, false);
});

test("tournament transferMatchToCourt preserves startedAt", () => {
  const courtStates = [
    { id: "1", status: "playing", currentMatchId: "m1", locked: false },
    { id: "2", status: "available", currentMatchId: null, locked: false },
  ];
  const match = createMatchRecord({
    id: "m1",
    courtId: "1",
    status: MATCH_STATUS.PLAYING,
    startedAt: "2026-01-01T10:00:00.000Z",
    entryAId: "e1",
    entryBId: "e2",
  });

  const result = transferMatchToCourt(courtStates, match, "1", "2");
  assert.equal(result.ok, true);
  assert.equal(result.match.startedAt, "2026-01-01T10:00:00.000Z");
  assert.equal(result.match.courtId, "2");
});
