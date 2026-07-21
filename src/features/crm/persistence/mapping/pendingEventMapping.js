/**
 * Explicit PendingEventRecord ↔ crm_pending_events row mapping (Phase 1G).
 */

import { createPendingEventRecord } from "../../models/pendingEventRecord.js";
import {
  cloneJsonObject,
  mapOptionalString,
  mapOptionalTimestamp,
  requireMappedScope,
  requireMappedString,
  requireMappedTimestamp,
} from "./mappingHelpers.js";

/**
 * @param {object} record
 * @returns {object}
 */
export function mapPendingEventDomainToRow(record) {
  const scope = requireMappedScope(record);
  const attemptCount =
    record.attemptCount != null && Number.isInteger(Number(record.attemptCount))
      ? Number(record.attemptCount)
      : 0;
  return {
    pending_event_id: requireMappedString(record.pendingEventId, "pendingEventId"),
    tenant_id: scope.tenantId,
    venue_id: scope.venueId,
    event_id: requireMappedString(record.eventId, "eventId"),
    event_type: requireMappedString(record.eventType, "eventType"),
    aggregate_type: requireMappedString(record.aggregateType, "aggregateType"),
    aggregate_id: requireMappedString(record.aggregateId, "aggregateId"),
    payload_json: cloneJsonObject(record.payload),
    status: requireMappedString(record.status || "PENDING", "status"),
    available_at: requireMappedTimestamp(record.availableAt, "availableAt"),
    attempt_count: attemptCount,
    claimed_by: mapOptionalString(record.claimedBy),
    claimed_at: mapOptionalTimestamp(record.claimedAt),
    acknowledged_at: mapOptionalTimestamp(record.acknowledgedAt),
    failed_at: mapOptionalTimestamp(record.failedAt),
    failure_reason: mapOptionalString(record.failureReason),
    created_at: requireMappedTimestamp(record.createdAt, "createdAt"),
    updated_at: requireMappedTimestamp(record.updatedAt ?? record.createdAt, "updatedAt"),
    claim_expires_at: mapOptionalTimestamp(record.claimExpiresAt),
  };
}

/**
 * @param {object} row
 * @returns {object}
 */
export function mapPendingEventRowToDomain(row) {
  if (!row || typeof row !== "object") {
    throw new Error("crm_pending_events row is required.");
  }
  return createPendingEventRecord({
    pendingEventId: requireMappedString(row.pending_event_id, "pending_event_id"),
    tenantId: requireMappedString(row.tenant_id, "tenant_id"),
    venueId: requireMappedString(row.venue_id, "venue_id"),
    eventId: requireMappedString(row.event_id, "event_id"),
    eventType: requireMappedString(row.event_type, "event_type"),
    aggregateType: requireMappedString(row.aggregate_type, "aggregate_type"),
    aggregateId: requireMappedString(row.aggregate_id, "aggregate_id"),
    payload: cloneJsonObject(row.payload_json),
    status: requireMappedString(row.status, "status"),
    availableAt: requireMappedTimestamp(row.available_at, "available_at"),
    attemptCount: Number(row.attempt_count || 0),
    claimedBy: mapOptionalString(row.claimed_by),
    claimedAt: mapOptionalTimestamp(row.claimed_at),
    acknowledgedAt: mapOptionalTimestamp(row.acknowledged_at),
    failedAt: mapOptionalTimestamp(row.failed_at),
    failureReason: mapOptionalString(row.failure_reason),
    createdAt: requireMappedTimestamp(row.created_at, "created_at"),
    updatedAt: requireMappedTimestamp(row.updated_at, "updated_at"),
    claimExpiresAt: mapOptionalTimestamp(row.claim_expires_at),
  });
}
