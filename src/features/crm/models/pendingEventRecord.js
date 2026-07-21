/**
 * PendingEventRecord foundation model (Phase 1F).
 *
 * Memory-first dispatch queue. No provider delivery.
 */

import { CRM_ERROR_CODES, CrmError } from "../constants/errorCodes.js";
import { isPendingEventStatus } from "../constants/pendingEventStatuses.js";
import { normalizeIsoTimestamp } from "../constants/timestamps.js";
import { createTenantVenueScope, requireNonEmptyId } from "./scope.js";

/**
 * @param {object} input
 * @returns {object}
 */
export function createPendingEventRecord(input = {}) {
  const scope = createTenantVenueScope(input);
  const pendingEventId = requireNonEmptyId(
    input.pendingEventId ?? input.id,
    "pendingEventId"
  );
  const eventId = requireNonEmptyId(input.eventId, "eventId");
  const eventType = requireNonEmptyId(input.eventType, "eventType");
  const aggregateType = requireNonEmptyId(input.aggregateType, "aggregateType");
  const aggregateId = requireNonEmptyId(input.aggregateId, "aggregateId");

  const status =
    input.status != null ? String(input.status).trim() : "PENDING";
  if (!isPendingEventStatus(status)) {
    throw new CrmError(CRM_ERROR_CODES.INVALID_STATUS, `Invalid pending event status: ${status}`);
  }

  const availableAt = normalizeIsoTimestamp(input.availableAt ?? input.createdAt);
  if (!availableAt) {
    throw new CrmError(
      CRM_ERROR_CODES.INVALID_INPUT,
      "availableAt must be a valid ISO-8601 timestamp."
    );
  }

  const attemptCount =
    input.attemptCount != null && Number.isInteger(Number(input.attemptCount))
      ? Number(input.attemptCount)
      : 0;
  if (attemptCount < 0) {
    throw new CrmError(CRM_ERROR_CODES.INVALID_INPUT, "attemptCount must be non-negative.");
  }

  const payload =
    input.payload && typeof input.payload === "object"
      ? Object.freeze({ ...input.payload })
      : Object.freeze({});

  return Object.freeze({
    pendingEventId,
    tenantId: scope.tenantId,
    venueId: scope.venueId,
    eventId,
    eventType,
    aggregateType,
    aggregateId,
    payload,
    status,
    availableAt,
    attemptCount,
    claimedBy:
      input.claimedBy != null && String(input.claimedBy).trim()
        ? String(input.claimedBy).trim()
        : null,
    claimedAt:
      input.claimedAt != null && input.claimedAt !== ""
        ? normalizeIsoTimestamp(input.claimedAt)
        : null,
    claimExpiresAt:
      input.claimExpiresAt != null && input.claimExpiresAt !== ""
        ? normalizeIsoTimestamp(input.claimExpiresAt)
        : null,
    acknowledgedAt:
      input.acknowledgedAt != null && input.acknowledgedAt !== ""
        ? normalizeIsoTimestamp(input.acknowledgedAt)
        : null,
    failedAt:
      input.failedAt != null && input.failedAt !== ""
        ? normalizeIsoTimestamp(input.failedAt)
        : null,
    failureReason:
      input.failureReason != null && String(input.failureReason).trim()
        ? String(input.failureReason).trim()
        : null,
    createdAt: normalizeIsoTimestamp(input.createdAt),
    updatedAt: normalizeIsoTimestamp(input.updatedAt ?? input.createdAt),
  });
}

/**
 * Deterministic pending-event list/claim order:
 * availableAt asc, createdAt asc, pendingEventId asc.
 * @param {object} a
 * @param {object} b
 */
export function comparePendingEventsClaimOrder(a, b) {
  const availCmp = String(a.availableAt || "").localeCompare(String(b.availableAt || ""));
  if (availCmp !== 0) return availCmp;
  const createdCmp = String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
  if (createdCmp !== 0) return createdCmp;
  return String(a.pendingEventId || "").localeCompare(String(b.pendingEventId || ""));
}
