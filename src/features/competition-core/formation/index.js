/**
 * Competition Core Canonical Team Formation foundation — CC-05A.
 * Importing this module MUST NOT execute pairing algorithms or mutate session state.
 */

export {
  FORMATION_ENGINE_VERSION,
  DEFAULT_FORMATION_RULE_SET_VERSION,
  FORMATION_STRATEGY,
  FORMATION_STRATEGY_VALUES,
  isFormationStrategy,
  FORMATION_CONSTRAINT_KIND,
  FORMATION_CONSTRAINT_KIND_VALUES,
  isFormationConstraintKind,
  DEFAULT_FORMATION_SCORE_WEIGHTS,
} from "./formationConstants.js";

export {
  CANONICAL_FORMATION_STRATEGY_CATALOG,
  LEGACY_FORMATION_STRATEGY_INVENTORY,
  mapLegacyFormationStrategyToCanonical,
  getFormationStrategyFromCatalog,
  createFormationStrategyDefinition,
  mapLegacyFormationConstraintKind,
} from "./legacyFormationMapping.js";

export {
  computeReferenceFormationScoreComponents,
  buildFormationScoreBreakdown,
} from "./formationScoreModel.js";

export {
  createFormationPolicy,
  createFormationConstraint,
  createFormationPair,
  createFormationCourt,
  createFormationRound,
  createFormationExplanation,
  createFormationDecisionExplanation,
  createFormationCandidate,
  createFormationDecisionTraceRecord,
  createFormationDecisionTrace,
  appendFormationDecisionTrace,
  createFormationAudit,
  createFormationRequest,
  createFormationResult,
  validateFormationRequestShape,
  validateFormationResultShape,
  cloneFormationRequest,
  serializeFormationContract,
  resolveFormationStrategyFromRequest,
} from "./formationContracts.js";

export { buildFoundationFormationResult } from "./formationBuilder.js";

export {
  mapLegacyFormationPayloadToFormationRequest,
  mapCompetitionEngineInputToFormationRequest,
  cloneLegacyFormationPayload,
  isTeamFormationEngineType,
} from "./formationMappers.js";
