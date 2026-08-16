/**
 * IT-E2E-BROWSER-020 — Internal knockout live refresh after referee commit.
 * Organizer Bracket follows canonical scores/winners/Final without F5.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  MATCH_STAGE,
  MATCH_STATUS,
} from "../src/models/tournament/constants.js";
import {
  canonicalRowToTournament,
  tournamentToCanonicalRow,
} from "../src/features/tournament/mappers/canonicalTournamentMapper.js";
import {
  INTERNAL_KNOCKOUT_REFRESH_MECHANISM,
  INTERNAL_SNAPSHOT_POLL_MS,
  INTERNAL_WINNER_PROGRESSION_ENGINE,
  applyInternalLiveKnockoutToTournament,
  detectKnockoutProgressionDrift,
  knockoutMatchFingerprint,
  knockoutProgressionIsIdempotent,
  planInternalOrganizerSnapshotRefresh,
  projectInternalLiveKnockout,
  resolveSilentReloadPresentation,
  shouldApplySilentCanonicalSnapshot,
  shouldPersistKnockoutProgression,
  shouldReplaceCanonicalSnapshot,
} from "../src/features/tournament/internal/index.js";
import { projectInternalRefereeCanonicalEventResult } from "../src/features/tournament/internal/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function team(id, name) {
  return { id, name, playerIds: String(id).split("|"), rating: 7, seed: 1 };
}

const A1 = team("a1", "IT421 Nam 05 / TT412-SEED-M01");
const A2 = team("a2", "IT421 Nam 08 / TT412-SEED-M04");
const B1 = team("b1", "IT421 Nam 06 / TT412-SEED-M02");
const B2 = team("b2", "IT421 Nam 07 / TT412-SEED-M03");

function koMatch({
  id,
  bracketMatchId,
  stage,
  round,
  entryA,
  entryB,
  status = MATCH_STATUS.WAITING,
  scoreA = null,
  scoreB = null,
}) {
  const completed =
    status === MATCH_STATUS.COMPLETED || status === MATCH_STATUS.FORFEIT;
  const winnerId =
    completed && Number(scoreA) !== Number(scoreB)
      ? Number(scoreA) > Number(scoreB)
        ? entryA.id
        : entryB.id
      : "";
  return {
    id,
    bracketMatchId,
    stage,
    round,
    entryAId: entryA?.id || "",
    entryBId: entryB?.id || "",
    status,
    scoreA,
    scoreB,
    winnerId,
    loserId:
      winnerId && winnerId === entryA?.id ? entryB?.id || "" : winnerId ? entryA?.id || "" : "",
  };
}

function makeKnockoutEvent({ semi1 = null, semi2 = null, finalEntries = { a: "", b: "" } } = {}) {
  const entries = [A1, A2, B1, B2];
  const matches = [
    koMatch({
      id: "ko-R1-M1",
      bracketMatchId: "R1-M1",
      stage: MATCH_STAGE.SEMIFINAL,
      round: 1,
      entryA: A1,
      entryB: B2,
      ...(semi1 || {}),
    }),
    koMatch({
      id: "ko-R1-M2",
      bracketMatchId: "R1-M2",
      stage: MATCH_STAGE.SEMIFINAL,
      round: 2,
      entryA: A2,
      entryB: B1,
      ...(semi2 || {}),
    }),
    koMatch({
      id: "ko-R2-M1",
      bracketMatchId: "R2-M1",
      stage: MATCH_STAGE.FINAL,
      round: 2,
      entryA: { id: finalEntries.a || "" },
      entryB: { id: finalEntries.b || "" },
    }),
  ];
  return {
    id: "event-020",
    type: "men_double",
    entries,
    matches,
    groups: [],
    bracket: {
      rounds: [
        {
          name: "Ban ket",
          matches: [
            { id: "R1-M1", home: A1, away: B2, homeSeed: "A1", awaySeed: "B2" },
            { id: "R1-M2", home: A2, away: B1, homeSeed: "A2", awaySeed: "B1" },
          ],
        },
        {
          name: "Chung ket",
          matches: [
            {
              id: "R2-M1",
              home: null,
              away: null,
              homeSeed: "W(R1-M1)",
              awaySeed: "W(R1-M2)",
            },
          ],
        },
      ],
      winnersByMatch: {},
      unlockedRounds: {},
      qualifiersPerGroup: 2,
      generatedAt: "2026-08-14T10:00:00.000Z",
    },
  };
}

function apply017StyleCommit(event, matchId, scoreA, scoreB) {
  return {
    ...event,
    matches: (event.matches || []).map((match) => {
      if (String(match.id) !== String(matchId)) return match;
      const winnerId = scoreA > scoreB ? match.entryAId : match.entryBId;
      return {
        ...match,
        scoreA,
        scoreB,
        status: MATCH_STATUS.COMPLETED,
        winnerId,
        loserId: winnerId === match.entryAId ? match.entryBId : match.entryAId,
      };
    }),
  };
}

describe("IT-E2E-BROWSER-020 Internal knockout live refresh", () => {
  it("A. organizer Bracket open plans silent snapshot invalidation", () => {
    const plan = planInternalOrganizerSnapshotRefresh({
      organizerBracketOpen: true,
      mutationActive: false,
      currentVersion: 31,
      incomingVersion: 32,
    });
    assert.equal(plan.shouldReload, true);
    assert.equal(plan.shouldApply, true);
    assert.equal(plan.silent, true);
    assert.equal(plan.fullPageLoading, false);
    assert.equal(plan.mechanism, INTERNAL_KNOCKOUT_REFRESH_MECHANISM);
    assert.equal(plan.expectedUpdateMaxDelayMs, INTERNAL_SNAPSHOT_POLL_MS);
    const setup = readSrc("src/pages/tournament/InternalTournamentSetup.jsx");
    const hook = readSrc("src/features/tournament/internal/useInternalCanonicalSnapshotRefresh.js");
    assert.match(setup, /useInternalCanonicalSnapshotRefresh/);
    assert.match(setup, /reloadCanonicalTournament/);
    assert.match(hook, /setInterval/);
    assert.match(hook, /visibilitychange/);
    assert.match(hook, /silent:\s*true/);
    assert.doesNotMatch(setup, /window\.location\.reload/);
    assert.doesNotMatch(setup, /location\.reload\(/);
  });

  it("B. score is visible from refreshed snapshot without route remount", () => {
    const before = makeKnockoutEvent({
      semi1: { status: MATCH_STATUS.COMPLETED, scoreA: 15, scoreB: 10 },
    });
    const after = apply017StyleCommit(before, "ko-R1-M2", 13, 15);
    assert.equal(
      shouldApplySilentCanonicalSnapshot({
        currentVersion: 31,
        incomingVersion: 32,
      }),
      true
    );
    const live = projectInternalLiveKnockout(after);
    const semi2 = live.event.matches.find((match) => match.id === "ko-R1-M2");
    assert.equal(semi2.scoreA, 13);
    assert.equal(semi2.scoreB, 15);
    assert.equal(semi2.status, MATCH_STATUS.COMPLETED);
    const presentation = resolveSilentReloadPresentation({ hasTournament: true });
    assert.equal(presentation.fullPageLoading, false);
    assert.equal(presentation.retainSection, true);
  });

  it("C. winner is visible after canonical 017-style commit", () => {
    const event = apply017StyleCommit(
      makeKnockoutEvent({
        semi1: { status: MATCH_STATUS.COMPLETED, scoreA: 15, scoreB: 10 },
      }),
      "ko-R1-M2",
      13,
      15
    );
    const live = projectInternalLiveKnockout(event);
    const semi1 = live.event.matches.find((match) => match.id === "ko-R1-M1");
    const semi2 = live.event.matches.find((match) => match.id === "ko-R1-M2");
    assert.equal(semi1.winnerId, A1.id);
    assert.equal(semi2.winnerId, B1.id);
    assert.equal(live.engine, INTERNAL_WINNER_PROGRESSION_ENGINE);
  });

  it("D. Final participants update from completed semifinals", () => {
    const event = apply017StyleCommit(
      makeKnockoutEvent({
        semi1: { status: MATCH_STATUS.COMPLETED, scoreA: 15, scoreB: 10 },
      }),
      "ko-R1-M2",
      13,
      15
    );
    assert.equal(event.matches.find((match) => match.id === "ko-R2-M1").entryAId, "");
    assert.equal(event.matches.find((match) => match.id === "ko-R2-M1").entryBId, "");
    const live = projectInternalLiveKnockout(event);
    assert.equal(live.drifted, true);
    assert.equal(live.finalMatch.entryAId, A1.id);
    assert.equal(live.finalMatch.entryBId, B1.id);
    assert.equal(live.progress.rounds[1].matches[0].home.id, A1.id);
    assert.equal(live.progress.rounds[1].matches[0].away.id, B1.id);
    assert.equal(
      shouldPersistKnockoutProgression({ drifted: live.drifted, mutationActive: false }),
      true
    );
  });

  it("E. round completion counter updates 0/2 → 1/2", () => {
    const none = projectInternalLiveKnockout(makeKnockoutEvent());
    assert.equal(none.progress.completedRounds, 0);
    assert.equal(none.progress.totalRounds, 2);
    const both = projectInternalLiveKnockout(
      apply017StyleCommit(
        makeKnockoutEvent({
          semi1: { status: MATCH_STATUS.COMPLETED, scoreA: 15, scoreB: 10 },
        }),
        "ko-R1-M2",
        13,
        15
      )
    );
    assert.equal(both.progress.completedRounds, 1);
    assert.equal(both.progress.totalRounds, 2);
    assert.equal(both.completedKnockoutCount, 2);
  });

  it("F. F5 mapper remount produces identical knockout fingerprint", () => {
    const event = apply017StyleCommit(
      makeKnockoutEvent({
        semi1: { status: MATCH_STATUS.COMPLETED, scoreA: 15, scoreB: 10 },
      }),
      "ko-R1-M2",
      13,
      15
    );
    const first = projectInternalLiveKnockout(event);
    const tournament = {
      id: "d3a35fd1-5caf-4d18-86b4-5df0881c9dc3",
      name: "Giải nội bộ 14/8/2026",
      mode: "internal_tournament",
      clubId: "club-ecebf64c78f948ccb2b59842441eb26c",
      tenantId: "venue-staging-a",
      events: [first.event],
    };
    const row = tournamentToCanonicalRow(tournament, {
      tenantId: tournament.tenantId,
      clubId: tournament.clubId,
    });
    row.version = 32;
    row.created_at = "2026-08-14T00:00:00.000Z";
    row.updated_at = "2026-08-14T00:00:00.000Z";
    const remounted = canonicalRowToTournament(row);
    const second = projectInternalLiveKnockout(remounted.events[0]);
    assert.equal(first.fingerprint, second.fingerprint);
    assert.equal(second.finalMatch.entryAId, A1.id);
    assert.equal(second.finalMatch.entryBId, B1.id);
  });

  it("G. background refresh does not full-page load", () => {
    const presentation = resolveSilentReloadPresentation({ hasTournament: true });
    assert.equal(presentation.initialLoading, false);
    assert.equal(presentation.silent, true);
    assert.equal(presentation.fullPageLoading, false);
    const hook = readSrc("src/features/tournament/hooks/useCanonicalTournament.js");
    assert.match(hook, /silent = false/);
    assert.match(hook, /if \(!silent\)/);
    assert.match(hook, /shouldReplaceCanonicalSnapshot/);
  });

  it("H. tab focus does not reset bracket section", () => {
    const sections = readSrc("src/features/tournament/internal/internalWorkspaceSections.js");
    const setup = readSrc("src/pages/tournament/InternalTournamentSetup.jsx");
    const hook = readSrc("src/features/tournament/hooks/useCanonicalTournament.js");
    assert.match(sections, /sameScopeRestored|keepWorkspace|has-tournament/);
    assert.match(hook, /sameScopeRestored/);
    assert.match(setup, /INTERNAL_WORKSPACE_SECTION_QUERY/);
    assert.match(setup, /sessionSection/);
    assert.doesNotMatch(setup, /window\.location\.reload/);
  });

  it("I. Team Tournament refresh regression remains polling/realtime", () => {
    const teamPage = readSrc("src/features/team-tournament/ui/useTeamTournamentPage.js");
    const teamRealtime = readSrc("src/features/team-tournament/ui/useTeamTournamentRealtime.js");
    assert.match(teamPage, /pollingEnabled/);
    assert.match(teamPage, /setInterval/);
    assert.match(teamPage, /visibilitychange/);
    assert.match(teamPage, /reload\(\{ silent: true \}\)/);
    assert.match(teamRealtime, /useTeamTournamentRealtime/);
  });

  it("J. completed semifinal cannot duplicate progression", () => {
    const event = apply017StyleCommit(
      makeKnockoutEvent({
        semi1: { status: MATCH_STATUS.COMPLETED, scoreA: 15, scoreB: 10 },
      }),
      "ko-R1-M2",
      13,
      15
    );
    assert.equal(knockoutProgressionIsIdempotent(event), true);
    const once = projectInternalLiveKnockout(event);
    const twice = projectInternalLiveKnockout(once.event);
    assert.equal(once.fingerprint, twice.fingerprint);
    assert.equal(twice.drifted, false);
    assert.equal(
      knockoutMatchFingerprint(once.event),
      knockoutMatchFingerprint(twice.event)
    );
    const wrapped = applyInternalLiveKnockoutToTournament({
      id: "t",
      version: 32,
      events: [event],
    });
    assert.equal(wrapped.projection.finalMatch.entryAId, A1.id);
    assert.equal(wrapped.projection.finalMatch.entryBId, B1.id);
    assert.equal(
      shouldReplaceCanonicalSnapshot({ version: 31, events: [event] }, { version: 32, events: [once.event] }),
      true
    );
    assert.equal(
      shouldReplaceCanonicalSnapshot({ version: 32, events: [once.event] }, { version: 32, events: [once.event] }),
      false
    );
  });

  it("017 client projector still syncs KO and referee portal reuses it", () => {
    const event = makeKnockoutEvent({
      semi1: { status: MATCH_STATUS.COMPLETED, scoreA: 15, scoreB: 10 },
    });
    const projected = projectInternalRefereeCanonicalEventResult(event, "ko-R1-M2", {
      scoreA: 13,
      scoreB: 15,
    });
    assert.equal(projected.ok, true);
    const live = projectInternalLiveKnockout(projected.event);
    assert.equal(live.finalMatch.entryAId, A1.id);
    assert.equal(live.finalMatch.entryBId, B1.id);
    const portal = readSrc("src/pages/tournament/InternalRefereePortalPage.jsx");
    assert.match(portal, /useInternalCanonicalSnapshotRefresh/);
    assert.match(portal, /applyInternalLiveKnockoutToTournament/);
    assert.match(portal, /internal-referee-portal-knockout/);
    const drift = detectKnockoutProgressionDrift(event);
    assert.equal(drift.drifted, true);
  });
});
