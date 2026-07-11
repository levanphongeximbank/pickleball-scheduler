import { cloneCompetitionEngineInput } from "../utils/inputClone.js";
import {
  CANONICAL_DRAW_MODE,
  DRAW_CONSTRAINT_CATEGORY,
  DRAW_ENGINE_VERSION,
  DRAW_RANDOM_GENERATOR,
  DRAW_SEED_SOURCE,
  DRAW_STRATEGY_KIND,
  DEFAULT_DRAW_RULE_SET_VERSION,
  isCanonicalDrawMode,
  isDrawConstraintCategory,
  isDrawRandomGenerator,
  isDrawSeedSource,
  isDrawStrategyKind,
} from "./drawConstants.js";

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
 * @param {Partial<import('./drawTypes.js').DrawSeed>} [partial]
 * @returns {import('./drawTypes.js').DrawSeed}
 */
export function createDrawSeed(partial = {}) {
  const source = isDrawSeedSource(partial.source)
    ? partial.source
    : DRAW_SEED_SOURCE.UNKNOWN;

  return {
    entryId: partial.entryId != null ? String(partial.entryId) : null,
    playerId: partial.playerId != null ? String(partial.playerId) : null,
    seedNumber: Number.isFinite(Number(partial.seedNumber))
      ? Number(partial.seedNumber)
      : null,
    source,
    averageLevel: Number.isFinite(Number(partial.averageLevel))
      ? Number(partial.averageLevel)
      : null,
    competitionElo: Number.isFinite(Number(partial.competitionElo))
      ? Number(partial.competitionElo)
      : null,
    winRate: Number.isFinite(Number(partial.winRate)) ? Number(partial.winRate) : null,
    performanceScore: Number.isFinite(Number(partial.performanceScore))
      ? Number(partial.performanceScore)
      : null,
    provisional: partial.provisional === true,
    newPlayer: partial.newPlayer === true,
    manualAdjustment: Number.isFinite(Number(partial.manualAdjustment))
      ? Number(partial.manualAdjustment)
      : null,
    metadata: clonePlainObject(partial.metadata) || undefined,
  };
}

/**
 * @param {Partial<import('./drawTypes.js').DrawGroup>} [partial]
 * @returns {import('./drawTypes.js').DrawGroup}
 */
export function createDrawGroup(partial = {}) {
  return {
    id: partial.id != null ? String(partial.id) : null,
    label: partial.label != null ? String(partial.label) : null,
    index: Number.isFinite(Number(partial.index)) ? Number(partial.index) : null,
    entryIds: cloneArray(partial.entryIds, (id) => String(id)),
    playerIds: cloneArray(partial.playerIds, (id) => String(id)),
    seedNumbers: cloneArray(partial.seedNumbers, (n) => Number(n)),
    averageLevel: Number.isFinite(Number(partial.averageLevel))
      ? Number(partial.averageLevel)
      : null,
    metadata: clonePlainObject(partial.metadata) || undefined,
  };
}

/**
 * @param {Partial<import('./drawTypes.js').DrawCandidate>} [partial]
 * @returns {import('./drawTypes.js').DrawCandidate}
 */
export function createDrawCandidate(partial = {}) {
  return {
    id: partial.id != null ? String(partial.id) : null,
    groups: cloneArray(partial.groups, (group) => createDrawGroup(group)),
    score: Number.isFinite(Number(partial.score)) ? Number(partial.score) : null,
    feasible: partial.feasible !== false,
    explanations: cloneArray(partial.explanations, (item) => createDrawExplanation(item)),
    conflicts: cloneArray(partial.conflicts, (item) => createDrawConflict(item)),
    scoreBreakdown: partial.scoreBreakdown
      ? createDrawScoreBreakdown(partial.scoreBreakdown)
      : undefined,
    metadata: clonePlainObject(partial.metadata) || undefined,
  };
}

/**
 * @param {Partial<import('./drawTypes.js').DrawConstraint>} [partial]
 * @returns {import('./drawTypes.js').DrawConstraint}
 */
