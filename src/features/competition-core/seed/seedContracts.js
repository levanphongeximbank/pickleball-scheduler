import { SEED_ENGINE_VERSION } from "./seedConstants.js";

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
 * @param {Partial<import('./seedTypes.js').SeedAdjustment>} [partial]
 * @returns {import('./seedTypes.js').SeedAdjustment}
 */
export function createSeedAdjustment(partial = {}) {
  return {
    kind: String(partial.kind || "adjustment"),
    value: partial.value != null ? Number(partial.value) : null,
    reason: partial.reason != null ? String(partial.reason) : undefined,
    metadata: clonePlainObject(partial.metadata) || undefined,
  };
}

/**
 * @param {Partial<import('./seedTypes.js').SeedScoreComponents>} [partial]
 * @returns {import('./seedTypes.js').SeedScoreComponents}
 */
export function createSeedScoreComponents(partial = {}) {
  return {
    baseScore: partial.baseScore ?? null,
    competitionEloComponent: partial.competitionEloComponent ?? null,
    averageLevelComponent: partial.averageLevelComponent ?? null,
    internalRatingComponent: partial.internalRatingComponent ?? null,
    winRateComponent: partial.winRateComponent ?? null,
    performanceComponent: partial.performanceComponent ?? null,
    manualAdjustment: partial.manualAdjustment ?? null,
    provisionalPenalty: partial.provisionalPenalty ?? null,
    newPlayerPenalty: partial.newPlayerPenalty ?? null,
    manualOverrideScore: partial.manualOverrideScore ?? null,
    total: partial.total ?? null,
    weights: clonePlainObject(partial.weights) || undefined,
  };
}

/**
 * @param {Partial<import('./seedTypes.js').CanonicalSeedObject>} [partial]
 * @returns {import('./seedTypes.js').CanonicalSeedObject}
 */
export function createCanonicalSeedObject(partial = {}) {
  return {
    participantId: partial.participantId != null ? String(partial.participantId) : null,
    entryId: partial.entryId != null ? String(partial.entryId) : null,
    seedNumber: Number.isFinite(Number(partial.seedNumber)) ? Number(partial.seedNumber) : null,
    seedScore: Number.isFinite(Number(partial.seedScore)) ? Number(partial.seedScore) : null,
    seedReason: partial.seedReason != null ? String(partial.seedReason) : null,
    source: String(partial.source || "unknown"),
    confidence: Number.isFinite(Number(partial.confidence)) ? Number(partial.confidence) : null,
    adjustments: cloneArray(partial.adjustments, (item) => createSeedAdjustment(item)),
    provisional: partial.provisional === true,
    manualOverride: partial.manualOverride === true,
    rankingSnapshot: partial.rankingSnapshot
      ? {
          rank: partial.rankingSnapshot.rank ?? null,
          seedScore: partial.rankingSnapshot.seedScore ?? null,
          primarySource: partial.rankingSnapshot.primarySource ?? null,
          metrics: clonePlainObject(partial.rankingSnapshot.metrics) || undefined,
        }
      : null,
    metadata: clonePlainObject(partial.metadata) || undefined,
  };
}

/**
 * @param {Partial<import('./seedTypes.js').SeedComputation>} [partial]
 * @returns {import('./seedTypes.js').SeedComputation}
 */
export function createSeedComputation(partial = {}) {
  return {
    participantId: String(partial.participantId || ""),
    resolvedSource: String(partial.resolvedSource || "unknown"),
    score: partial.score ? createSeedScoreComponents(partial.score) : createSeedScoreComponents(),
    adjustments: cloneArray(partial.adjustments, (item) => createSeedAdjustment(item)),
    confidence: Number.isFinite(Number(partial.confidence)) ? Number(partial.confidence) : null,
    provisional: partial.provisional === true,
    manualOverride: partial.manualOverride === true,
    seedReason: partial.seedReason != null ? String(partial.seedReason) : null,
  };
}

/**
 * @param {Partial<import('./seedTypes.js').SeedExplanation>} [partial]
 * @returns {import('./seedTypes.js').SeedExplanation}
 */
export function createSeedExplanation(partial = {}) {
  return {
    code: String(partial.code || "seed_explanation"),
    title: String(partial.title || ""),
    message: String(partial.message || ""),
    participantId: partial.participantId != null ? String(partial.participantId) : undefined,
    seedNumber: Number.isFinite(Number(partial.seedNumber)) ? Number(partial.seedNumber) : undefined,
    path: cloneArray(partial.path, (step) => String(step)),
    reasons: cloneArray(partial.reasons, (reason) => String(reason)),
    finalScore: Number.isFinite(Number(partial.finalScore)) ? Number(partial.finalScore) : undefined,
    details: clonePlainObject(partial.details) || undefined,
  };
}

