/**
 * CORE-20 Competition Audit Event Log — public capability surface (Phase 1B).
 *
 * Ownership boundary (what CORE-20 owns):
 * - Canonical CompetitionAuditEvent envelope
 * - ActorReference / SubjectReference / CompetitionScope
 * - Audit event type taxonomy (namespaced mappings)
 * - Ordering / integrity / redaction / query criteria
 * - Typed AUDIT_* errors
 * - Append-only sink port (in-memory double; no SQL)
 * - Adapters from domain events (CORE-19 WorkflowEvent first)
 *
 * Ownership boundary (what CORE-20 does NOT own):
 * - CORE-19 workflow kernel / domain event emission
 * - Identity / Platform audit store
 * - Capability-local factories (match/seeding/registration/referee)
 * - UI, routes, SQL, Supabase, production persistence wiring
 * - CORE-21 deterministic replay execution
 *
 * Deterministic input requirement:
 * - Callers supply occurredAt, sequence, and event identities.
 * - Kernel never invents wall-clock time or random identities.
 *
 * Integrator owns root competition-core/index.js re-exports — do not edit that here.
 */

export {
  CORE20_ENGINE_ID,
  CORE20_ENGINE_VERSION,
  COMPETITION_AUDIT_CONTRACT_ID,
  COMPETITION_AUDIT_SCHEMA_VERSION,
  COMPETITION_AUDIT_EVENT_SCHEMA_V1,
  COMPETITION_AUDIT_CONTENT_FINGERPRINT_V1,
  COMPETITION_AUDIT_EVENT_VERSION,
  CORE20_SOURCE,
  CORE19_WORKFLOW_SOURCE,
} from "./constants.js";

export {
  ACTOR_KIND,
  ACTOR_KIND_VALUES,
  isActorKind,
  SUBJECT_TYPE,
  SUBJECT_TYPE_VALUES,
  isSubjectType,
  AUDIT_EVENT_TYPE,
  AUDIT_EVENT_TYPE_VALUES,
  WORKFLOW_EVENT_TYPE_TO_AUDIT,
  isAuditEventType,
  mapWorkflowEventTypeToAudit,
} from "./enums/index.js";

export {
  AUDIT_ERROR_CODE,
  AUDIT_ERROR_CODE_VALUES,
  isAuditErrorCode,
  AuditError,
  isAuditError,
  createAuditError,
} from "./errors/index.js";

export {
  buildCompetitionAuditEventId,
  createCompetitionAuditEvent,
  createActorReference,
  mapLooseActorTypeToKind,
  createSubjectReference,
  createCompetitionScope,
  createAuditSource,
  createAuditQueryCriteria,
  matchAuditQuery,
} from "./contracts/index.js";

export {
  buildOrderingKey,
  compareAuditEventOrder,
  normalizeStreamSequence,
  assertNextSequence,
} from "./ordering/streamSequence.js";

export { createAuditContentFingerprint } from "./integrity/contentFingerprint.js";
export { validateAuditEvent } from "./integrity/validateAuditEvent.js";

export {
  PROHIBITED_AUDIT_KEYS,
  isProhibitedAuditKey,
  sanitizeAuditPayload,
  pickAllowlistedPayload,
} from "./redaction/sanitizeAuditPayload.js";

export {
  WORKFLOW_SAFE_PAYLOAD_ALLOWLIST,
  fromWorkflowEvent,
  fromWorkflowEventChain,
} from "./adapters/fromWorkflowEvent.js";

export {
  COMPETITION_AUDIT_SINK_PORT_METHODS,
  matchesCompetitionAuditSinkPort,
  createNullCompetitionAuditSinkPort,
  createInMemoryCompetitionAuditSinkPort,
} from "./ports/competitionAuditSinkPort.js";
