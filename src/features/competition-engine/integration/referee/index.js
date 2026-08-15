/**
 * Competition Referee Adapter Contract v1 — integration boundary (END A).
 */

export {
  COMPETITION_REFEREE_ADAPTER_CONTRACT_ID,
  COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION,
  COMPETITION_REFEREE_ADAPTER_CONTRACT_LOCKED,
  COMPETITION_REFEREE_MODE,
  COMPETITION_REFEREE_MODE_VALUES,
  COMPETITION_REFEREE_MODE_TO_TYPE,
  COMPETITION_TYPE_TO_REFEREE_MODE,
  REFEREE_ADAPTER_REQUIRED_METHODS,
  REFEREE_ADAPTER_FORBIDDEN_METHODS,
  REFEREE_ADAPTER_FORBIDDEN_AUTHORITY_KEYS,
  CANONICAL_REFEREE_PERSISTENCE_TABLES,
  CANONICAL_REFEREE_AUTHORITY,
  REFEREE_ADAPTER_ERROR_CODE,
  REFEREE_ADAPTER_ERROR_CODE_VALUES,
  IN_MEMORY_RUNTIME_CLASSIFICATION,
  PRODUCTION_RUNTIME_CLASSIFICATION,
} from "./constants.js";

export {
  RefereeAdapterContractError,
  isRefereeAdapterContractError,
  isRefereeAdapterErrorCode,
  failRefereeAdapter,
} from "./errors.js";

export {
  COMPETITION_REFEREE_ADAPTER_OWNED,
  COMPETITION_REFEREE_ADAPTER_FORBIDDEN_OWNERSHIP,
  normalizeRefereeAdapterMode,
  requireAdapterRequest,
  assertAdapterDoesNotOwnAuthority,
  assertCompetitionRefereeAdapter,
  assertScoringRulesPayload,
  assertResultPropagationPayload,
  freezeRefereeAdapterView,
} from "./contract.js";

export { createCompetitionRefereeAdapterRegistry } from "./registry.js";

export { createReferenceRefereeAdapter } from "./referenceAdapter.js";

export {
  REFEREE_OPERATIONS_STORE_PORT_METHODS,
  ASSIGNMENT_REPOSITORY_PORT_METHODS,
  MATCH_STATE_REPOSITORY_PORT_METHODS,
  SCORING_EVENT_LEDGER_PORT_METHODS,
  RESULT_REVISION_REPOSITORY_PORT_METHODS,
  matchesRefereeOperationsStorePort,
  matchesAssignmentRepositoryPort,
  matchesMatchStateRepositoryPort,
  matchesScoringEventLedgerPort,
  matchesResultRevisionRepositoryPort,
  matchesCanonicalRefereeRuntimePorts,
  CANONICAL_REFEREE_RUNTIME_PORT_SET,
} from "./runtimePorts.js";

export { createCanonicalRefereePersistenceRuntime } from "./createCanonicalRefereePersistenceRuntime.js";

export { runCompetitionRefereeAdapterConformance } from "./conformance.js";

export const COMPETITION_REFEREE_ADAPTER_INTEGRATION = Object.freeze({
  id: "competition.referee.adapter.v1",
  version: "1.0.0",
  locked: true,
  wiredToProductionRuntime: false,
  inMemoryRuntimeClassification: "TEST_DOUBLE_ONLY",
  productionRuntimePortsDefined: true,
});
