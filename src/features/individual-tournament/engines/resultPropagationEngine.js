/**
 * S1-F — Result propagation: apply confirmed result → event matches,
 * standings, bracket advance, qualification sync — exactly once per commandId.
 */

import {
  finalizeMatchResult,
  getMatchResult,
  getResultPropagationState,
  isCommandProcessed,
  MATCH_RESULT_TYPE,
  markCommandProcessed,
  appendResultAudit,
  RESULT_AUDIT_ACTIONS,
} from "./matchResultEngine.js";
import {
  submitTournamentDirectorMatchScore,
} from "../../../tournament/engines/tournamentDirectorEngine.js";
import {
  autoSyncBracketFromGroupStandings,
  syncKnockoutMatchParticipants,
  submitKnockoutMatchScore,
} from "../../../tournament/engines/bracketEngine.js";
import { forfeitMatch } from "../../../tournament/engines/matchEngine.js";
import { MATCH_STATUS } from "../../../models/tournament/constants.js";
import { buildIndividualAllGroupStandings } from "../adapters/individualStandingsAdapter.js";
import { createId } from "../../../utils/id.js";

function findEvent(tournament, eventId) {
  const events = tournament?.events || [];
  if (eventId) {
    return events.find((e) => String(e.id) === String(eventId)) || null;
  }
  return events[0] || null;
}

function replaceEvent(tournament, nextEvent) {
  const events = (tournament.events || []).map((event) =>
    String(event.id) === String(nextEvent.id) ? nextEvent : event
  );
  return { ...tournament, events };
}

function applyNonScoreResultToEvent(event, matchId, finalizedMatch) {
  const nextMatches = (event.matches || []).map((item) =>
    String(item.id) === String(matchId) ? finalizedMatch : item
  );
  let nextEvent = { ...event, matches: nextMatches };

  if (finalizedMatch.bracketMatchId) {
    nextEvent = syncKnockoutMatchParticipants(nextEvent);
  } else {
    const autoBracket = autoSyncBracketFromGroupStandings(nextEvent, {});
    if (autoBracket.generated) {
      nextEvent = autoBracket.event;
    }
  }

  return nextEvent;
}

/**
 * Propagate a finalized match into tournament blob once.
 */
