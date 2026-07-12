import test from "node:test";
import assert from "node:assert/strict";

import {
  canonicalizeTeamTournamentValue,
  hashTeamTournamentCanonicalValue,
  stableStringifyTeamTournamentValue,
} from "../src/features/team-tournament/repositories/teamTournamentCanonical.js";
import { hashTeamTournamentPayload } from "../src/features/team-tournament/repositories/teamTournamentIdempotency.js";
import { compareTeamTournamentSnapshots } from "../src/features/team-tournament/repositories/teamTournamentCompare.js";

const hash = hashTeamTournamentCanonicalValue;

test("canonical hash: top-level key order is equivalent", () => {
  assert.equal(hash({ b: 2, a: 1 }), hash({ a: 1, b: 2 }));
});

test("canonical hash: nested key order is equivalent", () => {
  assert.equal(
    hash({ settings: { z: 2, a: 1 } }),
    hash({ settings: { a: 1, z: 2 } })
  );
});

test("canonical hash: array order is significant", () => {
  assert.notEqual(hash([1, 2]), hash([2, 1]));
});

test("idempotency and shadow compare share the same hash function", () => {
  const payload = { b: 2, a: 1, nested: { y: 2, x: 1 } };
  assert.equal(hashTeamTournamentPayload(payload), hash(payload));
});

test("canonical hash: null differs from missing field", () => {
  assert.notEqual(hash({ a: null }), hash({}));
});

test("shadow compare: object key order does not mismatch", () => {
  const blob = {
    teams: [{ id: "t1", name: "A", playerIds: ["p2", "p1"] }],
    matchups: [],
    disciplines: [],
    lineups: {},
    standings: [],
    settings: { z: 2, a: 1 },
  };
  const cloud = {
    teams: [{ id: "t1", playerIds: ["p2", "p1"], name: "A" }],
    matchups: [],
    disciplines: [],
    lineups: {},
    standings: [],
    settings: { a: 1, z: 2 },
  };

  const result = compareTeamTournamentSnapshots(blob, cloud);
  assert.equal(result.ok, true, result.mismatches.map((m) => m.mismatchType).join(","));
});

test("shadow compare: nested object key order does not mismatch", () => {
  const blob = {
    teams: [],
    matchups: [],
    disciplines: [],
    lineups: {
      "m1::t1": {
        matchupId: "m1",
        teamId: "t1",
        status: "draft",
        selections: { "disc-b": ["p2"], "disc-a": ["p1"] },
      },
    },
    standings: [],
    settings: {},
  };
  const cloud = {
    teams: [],
    matchups: [],
    disciplines: [],
    lineups: {
      "m1::t1": {
        teamId: "t1",
        matchupId: "m1",
        status: "draft",
        selections: { "disc-a": ["p1"], "disc-b": ["p2"] },
      },
    },
    standings: [],
    settings: {},
  };

  const result = compareTeamTournamentSnapshots(blob, cloud);
  assert.equal(result.ok, true);
});

test("shadow compare: array order mismatch is detected", () => {
  const blob = {
    teams: [{ id: "t1", name: "A", playerIds: ["p1", "p2"] }],
    matchups: [],
    disciplines: [],
    lineups: {},
    standings: [],
    settings: {},
  };
  const cloud = {
    teams: [{ id: "t1", name: "A", playerIds: ["p2", "p1"] }],
    matchups: [],
    disciplines: [],
    lineups: {},
    standings: [],
    settings: {},
  };

  const result = compareTeamTournamentSnapshots(blob, cloud);
  assert.equal(result.ok, false);
  assert.equal(result.mismatches[0].mismatchType, "value_mismatch");
});

test("shadow compare: entity only in blob is missing_in_cloud", () => {
  const blob = {
    teams: [{ id: "t1", name: "A", playerIds: [] }],
    matchups: [],
    disciplines: [],
    lineups: {},
    standings: [],
    settings: {},
  };
  const cloud = {
    teams: [],
    matchups: [],
    disciplines: [],
    lineups: {},
    standings: [],
    settings: {},
  };

  const result = compareTeamTournamentSnapshots(blob, cloud);
  assert.equal(result.ok, false);
  assert.equal(result.mismatches[0].entityType, "team");
  assert.equal(result.mismatches[0].entityKey, "t1");
  assert.equal(result.mismatches[0].mismatchType, "missing_in_cloud");
});

test("shadow compare: entity only in cloud is missing_in_blob", () => {
  const blob = {
    teams: [],
    matchups: [],
    disciplines: [],
    lineups: {},
    standings: [],
    settings: {},
  };
  const cloud = {
    teams: [{ id: "t2", name: "B", playerIds: [] }],
    matchups: [],
    disciplines: [],
    lineups: {},
    standings: [],
    settings: {},
  };

  const result = compareTeamTournamentSnapshots(blob, cloud);
  assert.equal(result.mismatches[0].mismatchType, "missing_in_blob");
});

test("shadow compare: duplicate entity ID is detected", () => {
  const blob = {
    teams: [
      { id: "t1", name: "A", playerIds: [] },
      { id: "t1", name: "A-dup", playerIds: [] },
    ],
    matchups: [],
    disciplines: [],
    lineups: {},
    standings: [],
    settings: {},
  };

  const result = compareTeamTournamentSnapshots(blob, { teams: [], matchups: [], disciplines: [], lineups: {}, standings: [], settings: {} });
  assert.ok(result.mismatches.some((m) => m.mismatchType === "duplicate_key" && m.entityKey === "t1"));
});

test("shadow compare fixture: lineup content same with key order differs is ok", () => {
  const lineup = {
    matchupId: "m1",
    teamId: "t1",
    status: "draft",
    selections: { d1: ["p1", "p2"] },
  };
  const blob = {
    teams: [],
    matchups: [],
    disciplines: [],
    lineups: { "m1::t1": { ...lineup, selections: { d1: ["p1", "p2"] } } },
    standings: [],
    settings: {},
  };
  const cloud = {
    teams: [],
    matchups: [],
    disciplines: [],
    lineups: {
      "m1::t1": {
        status: "draft",
        teamId: "t1",
        matchupId: "m1",
        selections: { d1: ["p1", "p2"] },
      },
    },
    standings: [],
    settings: {},
  };

  const result = compareTeamTournamentSnapshots(blob, cloud);
  assert.equal(result.ok, true);
});

test("stableStringify uses canonical key order", () => {
  const left = stableStringifyTeamTournamentValue({ b: 2, a: 1 });
  const right = stableStringifyTeamTournamentValue({ a: 1, b: 2 });
  assert.equal(left, right);
  assert.deepEqual(canonicalizeTeamTournamentValue({ note: undefined, kept: 1 }), { kept: 1 });
});