export function createDrawConstraint(partial = {}) {
  const category = isDrawConstraintCategory(partial.category)
    ? partial.category
    : DRAW_CONSTRAINT_CATEGORY.CUSTOM;

  return {
    id: partial.id != null ? String(partial.id) : null,
    category,
    type: partial.type != null ? String(partial.type) : category,
    severity: partial.severity != null ? String(partial.severity) : "soft",
    enabled: partial.enabled !== false,
    params: clonePlainObject(partial.params) || undefined,
    message: partial.message != null ? String(partial.message) : undefined,
  };
}

/**
 * @param {Partial<import('./drawTypes.js').DrawExplanation>} [partial]
 * @returns {import('./drawTypes.js').DrawExplanation}
 */
export function createDrawExplanation(partial = {}) {
  return {
    code: String(partial.code || "draw_explanation"),
    title: String(partial.title || ""),
    message: String(partial.message || ""),
    entryId: partial.entryId != null ? String(partial.entryId) : undefined,
    playerId: partial.playerId != null ? String(partial.playerId) : undefined,
    seedNumber: Number.isFinite(Number(partial.seedNumber))
      ? Number(partial.seedNumber)
      : undefined,
    groupId: partial.groupId != null ? String(partial.groupId) : undefined,
    distributionPath: cloneArray(partial.distributionPath, (step) => String(step)),
    reasons: cloneArray(partial.reasons, (reason) => String(reason)),
    details: clonePlainObject(partial.details) || undefined,
  };
}

/**
 * @param {Partial<import('./drawTypes.js').DrawConflict>} [partial]
 * @returns {import('./drawTypes.js').DrawConflict}
 */
export function createDrawConflict(partial = {}) {
  return {
    code: String(partial.code || "draw_conflict"),
    message: String(partial.message || ""),
    severity: partial.severity != null ? String(partial.severity) : "hard",
    constraints: cloneArray(partial.constraints, (item) => createDrawConstraint(item)),
    affectedEntryIds: cloneArray(partial.affectedEntryIds, (id) => String(id)),
    details: clonePlainObject(partial.details) || undefined,
  };
}

/**
 * @param {Partial<import('./drawTypes.js').DrawScoreBreakdown>} [partial]
 * @returns {import('./drawTypes.js').DrawScoreBreakdown}
 */
export function createDrawScoreBreakdown(partial = {}) {
  return {
    total: Number.isFinite(Number(partial.total)) ? Number(partial.total) : null,
    components: clonePlainObject(partial.components) || {},
    heuristicScore: Number.isFinite(Number(partial.heuristicScore))
      ? Number(partial.heuristicScore)
      : null,
    balanceScore: Number.isFinite(Number(partial.balanceScore))
      ? Number(partial.balanceScore)
      : null,
    constraintPenalty: Number.isFinite(Number(partial.constraintPenalty))
      ? Number(partial.constraintPenalty)
      : null,
  };
}

/**
 * Deterministic random metadata contract — same seed → same result (runtime TBD CC-04B).
 *
 * @param {Partial<import('./drawTypes.js').DrawRandomMetadata>} [partial]
 * @returns {import('./drawTypes.js').DrawRandomMetadata}
 */
export function createDrawRandomMetadata(partial = {}) {
  const generator = isDrawRandomGenerator(partial.generator)
    ? partial.generator
    : DRAW_RANDOM_GENERATOR.UNKNOWN;

  return {
    randomSeed: partial.randomSeed != null ? partial.randomSeed : null,
    generator,
    algorithmVersion: partial.algorithmVersion != null ? String(partial.algorithmVersion) : null,
    deterministic: partial.deterministic !== false,
    notes: partial.notes != null ? String(partial.notes) : undefined,
  };
}

/**
 * Strategy descriptor — contract only.
 *
 * @param {Partial<import('./drawTypes.js').DrawStrategy>} [partial]
 * @returns {import('./drawTypes.js').DrawStrategy}
 */
export function createDrawStrategy(partial = {}) {
  const kind = isDrawStrategyKind(partial.kind)
    ? partial.kind
    : DRAW_STRATEGY_KIND.DISTRIBUTION;

  return {
    kind,
    id: partial.id != null ? String(partial.id) : null,
    name: partial.name != null ? String(partial.name) : kind,
    version: partial.version != null ? String(partial.version) : "1",
    params: clonePlainObject(partial.params) || undefined,
    implemented: partial.implemented === true,
  };
}

