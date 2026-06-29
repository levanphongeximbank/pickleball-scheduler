import {
  buildKnockoutProgress,
  buildTournamentBracket,
  isKnockoutRoundLocked,
  resolveKnockoutRounds,
  sanitizeKnockoutWinners,
} from "../../pages/tournament.bracket.logic.js";
import { MATCH_STAGE, MATCH_STATUS } from "../../models/tournament/constants.js";
import { createMatchRecord, normalizeMatch } from "../../models/tournament/match.js";
import { submitMatchScore } from "./matchEngine.js";
import { buildAllGroupStandings } from "./rankingEngine.js";

const ROUND_NAME_TO_STAGE = {
  "Vong 1/16": MATCH_STAGE.ROUND_OF_16,
  "Vong 1/8": MATCH_STAGE.ROUND_OF_16,
  "Tu ket": MATCH_STAGE.QUARTERFINAL,
  "Ban ket": MATCH_STAGE.SEMIFINAL,
  "Chung ket": MATCH_STAGE.FINAL,
};

function parseRoundNumber(bracketMatchId) {
  const match = String(bracketMatchId || "").match(/^R(\d+)-/);
  return match ? Number(match[1]) : 1;
}

function mapRoundNameToStage(roundName) {
  return ROUND_NAME_TO_STAGE[String(roundName || "").trim()] || MATCH_STAGE.QUARTERFINAL;
}

function getDefaultBracketState() {
  return {
    rounds: [],
    winnersByMatch: {},
    unlockedRounds: {},
    qualifiersPerGroup: 2,
    generatedAt: null,
  };
}

function normalizeBracketState(bracket) {
  if (!bracket || typeof bracket !== "object") {
    return getDefaultBracketState();
  }

  return {
    ...getDefaultBracketState(),
    ...bracket,
    winnersByMatch:
      bracket.winnersByMatch && typeof bracket.winnersByMatch === "object"
        ? { ...bracket.winnersByMatch }
        : {},
    unlockedRounds:
      bracket.unlockedRounds && typeof bracket.unlockedRounds === "object"
        ? { ...bracket.unlockedRounds }
        : {},
    rounds: Array.isArray(bracket.rounds) ? bracket.rounds : [],
  };
}

function entryMapFromEvent(event) {
  return new Map((event?.entries || []).map((entry) => [String(entry.id), entry]));
}

function getWinnerSideFromMatch(match) {
  if (!match?.winnerId) {
    return null;
  }

  if (String(match.winnerId) === String(match.entryAId)) {
    return "home";
  }

  if (String(match.winnerId) === String(match.entryBId)) {
    return "away";
  }

  return null;
}

export function getWinnersByMatchFromKnockoutMatches(matches = []) {
  const winners = {};

  (matches || []).forEach((match) => {
    if (!match?.bracketMatchId) {
      return;
    }

    const side = getWinnerSideFromMatch(match);
    if (side) {
      winners[match.bracketMatchId] = side;
    }
  });

  return winners;
}

export function mergeBracketWinners(bracket, knockoutMatches = []) {
  const manual = bracket?.winnersByMatch || {};
  const fromScores = getWinnersByMatchFromKnockoutMatches(knockoutMatches);
  return { ...manual, ...fromScores };
}

export function isGroupStageComplete(event) {
  const groupMatches = (event?.matches || []).filter((match) => !match.bracketMatchId);
  if (!groupMatches.length) {
    return false;
  }

  return groupMatches.every(
    (match) =>
      match.status === MATCH_STATUS.COMPLETED || match.status === MATCH_STATUS.FORFEIT
  );
}

export function hasBracketGenerated(event) {
  return Boolean(normalizeBracketState(event?.bracket).rounds.length);
}

export function isBracketGenerationReady(event, options = {}) {
  if (!isGroupStageComplete(event)) {
    return { ready: false, reason: "group-incomplete" };
  }

  if (hasBracketGenerated(event)) {
    return { ready: false, reason: "already-generated" };
  }

  const check = canGenerateBracket(event, options);
  if (!check.ok) {
    return { ready: false, reason: "validation-error", errors: check.errors };
  }

  if ((check.warnings || []).length > 0) {
    return { ready: false, reason: "qualifiers-incomplete", warnings: check.warnings };
  }

  return { ready: true, check };
}

