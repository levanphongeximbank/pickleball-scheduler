import test from "node:test";
import assert from "node:assert/strict";

import { createMatchRecord } from "../src/models/tournament/index.js";
import { normalizeReferee } from "../src/models/tournament/referee.js";
import {
  assignCourtRefereeToMatch,
  assignRefereeToMatch,
  buildMatchLiveRecord,
  buildRefereeUrl,
  getRefereeSettings,
  patchRefereeInTournament,
  resolveCourtRefereeForAssignment,
  resolveMatchLabels,
  setCourtRefereeAssignment,
} from "../src/tournament/engines/refereeEngine.js";

test("normalizeReferee keeps name and token", () => {
  const referee = normalizeReferee({ name: "Anh Tuấn", token: "abc123" });
  assert.equal(referee.name, "Anh Tuấn");
  assert.equal(referee.token, "abc123");
});

test("assignRefereeToMatch attaches referee to match", () => {
  const match = createMatchRecord({ id: "m1" });
  const result = assignRefereeToMatch(match, "Lan");

  assert.equal(result.match.referee.name, "Lan");
  assert.ok(result.token);
  assert.equal(result.match.referee.token, result.token);
});

test("buildMatchLiveRecord builds sync payload", () => {
  const match = createMatchRecord({
    id: "m1",
    referee: { name: "BTC", token: "tok-1" },
    courtId: "3",
  });

  const row = buildMatchLiveRecord({
    clubId: "club-1",
    tournamentId: "tour-1",
    eventId: "event-1",
    match,
    labels: { entryALabel: "A", entryBLabel: "B", courtLabel: "Sân 3" },
    tournamentName: "Giải test",
  });

  assert.equal(row.id, "club-1::tour-1::m1");
  assert.equal(row.refereeToken, "tok-1");
  assert.equal(row.entryALabel, "A");
  assert.equal(row.courtLabel, "Sân 3");
});

test("patchRefereeInTournament updates event match referee", () => {
  const tournament = {
    events: [
      {
        id: "e1",
        matches: [createMatchRecord({ id: "m1" })],
      },
    ],
  };
  const referee = normalizeReferee({ name: "Ref", token: "t1" });
  const patch = patchRefereeInTournament(tournament, {
    eventId: "e1",
    matchId: "m1",
    referee,
    isDaily: false,
  });

  assert.equal(patch.events[0].matches[0].referee.token, "t1");
});

test("resolveMatchLabels prefers enriched director labels", () => {
  const labels = resolveMatchLabels({
    entryALabel: "Đội A",
    entryBLabel: "Đội B",
    courtId: "2",
  });

  assert.equal(labels.entryALabel, "Đội A");
  assert.equal(labels.courtLabel, "Sân 2");
});

test("buildRefereeUrl returns path when window unavailable", () => {
  assert.match(buildRefereeUrl("abc"), /\/referee\/abc$/);
});

test("getRefereeSettings reads roster and court assignments", () => {
  const tournament = {
    settings: {
      refereeRoster: [{ id: "r1", name: "Lan" }],
      courtReferees: { "3": "r1" },
    },
  };

  const settings = getRefereeSettings(tournament);
  assert.equal(settings.roster.length, 1);
  assert.equal(settings.courtReferees["3"], "r1");
});

test("resolveCourtRefereeForAssignment returns roster entry", () => {
  const tournament = {
    settings: {
      refereeRoster: [{ id: "r1", name: "Lan", active: true }],
      courtReferees: { "2": "r1" },
    },
  };

  const entry = resolveCourtRefereeForAssignment(tournament, "2");
  assert.equal(entry.name, "Lan");
});

test("assignCourtRefereeToMatch links roster id", () => {
  const match = createMatchRecord({ id: "m1" });
  const assigned = assignCourtRefereeToMatch(match, { id: "r1", name: "Lan" });

  assert.equal(assigned.referee.name, "Lan");
  assert.equal(assigned.referee.rosterId, "r1");
});

test("setCourtRefereeAssignment updates court map", () => {
  const next = setCourtRefereeAssignment({}, "5", "r9");
  assert.equal(next["5"], "r9");

  const cleared = setCourtRefereeAssignment(next, "5", null);
  assert.equal(cleared["5"], undefined);
});
