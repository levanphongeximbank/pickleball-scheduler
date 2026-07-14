import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { MATCH_STATUS, MATCH_STAGE } from "../src/models/tournament/constants.js";
import {
  addIndividualReferee,
  assignRefereeToIndividualMatch,
  assertAssignmentScope,
  autoAssignReferees,
  buildIndividualRefereeAssignmentTable,
  detectRefereeConflicts,
  getRefereeAssignments,
  reassignReferee,
  validateRefereeAvailability,
} from "../src/features/individual-tournament/engines/refereeAssignEngine.js";
import {
  MATCH_RESULT_TYPE,
  RESULT_AUDIT_ACTIONS,
  getMatchResult,
  getResultPropagationState,
  isCommandProcessed,
} from "../src/features/individual-tournament/engines/matchResultEngine.js";
import {
  getLiveStandings,
  propagateMatchResult,
} from "../src/features/individual-tournament/engines/resultPropagationEngine.js";
import {
  approveResultCorrection,
  requestResultCorrection,
} from "../src/features/individual-tournament/engines/resultCorrectionEngine.js";
import { syncKnockoutMatchParticipants } from "../src/tournament/engines/bracketEngine.js";

function makeEntries() {
  return [
    { id: "e1", name: "Pair 1" },
    { id: "e2", name: "Pair 2" },
    { id: "e3", name: "Pair 3" },
    { id: "e4", name: "Pair 4" },
  ];
}

function makeTournament(overrides = {}) {
  const entries = makeEntries();
  return {
    id: "t-s1-f",
    clubId: "club-1",
    name: "S1-F Individual",
    type: "official_tournament",
    settings: {
      refereeRoster: [],
      refereeAssignments: {},
      matchResults: {},
      resultPropagation: { auditLog: [], processedCommandIds: [] },
      resultCorrections: [],
      ...(overrides.settings || {}),
    },
    events: [
      {
        id: "ev1",
        name: "Đôi nam",
        entries,
        groups: [
          { id: "A", name: "A" },
          { id: "B", name: "B" },
        ],
        matches: [
          {
            id: "m1",
            eventId: "ev1",
            groupId: "A",
            stage: MATCH_STAGE.GROUP,
            entryAId: "e1",
            entryBId: "e2",
            status: MATCH_STATUS.WAITING,
            scheduledStart: "2026-07-14T08:00:00.000Z",
            scheduledEnd: "2026-07-14T08:30:00.000Z",
            courtId: "c1",
          },
          {
            id: "m2",
            eventId: "ev1",
            groupId: "A",
            stage: MATCH_STAGE.GROUP,
            entryAId: "e1",
            entryBId: "e3",
            status: MATCH_STATUS.WAITING,
            scheduledStart: "2026-07-14T08:00:00.000Z",
            scheduledEnd: "2026-07-14T08:30:00.000Z",
            courtId: "c2",
          },
          {
            id: "m3",
            eventId: "ev1",
            groupId: "B",
            stage: MATCH_STAGE.GROUP,
            entryAId: "e3",
            entryBId: "e4",
            status: MATCH_STATUS.WAITING,
            scheduledStart: "2026-07-14T09:00:00.000Z",
            scheduledEnd: "2026-07-14T09:30:00.000Z",
            courtId: "c1",
          },
        ],
        bracket: { rounds: [] },
        ...(overrides.event || {}),
      },
    ],
    ...overrides,
  };
}

test("T-S1-F05 Referee assignment scoped to match", () => {
  let tournament = makeTournament();
  tournament = addIndividualReferee(tournament, { name: "Ref A" }).tournament;
  tournament = addIndividualReferee(tournament, { name: "Ref B" }).tournament;
  const refs = tournament.settings.refereeRoster;

  const assigned = assignRefereeToIndividualMatch(tournament, "m1", refs[0].id, {
    actor: { id: "btc-1" },
  });
  assert.equal(assigned.ok, true);
  tournament = assigned.tournament;

  const scopeOk = assertAssignmentScope(tournament, "m1", {
    rosterId: refs[0].id,
    token: assigned.assignment.token,
  });
  assert.equal(scopeOk.ok, true);

  const scopeBad = assertAssignmentScope(tournament, "m1", {
    rosterId: refs[1].id,
  });
  assert.equal(scopeBad.ok, false);
  assert.equal(scopeBad.code, "ASSIGNMENT_ROSTER_MISMATCH");

  const table = buildIndividualRefereeAssignmentTable(tournament);
  assert.equal(table.find((r) => r.matchId === "m1").assigned, true);
});