/**
 * @param {Partial<import('./drawTypes.js').DrawMetadata>} [partial]
 * @returns {import('./drawTypes.js').DrawMetadata}
 */
export function createDrawMetadata(partial = {}) {
  const drawMode = isCanonicalDrawMode(partial.drawMode)
    ? partial.drawMode
    : CANONICAL_DRAW_MODE.UNKNOWN;

  return {
    drawId: partial.drawId != null ? String(partial.drawId) : null,
    drawVersion: partial.drawVersion != null ? String(partial.drawVersion) : "1",
    engineVersion: partial.engineVersion != null ? String(partial.engineVersion) : DRAW_ENGINE_VERSION,
    randomSeed: partial.randomSeed != null ? partial.randomSeed : null,
    startedAt: partial.startedAt != null ? String(partial.startedAt) : null,
    finishedAt: partial.finishedAt != null ? String(partial.finishedAt) : null,
    durationMs: Number.isFinite(Number(partial.durationMs)) ? Number(partial.durationMs) : null,
    retryCount: Number.isFinite(Number(partial.retryCount)) ? Number(partial.retryCount) : 0,
    heuristicScore: Number.isFinite(Number(partial.heuristicScore))
      ? Number(partial.heuristicScore)
      : null,
    drawMode,
    strategy: partial.strategy ? createDrawStrategy(partial.strategy) : undefined,
    strategies: cloneArray(partial.strategies, (item) => createDrawStrategy(item)),
    ruleSetVersion:
      partial.ruleSetVersion != null
        ? String(partial.ruleSetVersion)
        : DEFAULT_DRAW_RULE_SET_VERSION,
    competitionVersion:
      partial.competitionVersion != null ? String(partial.competitionVersion) : null,
    random: partial.random ? createDrawRandomMetadata(partial.random) : undefined,
  };
}

/**
 * @param {Partial<import('./drawTypes.js').DrawAudit>} [partial]
 * @returns {import('./drawTypes.js').DrawAudit}
 */
export function createDrawAudit(partial = {}) {
  return {
    requestSnapshot: clonePlainObject(partial.requestSnapshot) || {},
    resolvedSeeds: cloneArray(partial.resolvedSeeds, (item) => createDrawSeed(item)),
    distributionPath: cloneArray(partial.distributionPath, (step) => String(step)),
    constraintEvaluation: clonePlainObject(partial.constraintEvaluation) || undefined,
    retryHistory: cloneArray(partial.retryHistory, (item) => clonePlainObject(item) || {}),
    selectedCandidate: partial.selectedCandidate
      ? createDrawCandidate(partial.selectedCandidate)
      : null,
    finalScore: Number.isFinite(Number(partial.finalScore)) ? Number(partial.finalScore) : null,
    randomSeed: partial.randomSeed != null ? partial.randomSeed : null,
    engineVersion: partial.engineVersion != null ? String(partial.engineVersion) : DRAW_ENGINE_VERSION,
    explanations: cloneArray(partial.explanations, (item) => createDrawExplanation(item)),
    recordedAt: partial.recordedAt != null ? String(partial.recordedAt) : null,
  };
}

/**
 * @param {Partial<import('./drawTypes.js').DrawRequest>} [partial]
 * @returns {import('./drawTypes.js').DrawRequest}
 */
export function createDrawRequest(partial = {}) {
  const drawMode = isCanonicalDrawMode(partial.drawMode)
    ? partial.drawMode
    : CANONICAL_DRAW_MODE.UNKNOWN;

  return {
    tournamentId: partial.tournamentId != null ? String(partial.tournamentId) : null,
    eventId: partial.eventId != null ? String(partial.eventId) : null,
    clubId: partial.clubId != null ? String(partial.clubId) : null,
    drawMode,
    groupCount: Number.isFinite(Number(partial.groupCount)) ? Number(partial.groupCount) : null,
    entries: cloneArray(partial.entries, (entry) => clonePlainObject(entry) || {}),
    players: cloneArray(partial.players, (player) => clonePlainObject(player) || {}),
    seeds: cloneArray(partial.seeds, (seed) => createDrawSeed(seed)),
    constraints: cloneArray(partial.constraints, (item) => createDrawConstraint(item)),
    strategies: cloneArray(partial.strategies, (item) => createDrawStrategy(item)),
    random: partial.random ? createDrawRandomMetadata(partial.random) : undefined,
    metadata: partial.metadata ? createDrawMetadata(partial.metadata) : undefined,
    options: clonePlainObject(partial.options) || undefined,
  };
}