/**
 * @param {Partial<import('./seedTypes.js').SeedTieBreak>} [partial]
 * @returns {import('./seedTypes.js').SeedTieBreak}
 */
export function createSeedTieBreak(partial = {}) {
  return {
    kind: String(partial.kind || "tie_break"),
    order: Number.isFinite(Number(partial.order)) ? Number(partial.order) : 0,
    winnerParticipantId:
      partial.winnerParticipantId != null ? String(partial.winnerParticipantId) : null,
    loserParticipantId:
      partial.loserParticipantId != null ? String(partial.loserParticipantId) : null,
    reason: partial.reason != null ? String(partial.reason) : null,
    details: clonePlainObject(partial.details) || undefined,
  };
}

/**
 * @param {Partial<import('./seedTypes.js').SeedAudit>} [partial]
 * @returns {import('./seedTypes.js').SeedAudit}
 */
export function createSeedAudit(partial = {}) {
  return {
    sourceValues: clonePlainObject(partial.sourceValues) || {},
    weights: clonePlainObject(partial.weights) || {},
    adjustments: cloneArray(partial.adjustments, (item) => createSeedAdjustment(item)),
    finalScore: partial.finalScore != null ? Number(partial.finalScore) : null,
    tieBreaks: cloneArray(partial.tieBreaks, (item) => createSeedTieBreak(item)),
    engineVersion: partial.engineVersion != null ? String(partial.engineVersion) : SEED_ENGINE_VERSION,
    recordedAt: partial.recordedAt != null ? String(partial.recordedAt) : null,
  };
}

/**
 * @param {Partial<import('./seedTypes.js').SeedRequest>} [partial]
 * @returns {import('./seedTypes.js').SeedRequest}
 */
export function createSeedRequest(partial = {}) {
  return {
    tournamentId: partial.tournamentId != null ? String(partial.tournamentId) : null,
    eventId: partial.eventId != null ? String(partial.eventId) : null,
    clubId: partial.clubId != null ? String(partial.clubId) : null,
    participants: cloneArray(partial.participants, (item) => clonePlainObject(item) || {}),
    weights: clonePlainObject(partial.weights) || undefined,
    tieBreakOrder: cloneArray(partial.tieBreakOrder, (item) => String(item)),
    randomSeed: partial.randomSeed ?? undefined,
    options: clonePlainObject(partial.options) || undefined,
  };
}

/**
 * @param {Partial<import('./seedTypes.js').SeedResult>} [partial]
 * @returns {import('./seedTypes.js').SeedResult}
 */
export function createSeedResult(partial = {}) {
  return {
    ok: partial.ok !== false,
    seeds: cloneArray(partial.seeds, (item) => createCanonicalSeedObject(item)),
    computations: cloneArray(partial.computations, (item) => createSeedComputation(item)),
    explanations: cloneArray(partial.explanations, (item) => createSeedExplanation(item)),
    audit: partial.audit ? createSeedAudit(partial.audit) : undefined,
    warnings: cloneArray(partial.warnings, (item) => String(item)),
    errors: cloneArray(partial.errors, (item) => String(item)),
    metadata: clonePlainObject(partial.metadata) || undefined,
  };
}

/**
 * @param {import('./seedTypes.js').SeedRequest} request
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateSeedRequestShape(request) {
  const errors = [];
  if (!request || typeof request !== "object") {
    return { ok: false, errors: ["SeedRequest must be an object."] };
  }
  if (!Array.isArray(request.participants)) {
    errors.push("SeedRequest.participants must be an array.");
  }
  return { ok: errors.length === 0, errors };
}

/**
 * @param {import('./seedTypes.js').SeedResult} result
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateSeedResultShape(result) {
  const errors = [];
  if (!result || typeof result !== "object") {
    return { ok: false, errors: ["SeedResult must be an object."] };
  }
  if (!Array.isArray(result.seeds)) {
    errors.push("SeedResult.seeds must be an array.");
  }
  if (!Array.isArray(result.computations)) {
    errors.push("SeedResult.computations must be an array.");
  }
  return { ok: errors.length === 0, errors };
}

/**
 * @param {import('./seedTypes.js').SeedRequest} request
 * @returns {import('./seedTypes.js').SeedRequest}
 */
export function cloneSeedRequest(request) {
  return createSeedRequest(request || {});
}

/**
 * @param {unknown} value
 * @returns {unknown}
 */
export function serializeSeedContract(value) {
  return JSON.parse(JSON.stringify(value));
}
