/**
 * CORE-20 — CompetitionAuditEvent factory (canonical immutable envelope).
 */

import {
  COMPETITION_AUDIT_EVENT_SCHEMA_V1,
  COMPETITION_AUDIT_EVENT_VERSION,
} from "../constants.js";
import { AUDIT_ERROR_CODE } from "../errors/auditErrorCodes.js";
import { AuditError } from "../errors/AuditError.js";
import { isAuditEventType } from "../enums/auditEventTypes.js";
import {
  deepFreezeClone,
  isNonEmptyString,
  isPlainObject,
  isPositiveInteger,
} from "../utils/helpers.js";
import { createActorReference } from "./actorReference.js";
import { createSubjectReference } from "./subjectReference.js";
import {
  createAuditSource,
  createCompetitionScope,
} from "./competitionScope.js";
import { sanitizeAuditPayload } from "../redaction/sanitizeAuditPayload.js";
import { createAuditContentFingerprint } from "../integrity/contentFingerprint.js";
import { normalizeStreamSequence } from "../ordering/streamSequence.js";

/**
 * @typedef {Object} CompetitionAuditEvent
 * @property {string} schemaId
 * @property {string} eventId
 * @property {string} eventType
 * @property {number} eventVersion
 * @property {Readonly<{ capability: string, moduleId: string }>} source
 * @property {string} occurredAt
 * @property {string|null} recordedAt
 * @property {Readonly<{ competitionId: string, seasonId?: string|null, clubId?: string|null, divisionId?: string|null }>} competitionScope
 * @property {string} streamKey
 * @property {string} orderingKey
 * @property {number} sequence
 * @property {Readonly<{ actorKind: string, actorId?: string|null, actorRole?: string|null }>} actor
 * @property {Readonly<{ subjectType: string, subjectId: string, competitionId?: string|null }>} subject
 * @property {string|null} correlationId
 * @property {string|null} causationId
 * @property {string|null} reason
 * @property {Readonly<Record<string, unknown>>|null} beforeSummary
 * @property {Readonly<Record<string, unknown>>|null} afterSummary
 * @property {ReadonlyArray<Readonly<Record<string, unknown>>>} evidenceReferences
 * @property {Readonly<Record<string, unknown>>} explanationMetadata
 * @property {Readonly<{ redacted: boolean, paths: ReadonlyArray<string> }>} redactionMetadata
 * @property {Readonly<Record<string, unknown>>} integrityMetadata
 * @property {Readonly<Record<string, unknown>>} safePayload
 */

/**
 * Deterministic event id helper (caller-owned; factory may also invent via this).
 * @param {Record<string, unknown>} parts
 * @returns {string}
 */
export function buildCompetitionAuditEventId(parts = {}) {
  const segments = [
    String(parts.eventType || ""),
    String(parts.competitionId || parts.competitionScope?.competitionId || ""),
    String(parts.streamKey || ""),
    String(parts.sequence ?? ""),
    String(parts.subjectId || parts.subject?.subjectId || ""),
    String(parts.occurredAt || ""),
    String(parts.correlationId || ""),
    String(parts.causationId || ""),
  ];
  return `competition-audit:${segments.join("|")}`;
}

/**
 * @param {unknown} value
 * @param {string} fieldName
 * @returns {Readonly<Record<string, unknown>>|null}
 */
function normalizeOptionalSummary(value, fieldName) {
  if (value == null) return null;
  if (!isPlainObject(value)) {
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_INVALID_EVENT,
      `${fieldName} must be a plain object when provided`,
      { fieldName }
    );
  }
  const { sanitized, redactionMetadata } = sanitizeAuditPayload(value);
  if (redactionMetadata.redacted) {
    // Summaries must already be allowlisted; prohibited keys are rejected.
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_PROHIBITED_CONTENT,
      `${fieldName} contains prohibited or truncated content`,
      { paths: redactionMetadata.paths }
    );
  }
  return sanitized;
}

/**
 * @param {unknown} partial
 * @returns {Readonly<CompetitionAuditEvent>}
 */
