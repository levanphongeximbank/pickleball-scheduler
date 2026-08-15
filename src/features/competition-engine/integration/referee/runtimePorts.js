/**
 * Smallest viable production runtime ports for E2E-04 referee operations.
 *
 * Maps to existing Referee V5 tables — no *_v2 tables.
 * In-memory store remains TEST_DOUBLE_ONLY.
 */

import {
  CANONICAL_REFEREE_PERSISTENCE_TABLES,
  IN_MEMORY_RUNTIME_CLASSIFICATION,
} from "./constants.js";

export const REFEREE_OPERATIONS_STORE_PORT_METHODS = Object.freeze([
  "get",
  "update",
  "upsertAssignments",
  "putMatch",
]);

export const ASSIGNMENT_REPOSITORY_PORT_METHODS = Object.freeze([
  "getActiveForMatch",
  "listByReferee",
  "upsert",
]);

export const MATCH_STATE_REPOSITORY_PORT_METHODS = Object.freeze([
  "getLiveState",
  "putLiveState",
]);

export const SCORING_EVENT_LEDGER_PORT_METHODS = Object.freeze([
  "appendEvent",
  "listEvents",
  "findIdempotent",
]);

export const RESULT_REVISION_REPOSITORY_PORT_METHODS = Object.freeze([
  "getActive",
  "appendRevision",
]);

function hasMethods(port, methods) {
  if (!port || typeof port !== "object") return false;
  return methods.every((name) => typeof port[name] === "function");
}

export function matchesRefereeOperationsStorePort(port) {
  return hasMethods(port, REFEREE_OPERATIONS_STORE_PORT_METHODS);
}

export function matchesAssignmentRepositoryPort(port) {
  return hasMethods(port, ASSIGNMENT_REPOSITORY_PORT_METHODS);
}

export function matchesMatchStateRepositoryPort(port) {
  return hasMethods(port, MATCH_STATE_REPOSITORY_PORT_METHODS);
}

export function matchesScoringEventLedgerPort(port) {
  return hasMethods(port, SCORING_EVENT_LEDGER_PORT_METHODS);
}

export function matchesResultRevisionRepositoryPort(port) {
  return hasMethods(port, RESULT_REVISION_REPOSITORY_PORT_METHODS);
}

export function matchesCanonicalRefereeRuntimePorts(runtime) {
  return (
    Boolean(runtime) &&
    typeof runtime === "object" &&
    matchesAssignmentRepositoryPort(runtime.assignmentRepository) &&
    matchesMatchStateRepositoryPort(runtime.matchStateRepository) &&
    matchesScoringEventLedgerPort(runtime.scoringEventLedger) &&
    matchesResultRevisionRepositoryPort(runtime.resultRevisionRepository)
  );
}

export const CANONICAL_REFEREE_RUNTIME_PORT_SET = Object.freeze({
  assignmentRepository: "assignment query/persist → referee_assignments",
  matchStateRepository: "CORE-15 snapshot → match_live_states.state_payload",
  scoringEventLedger:
    "CORE-16 events + idempotency → match_events + match_sync_mutations",
  resultRevisionRepository:
    "CORE-17 accepted history → match_result_revisions",
  omitted: Object.freeze({
    auditSink: "Reuse CORE-13 refereeAuditSinkPort when wiring organizers",
    separateCommandLedger: "Folded into scoringEventLedger via match_sync_mutations",
  }),
  tables: CANONICAL_REFEREE_PERSISTENCE_TABLES,
  inMemoryClassification: IN_MEMORY_RUNTIME_CLASSIFICATION,
});