/**
 * @param {Partial<import('./drawTypes.js').DrawResult>} [partial]
 * @returns {import('./drawTypes.js').DrawResult}
 */
export function createDrawResult(partial = {}) {
  return {
    ok: partial.ok !== false,
    groups: cloneArray(partial.groups, (group) => createDrawGroup(group)),
    selectedCandidate: partial.selectedCandidate
      ? createDrawCandidate(partial.selectedCandidate)
      : null,
    candidates: cloneArray(partial.candidates, (item) => createDrawCandidate(item)),
    scoreBreakdown: partial.scoreBreakdown
      ? createDrawScoreBreakdown(partial.scoreBreakdown)
      : undefined,
    explanations: cloneArray(partial.explanations, (item) => createDrawExplanation(item)),
    conflicts: cloneArray(partial.conflicts, (item) => createDrawConflict(item)),
    audit: partial.audit ? createDrawAudit(partial.audit) : undefined,
    metadata: partial.metadata ? createDrawMetadata(partial.metadata) : undefined,
    warnings: cloneArray(partial.warnings, (item) => String(item)),
    errors: cloneArray(partial.errors, (item) => String(item)),
  };
}

/**
 * Top-level draw engine envelope — foundation only; no execution.
 *
 * @param {Partial<import('./drawTypes.js').DrawEngineResult>} [partial]
 * @returns {import('./drawTypes.js').DrawEngineResult}
 */
export function createDrawEngineResult(partial = {}) {
  return {
    success: partial.success === true,
    enabled: partial.enabled === true,
    engineVersion: partial.engineVersion != null ? String(partial.engineVersion) : DRAW_ENGINE_VERSION,
    executionPath: partial.executionPath != null ? String(partial.executionPath) : "foundation",
    request: partial.request ? createDrawRequest(partial.request) : undefined,
    result: partial.result ? createDrawResult(partial.result) : undefined,
    audit: partial.audit ? createDrawAudit(partial.audit) : undefined,
    metadata: partial.metadata ? createDrawMetadata(partial.metadata) : undefined,
    error: partial.error ?? null,
  };
}

/**
 * Lightweight validation helpers — pure, no side effects.
 *
 * @param {import('./drawTypes.js').DrawRequest} request
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateDrawRequestShape(request) {
  const errors = [];
  if (!request || typeof request !== "object") {
    return { ok: false, errors: ["DrawRequest must be an object."] };
  }
  if (!isCanonicalDrawMode(request.drawMode)) {
    errors.push("DrawRequest.drawMode must be a canonical draw mode.");
  }
  if (request.groupCount != null && (!Number.isFinite(request.groupCount) || request.groupCount < 1)) {
    errors.push("DrawRequest.groupCount must be a positive number when provided.");
  }
  return { ok: errors.length === 0, errors };
}

/**
 * @param {import('./drawTypes.js').DrawResult} result
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateDrawResultShape(result) {
  const errors = [];
  if (!result || typeof result !== "object") {
    return { ok: false, errors: ["DrawResult must be an object."] };
  }
  if (!Array.isArray(result.groups)) {
    errors.push("DrawResult.groups must be an array.");
  }
  if (!Array.isArray(result.explanations)) {
    errors.push("DrawResult.explanations must be an array.");
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Deep-ish clone of a DrawRequest for audit snapshots (no mutation of caller).
 *
 * @param {import('./drawTypes.js').DrawRequest} request
 * @returns {import('./drawTypes.js').DrawRequest}
 */
export function cloneDrawRequest(request) {
  return createDrawRequest(request || {});
}

/**
 * Serialize → parse round-trip helper for contract tests.
 *
 * @param {unknown} value
 * @returns {unknown}
 */
export function serializeDrawContract(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Re-export clone helper used by competition-core engine input (no side effects).
 * Exposed for draw foundation tests that assert import purity.
 */
export { cloneCompetitionEngineInput };
