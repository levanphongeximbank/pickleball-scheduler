/**
 * CORE-20 Competition Audit Event Log — capability identity + schema locks.
 */

export const CORE20_ENGINE_ID = "competition-core.audit";
export const CORE20_ENGINE_VERSION = "1.0.0";

export const COMPETITION_AUDIT_CONTRACT_ID = "competition-core.audit";

/**
 * Envelope schema version — independent from eventVersion.
 * Controls schemaId identity only; do not conflate with eventVersion.
 */
export const COMPETITION_AUDIT_SCHEMA_VERSION = 1;

/** Canonical schema id for CompetitionAuditEvent (derived from schema version). */
export const COMPETITION_AUDIT_EVENT_SCHEMA_V1 = `competition-core.audit-event.v${COMPETITION_AUDIT_SCHEMA_VERSION}`;

export const COMPETITION_AUDIT_CONTENT_FINGERPRINT_V1 =
  "competition-core.audit-event.fp.v1";

/**
 * Canonical wire eventVersion for CompetitionAuditEvent payload semantics.
 * Independent from COMPETITION_AUDIT_SCHEMA_VERSION.
 */
export const COMPETITION_AUDIT_EVENT_VERSION = 1;

export const CORE20_SOURCE = Object.freeze({
  capability: "CORE-20",
  moduleId: COMPETITION_AUDIT_CONTRACT_ID,
});

export const CORE19_WORKFLOW_SOURCE = Object.freeze({
  capability: "CORE-19",
  moduleId: "competition-core.workflow",
});
