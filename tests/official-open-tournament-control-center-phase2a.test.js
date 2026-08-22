/**
 * Official Open Tournament — Phase 2A Control Center workflow tests.
 * Updated for Phase 2B round-centric stage IDs (settings/group_stage/results).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ENTRY_STATUS,
  TOURNAMENT_STATUS,
  TOURNAMENT_MODE,
  OFFICIAL_MODE,
  EVENT_TYPE,
} from "../src/models/tournament/index.js";
import {
  OFFICIAL_STAGE_ID,
  OFFICIAL_STAGE_STATE,
  deriveOfficialOrganizerStages,
  deriveOfficialNextAction,
  filterOfficialDrawEntries,
  buildOfficialDrawBlockMessage,
  evaluateOfficialCloseGate,
  summarizeOfficialRefereeOps,
} from "../src/features/individual-tournament/engines/officialOrganizerWorkflowEngine.js";
import {
  REFEREE_IDENTITY_BINDING_BLOCKED,
  syncOfficialRefereeAssignResultToLive,
} from "../src/features/individual-tournament/engines/officialRefereeLiveBridge.js";
import {
  assignRefereeToIndividualMatch,
  addIndividualReferee,
} from "../src/features/individual-tournament/engines/refereeAssignEngine.js";
import { submitTournamentDirectorMatchScore } from "../src/tournament/engines/tournamentDirectorEngine.js";

function baseTournament(overrides = {}) {
  return {
    id: "t-official-2a",
    name: "Giải Open 2A",
    mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
    officialMode: OFFICIAL_MODE.OPEN,
    status: TOURNAMENT_STATUS.DRAFT,
    settings: {
      registration: {},
      referee: { roster: [] },
      refereeAssignments: {},
      officialCompetition: { registrationMode: "pair" },
    },
    events: [
      {
        id: "event-1",
        name: "Đôi nam",
        eventType: EVENT_TYPE.MEN_DOUBLE,
        entries: [],
        groups: [],
        matches: [],
      },
    ],
    ...overrides,
  };
}

describe("official-open-tournament-control-center-phase2a", () => {
  it("A. derives stages for empty draft", () => {
    const { stages, currentStageId, facts } = deriveOfficialOrganizerStages(baseTournament());
    assert.ok(stages.length >= 6);
    assert.ok(stages.every((stage) => stage.label && stage.state));
    assert.ok(
      [OFFICIAL_STAGE_ID.SETTINGS, OFFICIAL_STAGE_ID.REGISTRATION].includes(currentStageId)
    );
    assert.equal(facts.entries.total, 0);
  });

  it("A/B. registration pending → next action approve / registration stage", () => {
    const tournament = baseTournament({
      status: TOURNAMENT_STATUS.REGISTRATION,
      events: [
        {
          id: "event-1",
          name: "Đôi nam",
          entries: [
            { id: "e1", name: "A", status: ENTRY_STATUS.PENDING, playerIds: ["p1"] },
            { id: "e2", name: "B", status: ENTRY_STATUS.APPROVED, playerIds: ["p2"] },
          ],
          groups: [],
          matches: [],
        },
      ],
    });
    const next = deriveOfficialNextAction(tournament);
    assert.ok(["approve_entries", "open_registration", "edit_settings"].includes(next.actionId));
    assert.ok(next.summary);
  });

  it("A. ready to draw when enough eligible entries and registration locked", () => {
    const tournament = baseTournament({
      status: TOURNAMENT_STATUS.READY,
      settings: {
        registration: { locked: true, lockedAt: new Date().toISOString() },
        referee: { roster: [] },
        refereeAssignments: {},
      },
      events: [
        {
          id: "event-1",
          entries: [
            { id: "e1", name: "A", status: ENTRY_STATUS.ACTIVE, playerIds: ["p1"] },
            { id: "e2", name: "B", status: ENTRY_STATUS.APPROVED, playerIds: ["p2"] },
          ],
          groups: [],
          matches: [],
        },
      ],
    });
    const { stages } = deriveOfficialOrganizerStages(tournament);
    const draw = stages.find((stage) => stage.id === OFFICIAL_STAGE_ID.DRAW);
    assert.ok(draw);
    assert.ok(
      [OFFICIAL_STAGE_STATE.CURRENT, OFFICIAL_STAGE_STATE.READY, OFFICIAL_STAGE_STATE.COMPLETED].includes(
        draw.state
      )
    );
  });

  it("C. draw excludes non-eligible entries", () => {
    const entries = [
      { id: "ok1", status: ENTRY_STATUS.ACTIVE },
      { id: "ok2", status: ENTRY_STATUS.APPROVED },
      { id: "bad1", status: ENTRY_STATUS.PENDING },
      { id: "bad2", status: ENTRY_STATUS.REJECTED },
      { id: "bad3", status: ENTRY_STATUS.WAITLISTED },
      { id: "bad4", status: ENTRY_STATUS.WITHDRAWN },
    ];
    const eligible = filterOfficialDrawEntries(entries, baseTournament());
    assert.deepEqual(
      eligible.map((e) => e.id).sort(),
      ["ok1", "ok2"]
    );
    const blocked = buildOfficialDrawBlockMessage(
      [{ id: "only", status: ENTRY_STATUS.PENDING }],
      baseTournament(),
      2
    );
    assert.equal(blocked.ok, false);
    assert.match(blocked.error, /đủ điều kiện/i);
  });

  it("A/D. referee coverage after draw with matches", () => {
    const tournament = baseTournament({
      status: TOURNAMENT_STATUS.READY,
      settings: {
        registration: { locked: true },
        referee: { roster: [{ id: "r1", name: "TT A" }] },
        refereeAssignments: {},
        draw: { status: "published" },
      },
      events: [
        {
          id: "event-1",
          entries: [
            { id: "e1", status: ENTRY_STATUS.ACTIVE, name: "A", playerIds: ["p1"] },
            { id: "e2", status: ENTRY_STATUS.ACTIVE, name: "B", playerIds: ["p2"] },
          ],
          groups: [{ id: "g1", label: "A", entries: [{ id: "e1" }, { id: "e2" }] }],
          matches: [
            {
              id: "m1",
              status: "scheduled",
              entryAId: "e1",
              entryBId: "e2",
              eventId: "event-1",
            },
            {
              id: "m2",
              status: "scheduled",
              entryAId: "e1",
              entryBId: "e2",
              eventId: "event-1",
            },
          ],
        },
      ],
    });
    const refs = summarizeOfficialRefereeOps(tournament);
    assert.equal(refs.matchCount, 2);
    assert.equal(refs.assignedCount, 0);
    const { stages } = deriveOfficialOrganizerStages(tournament);
    const group = stages.find((stage) => stage.id === OFFICIAL_STAGE_ID.GROUP_STAGE);
    assert.ok(group);
  });

  it("E. assignment-to-live bridge reports supabase skip without inventing persistence", async () => {
    assert.equal(REFEREE_IDENTITY_BINDING_BLOCKED, true);
    let tournament = baseTournament({
      events: [
        {
          id: "event-1",
          entries: [
            { id: "e1", status: ENTRY_STATUS.ACTIVE, name: "A", playerIds: ["p1"] },
            { id: "e2", status: ENTRY_STATUS.ACTIVE, name: "B", playerIds: ["p2"] },
          ],
          groups: [],
          matches: [
            {
              id: "m1",
              status: "scheduled",
              entryAId: "e1",
              entryBId: "e2",
              eventId: "event-1",
            },
          ],
        },
      ],
    });
    const withRef = addIndividualReferee(tournament, { name: "Trọng tài A" });
    assert.equal(withRef.ok, true);
    tournament = withRef.tournament;
    const assigned = assignRefereeToIndividualMatch(
      tournament,
      "m1",
      withRef.referee.id,
      { eventId: "event-1" }
    );
    assert.equal(assigned.ok, true);
    assert.ok(assigned.match?.referee?.token);

    const live = await syncOfficialRefereeAssignResultToLive({
      tournament: assigned.tournament,
      assignResult: assigned,
      clubId: "club-1",
      courts: [],
      players: [],
    });
    assert.equal(live.ok, false);
    assert.equal(live.needsSupabase, true);
  });

  it("F/G. organizer score uses director match authority and updates match status", () => {
    const event = {
      id: "event-1",
      entries: [
        { id: "e1", name: "A", status: ENTRY_STATUS.ACTIVE, playerIds: ["p1"] },
        { id: "e2", name: "B", status: ENTRY_STATUS.ACTIVE, playerIds: ["p2"] },
      ],
      groups: [{ id: "g1", label: "A", entries: [{ id: "e1" }, { id: "e2" }] }],
      matches: [
        {
          id: "m1",
          status: "scheduled",
          entryAId: "e1",
          entryBId: "e2",
          groupId: "g1",
        },
      ],
    };
    const result = submitTournamentDirectorMatchScore(event, "m1", { scoreA: 11, scoreB: 5 });
    assert.equal(result.ok, true);
    const match = result.event.matches.find((item) => item.id === "m1");
    assert.ok(match);
    assert.equal(Number(match.scoreA), 11);
    assert.equal(Number(match.scoreB), 5);
  });

  it("H. group stage reflects completed matches after score", () => {
    const tournament = baseTournament({
      status: TOURNAMENT_STATUS.ACTIVE,
      settings: {
        registration: { locked: true },
        draw: { status: "published" },
        referee: { roster: [] },
        refereeAssignments: {},
      },
      events: [
        {
          id: "event-1",
          entries: [
            { id: "e1", status: ENTRY_STATUS.ACTIVE, name: "A", playerIds: ["p1"] },
            { id: "e2", status: ENTRY_STATUS.ACTIVE, name: "B", playerIds: ["p2"] },
          ],
          groups: [{ id: "g1", label: "A", entries: [{ id: "e1" }, { id: "e2" }] }],
          matches: [
            {
              id: "m1",
              status: "completed",
              scoreA: 11,
              scoreB: 4,
              entryAId: "e1",
              entryBId: "e2",
            },
            {
              id: "m2",
              status: "scheduled",
              entryAId: "e1",
              entryBId: "e2",
            },
          ],
        },
      ],
    });
    const { stages } = deriveOfficialOrganizerStages(tournament);
    const group = stages.find((stage) => stage.id === OFFICIAL_STAGE_ID.GROUP_STAGE);
    assert.ok(group);
    assert.match(group.summary, /1\/2/);
  });

  it("I. close/results stage blocks when matches incomplete", () => {
    const tournament = baseTournament({
      status: TOURNAMENT_STATUS.ACTIVE,
      settings: {
        registration: { locked: true },
        draw: { status: "published" },
        resultsOps: { closed: false },
      },
      events: [
        {
          id: "event-1",
          entries: [
            { id: "e1", status: ENTRY_STATUS.ACTIVE, name: "A", playerIds: ["p1"] },
            { id: "e2", status: ENTRY_STATUS.ACTIVE, name: "B", playerIds: ["p2"] },
          ],
          groups: [{ id: "g1", entries: [{ id: "e1" }, { id: "e2" }] }],
          matches: [
            { id: "m1", status: "completed", scoreA: 11, scoreB: 3 },
            { id: "m2", status: "scheduled" },
          ],
        },
      ],
    });
    const gate = evaluateOfficialCloseGate(tournament);
    assert.equal(gate.ok, false);
    assert.match(gate.error, /còn 1 trận/i);
    const { stages } = deriveOfficialOrganizerStages(tournament);
    const results = stages.find((stage) => stage.id === OFFICIAL_STAGE_ID.RESULTS);
    assert.ok(results);
  });

  it("J. F5 hydration assumption: derivation is pure from tournament payload", () => {
    const tournament = baseTournament({
      status: TOURNAMENT_STATUS.READY,
      settings: {
        registration: { locked: true },
        draw: { status: "locked" },
      },
      events: [
        {
          id: "event-1",
          entries: [
            { id: "e1", status: ENTRY_STATUS.ACTIVE, name: "A", playerIds: ["p1"] },
            { id: "e2", status: ENTRY_STATUS.ACTIVE, name: "B", playerIds: ["p2"] },
          ],
          groups: [{ id: "g1", label: "A", entries: [{ id: "e1" }, { id: "e2" }] }],
          matches: [{ id: "m1", status: "scheduled", entryAId: "e1", entryBId: "e2" }],
        },
      ],
    });
    const first = deriveOfficialOrganizerStages(tournament);
    const second = deriveOfficialOrganizerStages(JSON.parse(JSON.stringify(tournament)));
    assert.equal(first.currentStageId, second.currentStageId);
    assert.equal(first.facts.matches.total, second.facts.matches.total);
  });

  it("K. next action remains stable labels for permission-aware UI mapping", () => {
    const next = deriveOfficialNextAction(baseTournament());
    assert.ok(next.actionId);
    assert.ok(next.label);
    assert.ok(next.stageId);
  });
});
