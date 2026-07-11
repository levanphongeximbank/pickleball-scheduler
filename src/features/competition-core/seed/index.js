/**
 * Competition Core Canonical Seed Engine foundation — CC-04B.
 * Importing this module MUST NOT execute legacy seed engines or mutate tournament state.
 */

export {
  SEED_ENGINE_VERSION,
  DEFAULT_SEED_RULE_SET_VERSION,
  CANONICAL_SEED_SOURCE,
  CANONICAL_SEED_SOURCE_VALUES,
  isCanonicalSeedSource,
  SEED_PIPELINE_STAGE,
  SEED_TIEBREAK_KIND,
  SEED_TIEBREAK_KIND_VALUES,
  isSeedTieBreakKind,
  DEFAULT_SEED_SCORE_WEIGHTS,
  DEFAULT_SEED_TIEBREAK_ORDER,
  DRAW_SEED_SOURCE_TO_CANONICAL,
} from "./seedConstants.js";

export {
  LEGACY_SEED_SOURCE_MAPPINGS,
  mapLegacySeedSourceToCanonical,
  listLegacySeedSourceKeys,
} from "./legacySeedMapping.js";

export {
  computeReferenceSeedScoreComponents,
  resolveReferenceRatingSource,
  buildReferenceSeedReason,
  estimateReferenceSeedConfidence,
} from "./seedScoreModel.js";

export {
  applySeedTieBreakKind,
  compareParticipantsWithTieBreak,
  sortParticipantsForSeedRank,
} from "./seedTieBreakModel.js";

export {
  normalizeSeedParticipants,
  resolveSeedAdjustments,
  runCanonicalSeedPipeline,
} from "./seedPipeline.js";

export {
  createSeedAdjustment,
  createSeedScoreComponents,
  createCanonicalSeedObject,
  createSeedComputation,
  createSeedExplanation,
  createSeedTieBreak,
  createSeedAudit,
  createSeedRequest,
  createSeedResult,
  validateSeedRequestShape,
  validateSeedResultShape,
  cloneSeedRequest,
  serializeSeedContract,
} from "./seedContracts.js";
