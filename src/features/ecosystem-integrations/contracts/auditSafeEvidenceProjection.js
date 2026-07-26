/**
 * Audit-safe event / evidence projection (ECO-05).
 * Always redacts secret-shaped fields; never retains raw credentials.
 */

import { fail, ok } from "../../../core/platform/index.js";
import {
  AUDIT_SAFE_EVIDENCE_VERSION,
  IDEMPOTENCY_OUTCOME_VALUES,
  INTEGRATION_ERROR_CODE_VALUES,
  OBSERVATION_SOURCE_KIND_VALUES,
} from "../constants/catalogues.js";
import {
  contractError,
  deepFreeze,
  isPlainObject,
  requireBoolean,
  requireEnumMember,
  requireIsoInstant,
  requireNonEmptyString,
} from "./shared.js";
import { createRedactedDiagnostics } from "./redactedDiagnostics.js";

export const AUDIT_SAFE_EVIDENCE_ERROR = Object.freeze({
  INVALID: "AUDIT_SAFE_EVIDENCE_INVALID",
  REFERENCE_INVALID: "AUDIT_SAFE_EVIDENCE_REFERENCE_INVALID",
  TIMESTAMP_INVALID: "AUDIT_SAFE_EVIDENCE_TIMESTAMP_INVALID",
  VERSION_INVALID: "AUDIT_SAFE_EVIDENCE_VERSION_INVALID",
  METADATA_INVALID: "AUDIT_SAFE_EVIDENCE_METADATA_INVALID",
});

/**
 * @param {*} input
 * @returns {import("../../../core/platform/contracts/result.js").Result}
 */