export function propagateMatchResult(tournament, matchId, options = {}) {
  const commandId = options.commandId || createId("cmd-prop");
  if (isCommandProcessed(tournament, commandId) && !options.force) {
    return {
      ok: true,
      tournament,
      idempotentReplay: true,
      commandId,
      standings: null,
    };
  }

  const event = findEvent(tournament, options.eventId);
  if (!event) {
    return { ok: false, error: "Không tìm thấy nội dung (event)." };
  }

  const match = (event.matches || []).find((m) => String(m.id) === String(matchId));
  if (!match) {
    return { ok: false, error: "Không tìm thấy trận." };
  }

  const stored = options.result || getMatchResult(tournament, matchId);
  if (!stored && !options.payload) {
    return { ok: false, error: "Chưa có kết quả đã xác nhận để lan truyền." };
  }

  const payload = options.payload || {
    resultType: stored.resultType || MATCH_RESULT_TYPE.COMPLETED,
    scoreA: stored.scoreA,
    scoreB: stored.scoreB,
    winnerId: stored.winnerId,
    reason: stored.reason,
  };

  const finalize = finalizeMatchResult(tournament, match, payload, {
    ...options,
    commandId,
    eventId: event.id,
  });
  if (!finalize.ok) return finalize;
  if (finalize.idempotentReplay && !options.force) {
    return {
      ok: true,
      tournament: finalize.tournament,
      idempotentReplay: true,
      commandId,
      match: finalize.match,
      result: finalize.result,
    };
  }

  let nextTournament = finalize.tournament;
  let nextEvent = event;
  const finalizedMatch = finalize.match;

  if (payload.resultType === MATCH_RESULT_TYPE.COMPLETED) {
    const scoreResult = submitTournamentDirectorMatchScore(
      event,
      matchId,
      { scoreA: finalizedMatch.scoreA, scoreB: finalizedMatch.scoreB },
      options
    );
    if (!scoreResult.ok) {
      return scoreResult;
    }
    // Stamp result metadata on the completed match
    nextEvent = {
      ...scoreResult.event,
      matches: (scoreResult.event.matches || []).map((item) =>
        String(item.id) === String(matchId)
          ? {
              ...item,
              resultType: MATCH_RESULT_TYPE.COMPLETED,
              locked: true,
              isThirdPlace: Boolean(finalizedMatch.isThirdPlace),
            }
          : item
      ),
    };
  } else {
    nextEvent = applyNonScoreResultToEvent(event, matchId, finalizedMatch);
  }

  nextTournament = replaceEvent(nextTournament, nextEvent);

  // Ensure KO participants advance after any group completion path
  if (nextEvent.bracket?.rounds?.length) {
    nextEvent = syncKnockoutMatchParticipants(nextEvent);
    nextTournament = replaceEvent(nextTournament, nextEvent);
  }

  const standings = buildIndividualAllGroupStandings(nextEvent, {
    forceCanonical: true,
  });

  // Persist latest standings snapshot for player/organizer views
  nextTournament = {
    ...nextTournament,
    settings: {
      ...(nextTournament.settings || {}),
      liveStandings: {
        ...(nextTournament.settings?.liveStandings || {}),
        [String(nextEvent.id)]: {
          updatedAt: new Date().toISOString(),
          groups: standings,
        },
      },
    },
  };

  nextTournament = markCommandProcessed(nextTournament, commandId);

  return {
    ok: true,
    tournament: nextTournament,
    event: nextEvent,
    match: finalizedMatch,
    result: finalize.result,
    standings,
    commandId,
    idempotentReplay: false,
  };
}

/**
 * Recompute standings + bracket after a corrected result.
 */
export function recalculateDownstream(tournament, matchId, options = {}) {
  const event = findEvent(tournament, options.eventId);
  if (!event) {
    return { ok: false, error: "Không tìm thấy nội dung (event)." };
  }

  let nextEvent = { ...event };

  // Re-sync KO from current completed/forfeit matches
  if (nextEvent.bracket?.rounds?.length) {
    nextEvent = syncKnockoutMatchParticipants(nextEvent);
  } else {
    const autoBracket = autoSyncBracketFromGroupStandings(nextEvent, options);
    if (autoBracket.generated) {
      nextEvent = autoBracket.event;
    }
  }

  let nextTournament = replaceEvent(tournament, nextEvent);
  const standings = buildIndividualAllGroupStandings(nextEvent, {
    forceCanonical: true,
  });

  nextTournament = {
    ...nextTournament,
    settings: {
      ...(nextTournament.settings || {}),
      liveStandings: {
        ...(nextTournament.settings?.liveStandings || {}),
        [String(nextEvent.id)]: {
          updatedAt: new Date().toISOString(),
          groups: standings,
          triggerMatchId: String(matchId),
        },
      },
    },
  };

  return {
    ok: true,
    tournament: nextTournament,
    event: nextEvent,
    standings,
  };
}

export function getLiveStandings(tournament, eventId) {
  const map = tournament?.settings?.liveStandings || {};
  if (eventId) return map[String(eventId)] || null;
  const firstEvent = tournament?.events?.[0];
  if (firstEvent) return map[String(firstEvent.id)] || null;
  return Object.values(map)[0] || null;
}

export function listCompletedLockedMatches(tournament, eventId) {
  const event = findEvent(tournament, eventId);
  if (!event) return [];
  return (event.matches || []).filter(
    (m) =>
      m.locked ||
      m.status === MATCH_STATUS.COMPLETED ||
      m.status === MATCH_STATUS.FORFEIT
  );
}

export {
  submitKnockoutMatchScore,
  forfeitMatch,
  getResultPropagationState,
  RESULT_AUDIT_ACTIONS,
  appendResultAudit,
};
