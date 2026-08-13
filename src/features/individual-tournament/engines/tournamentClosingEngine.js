/**
 * S1-G — Tournament closing: lock results, freeze standings/brackets, summary.
 */

import { TOURNAMENT_MODE, TOURNAMENT_STATUS, MATCH_STATUS } from "../../../models/tournament/constants.js";
import {
  RESULTS_OPS_AUDIT,
  appendResultsOpsAudit,
  getResultsOps,
  patchResultsOps,
} from "./walkoverEngine.js";
import { buildAwardsPreview, autoAssignAwardsFromRanking } from "./awardsEngine.js";
import { buildFinalRanking } from "./awardsEngine.js";
import { getLiveStandings } from "./resultPropagationEngine.js";
import { buildIndividualAllGroupStandings } from "../adapters/individualStandingsAdapter.js";
import { listWalkovers } from "./walkoverEngine.js";
import { listWithdrawalHistory } from "./withdrawalEngine.js";

function isGenuineTerminalMatchStatus(status) {
  const value = String(status || "").toLowerCase();
  return (
    value === MATCH_STATUS.COMPLETED ||
    value === MATCH_STATUS.FORFEIT ||
    value === "completed" ||
    value === "forfeit"
  );
}

/**
 * Internal competition gate without importing Internal completion module
 * (avoids circular dependency with oneGroupCompletion → canCloseTournament).
 * Semantics must match assertInternalCompetitionComplete / isGroupStageComplete.
 */
function assertInternalCompetitionForClose(tournament) {
  const event = tournament?.events?.[0];
  if (!event) {
    return { ok: false, error: "Thiếu nội dung thi đấu.", reason: "missing_event" };
  }
  const matches = Array.isArray(event.matches) ? event.matches : [];
  if (!matches.length) {
    return { ok: false, error: "Chưa có trận để đóng giải.", reason: "no_matches" };
  }
  const incomplete = matches.filter((match) => !isGenuineTerminalMatchStatus(match?.status));
  if (incomplete.length > 0) {
    return {
      ok: false,
      error: `Còn ${incomplete.length} trận chưa hoàn tất (locked không được tính là đã đấu).`,
      reason: "incomplete_matches",
    };
  }
  const groups = Array.isArray(event.groups) ? event.groups : [];
  const groupMatches = matches.filter((match) => !match?.bracketMatchId);
  if (groups.length < 1 || groupMatches.length < 1) {
    return { ok: false, error: "Thiếu vòng bảng hoàn tất.", reason: "missing_group_stage" };
  }
  if (groups.length === 1) {
    const ko = matches.filter((match) => match?.bracketMatchId);
    if (ko.length > 0) {
      return {
        ok: false,
        error: "Giải 1 bảng không được đóng khi còn trận knock-out.",
        reason: "one_group_has_knockout",
      };
    }
    return { ok: true };
  }
  const finalDone = matches.some((match) => {
    const stage = String(match?.stage || match?.round || "").toLowerCase();
    const isFinal =
      stage === "final" ||
      stage === "chung ket" ||
      stage === "chung_ket" ||
      stage.includes("final");
    return (
      isFinal &&
      isGenuineTerminalMatchStatus(match?.status) &&
      Boolean(match?.winnerId)
    );
  });
  if (!finalDone) {
    return {
      ok: false,
      error: "Vòng knock-out / chung kết chưa hoàn tất.",
      reason: "knockout_incomplete",
    };
  }
  return { ok: true };
}

export function canCloseTournament(tournament) {
  if (!tournament) {
    return { ok: false, error: "Thiếu giải." };
  }
  const ops = getResultsOps(tournament);
  if (ops.closed) {
    return { ok: false, error: "Giải đã được đóng." };
  }
  if (String(tournament.mode || "") === TOURNAMENT_MODE.INTERNAL_TOURNAMENT) {
    const competition = assertInternalCompetitionForClose(tournament);
    if (!competition.ok) {
      return {
        ok: false,
        error: competition.error,
        code: "INTERNAL_TOURNAMENT_NOT_COMPLETION_ELIGIBLE",
        reason: competition.reason,
      };
    }
  }
  return { ok: true };
}