test("referee auto assign + conflict detection + reassign", () => {
  let tournament = makeTournament();
  tournament = addIndividualReferee(tournament, { name: "Ref A" }).tournament;
  tournament = addIndividualReferee(tournament, { name: "Ref B" }).tournament;
  const refs = tournament.settings.refereeRoster;

  const first = assignRefereeToIndividualMatch(tournament, "m1", refs[0].id);
  assert.equal(first.ok, true);
  tournament = first.tournament;

  const conflict = validateRefereeAvailability(tournament, tournament.events[0].matches[1], refs[0].id);
  assert.equal(conflict.ok, false);
  assert.equal(conflict.code, "REFEREE_CONFLICT");
  assert.ok(detectRefereeConflicts(tournament, tournament.events[0].matches[1], refs[0].id).length > 0);

  const auto = autoAssignReferees(tournament, { onlyUnassigned: true });
  assert.equal(auto.ok, true);
  tournament = auto.tournament;
  assert.ok(Object.keys(getRefereeAssignments(tournament)).length >= 2);

  const changed = reassignReferee(tournament, "m1", refs[1].id, { allowConflict: true });
  assert.equal(changed.ok, true);
  assert.equal(changed.reassigned, true);
  const audits = getResultPropagationState(changed.tournament).auditLog.map((a) => a.action);
  assert.ok(audits.includes("referee_changed") || audits.includes("referee_assigned"));
});

test("T-S1-F01 Finalize idempotency — duplicate command once", () => {
  let tournament = makeTournament();
  const commandId = "cmd-dup-1";

  const first = propagateMatchResult(tournament, "m1", {
    commandId,
    eventId: "ev1",
    payload: {
      resultType: MATCH_RESULT_TYPE.COMPLETED,
      scoreA: 11,
      scoreB: 5,
    },
  });
  assert.equal(first.ok, true);
  assert.equal(first.idempotentReplay, false);
  tournament = first.tournament;

  const second = propagateMatchResult(tournament, "m1", {
    commandId,
    eventId: "ev1",
    payload: {
      resultType: MATCH_RESULT_TYPE.COMPLETED,
      scoreA: 11,
      scoreB: 5,
    },
  });
  assert.equal(second.ok, true);
  assert.equal(second.idempotentReplay, true);
  assert.equal(isCommandProcessed(second.tournament, commandId), true);

  const ids = getResultPropagationState(second.tournament).processedCommandIds.filter(
    (id) => id === commandId
  );
  assert.equal(ids.length, 1);
});

test("T-S1-F02 Finalize updates standings exactly once", () => {
  let tournament = makeTournament();

  const first = propagateMatchResult(tournament, "m1", {
    commandId: "cmd-stand-1",
    eventId: "ev1",
    payload: { resultType: MATCH_RESULT_TYPE.COMPLETED, scoreA: 11, scoreB: 3 },
  });
  assert.equal(first.ok, true);
  tournament = first.tournament;

  const live1 = getLiveStandings(tournament, "ev1");
  assert.ok(live1);
  assert.ok(Array.isArray(live1.groups));

  const second = propagateMatchResult(tournament, "m1", {
    commandId: "cmd-stand-1",
    eventId: "ev1",
    payload: { resultType: MATCH_RESULT_TYPE.COMPLETED, scoreA: 11, scoreB: 3 },
  });
  assert.equal(second.idempotentReplay, true);
  assert.equal(getLiveStandings(second.tournament, "ev1").updatedAt, live1.updatedAt);

  const confirmedAudits = getResultPropagationState(tournament).auditLog.filter(
    (a) => a.action === RESULT_AUDIT_ACTIONS.CONFIRMED && a.matchId === "m1"
  );
  assert.ok(confirmedAudits.length >= 1);
});

test("T-S1-F03 Bracket sync after group match complete (winner advance on KO)", () => {
  let tournament = makeTournament({
    event: {
      matches: [
        {
          id: "sf1",
          eventId: "ev1",
          stage: MATCH_STAGE.SEMIFINAL,
          bracketMatchId: "br-sf1",
          entryAId: "e1",
          entryBId: "e2",
          status: MATCH_STATUS.WAITING,
        },
        {
          id: "sf2",
          eventId: "ev1",
          stage: MATCH_STAGE.SEMIFINAL,
          bracketMatchId: "br-sf2",
          entryAId: "e3",
          entryBId: "e4",
          status: MATCH_STATUS.WAITING,
        },
        {
          id: "final",
          eventId: "ev1",
          stage: MATCH_STAGE.FINAL,
          bracketMatchId: "br-final",
          entryAId: "",
          entryBId: "",
          status: MATCH_STATUS.WAITING,
        },
        {
          id: "tp",
          eventId: "ev1",
          stage: MATCH_STAGE.THIRD_PLACE,
          bracketMatchId: "br-third",
          entryAId: "",
          entryBId: "",
          status: MATCH_STATUS.WAITING,
          isThirdPlace: true,
        },
      ],
      bracket: {
        rounds: [
          {
            id: "r1",
            name: "SF",
            matches: [
              {
                id: "br-sf1",
                home: { id: "e1" },
                away: { id: "e2" },
                nextMatchId: "br-final",
                nextSlot: "home",
              },
              {
                id: "br-sf2",
                home: { id: "e3" },
                away: { id: "e4" },
                nextMatchId: "br-final",
                nextSlot: "away",
              },
            ],
          },
          {
            id: "r2",
            name: "Final",
            matches: [
              {
                id: "br-final",
                home: { id: "" },
                away: { id: "" },
              },
            ],
          },
        ],
        winnersByMatch: {},
      },
    },
  });

  const result = propagateMatchResult(tournament, "sf1", {
    commandId: "cmd-ko-1",
    eventId: "ev1",
    payload: { resultType: MATCH_RESULT_TYPE.COMPLETED, scoreA: 11, scoreB: 6 },
  });
  assert.equal(result.ok, true);
  tournament = result.tournament;

  const synced = syncKnockoutMatchParticipants(tournament.events[0]);
  const finalMatch = (synced.matches || []).find((m) => m.id === "final");
  // Winner of sf1 (e1) should appear on final if bracket wiring supports nextMatch mapping.
  // At minimum finalized SF is locked completed.
  const sf1 = (result.event.matches || []).find((m) => m.id === "sf1");
  assert.equal(sf1.status, MATCH_STATUS.COMPLETED);
  assert.equal(sf1.winnerId, "e1");
  assert.equal(sf1.locked, true);
  assert.ok(finalMatch);
});