export function autoSyncBracketFromGroupStandings(event, options = {}) {
  const readiness = isBracketGenerationReady(event, options);
  if (!readiness.ready) {
    return {
      ok: true,
      event,
      generated: false,
      reason: readiness.reason,
    };
  }

  const generated = generateKnockoutBracket(event, options);
  if (!generated.ok) {
    return {
      ok: false,
      event,
      generated: false,
      errors: generated.errors,
    };
  }

  return {
    ok: true,
    event: generated.event,
    generated: true,
    warnings: generated.warnings,
    knockoutMatchCount: generated.knockoutMatchCount,
  };
}

export function canGenerateBracket(event, options = {}) {
  const qualifiersPerGroup = Number(options.qualifiersPerGroup) || 2;
  const groups = event?.groups || [];
  const errors = [];
  const warnings = [];

  if (groups.length < 2) {
    errors.push("Can it nhat 2 bang de tao bracket.");
  }

  if (groups.length % 2 !== 0) {
    errors.push("So bang phai la so chan (2/4/8/16...).");
  }

  const standings = buildAllGroupStandings(event, { qualifiersPerGroup });
  if (standings.length < 2) {
    errors.push("Chua co bang xep hang hop le.");
  }

  standings.forEach((groupStanding) => {
    if ((groupStanding.qualified || []).length < qualifiersPerGroup) {
      warnings.push(
        `Bang ${groupStanding.group} chua du ${qualifiersPerGroup} doi dung hang de knock-out.`
      );
    }
  });

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    groupStandings: standings,
  };
}

export function generateKnockoutBracket(event, options = {}) {
  const qualifiersPerGroup = Number(options.qualifiersPerGroup) || 2;
  const check = canGenerateBracket(event, { qualifiersPerGroup });

  if (!check.ok) {
    return {
      ok: false,
      errors: check.errors,
      warnings: check.warnings,
    };
  }

  const rounds = buildTournamentBracket(check.groupStandings, { qualifiersPerGroup });
  const groupMatches = (event.matches || []).filter(
    (match) => match.stage === MATCH_STAGE.GROUP || !match.bracketMatchId
  );

  const knockoutMatches = [];
  rounds.forEach((round) => {
    round.matches.forEach((bracketMatch) => {
      knockoutMatches.push(
        createMatchRecord({
          id: `ko-${bracketMatch.id}`,
          tournamentId: event.tournamentId || "",
          eventId: event.id || "",
          groupId: "",
          stage: mapRoundNameToStage(round.name),
          round: parseRoundNumber(bracketMatch.id),
          entryAId: bracketMatch.home?.id || "",
          entryBId: bracketMatch.away?.id || "",
          bracketMatchId: bracketMatch.id,
          status: MATCH_STATUS.WAITING,
        })
      );
    });
  });

  return {
    ok: true,
    event: {
      ...event,
      matches: [...groupMatches, ...knockoutMatches],
      bracket: {
        rounds,
        winnersByMatch: {},
        unlockedRounds: {},
        qualifiersPerGroup,
        generatedAt: options.now || new Date().toISOString(),
      },
    },
    warnings: check.warnings,
    groupStandings: check.groupStandings,
    knockoutMatchCount: knockoutMatches.length,
  };
}

function clearMatchResultFields(match) {
  return normalizeMatch({
    ...match,
    scoreA: null,
    scoreB: null,
    winnerId: "",
    loserId: "",
    status: MATCH_STATUS.WAITING,
    completedAt: null,
    courtId: null,
  });
}

export function syncKnockoutMatchParticipants(event) {
  const bracket = normalizeBracketState(event.bracket);
  if (!bracket.rounds.length) {
    return event;
  }

  const entries = entryMapFromEvent(event);
  const knockoutMatches = (event.matches || []).filter((match) => match.bracketMatchId);
  const winnersByMatch = mergeBracketWinners(bracket, knockoutMatches);
  const sanitized = sanitizeKnockoutWinners(bracket.rounds, winnersByMatch);
  const resolvedRounds = resolveKnockoutRounds(bracket.rounds, sanitized);

  const resolvedById = new Map();
  resolvedRounds.forEach((round) => {
    (round.matches || []).forEach((bracketMatch) => {
      resolvedById.set(bracketMatch.id, bracketMatch);
    });
  });

  const nextMatches = (event.matches || []).map((match) => {
    if (!match.bracketMatchId) {
      return match;
    }

    const resolved = resolvedById.get(match.bracketMatchId);
    if (!resolved) {
      return match;
    }

    const nextEntryA = resolved.home?.id || "";
    const nextEntryB = resolved.away?.id || "";
    const entryChanged =
      String(match.entryAId) !== String(nextEntryA) ||
      String(match.entryBId) !== String(nextEntryB);

    if (!entryChanged) {
      return match;
    }

    const entryA = entries.get(String(nextEntryA));
    const entryB = entries.get(String(nextEntryB));

    return clearMatchResultFields({
      ...match,
      entryAId: entryA?.id || nextEntryA,
      entryBId: entryB?.id || nextEntryB,
    });
  });

  return {
    ...event,
    matches: nextMatches,
    bracket: {
      ...bracket,
      winnersByMatch: sanitized,
    },
  };
}

