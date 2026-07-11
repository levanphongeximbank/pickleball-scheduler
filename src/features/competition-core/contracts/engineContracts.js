import { COMPETITION_CORE_VERSION } from "../constants/index.js";
import { ENGINE_RUN_STATUS } from "../constants/engineRunStatus.js";

/**
 * @typedef {import('../types/index.js').CompetitionEngineInput} CompetitionEngineInput
 * @typedef {import('../types/index.js').CompetitionEngineResult} CompetitionEngineResult
 * @typedef {import('../types/index.js').EngineValidationResult} EngineValidationResult
 * @typedef {import('../types/index.js').EngineScoreBreakdown} EngineScoreBreakdown
 * @typedef {import('../types/index.js').EngineExplanation} EngineExplanation
 * @typedef {import('../types/index.js').EngineRunMetadata} EngineRunMetadata
 * @typedef {import('../types/index.js').RatingSnapshot} RatingSnapshot
 * @typedef {import('../types/index.js').DrawConfiguration} DrawConfiguration
 * @typedef {import('../types/index.js').ConstraintDefinition} ConstraintDefinition
 * @typedef {import('../types/index.js').ConstraintConflict} ConstraintConflict
 */

/**
 * @param {Partial<EngineValidationResult>} [partial]
 * @returns {EngineValidationResult}
 */
export function createEngineValidationResult(partial = {}) {
  return {
    ok: partial.ok !== false,
    errors: Array.isArray(partial.errors) ? [...partial.errors] : [],
    warnings: Array.isArray(partial.warnings) ? [...partial.warnings] : [],
    conflicts: Array.isArray(partial.conflicts) ? [...partial.conflicts] : [],
  };
}

/**
 * @param {Partial<EngineScoreBreakdown>} [partial]
 * @returns {EngineScoreBreakdown}
 */
export function createEngineScoreBreakdown(partial = {}) {
  return {
    total: partial.total ?? null,
    components: partial.components ? { ...partial.components } : {},
  };
}

/**
 * @param {Partial<EngineExplanation>} partial
 * @returns {EngineExplanation}
 */
export function createEngineExplanation(partial) {
  return {
    code: String(partial.code || "unknown"),
    message: String(partial.message || ""),
    details: partial.details ? { ...partial.details } : undefined,
  };
}

/**
 * @param {Partial<EngineRunMetadata>} [partial]
 * @returns {EngineRunMetadata}
 */
export function createEngineRunMetadata(partial = {}) {
  return {
    engineVersion: partial.engineVersion ?? COMPETITION_CORE_VERSION,
    ruleSetVersion: partial.ruleSetVersion,
    randomSeed: partial.randomSeed,
    generatedAt: partial.generatedAt,
    generatedBy: partial.generatedBy,
    featureFlag: partial.featureFlag,
    legacyEngine: partial.legacyEngine,
    status: partial.status ?? ENGINE_RUN_STATUS.PENDING,
  };
}

/**
 * @param {Partial<CompetitionEngineInput>} partial
 * @returns {CompetitionEngineInput}
 */
export function createCompetitionEngineInput(partial) {
  return {
    engineType: partial.engineType,
    tournamentId: partial.tournamentId,
    clubId: partial.clubId,
    eventId: partial.eventId,
    draw: partial.draw ? { ...partial.draw } : undefined,
    payload: partial.payload ? { ...partial.payload } : undefined,
    constraints: Array.isArray(partial.constraints)
      ? partial.constraints.map((item) => ({ ...item }))
      : undefined,
    metadata: partial.metadata ? createEngineRunMetadata(partial.metadata) : undefined,
  };
}

/**
 * @param {Partial<CompetitionEngineResult>} partial
 * @returns {CompetitionEngineResult}
 */
export function createCompetitionEngineResult(partial) {
  return {
    success: partial.success === true,
    engineType: partial.engineType,
    engineVersion: partial.engineVersion ?? COMPETITION_CORE_VERSION,
    result: partial.result,
    validation: partial.validation ? createEngineValidationResult(partial.validation) : undefined,
    score: partial.score ?? null,
    scoreBreakdown: partial.scoreBreakdown
      ? createEngineScoreBreakdown(partial.scoreBreakdown)
      : undefined,
    explanations: Array.isArray(partial.explanations)
      ? partial.explanations.map((item) => createEngineExplanation(item))
      : [],
    warnings: Array.isArray(partial.warnings) ? [...partial.warnings] : [],
    metadata: partial.metadata ? createEngineRunMetadata(partial.metadata) : undefined,
    error: partial.error ?? null,
    executionPath: partial.executionPath ?? "legacy",
  };
}

/**
 * @param {Partial<RatingSnapshot>} [partial]
 * @returns {RatingSnapshot}
 */
export function createRatingSnapshot(partial = {}) {
  return {
    publicSkillLevel: partial.publicSkillLevel ?? null,
    competitionElo: partial.competitionElo ?? null,
    dailyPlayRating: partial.dailyPlayRating ?? null,
    ratingConfidence: partial.ratingConfidence ?? null,
    ratingStatus: partial.ratingStatus ?? null,
    provisionalSkillLevel: partial.provisionalSkillLevel ?? null,
    source: partial.source ?? null,
    capturedAt: partial.capturedAt ?? null,
  };
}

/**
 * @param {Partial<DrawConfiguration>} [partial]
 * @returns {DrawConfiguration}
 */
export function createDrawConfiguration(partial = {}) {
  return {
    mode: partial.mode,
    groupCount: partial.groupCount,
    randomSeed: partial.randomSeed,
    ruleSetId: partial.ruleSetId,
    ruleSetVersion: partial.ruleSetVersion,
  };
}

/**
 * @param {Partial<ConstraintDefinition>} partial
 * @returns {ConstraintDefinition}
 */
export function createConstraintDefinition(partial) {
  return {
    id: partial.id,
    type: partial.type,
    severity: partial.severity,
    enabled: partial.enabled !== false,
    params: partial.params ? { ...partial.params } : undefined,
  };
}

/**
 * @param {Partial<ConstraintConflict>} partial
 * @returns {ConstraintConflict}
 */
export function createConstraintConflict(partial) {
  return {
    code: String(partial.code || "CONSTRAINT_CONFLICT"),
    message: String(partial.message || ""),
    constraints: Array.isArray(partial.constraints)
      ? partial.constraints.map((item) => createConstraintDefinition(item))
      : undefined,
  };
}
