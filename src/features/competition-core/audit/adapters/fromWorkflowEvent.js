/**
 * CORE-20 adapter — CORE-19 WorkflowEvent → CompetitionAuditEvent.
 *
 * IMPORT_ONLY of CORE-19 public surface. Does not modify workflow module.
 * Does not dump raw workflow payload; fingerprint + allowlisted safe keys only.
 */

import {
  isWorkflowEventType,
  WORKFLOW_EVENT_TYPE,
} from "../../workflow/index.js";
import { CORE19_WORKFLOW_SOURCE } from "../constants.js";
import { AUDIT_ERROR_CODE } from "../errors/auditErrorCodes.js";
import { AuditError } from "../errors/AuditError.js";
import { SUBJECT_TYPE } from "../enums/subjectTypes.js";
import { mapWorkflowEventTypeToAudit } from "../enums/auditEventTypes.js";
import {
  isNonEmptyString,
  isPlainObject,
  isPositiveInteger,
} from "../utils/helpers.js";
import { createCompetitionAuditEvent } from "../contracts/competitionAuditEvent.js";
import { createActorReference } from "../contracts/actorReference.js";
import {
  pickAllowlistedPayload,
} from "../redaction/sanitizeAuditPayload.js";

/**
 * Allowlisted workflow payload keys safe for audit summaries.
 * Arbitrary domain keys are excluded by default.
 */
export const WORKFLOW_SAFE_PAYLOAD_ALLOWLIST = Object.freeze([
  "operation",
  "reason",
  "code",
  "failedEffectIds",
  "warnings",
  "targetStepId",
  "restartMode",
  "restartCount",
  "recoveryInvoked",
]);

/**
 * @param {unknown} workflowEvent
 * @param {{
 *   competitionScope: { competitionId: string, seasonId?: string|null, clubId?: string|null, divisionId?: string|null },
 *   sequence: number,
 *   streamKey?: string,
 *   causationId?: string|null,
 *   recordedAt?: string|null,
 *   requireCorrelation?: boolean,
 *   safePayloadAllowlist?: ReadonlyArray<string>,
 *   includeSafePayload?: boolean,
 * }} options
 * @returns {Readonly<object>}
 */