function freezeEventSnapshots(tournament) {
  const frozenStandings = {};
  const frozenBrackets = {};

  (tournament.events || []).forEach((event) => {
    const live = getLiveStandings(tournament, event.id);
    frozenStandings[event.id] = {
      updatedAt: new Date().toISOString(),
      groups:
        live?.groups ||
        buildIndividualAllGroupStandings(event, { forceCanonical: false }),
    };
    frozenBrackets[event.id] = event.bracket
      ? JSON.parse(JSON.stringify(event.bracket))
      : null;
  });

  return { frozenStandings, frozenBrackets };
}

function lockAllMatches(tournament) {
  const events = (tournament.events || []).map((event) => ({
    ...event,
    matches: (event.matches || []).map((match) => ({
      ...match,
      locked: true,
    })),
  }));
  return { ...tournament, events };
}

export function buildTournamentSummary(tournament) {
  const event = tournament.events?.[0];
  const final = buildFinalRanking(tournament, event?.id);
  const awards = buildAwardsPreview(tournament, { eventId: event?.id });
  const matches = event?.matches || [];
  // IT-P27-001: locked alone is mutability, not a terminal result.
  const completed = matches.filter((m) => isGenuineTerminalMatchStatus(m.status));

  return {
    tournamentId: tournament.id,
    tournamentName: tournament.name || "",
    status: TOURNAMENT_STATUS.COMPLETED,
    closedAt: getResultsOps(tournament).closedAt,
    eventCount: (tournament.events || []).length,
    entryCount: (event?.entries || []).length,
    matchCount: matches.length,
    completedMatchCount: completed.length,
    walkoverCount: listWalkovers(tournament).length,
    withdrawalCount: listWithdrawalHistory(tournament).filter((w) => w.status === "approved")
      .length,
    ranking: final.ranking || [],
    awards: awards.awards || [],
    champion: awards.awards.find((a) => a.key === "champion") || null,
  };
}

/**
 * Close tournament: validate genuine completion → freeze → lock → summary.
 * lockAllMatches is post-eligibility finalization only (IT-P27-001).
 */
export function closeTournament(tournament, options = {}) {
  const check = canCloseTournament(tournament);
  if (!check.ok) return check;

  let next = tournament;

  if (options.autoAwards !== false) {
    const assigned = autoAssignAwardsFromRanking(next, options);
    if (assigned.ok) next = assigned.tournament;
  }

  // Freeze from pre-lock competition state (standings already terminal).
  const { frozenStandings, frozenBrackets } = freezeEventSnapshots(next);

  // Lock only after eligibility — locked ≠ proof of completion.
  next = lockAllMatches(next);

  next = {
    ...next,
    status: TOURNAMENT_STATUS.COMPLETED,
  };

  next = patchResultsOps(next, {
    closed: true,
    closedAt: options.now || new Date().toISOString(),
    closedBy: options.actor?.id || options.userId || "",
    resultsLocked: true,
    frozenStandings,
    frozenBrackets,
  });

  const summary = buildTournamentSummary(next);
  next = patchResultsOps(next, { summary });

  next = appendResultsOpsAudit(
    next,
    {
      action: RESULTS_OPS_AUDIT.TOURNAMENT_CLOSED,
      actor: options.actor,
      reason: options.reason || "tournament_closed",
      meta: {
        championId: summary.champion?.entryId || "",
        completedMatchCount: summary.completedMatchCount,
      },
    },
    options
  );

  return {
    ok: true,
    tournament: next,
    summary,
  };
}

export function isTournamentClosed(tournament) {
  return getResultsOps(tournament).closed === true
    || tournament?.status === TOURNAMENT_STATUS.COMPLETED;
}

export function getFrozenStandings(tournament, eventId) {
  const ops = getResultsOps(tournament);
  if (!ops.frozenStandings) return null;
  if (eventId) return ops.frozenStandings[String(eventId)] || null;
  return Object.values(ops.frozenStandings)[0] || null;
}

export function getTournamentSummary(tournament) {
  const ops = getResultsOps(tournament);
  return ops.summary || (ops.closed ? buildTournamentSummary(tournament) : null);
}

/** Owner-only reopen for corrections after close (rare). */
export function reopenClosedTournament(tournament, options = {}) {
  if (!isTournamentClosed(tournament)) {
    return { ok: false, error: "Giải chưa đóng." };
  }
  if (!options.force) {
    return { ok: false, error: "Cần force=true để mở lại giải đã đóng." };
  }

  let next = {
    ...tournament,
    status: TOURNAMENT_STATUS.ACTIVE,
  };
  next = patchResultsOps(next, {
    closed: false,
    resultsLocked: false,
    closedAt: null,
  });
  return { ok: true, tournament: next };
}
