/**
 * Phase 3F — Match Runtime (capability-local public surface).
 * Integrator owns root competition-core/index.js re-exports — do not edit that here.
 */

export {
  createMatchResolver,
  MatchResolver,
} from "./MatchResolver.js";

export {
  createLegacyMatchAdapter,
  LegacyMatchAdapter,
} from "./adapters/index.js";

export {
  createMatchResolveRequest,
  createMatchResolveResult,
  matchResolveOk,
  matchResolveFail,
  MATCH_ADAPTER_ID,
  isMatchAdapter,
  MATCH_IDENTITY_KIND,
  MATCH_SIDE_IDENTITY_KIND,
  buildMatchIdentityKey,
  buildMatchSideId,
  createMatchIdentity,
  identityFromCompetitionMatch,
  createMatchPolicyResult,
  isMatchPolicy,
  createCompetitionMatch,
  createMatchSide,
  createMatchResultReference,
} from "./contracts/index.js";

export {
  MATCH_RUNTIME_ERROR_CODE,
  MATCH_RUNTIME_ERROR_CODE_VALUES,
  isMatchRuntimeErrorCode,
  MatchRuntimeError,
  isMatchRuntimeError,
  createMatchRuntimeError,
} from "./errors/index.js";

export {
  MATCH_SOURCE_TYPE,
  MATCH_SOURCE_TYPE_VALUES,
  isMatchSourceType,
  MATCH_STATUS,
  MATCH_STATUS_VALUES,
  MATCH_CORE_STATUS_VALUES,
  isMatchStatus,
  isMatchCoreStatus,
  MATCH_SIDE_KEY,
  MATCH_SIDE_KEY_VALUES,
  isMatchSideKey,
  MATCH_COMPLETION_REASON,
  MATCH_COMPLETION_REASON_VALUES,
  isMatchCompletionReason,
} from "./enums/index.js";

export {
  mapLegacyMatchStatus,
  LEGACY_MATCH_STATUS_MAP,
  isLegacyMatchSource,
  mapLegacyMatchToCompetitionMatch,
} from "./mappers/index.js";

export {
  MATCH_PERSISTENCE_PORT_METHODS,
  matchesMatchPersistencePort,
  createInMemoryMatchPersistencePort,
  createNoopMatchPersistencePort,
} from "./ports/index.js";

export {
  createNoopMatchPolicy,
  NOOP_MATCH_POLICY_ID,
} from "./policies/index.js";

export {
  createMatchIdentityLookup,
  requireMatchIdentity,
  normalizeAndValidateMatch,
  assertMatchSidesValid,
  MATCH_ACTION,
  MATCH_IMMUTABLE_STATUSES,
  MATCH_TRANSITION_MATRIX,
  findMatchTransition,
  assertMatchTransitionAllowed,
} from "./services/index.js";
