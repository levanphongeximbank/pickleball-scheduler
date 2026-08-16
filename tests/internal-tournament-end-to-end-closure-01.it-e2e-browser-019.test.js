/**
 * IT-E2E-BROWSER-019 — live Internal group standings during play.
 * Derived from canonical groups + completed matches. Visible before 6/6.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  EVENT_TYPE,
  MATCH_STATUS,
  TOURNAMENT_MODE,
} from "../src/models/tournament/constants.js";
import {
  canonicalRowToTournament,
  tournamentToCanonicalRow,
} from "../src/features/tournament/mappers/canonicalTournamentMapper.js";
import {
  INTERNAL_GROUP_TIE_BREAK_RULE,
  INTERNAL_KNOCKOUT_INCOMPLETE_MESSAGE,
  projectInternalLiveGroupStandings,
  projectInternalRefereeCanonicalEventResult,
  resolveInternalKnockoutAction,
  standingsFingerprint,
} from "../src/features/tournament/internal/index.js";
import { buildGroupStandingFromMatches } from "../src/tournament/engines/rankingEngine.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function team(id, name, playerIds) {
  return { id, name, playerIds, rating: 7, seed: 1 };
}

function player(id, name) {
  return { id, name, playerIds: [id], rating: 7, seed: 1 };
}

function matchRow({ id, groupId, entryAId, entryBId, status = MATCH_STATUS.WAITING, scoreA = 0, scoreB = 0 }) {
  return {
    id,
    groupId,
    stage: "group",
    entryAId,
    entryBId,
    status,
    scoreA,
    scoreB,
  };
}

function makeDoublesEvent({
  completed = [],
  groupCount = 2,
  type = EVENT_TYPE.MEN_DOUBLE,
} = {}) {
  const a1 = team("a1", "IT421 Nam 05 / TT412-SEED-M01", ["p5", "m01"]);
  const a2 = team("a2", "IT421 Nam 04 / IT421 Nam 01", ["p4", "p1"]);
  const a3 = team("a3", "IT421 Nam 08 / TT412-SEED-M04", ["p8", "m04"]);
  const b1 = team("b1", "IT421 Nam 06 / TT412-SEED-M02", ["p6", "m02"]);
  const b2 = team("b2", "IT421 Nam 03 / IT421 Nam 02", ["p3", "p2"]);
  const b3 = team("b3", "IT421 Nam 07 / TT412-SEED-M03", ["p7", "m03"]);
  const groupA = {
    id: "group-A",
    name: "Bảng A",
    label: "A",
    entryIds: ["a1", "a2", "a3"],
    entries: [a1, a2, a3],
    pointsConfig: { win: 2, loss: 1, forfeit: 0 },
  };
  const groupB = {
    id: "group-B",
    name: "Bảng B",
    label: "B",
    entryIds: ["b1", "b2", "b3"],
    entries: [b1, b2, b3],
    pointsConfig: { win: 2, loss: 1, forfeit: 0 },
  };
  const spec = [
    { id: "GA-R1-M1", groupId: "group-A", entryAId: "a1", entryBId: "a2" },
    { id: "GA-R2-M1", groupId: "group-A", entryAId: "a1", entryBId: "a3" },
    { id: "GA-R3-M1", groupId: "group-A", entryAId: "a2", entryBId: "a3" },
    { id: "GB-R1-M1", groupId: "group-B", entryAId: "b1", entryBId: "b2" },
    { id: "GB-R2-M1", groupId: "group-B", entryAId: "b1", entryBId: "b3" },
    { id: "GB-R3-M1", groupId: "group-B", entryAId: "b2", entryBId: "b3" },
  ];
  const completedMap = new Map(completed.map((item) => [item.id, item]));
  const matches = spec.map((row) => {
    const done = completedMap.get(row.id);
    return matchRow({
      ...row,
      status: done ? MATCH_STATUS.COMPLETED : MATCH_STATUS.WAITING,
      scoreA: done?.scoreA || 0,
      scoreB: done?.scoreB || 0,
    });
  });
  const groups = groupCount === 1 ? [groupA] : [groupA, groupB];
  const entries = groupCount === 1 ? [a1, a2, a3] : [a1, a2, a3, b1, b2, b3];
  return {
    id: "event-1",
    type,
    groups,
    entries,
    matches: groupCount === 1 ? matches.filter((item) => item.groupId === "group-A") : matches,
  };
}

function row(projection, groupLabel, id) {
  const group = projection.groups.find((item) => item.group === groupLabel);
  return group?.standing.find((item) => item.id === id);
}

function roundTripEvent(event) {
  const tournament = {
    id: "d3a35fd1-5caf-4d18-86b4-5df0881c9dc3",
    name: "Giải nội bộ 14/8/2026",
    mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
    clubId: "club-ecebf64c78f948ccb2b59842441eb26c",
    tenantId: "venue-staging-a",
    events: [event],
  };
  const rowData = tournamentToCanonicalRow(tournament, {
    tenantId: tournament.tenantId,
    clubId: tournament.clubId,
  });
  rowData.version = 25;
  rowData.created_at = "2026-08-14T00:00:00.000Z";
  rowData.updated_at = "2026-08-14T00:00:00.000Z";
  return canonicalRowToTournament(rowData).events[0];
}

describe("IT-E2E-BROWSER-019 live Internal group standings", () => {
  it("A. 0 completed matches still shows 3 zero rows per group", () => {
    const projection = projectInternalLiveGroupStandings(makeDoublesEvent());
    assert.equal(projection.visible, true);
    assert.equal(projection.final, false);
    assert.equal(projection.rowIdentity, "TEAM");
    assert.equal(projection.groups.length, 2);
    assert.equal(projection.groups[0].standing.length, 3);
    assert.equal(projection.groups[1].standing.length, 3);
    assert.equal(projection.groups.every((group) => group.standing.every((item) => item.played === 0)), true);
    assert.equal(projection.knockout.enabled, false);
    assert.equal(projection.knockout.reason, INTERNAL_KNOCKOUT_INCOMPLETE_MESSAGE);
  });

  it("B. GA-R1-M1 11-5 updates Bảng A and leaves Bảng B at zero", () => {
    const projection = projectInternalLiveGroupStandings(
      makeDoublesEvent({ completed: [{ id: "GA-R1-M1", scoreA: 11, scoreB: 5 }] })
    );
    const winner = row(projection, "A", "a1");
    const loser = row(projection, "A", "a2");
    const third = row(projection, "A", "a3");
    assert.equal(winner.played, 1);
    assert.equal(winner.won, 1);
    assert.equal(winner.lost, 0);
    assert.equal(winner.matchPoints, 2);
    assert.equal(winner.pointsFor, 11);
    assert.equal(winner.pointsAgainst, 5);
    assert.equal(loser.played, 1);
    assert.equal(loser.won, 0);
    assert.equal(loser.lost, 1);
    assert.equal(loser.matchPoints, 1);
    assert.equal(third.played, 0);
    assert.equal(third.won, 0);
    assert.equal(projection.groups.find((item) => item.group === "B").standing.every((item) => item.played === 0), true);
    assert.equal(projection.final, false);
    assert.equal(projection.tieBreakRule, INTERNAL_GROUP_TIE_BREAK_RULE);
  });

  it("C. second canonical result updates standings without BTC", () => {
    const first = makeDoublesEvent({ completed: [{ id: "GA-R1-M1", scoreA: 11, scoreB: 5 }] });
    const projected = projectInternalRefereeCanonicalEventResult(first, "GA-R2-M1", {
      scoreA: 11,
      scoreB: 7,
    });
    assert.equal(projected.ok, true);
    const standings = projectInternalLiveGroupStandings(projected.event);
    const winner = row(standings, "A", "a1");
    assert.equal(winner.played, 2);
    assert.equal(winner.won, 2);
    assert.equal(winner.pointsFor, 22);
    assert.equal(standings.knockout.enabled, false);
  });

  it("D. F5 mapper remount keeps identical standings", () => {
    const event = makeDoublesEvent({ completed: [{ id: "GA-R1-M1", scoreA: 11, scoreB: 5 }] });
    const first = projectInternalLiveGroupStandings(event);
    const second = projectInternalLiveGroupStandings(roundTripEvent(event));
    assert.equal(standingsFingerprint(first), standingsFingerprint(second));
  });

  it("E. 5/6 complete: standings visible, knockout disabled", () => {
    const event = makeDoublesEvent({
      completed: [
        { id: "GA-R1-M1", scoreA: 11, scoreB: 5 },
        { id: "GA-R2-M1", scoreA: 11, scoreB: 7 },
        { id: "GA-R3-M1", scoreA: 6, scoreB: 11 },
        { id: "GB-R1-M1", scoreA: 11, scoreB: 8 },
        { id: "GB-R2-M1", scoreA: 9, scoreB: 11 },
      ],
    });
    const projection = projectInternalLiveGroupStandings(event);
    assert.equal(projection.visible, true);
    assert.equal(projection.final, false);
    assert.equal(projection.completedGroupMatchCount, 5);
    assert.equal(projection.pendingGroupMatchCount, 1);
    assert.equal(resolveInternalKnockoutAction(event).enabled, false);
  });

  it("F. 6/6 complete: standings final and knockout eligible", () => {
    const event = makeDoublesEvent({
      completed: [
        { id: "GA-R1-M1", scoreA: 11, scoreB: 5 },
        { id: "GA-R2-M1", scoreA: 11, scoreB: 7 },
        { id: "GA-R3-M1", scoreA: 6, scoreB: 11 },
        { id: "GB-R1-M1", scoreA: 11, scoreB: 8 },
        { id: "GB-R2-M1", scoreA: 9, scoreB: 11 },
        { id: "GB-R3-M1", scoreA: 11, scoreB: 4 },
      ],
    });
    const projection = projectInternalLiveGroupStandings(event);
    assert.equal(projection.final, true);
    assert.equal(projection.knockout.enabled, true);
    assert.equal(projection.groups[0].standing[0].qualificationStatus, "qualified_1st");
  });

  it("G. one group: live standings and no knockout after completion", () => {
    const live = projectInternalLiveGroupStandings(makeDoublesEvent({ groupCount: 1 }));
    assert.equal(live.visible, true);
    assert.equal(live.knockout.skipKnockout, true);
    const done = projectInternalLiveGroupStandings(
      makeDoublesEvent({
        groupCount: 1,
        completed: [
          { id: "GA-R1-M1", scoreA: 11, scoreB: 5 },
          { id: "GA-R2-M1", scoreA: 11, scoreB: 7 },
          { id: "GA-R3-M1", scoreA: 6, scoreB: 11 },
        ],
      })
    );
    assert.equal(done.final, true);
    assert.equal(done.knockout.enabled, false);
    assert.equal(done.knockout.skipKnockout, true);
  });

  it("H/I. singles PLAYER rows and doubles TEAM rows", () => {
    const singles = {
      type: EVENT_TYPE.MEN_SINGLE,
      groups: [
        {
          id: "g1",
          label: "A",
          entryIds: ["p1", "p2"],
          entries: [player("p1", "Nam 01"), player("p2", "Nam 02")],
        },
      ],
      entries: [player("p1", "Nam 01"), player("p2", "Nam 02")],
      matches: [],
    };
    assert.equal(projectInternalLiveGroupStandings(singles).rowIdentity, "PLAYER");
    for (const type of [EVENT_TYPE.MEN_DOUBLE, EVENT_TYPE.WOMEN_DOUBLE, EVENT_TYPE.MIXED_DOUBLE]) {
      assert.equal(projectInternalLiveGroupStandings(makeDoublesEvent({ type })).rowIdentity, "TEAM");
    }
  });

  it("J. organizer and referee reuse the same standings projector", () => {
    const event = makeDoublesEvent({ completed: [{ id: "GA-R1-M1", scoreA: 11, scoreB: 5 }] });
    const organizer = projectInternalLiveGroupStandings(event);
    const referee = projectInternalLiveGroupStandings(event);
    assert.equal(standingsFingerprint(organizer), standingsFingerprint(referee));
    const setup = readSrc("src/pages/tournament/InternalTournamentSetup.jsx");
    const portal = readSrc("src/pages/tournament/InternalRefereePortalPage.jsx");
    const table = readSrc("src/components/tournament/internal/InternalGroupStandingsTable.jsx");
    assert.match(setup, /projectInternalLiveGroupStandings/);
    assert.match(setup, /InternalGroupStandingsTable/);
    assert.match(portal, /projectInternalLiveGroupStandings/);
    assert.match(portal, /title="BXH vòng bảng"/);
    assert.match(table, /BẢNG XẾP HẠNG VÒNG BẢNG/);
    assert.equal(table.includes("onChange"), false);
    assert.equal(table.includes("TextField"), false);
  });

  it("understands TEAM group.entries even without entryIds", () => {
    const standing = buildGroupStandingFromMatches({
      group: {
        id: "group-A",
        label: "A",
        entries: [
          team("a1", "Team 1", ["p1", "p2"]),
          team("a2", "Team 2", ["p3", "p4"]),
        ],
      },
      matches: [
        matchRow({
          id: "GA-R1-M1",
          groupId: "group-A",
          entryAId: "a1",
          entryBId: "a2",
          status: MATCH_STATUS.COMPLETED,
          scoreA: 11,
          scoreB: 5,
        }),
      ],
    });
    assert.equal(standing.standing.length, 2);
    assert.equal(standing.standing[0].id, "a1");
    assert.equal(standing.standing[0].pointsFor, 11);
  });
});
