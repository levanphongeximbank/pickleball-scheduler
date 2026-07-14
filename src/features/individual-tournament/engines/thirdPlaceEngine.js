/**
 * S1-G — Optional third-place playoff generation + medal wiring helpers.
 * Does not modify S1-A/F engines; patches event matches/bracket when enabled.
 */

import { createId } from "../../../utils/id.js";
import { MATCH_STAGE, MATCH_STATUS } from "../../../models/tournament/constants.js";
import { createMatchRecord } from "../../../models/tournament/match.js";
import {
  RESULTS_OPS_AUDIT,
  appendResultsOpsAudit,
  getResultsOps,
  patchResultsOps,
} from "./walkoverEngine.js";

export function isThirdPlaceEnabled(tournament) {
  return getResultsOps(tournament).includeThirdPlace !== false;
}

export function setThirdPlaceEnabled(tournament, enabled, options = {}) {
  let next = patchResultsOps(tournament, {
    includeThirdPlace: enabled === true,
  });
  next = appendResultsOpsAudit(
    next,
    {
      action: RESULTS_OPS_AUDIT.THIRD_PLACE_ENABLED,
      actor: options.actor,
      reason: enabled ? "enabled" : "disabled",
      meta: { includeThirdPlace: enabled === true },
    },
    options
  );
  return { ok: true, tournament: next, includeThirdPlace: enabled === true };
}

function findSemifinalMatches(event) {
  return (event?.matches || []).filter(
    (m) =>
      m.stage === MATCH_STAGE.SEMIFINAL ||
      String(m.bracketMatchId || "").toLowerCase().includes("sf") ||
      String(m.bracketMatchId || "").toLowerCase().includes("semi")
  );
}

function findFinalMatch(event) {
  return (event?.matches || []).find((m) => m.stage === MATCH_STAGE.FINAL) || null;
}

function findExistingThirdPlace(event) {
  return (
    (event?.matches || []).find(
      (m) => m.stage === MATCH_STAGE.THIRD_PLACE || m.isThirdPlace
    ) || null
  );
}

/**
 * Ensure a third-place match exists for an event with knockout rounds.
 * Slots filled from semifinal losers when available.
 */
export function ensureThirdPlaceMatch(event, options = {}) {
  if (!event) {
    return { ok: false, error: "Thiếu event." };
  }

  const existing = findExistingThirdPlace(event);
  if (existing && !options.force) {
    return { ok: true, event, match: existing, created: false };
  }

  const semis = findSemifinalMatches(event);
  const finalMatch = findFinalMatch(event);
  if (!finalMatch && semis.length < 2 && !(event.bracket?.rounds || []).length) {
    return {
      ok: false,
      error: "Chưa có nhánh knockout / chung kết để tạo tranh hạng ba.",
    };
  }

  const losers = [];
  semis.forEach((semi) => {
    if (semi.loserId) losers.push(semi.loserId);
  });

  const bracketMatchId = options.bracketMatchId || "br-third-place";
  const matchId = existing?.id || options.matchId || `ko-${bracketMatchId}`;

  const thirdPlaceMatch = createMatchRecord({
    id: matchId,
    tournamentId: event.tournamentId || "",
    eventId: event.id || "",
    groupId: "",
    stage: MATCH_STAGE.THIRD_PLACE,
    round: 99,
    entryAId: losers[0] || existing?.entryAId || "",
    entryBId: losers[1] || existing?.entryBId || "",
    bracketMatchId,
    status: MATCH_STATUS.WAITING,
    isThirdPlace: true,
  });

  const withoutOld = (event.matches || []).filter(
    (m) => m.stage !== MATCH_STAGE.THIRD_PLACE && !m.isThirdPlace
  );

  const rounds = [...(event.bracket?.rounds || [])];
  const hasThirdRound = rounds.some((r) =>
    (r.matches || []).some((m) => String(m.id) === bracketMatchId)
  );
  if (!hasThirdRound) {
    rounds.push({
      id: createId("round-third"),
      name: "Tranh hạng ba",
      matches: [
        {
          id: bracketMatchId,
          home: { id: thirdPlaceMatch.entryAId || "" },
          away: { id: thirdPlaceMatch.entryBId || "" },
          isThirdPlace: true,
        },
      ],
    });
  }

  const nextEvent = {
    ...event,
    matches: [...withoutOld, thirdPlaceMatch],
    bracket: {
      ...(event.bracket || {}),
      rounds,
      includeThirdPlace: true,
    },
  };

  return { ok: true, event: nextEvent, match: thirdPlaceMatch, created: !existing };
}

/**
 * After SF results, fill third-place participants from losers.
 */
export function syncThirdPlaceParticipants(event) {
  const third = findExistingThirdPlace(event);
  if (!third) {
    return { ok: true, event, updated: false };
  }

  const semis = findSemifinalMatches(event).filter(
    (m) => m.status === MATCH_STATUS.COMPLETED || m.status === MATCH_STATUS.FORFEIT
  );
  if (semis.length < 2) {
    return { ok: true, event, updated: false };
  }

  const losers = semis.map((m) => m.loserId).filter(Boolean);
  if (losers.length < 2) {
    return { ok: true, event, updated: false };
  }

  if (
    String(third.entryAId) === String(losers[0]) &&
    String(third.entryBId) === String(losers[1])
  ) {
    return { ok: true, event, updated: false };
  }

  // Don't overwrite if third place already completed
  if (third.status === MATCH_STATUS.COMPLETED || third.status === MATCH_STATUS.FORFEIT) {
    return { ok: true, event, updated: false };
  }

  const nextMatch = {
    ...third,
    entryAId: losers[0],
    entryBId: losers[1],
  };

  const nextEvent = {
    ...event,
    matches: (event.matches || []).map((m) =>
      String(m.id) === String(third.id) ? nextMatch : m
    ),
  };

  return { ok: true, event: nextEvent, match: nextMatch, updated: true };
}

export function generateThirdPlaceForTournament(tournament, options = {}) {
  if (!isThirdPlaceEnabled(tournament) && options.force !== true) {
    return { ok: false, error: "Tranh hạng ba đang tắt trong cài đặt." };
  }

  const eventId = options.eventId || tournament.events?.[0]?.id;
  const event = (tournament.events || []).find((e) => String(e.id) === String(eventId));
  if (!event) {
    return { ok: false, error: "Không tìm thấy nội dung." };
  }

  let ensured = ensureThirdPlaceMatch(event, options);
  if (!ensured.ok) return ensured;

  ensured = syncThirdPlaceParticipants(ensured.event);
  const nextEvent = ensured.event;

  let next = {
    ...tournament,
    events: (tournament.events || []).map((e) =>
      String(e.id) === String(nextEvent.id) ? nextEvent : e
    ),
  };

  next = appendResultsOpsAudit(
    next,
    {
      action: RESULTS_OPS_AUDIT.THIRD_PLACE_GENERATED,
      eventId: nextEvent.id,
      matchId: ensured.match?.id || findExistingThirdPlace(nextEvent)?.id,
      actor: options.actor,
      reason: "generate_third_place",
    },
    options
  );

  return {
    ok: true,
    tournament: next,
    event: nextEvent,
    match: findExistingThirdPlace(nextEvent),
    created: ensured.created === true || ensured.updated === true,
  };
}

export function getThirdPlaceMedalEntryId(event) {
  const third = findExistingThirdPlace(event);
  if (!third) return "";
  if (third.status === MATCH_STATUS.COMPLETED || third.status === MATCH_STATUS.FORFEIT) {
    return third.winnerId || "";
  }
  return "";
}
