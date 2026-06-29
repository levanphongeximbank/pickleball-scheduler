import { MATCH_STAGE, MATCH_STATUS } from "./constants.js";
import { normalizeReferee } from "./referee.js";
import { normalizeScoreLog } from "./scoreLog.js";

const VALID_STAGES = new Set(Object.values(MATCH_STAGE));
const VALID_STATUSES = new Set(Object.values(MATCH_STATUS));

function toNumber(value, fallback = null) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeStage(value) {
  const raw = String(value || "").trim().toLowerCase();
  return VALID_STAGES.has(raw) ? raw : MATCH_STAGE.GROUP;
}

function normalizeStatus(value) {
  const raw = String(value || "").trim().toLowerCase();
  return VALID_STATUSES.has(raw) ? raw : MATCH_STATUS.WAITING;
}

export function normalizeMatch(match) {
  if (!match || match.id === undefined || match.id === null) {
    return null;
  }

  return {
    ...match,
    id: String(match.id).trim(),
    tournamentId: match.tournamentId ? String(match.tournamentId).trim() : "",
    eventId: match.eventId ? String(match.eventId).trim() : "",
    groupId: match.groupId ? String(match.groupId).trim() : "",
    stage: normalizeStage(match.stage),
    round: toNumber(match.round, 1),
    entryAId: match.entryAId ? String(match.entryAId).trim() : "",
    entryBId: match.entryBId ? String(match.entryBId).trim() : "",
    courtId: match.courtId != null ? match.courtId : null,
    status: normalizeStatus(match.status),
    scoreA: toNumber(match.scoreA, null),
    scoreB: toNumber(match.scoreB, null),
    winnerId: match.winnerId ? String(match.winnerId).trim() : "",
    loserId: match.loserId ? String(match.loserId).trim() : "",
    startedAt: match.startedAt || null,
    completedAt: match.completedAt || null,
    bracketMatchId: match.bracketMatchId
      ? String(match.bracketMatchId).trim()
      : "",
    referee: normalizeReferee(match.referee),
    scoreLog: normalizeScoreLog(match.scoreLog),
  };
}

export function normalizeMatches(matches = []) {
  if (!Array.isArray(matches)) {
    return [];
  }

  return matches
    .map((match) => normalizeMatch(match))
    .filter(Boolean);
}

export function createMatchRecord(options = {}) {
  return normalizeMatch({
    id: options.id || `match-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    tournamentId: options.tournamentId || "",
    eventId: options.eventId || "",
    groupId: options.groupId || "",
    stage: options.stage || MATCH_STAGE.GROUP,
    round: options.round ?? 1,
    entryAId: options.entryAId || "",
    entryBId: options.entryBId || "",
    courtId: options.courtId ?? null,
    status: options.status || MATCH_STATUS.WAITING,
    scoreA: options.scoreA ?? null,
    scoreB: options.scoreB ?? null,
    winnerId: options.winnerId || "",
    loserId: options.loserId || "",
    startedAt: options.startedAt || null,
    completedAt: options.completedAt || null,
    bracketMatchId: options.bracketMatchId || "",
    referee: options.referee || null,
  });
}