export function createCompetitionAuditEvent(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_INVALID_EVENT,
      "CompetitionAuditEvent must be a plain object",
      {}
    );
  }

  const eventType = isNonEmptyString(partial.eventType)
    ? String(partial.eventType).trim()
    : "";
  if (!isAuditEventType(eventType)) {
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_INVALID_EVENT,
      "Invalid audit eventType",
      { eventType: partial.eventType }
    );
  }

  const eventVersion =
    partial.eventVersion == null
      ? COMPETITION_AUDIT_EVENT_VERSION
      : Number(partial.eventVersion);
  if (
    !Number.isInteger(eventVersion) ||
    eventVersion !== COMPETITION_AUDIT_EVENT_VERSION
  ) {
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_INCOMPATIBLE_VERSION,
      `eventVersion must be ${COMPETITION_AUDIT_EVENT_VERSION}`,
      { eventVersion: partial.eventVersion }
    );
  }

  const occurredAt = isNonEmptyString(partial.occurredAt)
    ? String(partial.occurredAt).trim()
    : "";
  if (!occurredAt) {
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_INVALID_EVENT,
      "occurredAt is required (caller-supplied; no wall-clock invent)",
      {}
    );
  }

  const competitionScope = createCompetitionScope(partial.competitionScope);
  const source = createAuditSource(partial.source);
  const actor = createActorReference(partial.actor);
  const subject = createSubjectReference(
    partial.subject && isPlainObject(partial.subject)
      ? {
          ...partial.subject,
          competitionId:
            partial.subject.competitionId ?? competitionScope.competitionId,
        }
      : partial.subject
  );

  const streamKey = isNonEmptyString(partial.streamKey)
    ? String(partial.streamKey).trim()
    : "";
  if (!streamKey) {
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_INVALID_EVENT,
      "streamKey is required",
      {}
    );
  }

  const sequence = normalizeStreamSequence(partial.sequence);
  const orderingKey = isNonEmptyString(partial.orderingKey)
    ? String(partial.orderingKey).trim()
    : `${competitionScope.competitionId}|${streamKey}`;

  const correlationId =
    partial.correlationId == null || partial.correlationId === ""
      ? null
      : String(partial.correlationId).trim();
  const causationId =
    partial.causationId == null || partial.causationId === ""
      ? null
      : String(partial.causationId).trim();

  if (causationId != null && causationId === (partial.eventId || "")) {
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_INVALID_CAUSATION,
      "causationId must not equal eventId",
      { causationId }
    );
  }

  const reason =
    partial.reason == null || partial.reason === ""
      ? null
      : String(partial.reason).trim().slice(0, 500);

  const beforeSummary = normalizeOptionalSummary(
    partial.beforeSummary,
    "beforeSummary"
  );
  const afterSummary = normalizeOptionalSummary(
    partial.afterSummary,
    "afterSummary"
  );

  const evidenceReferences = Array.isArray(partial.evidenceReferences)
    ? partial.evidenceReferences.map((ref) => {
        if (!isPlainObject(ref)) {
          throw new AuditError(
            AUDIT_ERROR_CODE.AUDIT_INVALID_EVENT,
            "evidenceReferences entries must be plain objects",
            {}
          );
        }
        return sanitizeAuditPayload(ref).sanitized;
      })
    : [];

  let explanationMetadata = {};
  if (partial.explanationMetadata != null) {
    if (!isPlainObject(partial.explanationMetadata)) {
      throw new AuditError(
        AUDIT_ERROR_CODE.AUDIT_INVALID_EVENT,
        "explanationMetadata must be a plain object",
        {}
      );
    }
    const sanitizedExplanation = sanitizeAuditPayload(
      partial.explanationMetadata
    );
    if (sanitizedExplanation.redactionMetadata.redacted) {
      throw new AuditError(
        AUDIT_ERROR_CODE.AUDIT_PROHIBITED_CONTENT,
        "explanationMetadata contains prohibited content",
        { paths: sanitizedExplanation.redactionMetadata.paths }
      );
    }
    explanationMetadata = sanitizedExplanation.sanitized;
  }

  let safePayload = {};
  /** @type {{ redacted: boolean, paths: ReadonlyArray<string> }} */
  let redactionMetadata = { redacted: false, paths: [] };
  if (partial.safePayload != null) {
    if (!isPlainObject(partial.safePayload)) {
      throw new AuditError(
        AUDIT_ERROR_CODE.AUDIT_PROHIBITED_CONTENT,
        "safePayload must be a plain object",
        {}
      );
    }
    const sanitizedPayload = sanitizeAuditPayload(partial.safePayload);
    safePayload = sanitizedPayload.sanitized;
    redactionMetadata = sanitizedPayload.redactionMetadata;
  }
  if (partial.redactionMetadata && isPlainObject(partial.redactionMetadata)) {
    redactionMetadata = {
      redacted: Boolean(partial.redactionMetadata.redacted),
      paths: Array.isArray(partial.redactionMetadata.paths)
        ? partial.redactionMetadata.paths.map((p) => String(p))
        : redactionMetadata.paths,
    };
  }

  const recordedAt =
    partial.recordedAt == null || partial.recordedAt === ""
      ? null
      : String(partial.recordedAt).trim();

  const eventId = isNonEmptyString(partial.eventId)
    ? String(partial.eventId).trim()
    : buildCompetitionAuditEventId({
        eventType,
        competitionId: competitionScope.competitionId,
        streamKey,
        sequence,
        subjectId: subject.subjectId,
        occurredAt,
        correlationId,
        causationId,
      });

  if (!isPositiveInteger(sequence)) {
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_INVALID_SEQUENCE,
      "sequence must be a positive integer",
      { sequence }
    );
  }

  /** @type {Record<string, unknown>} */
  const integrityBase =
    partial.integrityMetadata && isPlainObject(partial.integrityMetadata)
      ? { ...partial.integrityMetadata }
      : {};

  const draft = {
    schemaId: COMPETITION_AUDIT_EVENT_SCHEMA_V1,
    eventId,
    eventType,
    eventVersion,
    source,
    occurredAt,
    recordedAt,
    competitionScope,
    streamKey,
    orderingKey,
    sequence,
    actor,
    subject,
    correlationId,
    causationId,
    reason,
    beforeSummary,
    afterSummary,
    evidenceReferences,
    explanationMetadata,
    redactionMetadata,
    safePayload,
  };

  const contentFingerprint =
    isNonEmptyString(integrityBase.contentFingerprint)
      ? String(integrityBase.contentFingerprint).trim()
      : createAuditContentFingerprint(draft);

  const integrityMetadata = Object.freeze(
    deepFreezeClone({
      ...integrityBase,
      contentFingerprint,
    })
  );

  return Object.freeze(
    /** @type {CompetitionAuditEvent} */ (
      deepFreezeClone({
        ...draft,
        evidenceReferences: Object.freeze([...evidenceReferences]),
        explanationMetadata: Object.freeze(
          deepFreezeClone(explanationMetadata)
        ),
        redactionMetadata: Object.freeze({
          redacted: Boolean(redactionMetadata.redacted),
          paths: Object.freeze([...(redactionMetadata.paths || [])]),
        }),
        integrityMetadata,
        safePayload: Object.freeze(deepFreezeClone(safePayload)),
      })
    )
  );
}
