import {
  FORMATION_ENGINE_VERSION,
  FORMATION_STRATEGY,
  isFormationConstraintKind,
  isFormationStrategy,
} from "./formationConstants.js";
import { buildFormationScoreBreakdown } from "./formationScoreModel.js";
import {
  getFormationStrategyFromCatalog,
  mapLegacyFormationConstraintKind,
  mapLegacyFormationStrategyToCanonical,
} from "./legacyFormationMapping.js";

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
 * @param {Partial<import('./formationTypes.js').FormationPolicy>} [partial]
 * @returns {import('./formationTypes.js').FormationPolicy}
 */
export function createFormationPolicy(partial = {}) {
  const strategy = isFormationStrategy(partial.strategy)
    ? partial.strategy
    : FORMATION_STRATEGY.UNKNOWN;

  return {
    strategy,
    allowRandomization: partial.allowRandomization === true,
    maxSkillGap: Number.isFinite(Number(partial.maxSkillGap)) ? Number(partial.maxSkillGap) : null,
    targetCourtCount: Number.isFinite(Number(partial.targetCourtCount))
      ? Number(partial.targetCourtCount)
      : null,
    params: clonePlainObject(partial.params) || undefined,
  };
}

/**
 * @param {Partial<import('./formationTypes.js').FormationConstraint>} [partial]
 * @returns {import('./formationTypes.js').FormationConstraint}
 */
export function createFormationConstraint(partial = {}) {
  const kind = isFormationConstraintKind(partial.kind)
    ? partial.kind
    : mapLegacyFormationConstraintKind(partial.kind);

  return {
    id: partial.id != null ? String(partial.id) : null,
    kind,
    severity: partial.severity != null ? String(partial.severity) : "soft",
    enabled: partial.enabled !== false,
    params: clonePlainObject(partial.params) || undefined,
    message: partial.message != null ? String(partial.message) : undefined,
  };
}

/**
 * @param {Partial<import('./formationTypes.js').FormationPair>} [partial]
 * @returns {import('./formationTypes.js').FormationPair}
 */
export function createFormationPair(partial = {}) {
  return {
    id: partial.id != null ? String(partial.id) : null,
    playerIds: cloneArray(partial.playerIds, (id) => String(id)),
    averageSkill: Number.isFinite(Number(partial.averageSkill)) ? Number(partial.averageSkill) : null,
    metadata: clonePlainObject(partial.metadata) || undefined,
  };
}

/**
 * @param {Partial<import('./formationTypes.js').FormationCourt>} [partial]
 * @returns {import('./formationTypes.js').FormationCourt}
 */
export function createFormationCourt(partial = {}) {
  return {
    id: partial.id != null ? String(partial.id) : null,
    label: partial.label != null ? String(partial.label) : null,
    index: Number.isFinite(Number(partial.index)) ? Number(partial.index) : null,
    playerIds: cloneArray(partial.playerIds, (id) => String(id)),
    pairs: cloneArray(partial.pairs, (pair) => createFormationPair(pair)),
    metadata: clonePlainObject(partial.metadata) || undefined,
  };
}

/**
 * @param {Partial<import('./formationTypes.js').FormationRound>} [partial]
 * @returns {import('./formationTypes.js').FormationRound}
 */
export function createFormationRound(partial = {}) {
  return {
    id: partial.id != null ? String(partial.id) : null,
    roundNumber: Number.isFinite(Number(partial.roundNumber)) ? Number(partial.roundNumber) : null,
    courts: cloneArray(partial.courts, (court) => createFormationCourt(court)),
    metadata: clonePlainObject(partial.metadata) || undefined,
  };
}

/**
 * @param {Partial<import('./formationTypes.js').FormationExplanation>} [partial]
 * @returns {import('./formationTypes.js').FormationExplanation}
 */
export function createFormationExplanation(partial = {}) {
  return {
    code: String(partial.code || "formation_explanation"),
    title: String(partial.title || ""),
    message: String(partial.message || ""),
    playerAId: partial.playerAId != null ? String(partial.playerAId) : undefined,
    playerBId: partial.playerBId != null ? String(partial.playerBId) : undefined,
    decisionPath: cloneArray(partial.decisionPath, (step) => String(step)),
    reasons: cloneArray(partial.reasons, (reason) => String(reason)),
    scoreBreakdown: partial.scoreBreakdown
      ? buildFormationScoreBreakdown(partial.scoreBreakdown)
      : undefined,
    details: clonePlainObject(partial.details) || undefined,
  };
}

