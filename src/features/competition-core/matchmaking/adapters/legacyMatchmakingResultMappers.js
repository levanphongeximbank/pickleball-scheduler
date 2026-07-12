import {
  createMatchmakingAudit,
  createMatchmakingCourtAssignment,
  createMatchmakingResult,
  createMatchmakingScoreBreakdown,
} from "../matchmakingContracts.js";
import { MATCHMAKING_RUNTIME_ADAPTER_VERSION } from "./matchmakingRuntimeInventory.js";

/**
 * @typedef {Object} LegacyRunAIResult
 * @property {Array<Record<string, unknown>>} [courts]
 * @property {Array<Record<string, unknown>>} [waiting]
 * @property {Record<string, unknown>} [aiScore]
 * @property {string[]} [errors]
 * @property {string} [competitionType]
 * @property {boolean} [persisted]
 */

function extractPlayerIds(team = []) {
  return (team || []).map((player) => String(player.id ?? player));
}

function mapLegacyCourtToAssignment(court, index = 0) {
  return createMatchmakingCourtAssignment({
    courtId: court.court ?? court.id ?? index + 1,
    courtLabel: court.courtName ?? court.name ?? court.label ?? null,
    teamAIds: extractPlayerIds(court.teamA),
    teamBIds: extractPlayerIds(court.teamB),
    diff: court.diff ?? null,
    score: court.score ?? null,
    metadata: {
      teamATotal: court.teamATotal,
      teamBTotal: court.teamBTotal,
      explanation: court.explanation,
    },
  });
}

/**
 * @param {LegacyRunAIResult} legacyResult
 * @param {import('../matchmakingTypes.js').MatchmakingRequest} [matchmakingRequest]
 */
export function mapLegacyMatchmakingResultToMatchmakingResult(legacyResult = {}, matchmakingRequest) {
  const courts = (legacyResult.courts || []).map((court, index) =>
    mapLegacyCourtToAssignment(court, index)
  );
  const waitingPlayerIds = (legacyResult.waiting || []).map((player) =>
    String(player.id ?? player)
  );
  const scores = createMatchmakingScoreBreakdown({
    total: legacyResult.aiScore?.total,
    balance: legacyResult.aiScore?.balance,
    history: legacyResult.aiScore?.history,
    waiting: legacyResult.aiScore?.waiting,
    rules: legacyResult.aiScore?.rules,
    finalScore: legacyResult.aiScore?.total,
  });

  return createMatchmakingResult({
    ok: !(legacyResult.errors?.length) && courts.length >= 0,
    courts,
    waitingPlayerIds,
    scores,
    audit: createMatchmakingAudit({
      engineVersion: MATCHMAKING_RUNTIME_ADAPTER_VERSION,
      strategy: matchmakingRequest?.policy?.strategy || "unknown",
      seed: matchmakingRequest?.randomSeed ?? null,
      scores,
      courtAllocation: { courtCount: courts.length, waitingCount: waitingPlayerIds.length },
      warnings: [],
    }),
    errors: legacyResult.errors || [],
    metadata: {
      mappedFrom: "legacy-runAI-result",
      competitionType: legacyResult.competitionType,
      persisted: legacyResult.persisted === true,
      bestCandidateScore: legacyResult.bestCandidateScore,
    },
  });
}

/**
 * @param {import('../matchmakingTypes.js').MatchmakingResult} matchmakingResult
 * @param {LegacyRunAIResult} [originalLegacyResult]
 */
export function adaptMatchmakingResultForLegacyConsumer(matchmakingResult, originalLegacyResult = {}) {
  return {
    ...originalLegacyResult,
    courts: (originalLegacyResult.courts || []).map((court) => ({ ...court })),
    waiting: [...(originalLegacyResult.waiting || [])].map((player) =>
      typeof player === "object" ? { ...player } : player
    ),
    aiScore: originalLegacyResult.aiScore ? { ...originalLegacyResult.aiScore } : undefined,
    errors: matchmakingResult.errors?.length
      ? matchmakingResult.errors
      : originalLegacyResult.errors || [],
  };
}

function normalizeCourtsForCompare(courts = []) {
  return courts.map((court) => ({
    courtId: String(court.court ?? court.id ?? ""),
    teamAIds: extractPlayerIds(court.teamA).sort(),
    teamBIds: extractPlayerIds(court.teamB).sort(),
  }));
}

/**
 * @param {LegacyRunAIResult} directLegacy
 * @param {LegacyRunAIResult} adaptedLegacy
 */
export function isLegacyMatchmakingOutputPreserved(directLegacy, adaptedLegacy) {
  const directCourts = JSON.stringify(normalizeCourtsForCompare(directLegacy.courts));
  const adaptedCourts = JSON.stringify(normalizeCourtsForCompare(adaptedLegacy.courts));
  const directWaiting = JSON.stringify(
    (directLegacy.waiting || []).map((p) => String(p.id ?? p)).sort()
  );
  const adaptedWaiting = JSON.stringify(
    (adaptedLegacy.waiting || []).map((p) => String(p.id ?? p)).sort()
  );
  const directScore = JSON.stringify(directLegacy.aiScore || {});
  const adaptedScore = JSON.stringify(adaptedLegacy.aiScore || {});

  return (
    directCourts === adaptedCourts &&
    directWaiting === adaptedWaiting &&
    directScore === adaptedScore
  );
}

/**
 * @param {Array<Record<string, unknown>>} [courts]
 */
export function extractMatchmakingCourtMembership(courts = []) {
  return (courts || []).map((court, index) => ({
    courtIndex: index,
    courtId: court.court ?? court.id ?? null,
    teamAIds: extractPlayerIds(court.teamA).sort(),
    teamBIds: extractPlayerIds(court.teamB).sort(),
  }));
}

export function extractMatchmakingWaitingIds(waiting = []) {
  return (waiting || []).map((player) => String(player.id ?? player)).sort();
}
