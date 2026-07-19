/**
 * Phase 3E — Lineup Resolution Runtime (capability-local public surface).
 * Integrator owns root competition-core/index.js re-exports — do not edit that here.
 */

export {
  createLineupResolver,
  LineupResolver,
} from "./LineupResolver.js";

export {
  createLegacyLineupAdapter,
  LegacyLineupAdapter,
} from "./adapters/index.js";

export {
  createLineupResolveRequest,
  createLineupResolveResult,
  lineupResolveOk,
  lineupResolveFail,
  LINEUP_ADAPTER_ID,
  isLineupAdapter,
  LINEUP_IDENTITY_KIND,
  buildLineupIdentityKey,
  buildLineupSlotId,
  createLineupIdentity,
  identityFromCompetitionLineup,
  createLineupPolicyResult,
  isLineupPolicy,
} from "./contracts/index.js";

export {
  LINEUP_RUNTIME_ERROR_CODE,
  LINEUP_RUNTIME_ERROR_CODE_VALUES,
  isLineupRuntimeErrorCode,
  LineupRuntimeError,
  isLineupRuntimeError,
  createLineupRuntimeError,
} from "./errors/index.js";

export {
  LINEUP_SOURCE_TYPE,
  LINEUP_SOURCE_TYPE_VALUES,
  isLineupSourceType,
} from "./enums/index.js";

export {
  mapLegacyLineupStatus,
  LEGACY_LINEUP_STATUS_MAP,
  isLegacyLineupSource,
  mapLegacyLineupToCompetitionLineup,
} from "./mappers/index.js";

export {
  LINEUP_PERSISTENCE_PORT_METHODS,
  matchesLineupPersistencePort,
  createInMemoryLineupPersistencePort,
  createNoopLineupPersistencePort,
} from "./ports/index.js";

export {
  createNoopLineupPolicy,
  NOOP_LINEUP_POLICY_ID,
} from "./policies/index.js";

export {
  createLineupIdentityLookup,
  requireLineupIdentity,
  normalizeAndValidateLineup,
  participantToken,
  buildRosterMemberTokenSet,
  assertLineupRosterMembership,
  LINEUP_ACTION,
  LINEUP_IMMUTABLE_STATUSES,
  LINEUP_TRANSITION_MATRIX,
  findLineupTransition,
  assertLineupTransitionAllowed,
} from "./services/index.js";

/** Re-export slot/lineup factories for capability-local consumers (contracts only). */
export {
  createCompetitionLineup,
  createCompetitionLineupSlot,
  createCompetitionLineupRevision,
} from "../participants/contracts/teamRosterLineup.js";