/**
 * Build explainability path: Player A → Partner B → Reason → Constraint → Score → Final decision.
 *
 * @param {Object} input
 * @param {string} [input.playerAId]
 * @param {string} [input.playerBId]
 * @param {string} [input.reason]
 * @param {import('./formationTypes.js').FormationConstraint[]} [input.constraints]
 * @param {import('./formationTypes.js').FormationScoreBreakdown} [input.scoreBreakdown]
 */
export function createFormationDecisionExplanation(input = {}) {
  const constraintSummary =
    (input.constraints || [])
      .filter((item) => item.enabled !== false)
      .map((item) => item.kind)
      .join(", ") || "none";

  const path = [
    "Player A",
    input.playerAId || "unknown",
    "Partner B",
    input.playerBId || "unknown",
    "Reason",
    input.reason || "Foundation metadata only",
    "Constraint summary",
    constraintSummary,
    "Score breakdown",
    String(input.scoreBreakdown?.finalScore ?? "n/a"),
    "Final decision",
    "Foundation metadata only",
  ];

  return createFormationExplanation({
    code: "formation_decision_explanation",
    title: "Formation decision explainability",
    message: `Pair ${input.playerAId || "?"} + ${input.playerBId || "?"} planned.`,
    playerAId: input.playerAId,
    playerBId: input.playerBId,
    decisionPath: path,
    reasons: [input.reason || "Foundation only"],
    scoreBreakdown: input.scoreBreakdown,
  });
}

/**
 * @param {Partial<import('./formationTypes.js').FormationCandidate>} [partial]
 * @returns {import('./formationTypes.js').FormationCandidate}
 */
export function createFormationCandidate(partial = {}) {
  return {
    id: partial.id != null ? String(partial.id) : null,
    pairs: cloneArray(partial.pairs, (pair) => createFormationPair(pair)),
    courts: cloneArray(partial.courts, (court) => createFormationCourt(court)),
    score: Number.isFinite(Number(partial.score)) ? Number(partial.score) : null,
    feasible: partial.feasible !== false,
    explanations: cloneArray(partial.explanations, (item) => createFormationExplanation(item)),
    metadata: clonePlainObject(partial.metadata) || undefined,
  };
}

/**
 * @param {Partial<import('./formationTypes.js').FormationDecisionTraceRecord>} [partial]
 * @returns {import('./formationTypes.js').FormationDecisionTraceRecord}
 */
export function createFormationDecisionTraceRecord(partial = {}) {
  return {
    id: partial.id || `formation-trace-${Date.now()}`,
    action: String(partial.action || "evaluate"),
    path: cloneArray(partial.path, (step) => String(step)),
    engineVersion: partial.engineVersion || FORMATION_ENGINE_VERSION,
    evaluatedAt: partial.evaluatedAt || new Date().toISOString(),
    metadata: clonePlainObject(partial.metadata) || undefined,
  };
}

/**
 * @returns {import('./formationTypes.js').FormationDecisionTrace}
 */
export function createFormationDecisionTrace() {
  return {
    records: [],
    traceVersion: FORMATION_ENGINE_VERSION,
  };
}

/**
 * @param {import('./formationTypes.js').FormationDecisionTrace} trace
 * @param {import('./formationTypes.js').FormationDecisionTraceRecord} record
 */
export function appendFormationDecisionTrace(trace, record) {
  return {
    ...trace,
    records: [...(trace.records || []), record],
  };
}

/**
 * @param {Partial<import('./formationTypes.js').FormationAudit>} [partial]
 * @returns {import('./formationTypes.js').FormationAudit}
 */
export function createFormationAudit(partial = {}) {
  return {
    engineVersion: partial.engineVersion || FORMATION_ENGINE_VERSION,
    strategy: String(partial.strategy || FORMATION_STRATEGY.UNKNOWN),
    seed: partial.seed ?? null,
    constraints: clonePlainObject(partial.constraints) || {},
    scores: partial.scores ? buildFormationScoreBreakdown(partial.scores) : null,
    courtAllocation: clonePlainObject(partial.courtAllocation) || {},
    warnings: cloneArray(partial.warnings, (item) => String(item)),
    recordedAt: partial.recordedAt != null ? String(partial.recordedAt) : null,
  };
}

