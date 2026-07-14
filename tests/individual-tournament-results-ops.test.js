import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { ENTRY_STATUS, MATCH_STAGE, MATCH_STATUS, TOURNAMENT_STATUS } from "../src/models/tournament/constants.js";
import { isDrawEligibleEntry } from "../src/models/tournament/entry.js";
import {
  declareWalkover,
  listWalkovers,
  RESULTS_OPS_AUDIT,
  getResultsOps,
} from "../src/features/individual-tournament/engines/walkoverEngine.js";
import {
  WITHDRAWAL_PHASE,
  approveWithdrawal,
  filterDrawEligibleEntries,
  requestWithdrawal,
} from "../src/features/individual-tournament/engines/withdrawalEngine.js";
import {
  ensureThirdPlaceMatch,
  generateThirdPlaceForTournament,
  setThirdPlaceEnabled,
  syncThirdPlaceParticipants,
} from "../src/features/individual-tournament/engines/thirdPlaceEngine.js";
import {
  AWARD_KEY,
  autoAssignAwardsFromRanking,
  buildAwardsPreview,
  buildFinalRanking,
  exportAwardsJson,
} from "../src/features/individual-tournament/engines/awardsEngine.js";
import {
  closeTournament,
  getTournamentSummary,
  isTournamentClosed,
} from "../src/features/individual-tournament/engines/tournamentClosingEngine.js";
import { getLiveStandings } from "../src/features/individual-tournament/engines/resultPropagationEngine.js";

function makeTournament(overrides = {}) {
  return {
    id: "t-s1-g",
    name: "S1-G Cup",
    clubId: "club-1",
    type: "official_tournament",
    status: TOURNAMENT_STATUS.ACTIVE,
    settings: {
      resultsOps: {
        includeThirdPlace: true,
        auditLog: [],
        walkovers: [],
        closed: false,
      },
      withdrawals: [],
      awards: { config: {}, assignments: {}, certificates: [] },
      ...(overrides.settings || {}),
    },
    events: [
      {
        id: "ev1",
        name: "Đôi nam",
        entries: [
          { id: "e1", name: "Pair 1", status: ENTRY_STATUS.APPROVED },
          { id: "e2", name: "Pair 2", status: ENTRY_STATUS.APPROVED },
          { id: "e3", name: "Pair 3", status: ENTRY_STATUS.APPROVED },
          { id: "e4", name: "Pair 4", status: ENTRY_STATUS.APPROVED },
          { id: "e5", name: "Wait 5", status: ENTRY_STATUS.WAITLISTED },
        ],
        groups: [{ id: "A" }, { id: "B" }],
        matches: [
          {
            id: "m1",
            eventId: "ev1",
            groupId: "A",
            stage: MATCH_STAGE.GROUP,
            entryAId: "e1",
            entryBId: "e2",
            status: MATCH_STATUS.WAITING,
          },
          {
            id: "m2",
            eventId: "ev1",
            groupId: "A",
            stage: MATCH_STAGE.GROUP,
            entryAId: "e1",
            entryBId: "e3",
            status: MATCH_STATUS.WAITING,
          },
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
        ],
        bracket: {
          rounds: [
            {
              id: "r1",
              name: "SF",
              matches: [
                { id: "br-sf1", home: { id: "e1" }, away: { id: "e2" } },
                { id: "br-sf2", home: { id: "e3" }, away: { id: "e4" } },
              ],
            },
            {
              id: "r2",
              name: "Final",
              matches: [{ id: "br-final", home: { id: "" }, away: { id: "" } }],
            },
          ],
        },
        ...(overrides.event || {}),
      },
    ],
    ...overrides,
  };
}

test("T-S1-G01 Walkover points in standings", () => {
  let tournament = makeTournament();
  const result = declareWalkover(tournament, {
    matchId: "m1",
    winnerId: "e1",
    eventId: "ev1",
    reasonType: "no_show",
    actor: { id: "btc" },
  });
  assert.equal(result.ok, true);
  tournament = result.tournament;

  const match = tournament.events[0].matches.find((m) => m.id === "m1");
  assert.equal(match.status, MATCH_STATUS.FORFEIT);
  assert.equal(match.resultType, "walkover");
  assert.equal(match.winnerId, "e1");
  assert.equal(listWalkovers(tournament).length, 1);

  const live = getLiveStandings(tournament, "ev1");
  assert.ok(live);

  const audit = getResultsOps(tournament).auditLog.some(
    (a) => a.action === RESULTS_OPS_AUDIT.WALKOVER_DECLARED
  );
  assert.equal(audit, true);
});

