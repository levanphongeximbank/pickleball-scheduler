import {
  appendScoreLogToMatch,
  createScoreLogEntry,
  formatScoreLogEntry,
  getLatestScoreLogEntry,
  mergeAuditLogIntoMatch,
  normalizeScoreLog,
  resolveDirectorScoreLogSource,
  SCORE_LOG_ACTION,
  SCORE_LOG_SOURCE,
} from "../../models/tournament/scoreLog.js";

export {
  createScoreLogEntry,
  formatScoreLogEntry,
  getLatestScoreLogEntry,
  mergeAuditLogIntoMatch,
  normalizeScoreLog,
  resolveDirectorScoreLogSource,
  SCORE_LOG_ACTION,
  SCORE_LOG_SOURCE,
};

export function mergeScoreLogIntoEvent(event, matchId, entry) {
  if (!event) {
    return event;
  }

  return {
    ...event,
    matches: (event.matches || []).map((match) =>
      String(match.id) === String(matchId) ? appendScoreLogToMatch(match, entry) : match
    ),
  };
}

export function mergeLiveAuditIntoEvent(event, matchId, auditLog = []) {
  if (!event || !auditLog.length) {
    return event;
  }

  return {
    ...event,
    matches: (event.matches || []).map((match) =>
      String(match.id) === String(matchId)
        ? mergeAuditLogIntoMatch(match, auditLog)
        : match
    ),
  };
}

export function mergeScoreLogIntoDailySettings(settings, matchId, entry) {
  const matches = (settings?.matches || []).map((match) =>
    String(match.id) === String(matchId) ? appendScoreLogToMatch(match, entry) : match
  );

  return {
    ...settings,
    matches,
  };
}

export function mergeLiveAuditIntoDailySettings(settings, matchId, auditLog = []) {
  const matches = (settings?.matches || []).map((match) =>
    String(match.id) === String(matchId)
      ? mergeAuditLogIntoMatch(match, auditLog)
      : match
  );

  return {
    ...settings,
    matches,
  };
}

export function patchScoreLogInTournament(tournament, { eventId, matchId, entry, isDaily }) {
  if (!tournament || !matchId || !entry) {
    return null;
  }

  if (isDaily) {
    const dailyPlay = tournament.settings?.dailyPlay || {};
    return {
      settings: {
        ...tournament.settings,
        dailyPlay: mergeScoreLogIntoDailySettings(dailyPlay, matchId, entry),
      },
    };
  }

  const events = (tournament.events || []).map((event) => {
    if (eventId && String(event.id) !== String(eventId)) {
      return event;
    }

    return mergeScoreLogIntoEvent(event, matchId, entry);
  });

  return { events };
}

export function appendScoreLogAfterEventSubmit(event, matchId, entry) {
  return mergeScoreLogIntoEvent(event, matchId, entry);
}

export function appendScoreLogAfterDailySubmit(settings, matchId, entry) {
  return mergeScoreLogIntoDailySettings(settings, matchId, entry);
}

export function buildRefereeFinalizeLogEntry(row, note = "") {
  return createScoreLogEntry({
    source: SCORE_LOG_SOURCE.REFEREE,
    action: SCORE_LOG_ACTION.FINALIZED,
    actorName: row?.refereeName || "Trọng tài",
    matchId: row?.matchId || "",
    refereeToken: row?.refereeToken || "",
    scoreA: row?.scoreA,
    scoreB: row?.scoreB,
    note,
  });
}

export function buildDirectorScoreLogEntry({
  actorName = "BTC",
  scoreA,
  scoreB,
  source,
  note = "",
  matchId = "",
  refereeToken = "",
  oldScoreA = 0,
  oldScoreB = 0,
}) {
  const resolvedSource = source || SCORE_LOG_SOURCE.DIRECTOR;

  return createScoreLogEntry({
    source: resolvedSource,
    action:
      resolvedSource === SCORE_LOG_SOURCE.DIRECTOR_OVERRIDE
        ? SCORE_LOG_ACTION.ADMIN_OVERRIDE
        : "",
    actorName,
    matchId,
    refereeToken,
    oldScoreA,
    oldScoreB,
    scoreA,
    scoreB,
    note,
  });
}

export function buildDisputeResetLogEntry(actorName = "BTC", note = "", matchMeta = {}) {
  return createScoreLogEntry({
    source: SCORE_LOG_SOURCE.DISPUTE_RESET,
    action: SCORE_LOG_ACTION.DISPUTE_RESET,
    actorName,
    matchId: matchMeta.matchId || "",
    refereeToken: matchMeta.refereeToken || "",
    oldScoreA: matchMeta.oldScoreA,
    oldScoreB: matchMeta.oldScoreB,
    scoreA: 0,
    scoreB: 0,
    note: note || "Reset điểm live trọng tài",
  });
}

export function summarizeScoreLog(match, limit = 20) {
  return normalizeScoreLog(match?.scoreLog)
    .slice(-limit)
    .map(formatScoreLogEntry)
    .filter(Boolean);
}

export function summarizeCombinedAudit(match, liveRow, limit = 30) {
  const combined = normalizeScoreLog([
    ...(match?.scoreLog || []),
    ...(liveRow?.auditLog || []),
  ]);

  const seen = new Set();
  const unique = [];

  combined.forEach((entry) => {
    const key = `${entry.at}::${entry.action}::${entry.scoreA}-${entry.scoreB}::${entry.team}::${entry.delta}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    unique.push(entry);
  });

  return unique.slice(-limit).map(formatScoreLogEntry).filter(Boolean);
}
