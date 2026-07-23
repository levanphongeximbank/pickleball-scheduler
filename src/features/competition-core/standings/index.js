export {
  CORE18_ENGINE_ID,
  CORE18_ENGINE_VERSION,
  STANDINGS_ENGINE_VERSION,
  MATCH_RESULT_TYPE,
  TIEBREAK_TYPE,
  QUALIFICATION_STATUS,
  STANDINGS_SCOPE,
  DEFAULT_SCORING_RULE,
  DEFAULT_TIEBREAK_ORDER,
  LEGACY_DEFAULT_TIEBREAK_ORDER,
  DEFAULT_SCORING_RULE_ID,
  DEFAULT_SCORING_RULE_VERSION,
  DEFAULT_TIEBREAK_RULE_SET_ID,
  DEFAULT_TIEBREAK_RULE_SET_VERSION,
  isMatchResultType,
  isTieBreakType,
} from "./standingsConstants.js";

export {
  STANDINGS_ERROR_CODE,
  STANDINGS_ERROR_CODE_VALUES,
  STANDINGS_WARNING_CODE,
  STANDINGS_WARNING_CODE_VALUES,
  isStandingsErrorCode,
  isStandingsWarningCode,
  StandingsError,
  isStandingsError,
  createStandingsError,
  createStandingsIssue,
} from "./standingsErrors.js";

export {
  STANDINGS_EXPLANATION_CODE,
  compareCanonicalIdentity,
  mapCore17ResultTypeToStandings,
  mapEligibleScoreStatistics,
  adaptValidatedResultToStandingsMatch,
  adaptValidatedResultsToStandingsMatches,
  standingsMatchFingerprint,
  isRawCore16Projection,
} from "./canonicalResultAdapter.js";

export {
  createScoringRule,
  createTieBreakRule,
  createDefaultTieBreakRuleSet,
  createStandingsEntry,
  createStandingsMatchRecord,
  createStandingsRow,
  createStandingsConfiguration,
  createStandingsRequest,
  createStandingsExplanation,
  createStandingsAudit,
  createStandingsSnapshot,
  createStandingsDecisionTrace,
  createStandingsResult,
  cloneStandingsRequest,
  buildMatchSetHash,
} from "./standingsContracts.js";

export {
  normalizeLegacyGroupMatch,
  getMatchStandingsPolicy,
} from "./matchResultPolicy.js";

export {
  buildInitialStandingsRows,
  accumulateStandingsRows,
} from "./scoringRules.js";

export {
  computeTwoEntryHeadToHead,
  compareHeadToHeadRows,
} from "./headToHead.js";

export {
  computeMiniTableRanking,
  groupTiedRows,
} from "./miniTable.js";

export {
  buildDrawLotToken,
  orderRowsByDrawLot,
  buildDrawLotTokensForEntries,
} from "./drawLot.js";

export {
  compareRowsByTieBreakRule,
  unsupportedTieBreakIssue,
} from "./tieBreakCompare.js";

export {
  resolveTiedGroup,
  rankStandingsRows,
  applyQualificationDecisions,
  applyManualOverrides,
} from "./tieBreakSteps.js";

export {
  calculateCanonicalStandings,
  calculateStandingsFromValidatedResults,
  validateStandingsRequestShape,
  isStandingsResultJsonSerializable,
  CORE18_IDENTITY,
} from "./calculateStandings.js";

export {
  mapLegacyGroupStandingsPayloadToRequest,
  mapLegacyTeamStandingsPayloadToRequest,
  mapStandingsResultToLegacyGroupRows,
  mapStandingsResultToLegacyTeamRows,
  cloneLegacyStandingsPayload,
} from "./legacyStandingsMapping.js";

export * from "./adapters/index.js";