/**
 * @param {Partial<import('./formationTypes.js').FormationRequest>} [partial]
 * @returns {import('./formationTypes.js').FormationRequest}
 */
export function createFormationRequest(partial = {}) {
  const legacyStrategy =
    partial.options?.legacyStrategyKey ||
    partial.options?.strategyKey ||
    partial.policy?.strategy;

  const policy = createFormationPolicy({
    ...(partial.policy || {}),
    strategy:
      partial.policy?.strategy ||
      mapLegacyFormationStrategyToCanonical(legacyStrategy),
  });

  return {
    sessionId: partial.sessionId != null ? String(partial.sessionId) : null,
    clubId: partial.clubId != null ? String(partial.clubId) : null,
    eventId: partial.eventId != null ? String(partial.eventId) : null,
    policy,
    players: cloneArray(partial.players, (player) => clonePlainObject(player) || {}),
    constraints: cloneArray(partial.constraints, (item) => createFormationConstraint(item)),
    lockedPairs: cloneArray(partial.lockedPairs, (pair) => createFormationPair(pair)),
    courts: cloneArray(partial.courts, (court) => createFormationCourt(court)),
    randomSeed: partial.randomSeed ?? null,
    options: clonePlainObject(partial.options) || undefined,
  };
}

/**
 * @param {Partial<import('./formationTypes.js').FormationResult>} [partial]
 * @returns {import('./formationTypes.js').FormationResult}
 */
export function createFormationResult(partial = {}) {
  return {
    ok: partial.ok !== false,
    pairs: cloneArray(partial.pairs, (pair) => createFormationPair(pair)),
    courts: cloneArray(partial.courts, (court) => createFormationCourt(court)),
    rounds: cloneArray(partial.rounds, (round) => createFormationRound(round)),
    selectedCandidate: partial.selectedCandidate
      ? createFormationCandidate(partial.selectedCandidate)
      : null,
    candidates: cloneArray(partial.candidates, (item) => createFormationCandidate(item)),
    explanations: cloneArray(partial.explanations, (item) => createFormationExplanation(item)),
    audit: partial.audit ? createFormationAudit(partial.audit) : undefined,
    decisionTrace: partial.decisionTrace
      ? {
          ...partial.decisionTrace,
          records: cloneArray(partial.decisionTrace.records, (record) =>
            createFormationDecisionTraceRecord(record)
          ),
        }
      : undefined,
    warnings: cloneArray(partial.warnings, (item) => String(item)),
    errors: cloneArray(partial.errors, (item) => String(item)),
    metadata: clonePlainObject(partial.metadata) || undefined,
  };
}

/**
 * @param {import('./formationTypes.js').FormationRequest} request
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateFormationRequestShape(request) {
  const errors = [];
  if (!request || typeof request !== "object") {
    return { ok: false, errors: ["FormationRequest must be an object."] };
  }
  if (!request.policy || typeof request.policy !== "object") {
    errors.push("FormationRequest.policy is required.");
  } else if (!isFormationStrategy(request.policy.strategy)) {
    errors.push("FormationRequest.policy.strategy must be a canonical formation strategy.");
  }
  if (!Array.isArray(request.players)) {
    errors.push("FormationRequest.players must be an array.");
  }
  return { ok: errors.length === 0, errors };
}

/**
 * @param {import('./formationTypes.js').FormationResult} result
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateFormationResultShape(result) {
  const errors = [];
  if (!result || typeof result !== "object") {
    return { ok: false, errors: ["FormationResult must be an object."] };
  }
  if (!Array.isArray(result.pairs)) {
    errors.push("FormationResult.pairs must be an array.");
  }
  if (!Array.isArray(result.explanations)) {
    errors.push("FormationResult.explanations must be an array.");
  }
  return { ok: errors.length === 0, errors };
}

/**
 * @param {import('./formationTypes.js').FormationRequest} request
 * @returns {import('./formationTypes.js').FormationRequest}
 */
export function cloneFormationRequest(request) {
  return createFormationRequest(request || {});
}

/**
 * @param {unknown} value
 * @returns {unknown}
 */
export function serializeFormationContract(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Resolve strategy definition from request policy.
 *
 * @param {import('./formationTypes.js').FormationRequest} request
 */
export function resolveFormationStrategyFromRequest(request) {
  return getFormationStrategyFromCatalog(request.policy?.strategy || FORMATION_STRATEGY.UNKNOWN);
}