export function projectAuditSafeEvidence(input) {
  if (!isPlainObject(input)) {
    return fail(
      contractError(
        AUDIT_SAFE_EVIDENCE_ERROR.INVALID,
        "Audit-safe evidence input must be a plain object"
      )
    );
  }

  const contractVersion = requireNonEmptyString(
    input.contractVersion ?? AUDIT_SAFE_EVIDENCE_VERSION,
    "contractVersion",
    AUDIT_SAFE_EVIDENCE_ERROR.VERSION_INVALID,
    "contractVersion"
  );
  if (!contractVersion.ok) return contractVersion;

  const evidenceId = requireNonEmptyString(
    input.evidenceId,
    "evidenceId",
    AUDIT_SAFE_EVIDENCE_ERROR.REFERENCE_INVALID,
    "evidenceId"
  );
  if (!evidenceId.ok) return evidenceId;

  const eventType = requireNonEmptyString(
    input.eventType,
    "eventType",
    AUDIT_SAFE_EVIDENCE_ERROR.REFERENCE_INVALID,
    "eventType"
  );
  if (!eventType.ok) return eventType;

  const occurredAt = requireIsoInstant(
    input.occurredAt ?? new Date().toISOString(),
    "occurredAt",
    AUDIT_SAFE_EVIDENCE_ERROR.TIMESTAMP_INVALID
  );
  if (!occurredAt.ok) return occurredAt;

  const subjectId = requireNonEmptyString(
    input.subjectId,
    "subjectId",
    AUDIT_SAFE_EVIDENCE_ERROR.REFERENCE_INVALID,
    "subjectId"
  );
  if (!subjectId.ok) return subjectId;

  const sourceKind = requireEnumMember(
    input.sourceKind,
    OBSERVATION_SOURCE_KIND_VALUES,
    "sourceKind",
    AUDIT_SAFE_EVIDENCE_ERROR.METADATA_INVALID,
    "sourceKind"
  );
  if (!sourceKind.ok) return sourceKind;

  /** @type {string|undefined} */
  let outcome;
  if ("outcome" in input && input.outcome !== undefined) {
    const o = requireNonEmptyString(
      input.outcome,
      "outcome",
      AUDIT_SAFE_EVIDENCE_ERROR.REFERENCE_INVALID,
      "outcome"
    );
    if (!o.ok) return o;
    outcome = o.value;
  }

  /** @type {string|undefined} */
  let correlationId;
  if ("correlationId" in input && input.correlationId !== undefined) {
    const corr = requireNonEmptyString(
      input.correlationId,
      "correlationId",
      AUDIT_SAFE_EVIDENCE_ERROR.REFERENCE_INVALID,
      "correlationId"
    );
    if (!corr.ok) return corr;
    correlationId = corr.value;
  }

  /** @type {string|undefined} */
  let errorCode;
  if ("errorCode" in input && input.errorCode !== undefined) {
    const code = requireEnumMember(
      input.errorCode,
      INTEGRATION_ERROR_CODE_VALUES,
      "errorCode",
      AUDIT_SAFE_EVIDENCE_ERROR.METADATA_INVALID,
      "errorCode"
    );
    if (!code.ok) return code;
    errorCode = code.value;
  }

  /** @type {boolean|undefined} */
  let retryable;
  if ("retryable" in input && input.retryable !== undefined) {
    const flag = requireBoolean(
      input.retryable,
      "retryable",
      AUDIT_SAFE_EVIDENCE_ERROR.METADATA_INVALID
    );
    if (!flag.ok) return flag;
    retryable = flag.value;
  }

  /** @type {string|undefined} */
  let idempotencyOutcome;
  if ("idempotencyOutcome" in input && input.idempotencyOutcome !== undefined) {
    const idemp = requireEnumMember(
      input.idempotencyOutcome,
      IDEMPOTENCY_OUTCOME_VALUES,
      "idempotencyOutcome",
      AUDIT_SAFE_EVIDENCE_ERROR.METADATA_INVALID,
      "idempotencyOutcome"
    );
    if (!idemp.ok) return idemp;
    idempotencyOutcome = idemp.value;
  }

  let payload = Object.freeze({ redacted: true, diagnostics: Object.freeze({}) });
  if ("payload" in input && input.payload !== undefined) {
    if (!isPlainObject(input.payload)) {
      return fail(
        contractError(
          AUDIT_SAFE_EVIDENCE_ERROR.METADATA_INVALID,
          "payload must be a plain object",
          "payload"
        )
      );
    }
    const redacted = createRedactedDiagnostics(input.payload);
    if (!redacted.ok) return redacted;
    payload = redacted.value;
  }

  return ok(
    deepFreeze({
      evidenceId: evidenceId.value,
      contractVersion: contractVersion.value,
      eventType: eventType.value,
      occurredAt: occurredAt.value,
      subjectId: subjectId.value,
      sourceKind: sourceKind.value,
      auditSafe: true,
      ...(outcome ? { outcome } : {}),
      ...(correlationId ? { correlationId } : {}),
      ...(errorCode ? { errorCode } : {}),
      ...(retryable !== undefined ? { retryable } : {}),
      ...(idempotencyOutcome ? { idempotencyOutcome } : {}),
      payload,
    })
  );
}

/**
 * Project audit-safe evidence from a canonical integration observation.
 * @param {*} observation
 * @param {*} [overrides]
 */
export function projectAuditSafeEvidenceFromObservation(
  observation,
  overrides = {}
) {
  if (!isPlainObject(observation)) {
    return fail(
      contractError(
        AUDIT_SAFE_EVIDENCE_ERROR.INVALID,
        "observation must be a plain object"
      )
    );
  }
  if (!isPlainObject(overrides)) {
    return fail(
      contractError(
        AUDIT_SAFE_EVIDENCE_ERROR.INVALID,
        "overrides must be a plain object"
      )
    );
  }

  return projectAuditSafeEvidence({
    evidenceId: overrides.evidenceId ?? `evidence:${observation.observationId}`,
    eventType: observation.eventType,
    occurredAt: observation.observedAt,
    subjectId: observation.subjectId,
    sourceKind: observation.sourceKind,
    outcome: observation.outcome,
    correlationId: observation.correlationId,
    errorCode: observation.errorCode,
    retryable: observation.retryable,
    idempotencyOutcome: observation.idempotencyOutcome,
    payload: {
      ...(observation.attributes?.diagnostics ?? {}),
      ...(observation.deliveryEvidence?.diagnostics ?? {}),
    },
    ...overrides,
  });
}