export function fromWorkflowEvent(workflowEvent, options = {}) {
  if (!isPlainObject(workflowEvent)) {
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_ADAPTER_INPUT_INVALID,
      "WorkflowEvent must be a plain object",
      {}
    );
  }
  if (!isPlainObject(options) || !isPlainObject(options.competitionScope)) {
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_ADAPTER_INPUT_INVALID,
      "options.competitionScope is required (WorkflowEvent has no competitionId)",
      {}
    );
  }
  if (!isPositiveInteger(options.sequence)) {
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_ADAPTER_INPUT_INVALID,
      "options.sequence must be a positive integer (sink/orchestrator owned)",
      { sequence: options.sequence }
    );
  }

  if (!isNonEmptyString(workflowEvent.eventId)) {
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_ADAPTER_INPUT_INVALID,
      "WorkflowEvent.eventId is required",
      {}
    );
  }
  if (!isWorkflowEventType(workflowEvent.eventType)) {
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_ADAPTER_INPUT_INVALID,
      "WorkflowEvent.eventType is not a CORE-19 WORKFLOW_EVENT_TYPE",
      { eventType: workflowEvent.eventType }
    );
  }

  const auditEventType = mapWorkflowEventTypeToAudit(workflowEvent.eventType);
  if (!auditEventType) {
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_ADAPTER_INPUT_INVALID,
      "No CORE-20 audit mapping for workflow event type",
      { eventType: workflowEvent.eventType }
    );
  }

  if (!isNonEmptyString(workflowEvent.occurredAt)) {
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_ADAPTER_INPUT_INVALID,
      "WorkflowEvent.occurredAt is required",
      {}
    );
  }
  if (!isNonEmptyString(workflowEvent.workflowInstanceId)) {
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_ADAPTER_INPUT_INVALID,
      "WorkflowEvent.workflowInstanceId is required",
      {}
    );
  }
  if (!isNonEmptyString(workflowEvent.payloadFingerprint)) {
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_ADAPTER_INPUT_INVALID,
      "WorkflowEvent.payloadFingerprint is required",
      {}
    );
  }

  const competitionId = String(options.competitionScope.competitionId || "").trim();
  if (!competitionId) {
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_ADAPTER_INPUT_INVALID,
      "competitionScope.competitionId is required",
      {}
    );
  }

  const streamKey = isNonEmptyString(options.streamKey)
    ? String(options.streamKey).trim()
    : `workflow:${workflowEvent.workflowInstanceId}`;

  const correlationId =
    workflowEvent.correlationId == null || workflowEvent.correlationId === ""
      ? null
      : String(workflowEvent.correlationId);

  if (options.requireCorrelation && !correlationId) {
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_MISSING_CORRELATION,
      "correlationId required when adapting multi-event workflow chains",
      { eventId: workflowEvent.eventId }
    );
  }

  const allowlist = Array.isArray(options.safePayloadAllowlist)
    ? options.safePayloadAllowlist
    : WORKFLOW_SAFE_PAYLOAD_ALLOWLIST;

  const includeSafePayload = options.includeSafePayload !== false;
  const safePayload = includeSafePayload
    ? pickAllowlistedPayload(workflowEvent.payload, allowlist)
    : Object.freeze({});

  const actor = createActorReference({
    actorId: workflowEvent.actorId,
    actorType: workflowEvent.actorType,
  });

  return createCompetitionAuditEvent({
    // Preserve domain event identity as audit eventId (stable, caller-supplied).
    eventId: String(workflowEvent.eventId).trim(),
    eventType: auditEventType,
    source: CORE19_WORKFLOW_SOURCE,
    occurredAt: String(workflowEvent.occurredAt).trim(),
    recordedAt:
      options.recordedAt == null || options.recordedAt === ""
        ? null
        : String(options.recordedAt).trim(),
    competitionScope: options.competitionScope,
    streamKey,
    sequence: options.sequence,
    actor,
    subject: {
      subjectType: SUBJECT_TYPE.WORKFLOW,
      subjectId: String(workflowEvent.workflowInstanceId).trim(),
      competitionId,
    },
    correlationId,
    causationId:
      options.causationId == null || options.causationId === ""
        ? null
        : String(options.causationId).trim(),
    reason:
      workflowEvent.reasonCode == null || workflowEvent.reasonCode === ""
        ? null
        : String(workflowEvent.reasonCode),
    beforeSummary: {
      status: workflowEvent.fromStatus,
      stepId: workflowEvent.fromStepId,
    },
    afterSummary: {
      status: workflowEvent.toStatus,
      stepId: workflowEvent.toStepId,
    },
    evidenceReferences: [
      {
        kind: "workflow.payloadFingerprint",
        fingerprint: String(workflowEvent.payloadFingerprint).trim(),
      },
    ],
    explanationMetadata: {
      definitionId: workflowEvent.definitionId,
      definitionVersion: workflowEvent.definitionVersion,
      transitionId: workflowEvent.transitionId,
      idempotencyKey: workflowEvent.idempotencyKey,
      workflowEventType: workflowEvent.eventType,
      domainEventId: workflowEvent.eventId,
    },
    integrityMetadata: {
      domainPayloadFingerprint: String(workflowEvent.payloadFingerprint).trim(),
      domainEventType: workflowEvent.eventType,
    },
    safePayload,
  });
}

/**
 * Adapt a success-chain of workflow events sharing one correlationId.
 * Root event: causationId = null; subsequent: causationId = previous audit eventId.
 *
 * @param {ReadonlyArray<object>} workflowEvents
 * @param {{
 *   competitionScope: object,
 *   streamKey?: string,
 *   startingSequence?: number,
 *   recordedAt?: string|null,
 *   safePayloadAllowlist?: ReadonlyArray<string>,
 * }} options
 * @returns {ReadonlyArray<object>}
 */
export function fromWorkflowEventChain(workflowEvents, options = {}) {
  if (!Array.isArray(workflowEvents) || workflowEvents.length === 0) {
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_ADAPTER_INPUT_INVALID,
      "workflowEvents must be a non-empty array",
      {}
    );
  }

  const startingSequence = options.startingSequence == null
    ? 1
    : options.startingSequence;
  if (!isPositiveInteger(startingSequence)) {
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_ADAPTER_INPUT_INVALID,
      "startingSequence must be a positive integer",
      { startingSequence: options.startingSequence }
    );
  }

  /** @type {object[]} */
  const out = [];
  let previousEventId = null;
  for (let i = 0; i < workflowEvents.length; i += 1) {
    const adapted = fromWorkflowEvent(workflowEvents[i], {
      competitionScope: options.competitionScope,
      streamKey: options.streamKey,
      sequence: startingSequence + i,
      recordedAt: options.recordedAt,
      safePayloadAllowlist: options.safePayloadAllowlist,
      requireCorrelation: workflowEvents.length > 1,
      causationId: i === 0 ? null : previousEventId,
    });
    previousEventId = adapted.eventId;
    out.push(adapted);
  }
  return Object.freeze([...out]);
}

export { WORKFLOW_EVENT_TYPE };
