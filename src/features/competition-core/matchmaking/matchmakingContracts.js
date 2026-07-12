import {
  MATCHMAKING_ENGINE_VERSION,
  MATCHMAKING_STRATEGY,
  isMatchmakingStrategy,
} from "./matchmakingConstants.js";
import { mapLegacyMatchmakingStrategyToCanonical } from "./legacyMatchmakingMapping.js";

function clonePlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value ?? null;
  }
  return { ...value };
}

function cloneArray(items, mapFn) {
  if (!Array.isArray(items)) {
    return [];
  }
  return items.map((item) => (mapFn ? mapFn(item) : item));
}

/**
 * @param {Partial<import('./matchmakingTypes.js').MatchmakingPolicy>} [partial]
 */
export function createMatchmakingPolicy(partial = {}) {
  const strategy = isMatchmakingStrategy(partial.strategy)
    ? partial.strategy
    : MATCHMAKING_STRATEGY.UNKNOWN;

  return {
    strategy,
    competitionType: partial.competitionType != null ? String(partial.competitionType) : null,
    persist: partial.persist === true,
    courtCount: Number.isFinite(Number(partial.courtCount)) ? Number(partial.courtCount) : null,
    params: clonePlainObject(partial.params) || undefined,
  };
}

/**
 * @param {Partial<import('./matchmakingTypes.js').MatchmakingCourtAssignment>} [partial]
 */
export function createMatchmakingCourtAssignment(partial = {}) {
  return {
    courtId: partial.courtId ?? null,
    courtLabel: partial.courtLabel != null ? String(partial.courtLabel) : null,
    teamAIds: cloneArray(partial.teamAIds, (id) => String(id)),
    teamBIds: cloneArray(partial.teamBIds, (id) => String(id)),
    diff: Number.isFinite(Number(partial.diff)) ? Number(partial.diff) : null,
    score: Number.isFinite(Number(partial.score)) ? Number(partial.score) : null,
    metadata: clonePlainObject(partial.metadata) || undefined,
  };
}

/**
 * @param {Partial<import('./matchmakingTypes.js').MatchmakingScoreBreakdown>} [partial]
 */
export function createMatchmakingScoreBreakdown(partial = {}) {
  return {
    total: Number.isFinite(Number(partial.total)) ? Number(partial.total) : null,
    balance: Number.isFinite(Number(partial.balance)) ? Number(partial.balance) : null,
    history: Number.isFinite(Number(partial.history)) ? Number(partial.history) : null,
    waiting: Number.isFinite(Number(partial.waiting)) ? Number(partial.waiting) : null,
    rules: Number.isFinite(Number(partial.rules)) ? Number(partial.rules) : null,
    pairingScore: Number.isFinite(Number(partial.pairingScore)) ? Number(partial.pairingScore) : null,
    finalScore: Number.isFinite(Number(partial.finalScore ?? partial.total))
      ? Number(partial.finalScore ?? partial.total)
      : null,
  };
}

/**
 * @param {Partial<import('./matchmakingTypes.js').MatchmakingAudit>} [partial]
 */
export function createMatchmakingAudit(partial = {}) {
  return {
    engineVersion: partial.engineVersion || MATCHMAKING_ENGINE_VERSION,
    strategy: String(partial.strategy || MATCHMAKING_STRATEGY.UNKNOWN),
    seed: partial.seed ?? null,
    scores: partial.scores ? createMatchmakingScoreBreakdown(partial.scores) : null,
    courtAllocation: clonePlainObject(partial.courtAllocation) || {},
    warnings: cloneArray(partial.warnings, (item) => String(item)),
    recordedAt: partial.recordedAt != null ? String(partial.recordedAt) : null,
  };
}

/**
 * @param {Partial<import('./matchmakingTypes.js').MatchmakingRequest>} [partial]
 */
export function createMatchmakingRequest(partial = {}) {
  const legacyStrategy =
    partial.options?.legacyStrategyKey ||
    partial.options?.strategyKey ||
    partial.policy?.strategy;

  return {
    sessionId: partial.sessionId != null ? String(partial.sessionId) : null,
    clubId: partial.clubId != null ? String(partial.clubId) : null,
    tournamentId: partial.tournamentId != null ? String(partial.tournamentId) : null,
    policy: createMatchmakingPolicy({
      ...(partial.policy || {}),
      strategy:
        partial.policy?.strategy ||
        mapLegacyMatchmakingStrategyToCanonical(legacyStrategy),
      competitionType:
        partial.policy?.competitionType ?? partial.options?.competitionType ?? null,
      persist: partial.policy?.persist ?? partial.options?.persist === true,
      courtCount:
        partial.policy?.courtCount ??
        (Array.isArray(partial.courts) ? partial.courts.length : partial.options?.courtCount),
    }),
    players: cloneArray(partial.players, (player) => clonePlainObject(player) || {}),
    courts: cloneArray(partial.courts, (court) => clonePlainObject(court) || {}),
    lockedCourtIds: cloneArray(partial.lockedCourtIds, (id) => String(id)),
    lockedPlayerIds: cloneArray(partial.lockedPlayerIds, (id) => String(id)),
    randomSeed: partial.randomSeed ?? null,
    options: clonePlainObject(partial.options) || undefined,
  };
}

/**
 * @param {Partial<import('./matchmakingTypes.js').MatchmakingResult>} [partial]
 */
export function createMatchmakingResult(partial = {}) {
  return {
    ok: partial.ok !== false && !(partial.errors?.length),
    courts: cloneArray(partial.courts, (court) => createMatchmakingCourtAssignment(court)),
    waitingPlayerIds: cloneArray(partial.waitingPlayerIds, (id) => String(id)),
    scores: partial.scores ? createMatchmakingScoreBreakdown(partial.scores) : null,
    audit: partial.audit ? createMatchmakingAudit(partial.audit) : undefined,
    warnings: cloneArray(partial.warnings, (item) => String(item)),
    errors: cloneArray(partial.errors, (item) => String(item)),
    metadata: clonePlainObject(partial.metadata) || undefined,
  };
}

/**
 * @param {import('./matchmakingTypes.js').MatchmakingRequest} request
 */
export function validateMatchmakingRequestShape(request) {
  const errors = [];
  if (!request || typeof request !== "object") {
    return { ok: false, errors: ["MatchmakingRequest must be an object."] };
  }
  if (!request.policy || typeof request.policy !== "object") {
    errors.push("MatchmakingRequest.policy is required.");
  } else if (!isMatchmakingStrategy(request.policy.strategy)) {
    errors.push("MatchmakingRequest.policy.strategy must be canonical.");
  }
  if (!Array.isArray(request.players)) {
    errors.push("MatchmakingRequest.players must be an array.");
  }
  return { ok: errors.length === 0, errors };
}

/**
 * @param {import('./matchmakingTypes.js').MatchmakingResult} result
 */
export function validateMatchmakingResultShape(result) {
  const errors = [];
  if (!result || typeof result !== "object") {
    return { ok: false, errors: ["MatchmakingResult must be an object."] };
  }
  if (!Array.isArray(result.courts)) {
    errors.push("MatchmakingResult.courts must be an array.");
  }
  if (!Array.isArray(result.waitingPlayerIds)) {
    errors.push("MatchmakingResult.waitingPlayerIds must be an array.");
  }
  return { ok: errors.length === 0, errors };
}

export function cloneMatchmakingRequest(request) {
  return createMatchmakingRequest(request || {});
}

export function serializeMatchmakingContract(value) {
  return JSON.parse(JSON.stringify(value));
}
