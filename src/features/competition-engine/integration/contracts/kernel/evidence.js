/**
 * Standard evidence / snapshot response for Canonical Competition Adapter reads.
 * Competition may retain evidence references; it must not copy external master ownership.
 */

import { SHARED_ADAPTER_ERROR_CODE } from "./constants.js";
import { failCompetitionAdapter } from "./errors.js";
import { freezeClone, isNonEmptyString, isPlainObject } from "./helpers.js";

export const EVIDENCE_STATUS = Object.freeze({
  OK: "OK",
  NOT_FOUND: "NOT_FOUND",
  NOT_CONFIGURED: "NOT_CONFIGURED",
  DENIED: "DENIED",
  PARTIAL: "PARTIAL",
  DELIVERY_FAILED: "DELIVERY_FAILED",
  CONTEXT_VALIDATED: "CONTEXT_VALIDATED",
});

/**
 * @param {unknown} payload
 */
export function assertEvidencePayload(payload) {
  if (!isPlainObject(payload)) {
    failCompetitionAdapter(
      SHARED_ADAPTER_ERROR_CODE.MALFORMED_RESPONSE,
      "Adapter evidence response must be a plain object",
      {}
    );
  }
  if (!isNonEmptyString(payload.status)) {
    failCompetitionAdapter(
      SHARED_ADAPTER_ERROR_CODE.MALFORMED_RESPONSE,
      "Evidence status is required",
      {}
    );
  }
  if (payload.status === EVIDENCE_STATUS.OK && payload.data === undefined) {
    failCompetitionAdapter(
      SHARED_ADAPTER_ERROR_CODE.MALFORMED_RESPONSE,
      "OK evidence must include data",
      {}
    );
  }
  return freezeClone({
    sourceSystem: isNonEmptyString(payload.sourceSystem)
      ? String(payload.sourceSystem).trim()
      : null,
    sourceVersion: isNonEmptyString(payload.sourceVersion)
      ? String(payload.sourceVersion).trim()
      : null,
    snapshotId: isNonEmptyString(payload.snapshotId)
      ? String(payload.snapshotId).trim()
      : null,
    effectiveAt:
      payload.effectiveAt == null || payload.effectiveAt === ""
        ? null
        : payload.effectiveAt,
    retrievedAt:
      payload.retrievedAt == null || payload.retrievedAt === ""
        ? null
        : payload.retrievedAt,
    data: payload.data === undefined ? null : payload.data,
    status: String(payload.status).trim(),
    reasonCodes: Array.isArray(payload.reasonCodes)
      ? payload.reasonCodes.map((code) => String(code))
      : [],
  });
}

/**
 * @param {object} payload
 */
export function freezeEvidence(payload) {
  return assertEvidencePayload(payload);
}
