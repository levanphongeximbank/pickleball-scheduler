import test from "node:test";
import assert from "node:assert/strict";

import {
  EVENT_TYPE,
  MATCH_STATUS,
  OFFICIAL_MODE,
  TOURNAMENT_MODE,
  COURT_STATUS,
} from "../src/models/tournament/index.js";
import {
  validateEntryForEvent,
  validateGroupDrawInput,
  validateNoDuplicatePlayersInEvent,
  submitMatchScore,
  forfeitMatch,
  postponeMatch,
  startMatch,
  assignMatchToCourt,
  releaseCourt,
  setCourtLocked,
  buildCourtRuntimeStates,
  getAvailableCourts,
} from "../src/tournament/engines/index.js";

const players = [
  { id: 1, name: "Nam A", gender: "Nam", level: 4 },
  { id: 2, name: "Nam B", gender: "Nam", level: 3.5 },
  { id: 3, name: "Nu A", gender: "Nữ", level: 4 },
  { id: 4, name: "Nu B", gender: "Nữ", level: 3.5 },
];

test("validateEntryForEvent enforces mixed double composition", () => {
  const valid = validateEntryForEvent(
    { id: "e1", name: "Cap 1", playerIds: ["1", "3"] },
    players,
    EVENT_TYPE.MIXED_DOUBLE
  );
  assert.equal(valid.ok, true);

  const invalid = validateEntryForEvent(
    { id: "e2", name: "Cap 2", playerIds: ["1", "2"] },
    players,
    EVENT_TYPE.MIXED_DOUBLE
  );
  assert.equal(invalid.ok, false);
});

test("validateNoDuplicatePlayersInEvent detects duplicate player", () => {
  const result = validateNoDuplicatePlayersInEvent([
    { id: "e1", name: "Cap 1", playerIds: ["1", "3"] },
    { id: "e2", name: "Cap 2", playerIds: ["1", "4"] },
  ]);

  assert.equal(result.ok, false);
  assert.match(result.errors[0], /nhieu doi/);
});

test("validateGroupDrawInput returns warnings for AI balance missing rating", () => {
  const result = validateGroupDrawInput({
    entries: [
      { id: "e1", name: "Cap 1", playerIds: ["1", "3"] },
      { id: "e2", name: "Cap 2", playerIds: ["2", "4"] },
    ],
    players: [{ id: 99, name: "X", gender: "Nam" }],
    eventType: EVENT_TYPE.MIXED_DOUBLE,
    groupCount: 2,
    courtCount: 2,
    tournamentMode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
    officialMode: OFFICIAL_MODE.AI_BALANCE,
  });

  assert.equal(result.ok, false);
  assert.ok(result.warnings.length > 0);
});

test("submitMatchScore sets winner and completed status", () => {
  const match = {
    id: "m1",
    entryAId: "e1",
    entryBId: "e2",
    status: MATCH_STATUS.PLAYING,
  };

  const result = submitMatchScore(match, { scoreA: 11, scoreB: 7 }, { now: "2026-01-01T10:00:00.000Z" });

  assert.equal(result.ok, true);
  assert.equal(result.match.winnerId, "e1");
  assert.equal(result.match.loserId, "e2");
  assert.equal(result.match.status, MATCH_STATUS.COMPLETED);
  assert.equal(result.match.completedAt, "2026-01-01T10:00:00.000Z");
});

test("forfeitMatch marks winner without scores", () => {
  const result = forfeitMatch(
    { id: "m1", entryAId: "e1", entryBId: "e2", status: MATCH_STATUS.PLAYING },
    "e2"
  );

  assert.equal(result.ok, true);
  assert.equal(result.match.winnerId, "e2");
  assert.equal(result.match.status, MATCH_STATUS.FORFEIT);
});

test("postponeMatch clears court assignment", () => {
  const result = postponeMatch({
    id: "m1",
    entryAId: "e1",
    entryBId: "e2",
    courtId: 10,
    status: MATCH_STATUS.PLAYING,
  });

  assert.equal(result.ok, true);
  assert.equal(result.match.status, MATCH_STATUS.POSTPONED);
  assert.equal(result.match.courtId, null);
});

test("startMatch moves assigned match to playing", () => {
  const result = startMatch({
    id: "m1",
    entryAId: "e1",
    entryBId: "e2",
    status: MATCH_STATUS.ASSIGNED,
    courtId: 10,
  });

  assert.equal(result.ok, true);
  assert.equal(result.match.status, MATCH_STATUS.PLAYING);
});

test("assignMatchToCourt respects locked courts", () => {
  const courts = [
    { id: 1, name: "San 1", active: true },
    { id: 2, name: "San 2", active: true },
  ];
  const states = buildCourtRuntimeStates(courts, [], { lockedCourtIds: [1] });
  const match = { id: "m1", entryAId: "e1", entryBId: "e2", status: MATCH_STATUS.WAITING };

  const blocked = assignMatchToCourt(states, match, 1);
  assert.equal(blocked.ok, false);

  const allowed = assignMatchToCourt(states, match, 2);
  assert.equal(allowed.ok, true);
  assert.equal(allowed.match.courtId, 2);
  assert.equal(allowed.courtStates[1].currentMatchId, "m1");
});

test("releaseCourt frees court after match completes", () => {
  const courts = [{ id: 1, name: "San 1", active: true }];
  const match = {
    id: "m1",
    entryAId: "e1",
    entryBId: "e2",
    courtId: 1,
    status: MATCH_STATUS.PLAYING,
  };
  const states = buildCourtRuntimeStates(courts, [match]);

  const completed = submitMatchScore(match, { scoreA: 11, scoreB: 5 });
  const released = releaseCourt(states, 1, completed.match);

  assert.equal(released.ok, true);
  assert.equal(released.courtStates[0].status, COURT_STATUS.AVAILABLE);
  assert.equal(released.courtStates[0].currentMatchId, null);
});

test("setCourtLocked blocks court with active match", () => {
  const states = [
    {
      id: 1,
      name: "San 1",
      status: COURT_STATUS.PLAYING,
      currentMatchId: "m1",
      locked: false,
      active: true,
    },
  ];

  const result = setCourtLocked(states, 1, true);
  assert.equal(result.ok, false);
});

test("getAvailableCourts excludes locked and busy courts", () => {
  const states = buildCourtRuntimeStates(
    [
      { id: 1, name: "San 1", active: true },
      { id: 2, name: "San 2", active: true },
    ],
    [],
    { lockedCourtIds: [1] }
  );

  const available = getAvailableCourts(states);
  assert.equal(available.length, 1);
  assert.equal(available[0].id, "2");
});