test("T-S1-G02 Withdrawn entry excluded from draw", () => {
  let tournament = makeTournament();
  const requested = requestWithdrawal(tournament, {
    entryId: "e4",
    eventId: "ev1",
    phase: WITHDRAWAL_PHASE.BEFORE_EVENT,
    reason: "personal",
  });
  assert.equal(requested.ok, true);
  tournament = requested.tournament;

  const approved = approveWithdrawal(tournament, requested.withdrawal.id, {
    actor: { id: "btc" },
  });
  assert.equal(approved.ok, true);
  tournament = approved.tournament;

  const entry = tournament.events[0].entries.find((e) => e.id === "e4");
  assert.equal(entry.status, ENTRY_STATUS.WITHDRAWN);
  assert.equal(isDrawEligibleEntry(entry), false);

  const eligible = filterDrawEligibleEntries(tournament.events[0].entries, tournament);
  assert.equal(eligible.some((e) => e.id === "e4"), false);
  assert.ok(eligible.some((e) => e.id === "e1"));

  const audit = getResultsOps(tournament).auditLog.some(
    (a) => a.action === RESULTS_OPS_AUDIT.WITHDRAWAL_APPROVED
  );
  assert.equal(audit, true);
});

test("T-S1-G03 Third place match created when enabled", () => {
  let tournament = makeTournament();
  tournament = setThirdPlaceEnabled(tournament, true).tournament;

  // Complete semis so losers exist
  tournament.events[0].matches = tournament.events[0].matches.map((m) => {
    if (m.id === "sf1") {
      return {
        ...m,
        status: MATCH_STATUS.COMPLETED,
        winnerId: "e1",
        loserId: "e2",
        scoreA: 11,
        scoreB: 5,
      };
    }
    if (m.id === "sf2") {
      return {
        ...m,
        status: MATCH_STATUS.COMPLETED,
        winnerId: "e3",
        loserId: "e4",
        scoreA: 11,
        scoreB: 7,
      };
    }
    return m;
  });

  const generated = generateThirdPlaceForTournament(tournament, {
    eventId: "ev1",
    actor: { id: "btc" },
  });
  assert.equal(generated.ok, true);
  const third = generated.match;
  assert.ok(third);
  assert.equal(third.stage, MATCH_STAGE.THIRD_PLACE);
  assert.equal(third.entryAId, "e2");
  assert.equal(third.entryBId, "e4");

  const ensured = ensureThirdPlaceMatch(generated.event);
  assert.equal(ensured.created, false);
});

test("T-S1-G04 Awards preview top 3 matches standings / final", () => {
  let tournament = makeTournament();

  // Set final + third place results
  tournament.events[0].matches = [
    ...tournament.events[0].matches.filter((m) => m.stage !== MATCH_STAGE.FINAL),
    {
      id: "final",
      eventId: "ev1",
      stage: MATCH_STAGE.FINAL,
      bracketMatchId: "br-final",
      entryAId: "e1",
      entryBId: "e3",
      status: MATCH_STATUS.COMPLETED,
      winnerId: "e1",
      loserId: "e3",
      scoreA: 11,
      scoreB: 6,
    },
    {
      id: "tp",
      eventId: "ev1",
      stage: MATCH_STAGE.THIRD_PLACE,
      isThirdPlace: true,
      entryAId: "e2",
      entryBId: "e4",
      status: MATCH_STATUS.COMPLETED,
      winnerId: "e2",
      loserId: "e4",
      scoreA: 11,
      scoreB: 8,
    },
  ];

  const ranking = buildFinalRanking(tournament, "ev1");
  assert.equal(ranking.ok, true);
  assert.equal(ranking.ranking[0].entryId, "e1");
  assert.equal(ranking.ranking[1].entryId, "e3");
  assert.equal(ranking.ranking[2].entryId, "e2");
  assert.equal(ranking.ranking[3].entryId, "e4");

  const assigned = autoAssignAwardsFromRanking(tournament, { eventId: "ev1" });
  assert.equal(assigned.ok, true);
  const preview = buildAwardsPreview(assigned.tournament, { eventId: "ev1" });
  const champion = preview.awards.find((a) => a.key === AWARD_KEY.CHAMPION);
  assert.equal(champion.entryId, "e1");
  assert.equal(champion.medal, "gold");

  const exported = exportAwardsJson(assigned.tournament);
  assert.equal(exported.ok, true);
  assert.ok(exported.content.includes("champion"));
});