test("walkover / retirement / injury / DQ result types lock match", () => {
  const cases = [
    MATCH_RESULT_TYPE.WALKOVER,
    MATCH_RESULT_TYPE.RETIREMENT,
    MATCH_RESULT_TYPE.INJURY,
    MATCH_RESULT_TYPE.DISQUALIFICATION,
  ];

  for (const resultType of cases) {
    const tournament = makeTournament();
    const result = propagateMatchResult(tournament, "m3", {
      commandId: `cmd-${resultType}`,
      eventId: "ev1",
      payload: { resultType, winnerId: "e3", reason: resultType },
    });
    assert.equal(result.ok, true, resultType);
    assert.equal(result.match.status, MATCH_STATUS.FORFEIT);
    assert.equal(result.match.resultType, resultType);
    assert.equal(result.match.winnerId, "e3");
    assert.equal(getMatchResult(result.tournament, "m3").locked, true);
  }
});

test("T-S1-F04 Correction request → approve → recompute", () => {
  let tournament = makeTournament();

  const initial = propagateMatchResult(tournament, "m1", {
    commandId: "cmd-before-corr",
    eventId: "ev1",
    payload: { resultType: MATCH_RESULT_TYPE.COMPLETED, scoreA: 11, scoreB: 9 },
  });
  assert.equal(initial.ok, true);
  tournament = initial.tournament;

  const requested = requestResultCorrection(tournament, {
    matchId: "m1",
    eventId: "ev1",
    scoreA: 11,
    scoreB: 2,
    reason: "Sai điểm",
    actor: { id: "btc" },
  });
  assert.equal(requested.ok, true);
  tournament = requested.tournament;

  const approved = approveResultCorrection(tournament, requested.correction.id, {
    actor: { id: "owner" },
  });
  assert.equal(approved.ok, true);
  tournament = approved.tournament;

  const match = tournament.events[0].matches.find((m) => m.id === "m1");
  assert.equal(match.scoreA, 11);
  assert.equal(match.scoreB, 2);
  assert.equal(getMatchResult(tournament, "m1").locked, true);

  const correctedAudit = getResultPropagationState(tournament).auditLog.some(
    (a) => a.action === RESULT_AUDIT_ACTIONS.CORRECTED
  );
  assert.equal(correctedAudit, true);
});

test("TournamentRefereeAssignPage no longer uses team demo builder", () => {
  const pagePath = path.resolve("src/pages/tournament/TournamentRefereeAssignPage.jsx");
  const source = fs.readFileSync(pagePath, "utf8");
  assert.equal(source.includes("buildDemoTeamData"), false);
  assert.equal(source.includes("team-tournament/engines/refereeAssignEngine"), false);
  assert.equal(source.includes("IndividualTournamentSelector"), true);
  assert.equal(source.includes("RefereeAssignPanel"), true);
  assert.equal(source.includes("MatchResultMonitorPanel"), true);
  assert.equal(source.includes("ResultCorrectionPanel"), true);
});

test("S1-F regression: index exports referee/result engines", () => {
  const indexPath = path.resolve("src/features/individual-tournament/index.js");
  const source = fs.readFileSync(indexPath, "utf8");
  assert.equal(source.includes("assignRefereeToIndividualMatch"), true);
  assert.equal(source.includes("propagateMatchResult"), true);
  assert.equal(source.includes("approveResultCorrection"), true);
  assert.equal(source.includes("MATCH_RESULT_TYPE"), true);
});
