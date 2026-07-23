/**
 * CORE-20 — stream ordering semantics.
 * Primary order: (competitionScope.competitionId, streamKey, sequence).
 * Timestamp is never used as ordering authority.
 */

import { AUDIT_ERROR_CODE } from "../errors/auditErrorCodes.js";
import { AuditError } from "../errors/AuditError.js";
import { isNonEmptyString, isPositiveInteger } from "../utils/helpers.js";

/**
 * @param {string} competitionId
 * @param {string} streamKey
 * @returns {string}
 */
export function buildOrderingKey(competitionId, streamKey) {
  const c = isNonEmptyString(competitionId)
    ? String(competitionId).trim()
    : "";
  const s = isNonEmptyString(streamKey) ? String(streamKey).trim() : "";
  if (!c || !s) {
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_ORDERING_VIOLATION,
      "competitionId and streamKey are required for ordering key",
      { competitionId: c, streamKey: s }
    );
  }
  return `${c}|${s}`;
}

/**
 * @param {{ competitionScope?: { competitionId?: string }, streamKey?: string, sequence?: number, eventId?: string }} a
 * @param {{ competitionScope?: { competitionId?: string }, streamKey?: string, sequence?: number, eventId?: string }} b
 * @returns {number}
 */
export function compareAuditEventOrder(a, b) {
  const aComp = String(a?.competitionScope?.competitionId || "");
  const bComp = String(b?.competitionScope?.competitionId || "");
  if (aComp !== bComp) return aComp < bComp ? -1 : 1;

  const aStream = String(a?.streamKey || "");
  const bStream = String(b?.streamKey || "");
  if (aStream !== bStream) return aStream < bStream ? -1 : 1;

  const aSeq = Number(a?.sequence);
  const bSeq = Number(b?.sequence);
  if (aSeq !== bSeq) return aSeq < bSeq ? -1 : 1;

  const aId = String(a?.eventId || "");
  const bId = String(b?.eventId || "");
  if (aId === bId) return 0;
  return aId < bId ? -1 : 1;
}

/**
 * Validate that sequence is a positive integer (1-based per stream).
 * @param {unknown} sequence
 * @returns {number}
 */
export function normalizeStreamSequence(sequence) {
  if (!isPositiveInteger(sequence)) {
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_INVALID_SEQUENCE,
      "sequence must be a positive integer (>= 1)",
      { sequence }
    );
  }
  return sequence;
}

/**
 * Strict append check: next sequence must equal lastSequence + 1
 * (or 1 when stream is empty).
 *
 * @param {number|null|undefined} lastSequence
 * @param {number} nextSequence
 */
export function assertNextSequence(lastSequence, nextSequence) {
  const next = normalizeStreamSequence(nextSequence);
  if (lastSequence == null) {
    if (next !== 1) {
      throw new AuditError(
        AUDIT_ERROR_CODE.AUDIT_INVALID_SEQUENCE,
        "First event in stream must have sequence = 1",
        { lastSequence: null, nextSequence: next }
      );
    }
    return;
  }
  if (!isPositiveInteger(lastSequence)) {
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_INVALID_SEQUENCE,
      "lastSequence is invalid",
      { lastSequence }
    );
  }
  if (next !== lastSequence + 1) {
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_ORDERING_VIOLATION,
      "sequence must be strictly monotonic (+1) per stream",
      { lastSequence, nextSequence: next }
    );
  }
}