export function resolveBracketProgress(event) {
  const bracket = normalizeBracketState(event.bracket);
  if (!bracket.rounds.length) {
    return {
      rounds: [],
      champion: null,
      completedRounds: 0,
      totalRounds: 0,
    };
  }

  const knockoutMatches = (event.matches || []).filter((match) => match.bracketMatchId);
  const winnersByMatch = mergeBracketWinners(bracket, knockoutMatches);
  const sanitized = sanitizeKnockoutWinners(bracket.rounds, winnersByMatch);

  return buildKnockoutProgress(bracket.rounds, sanitized);
}

export function setBracketWinner(event, bracketMatchId, winnerSide) {
  const bracket = normalizeBracketState(event.bracket);
  if (!bracket.rounds.length) {
    return { ok: false, error: "Chua co bracket." };
  }

  const match = (event.matches || []).find(
    (item) => String(item.bracketMatchId) === String(bracketMatchId)
  );

  if (!match) {
    return { ok: false, error: "Khong tim thay tran knock-out." };
  }

  const nextWinners = { ...bracket.winnersByMatch };
  if (!winnerSide) {
    delete nextWinners[bracketMatchId];
  } else {
    nextWinners[bracketMatchId] = winnerSide;
  }

  let nextMatch = match;
  if (!winnerSide) {
    nextMatch = clearMatchResultFields(match);
  } else if (winnerSide === "home" && match.entryAId) {
    nextMatch = normalizeMatch({
      ...match,
      winnerId: match.entryAId,
      loserId: match.entryBId || "",
      status: MATCH_STATUS.COMPLETED,
      completedAt: new Date().toISOString(),
    });
  } else if (winnerSide === "away" && match.entryBId) {
    nextMatch = normalizeMatch({
      ...match,
      winnerId: match.entryBId,
      loserId: match.entryAId || "",
      status: MATCH_STATUS.COMPLETED,
      completedAt: new Date().toISOString(),
    });
  } else {
    return { ok: false, error: "Chua du doi de chon winner." };
  }

  const nextMatches = (event.matches || []).map((item) =>
    String(item.id) === String(match.id) ? nextMatch : item
  );

  const synced = syncKnockoutMatchParticipants({
    ...event,
    matches: nextMatches,
    bracket: {
      ...bracket,
      winnersByMatch: nextWinners,
    },
  });

  return { ok: true, event: synced };
}

export function submitKnockoutMatchScore(event, matchId, scores = {}, options = {}) {
  const match = (event.matches || []).find((item) => String(item.id) === String(matchId));

  if (!match?.bracketMatchId) {
    return { ok: false, error: "Tran knock-out khong hop le." };
  }

  const result = submitMatchScore(match, scores, options);
  if (!result.ok) {
    return result;
  }

  const nextMatches = (event.matches || []).map((item) =>
    String(item.id) === String(matchId) ? result.match : item
  );

  const synced = syncKnockoutMatchParticipants({
    ...event,
    matches: nextMatches,
  });

  return {
    ok: true,
    event: synced,
    match: result.match,
  };
}

export function toggleBracketRoundUnlock(event, roundName, unlock = true) {
  const bracket = normalizeBracketState(event.bracket);
  const key = String(roundName || "").trim();
  if (!key) {
    return { ok: false, error: "Ten vong khong hop le." };
  }

  const nextUnlocked = { ...bracket.unlockedRounds };
  if (unlock) {
    nextUnlocked[key] = true;
  } else {
    delete nextUnlocked[key];
  }

  return {
    ok: true,
    event: {
      ...event,
      bracket: {
        ...bracket,
        unlockedRounds: nextUnlocked,
      },
    },
  };
}

export function resetBracketState(event) {
  const groupMatches = (event.matches || []).filter((match) => !match.bracketMatchId);

  return {
    ...event,
    matches: groupMatches,
    bracket: getDefaultBracketState(),
  };
}

export function buildBracketPatch(event, nextEvent) {
  return {
    ok: true,
    events: [
      {
        ...event,
        ...nextEvent,
      },
    ],
  };
}

export {
  isKnockoutRoundLocked,
  sanitizeKnockoutWinners,
  buildTournamentBracket,
  buildKnockoutProgress,
};
