/**
 * Durable CrmPendingEventRepository adapter (Phase 1G).
 *
 * enqueue is atomic (single insert batch).
 * claim / releaseExpiredClaims use hardened RPCs.
 * acknowledge / fail use conditional updates (status = CLAIMED).
 */

import { PENDING_EVENT_STATUS } from "../../constants/pendingEventStatuses.js";
import { CRM_ERROR_CODES, CrmError } from "../../constants/errorCodes.js";
import {
  comparePendingEventsClaimOrder,
  createPendingEventRecord,
} from "../../models/pendingEventRecord.js";
import { createTenantVenueScope } from "../../models/scope.js";
import { normalizeIsoTimestamp } from "../../constants/timestamps.js";
import {
  CRM_PHASE_1G_RPC,
  CRM_PHASE_1G_TABLES,
  requireCrmDatabaseClientPort,
} from "../databaseClientPort.js";
import { withPersistenceErrors } from "../errorTranslation.js";
import {
  mapPendingEventDomainToRow,
  mapPendingEventRowToDomain,
} from "../mapping/pendingEventMapping.js";

/**
 * @param {{ db: import('../databaseClientPort.js').CrmDatabaseClientPort }} deps
 */
export function createDurablePendingEventRepository(deps = {}) {
  const db = requireCrmDatabaseClientPort(deps.db);

  function resolveScope(scopeInput) {
    return createTenantVenueScope(scopeInput);
  }

  function scopeFilters(scope) {
    return { tenant_id: scope.tenantId, venue_id: scope.venueId };
  }

  return {
    async enqueue(scopeInput, recordsInput) {
      const scope = resolveScope(scopeInput);
      if (!Array.isArray(recordsInput) || recordsInput.length === 0) {
        throw new CrmError(
          CRM_ERROR_CODES.INVALID_INPUT,
          "enqueue requires a non-empty records array."
        );
      }

      const domainRecords = recordsInput.map((row) =>
        createPendingEventRecord({
          ...row,
          tenantId: scope.tenantId,
          venueId: scope.venueId,
        })
      );
      const rows = domainRecords.map(mapPendingEventDomainToRow);

      return withPersistenceErrors(
        async () => {
          // Single insert call — adapter/client must treat as one atomic statement/transaction.
          const inserted = await db.insert({
            table: CRM_PHASE_1G_TABLES.PENDING_EVENTS,
            rows,
            returning: true,
          });
          if (!inserted || inserted.length !== rows.length) {
            throw new CrmError(
              CRM_ERROR_CODES.INVALID_INPUT,
              "Atomic enqueue failed: partial insert is not allowed."
            );
          }
          return inserted.map(mapPendingEventRowToDomain);
        },
        { conflictMessage: "Duplicate pending event_id in tenant/venue scope." }
      );
    },

    async getById(scopeInput, pendingEventId) {
      const scope = resolveScope(scopeInput);
      const id = String(pendingEventId || "").trim();
      if (!id) return null;
      return withPersistenceErrors(async () => {
        const rows = await db.select({
          table: CRM_PHASE_1G_TABLES.PENDING_EVENTS,
          filters: { ...scopeFilters(scope), pending_event_id: id },
          limit: 1,
        });
        if (!rows || rows.length === 0) return null;
        return mapPendingEventRowToDomain(rows[0]);
      });
    },

    async list(scopeInput, filters = {}) {
      const scope = resolveScope(scopeInput);
      return withPersistenceErrors(async () => {
        const queryFilters = { ...scopeFilters(scope) };
        if (filters.status) queryFilters.status = String(filters.status);
        if (filters.eventType) queryFilters.event_type = String(filters.eventType);
        if (filters.aggregateType) {
          queryFilters.aggregate_type = String(filters.aggregateType);
        }
        if (filters.aggregateId) {
          queryFilters.aggregate_id = String(filters.aggregateId);
        }
        if (filters.claimedBy) queryFilters.claimed_by = String(filters.claimedBy);

        const rows = await db.select({
          table: CRM_PHASE_1G_TABLES.PENDING_EVENTS,
          filters: queryFilters,
          order: [
            { column: "available_at", ascending: true },
            { column: "created_at", ascending: true },
            { column: "pending_event_id", ascending: true },
          ],
        });

        let mapped = (rows || []).map(mapPendingEventRowToDomain);
        const nowIso = filters.nowIso != null ? String(filters.nowIso) : null;
        if (filters.availableBefore) {
          mapped = mapped.filter(
            (row) => String(row.availableAt) <= String(filters.availableBefore)
          );
        }
        if (filters.claimableOnly) {
          mapped = mapped.filter((row) => {
            if (row.status !== PENDING_EVENT_STATUS.PENDING) return false;
            if (nowIso && String(row.availableAt) > nowIso) return false;
            return true;
          });
        }
        return mapped.sort(comparePendingEventsClaimOrder);
      });
    },

    async claim(scopeInput, request = {}) {
      const scope = resolveScope(scopeInput);
      const claimedBy = String(request.claimedBy || "").trim();
      if (!claimedBy) {
        throw new CrmError(CRM_ERROR_CODES.INVALID_INPUT, "claim requires claimedBy.");
      }
      const nowIso = String(request.nowIso || "");
      const nowAt = normalizeIsoTimestamp(nowIso);
      if (!nowAt) {
        throw new CrmError(
          CRM_ERROR_CODES.INVALID_INPUT,
          "claim requires valid nowIso."
        );
      }
      const limit =
        request.limit != null && Number.isInteger(Number(request.limit))
          ? Number(request.limit)
          : 1;
      const claimTtlMs =
        request.claimTtlMs != null && Number.isInteger(Number(request.claimTtlMs))
          ? Number(request.claimTtlMs)
          : 60_000;
      const claimTtlSeconds = Math.max(1, Math.floor(claimTtlMs / 1000));

      return withPersistenceErrors(async () => {
        const data = await db.rpc({
          fn: CRM_PHASE_1G_RPC.CLAIM_PENDING_EVENTS,
          args: {
            p_tenant_id: scope.tenantId,
            p_venue_id: scope.venueId,
            p_worker_id: claimedBy,
            p_claim_limit: limit,
            p_now_at: nowAt,
            p_claim_ttl_seconds: claimTtlSeconds,
          },
        });
        const rows = Array.isArray(data) ? data : data == null ? [] : [data];
        return rows.map(mapPendingEventRowToDomain).sort(comparePendingEventsClaimOrder);
      });
    },

    async update(scopeInput, recordInput) {
      const scope = resolveScope(scopeInput);
      const pendingEventId = String(recordInput?.pendingEventId || "").trim();
      if (!pendingEventId) {
        throw new CrmError(
          CRM_ERROR_CODES.INVALID_INPUT,
          "pendingEventId is required for update."
        );
      }

      return withPersistenceErrors(
        async () => {
          const existingRows = await db.select({
            table: CRM_PHASE_1G_TABLES.PENDING_EVENTS,
            filters: { ...scopeFilters(scope), pending_event_id: pendingEventId },
            limit: 1,
          });
          if (!existingRows || existingRows.length === 0) {
            const notFound = new Error(
              `Pending event not found for update: ${pendingEventId}`
            );
            notFound.name = "CrmNotFound";
            throw notFound;
          }
          const existing = mapPendingEventRowToDomain(existingRows[0]);
          const nextStatus = String(
            recordInput.status != null ? recordInput.status : existing.status
          );

          // Guarded terminal transitions: acknowledge / fail require CLAIMED
          if (
            nextStatus === PENDING_EVENT_STATUS.ACKNOWLEDGED ||
            nextStatus === PENDING_EVENT_STATUS.FAILED
          ) {
            const values = mapPendingEventDomainToRow(
              createPendingEventRecord({
                ...existing,
                ...recordInput,
                pendingEventId: existing.pendingEventId,
                tenantId: scope.tenantId,
                venueId: scope.venueId,
                status: nextStatus,
                claimExpiresAt: null,
              })
            );

            const updated = await db.update({
              table: CRM_PHASE_1G_TABLES.PENDING_EVENTS,
              values,
              filters: {
                ...scopeFilters(scope),
                pending_event_id: pendingEventId,
                status: PENDING_EVENT_STATUS.CLAIMED,
              },
              returning: true,
            });
            if (!updated || updated.length === 0) {
              throw new CrmError(
                CRM_ERROR_CODES.INVALID_TRANSITION,
                `Pending event transition to ${nextStatus} requires current status CLAIMED.`
              );
            }
            return mapPendingEventRowToDomain(updated[0]);
          }

          const record = createPendingEventRecord({
            ...existing,
            ...recordInput,
            pendingEventId: existing.pendingEventId,
            tenantId: scope.tenantId,
            venueId: scope.venueId,
          });
          const values = mapPendingEventDomainToRow(record);
          const updated = await db.update({
            table: CRM_PHASE_1G_TABLES.PENDING_EVENTS,
            values,
            filters: { ...scopeFilters(scope), pending_event_id: pendingEventId },
            returning: true,
          });
          if (!updated || updated.length === 0) {
            const notFound = new Error(
              `Pending event not found for update: ${pendingEventId}`
            );
            notFound.name = "CrmNotFound";
            throw notFound;
          }
          return mapPendingEventRowToDomain(updated[0]);
        },
        { notFoundMessage: `Pending event not found for update: ${pendingEventId}` }
      );
    },

    async releaseExpiredClaims(scopeInput, request = {}) {
      const scope = resolveScope(scopeInput);
      const nowAt = normalizeIsoTimestamp(request.nowIso);
      if (!nowAt) {
        throw new CrmError(
          CRM_ERROR_CODES.INVALID_INPUT,
          "releaseExpiredClaims requires valid nowIso."
        );
      }
      return withPersistenceErrors(async () => {
        const data = await db.rpc({
          fn: CRM_PHASE_1G_RPC.RELEASE_EXPIRED_CLAIMS,
          args: {
            p_tenant_id: scope.tenantId,
            p_venue_id: scope.venueId,
            p_now_at: nowAt,
          },
        });
        const items = Array.isArray(data) ? data : data == null ? [] : [data];
        const released = [];
        for (const item of items) {
          // Prefer full row payloads when the client/RPC returns them.
          if (item && typeof item === "object" && item.status != null && item.pending_event_id) {
            released.push(mapPendingEventRowToDomain(item));
            continue;
          }
          const pendingEventId =
            typeof item === "string"
              ? item
              : item?.pending_event_id || item?.pendingEventId;
          if (!pendingEventId) continue;
          const rows = await db.select({
            table: CRM_PHASE_1G_TABLES.PENDING_EVENTS,
            filters: {
              ...scopeFilters(scope),
              pending_event_id: String(pendingEventId),
            },
            limit: 1,
          });
          if (rows && rows[0]) {
            released.push(mapPendingEventRowToDomain(rows[0]));
          }
        }
        return released.sort(comparePendingEventsClaimOrder);
      });
    },
  };
}