test("tournament closing locks results and freezes summary", () => {
  let tournament = makeTournament();
  tournament.events[0].matches = tournament.events[0].matches.map((m) =>
    m.id === "final"
      ? {
          ...m,
          entryAId: "e1",
          entryBId: "e3",
          status: MATCH_STATUS.COMPLETED,
          winnerId: "e1",
          loserId: "e3",
        }
      : m
  );

  const closed = closeTournament(tournament, { actor: { id: "owner" } });
  assert.equal(closed.ok, true);
  tournament = closed.tournament;
  assert.equal(isTournamentClosed(tournament), true);
  assert.equal(tournament.status, TOURNAMENT_STATUS.COMPLETED);
  assert.equal(getResultsOps(tournament).resultsLocked, true);
  assert.ok(getResultsOps(tournament).frozenStandings);
  assert.ok(getTournamentSummary(tournament));

  const audit = getResultsOps(tournament).auditLog.some(
    (a) => a.action === RESULTS_OPS_AUDIT.TOURNAMENT_CLOSED
  );
  assert.equal(audit, true);

  // Walkover blocked after close
  const wo = declareWalkover(tournament, {
    matchId: "m2",
    winnerId: "e1",
    eventId: "ev1",
  });
  assert.equal(wo.ok, false);
});

test("injury withdrawal during event awards walkovers", () => {
  let tournament = makeTournament();
  const requested = requestWithdrawal(tournament, {
    entryId: "e2",
    eventId: "ev1",
    phase: WITHDRAWAL_PHASE.INJURY,
    reason: "ankle",
  });
  tournament = requested.tournament;
  const approved = approveWithdrawal(tournament, requested.withdrawal.id);
  assert.equal(approved.ok, true);
  tournament = approved.tournament;

  const m1 = tournament.events[0].matches.find((m) => m.id === "m1");
  assert.equal(m1.status, MATCH_STATUS.FORFEIT);
  assert.equal(m1.winnerId, "e1");
});

test("TournamentAwardsPage / WithdrawalPage no longer use team demo", () => {
  const awards = fs.readFileSync(
    path.resolve("src/pages/tournament/TournamentAwardsPage.jsx"),
    "utf8"
  );
  const withdrawal = fs.readFileSync(
    path.resolve("src/pages/tournament/TournamentWithdrawalPage.jsx"),
    "utf8"
  );
  assert.equal(awards.includes("buildDemoTeamData"), false);
  assert.equal(awards.includes("team-tournament/engines/awardsEngine"), false);
  assert.equal(awards.includes("IndividualTournamentSelector"), true);
  assert.equal(awards.includes("AwardManagerPanel"), true);
  assert.equal(withdrawal.includes("buildDemoTeamData"), false);
  assert.equal(withdrawal.includes("team-tournament/engines/withdrawalEngine"), false);
  assert.equal(withdrawal.includes("WithdrawalManagementPanel"), true);
});

test("sync third place participants from SF losers", () => {
  let event = makeTournament().events[0];
  event.matches = event.matches.map((m) => {
    if (m.id === "sf1") {
      return { ...m, status: MATCH_STATUS.COMPLETED, winnerId: "e1", loserId: "e2" };
    }
    if (m.id === "sf2") {
      return { ...m, status: MATCH_STATUS.COMPLETED, winnerId: "e4", loserId: "e3" };
    }
    return m;
  });
  const created = ensureThirdPlaceMatch(event);
  assert.equal(created.ok, true);
  const synced = syncThirdPlaceParticipants(created.event);
  assert.equal(synced.match.entryAId, "e2");
  assert.equal(synced.match.entryBId, "e3");
});
