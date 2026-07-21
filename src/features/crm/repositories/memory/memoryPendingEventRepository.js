/**
 * In-memory CrmPendingEventRepository — tenant/venue isolated per instance.
 *
 * claim() is atomic within one repository instance (synchronous in-memory).
 */

import { PENDING_EVENT_STATUS } from "../../constants/pendingEventStatuses.js";
import {
  comparePendingEventsClaimOrder,
  createPendingEventRecord,
} from "../../models/pendingEventRecord.js";
import { createScopedMemoryStore, resolveScope } from "./scopedMemoryStore.js";

export function createMemoryPendingEventRepository() {
  const store = createScopedMemoryStore();

  function saveRecord(scope, record) {
    return store.save(scope, record.pendingEventId, record);
  }

  return {
    enqueue(scopeInput, recordsInput) {
      const scope = resolveScope(scopeInput);
      const saved = [];
      for (const row of recordsInput) {
        const record = createPendingEventRecord({
          ...row,
          tenantId: scope.tenantId,
          venueId: scope.venueId,
        });
        saved.push(saveRecord(scope, record));
      }
      return saved;
    },
    getById(scopeInput, pendingEventId) {
      const scope = resolveScope(scopeInput);
      return store.getById(scope, String(pendingEventId || ""));
    },
    list(scopeInput, filters = {}) {
      const scope = resolveScope(scopeInput);
      const nowIso = filters.nowIso != null ? String(filters.nowIso) : null;
      const rows = store.list(scope, (row) => {
        if (filters.status && row.status !== String(filters.status)) return false;
        if (filters.eventType && row.eventType !== String(filters.eventType)) return false;
        if (filters.aggregateType && row.aggregateType !== String(filters.aggregateType)) {
          return false;
        }
        if (filters.aggregateId && row.aggregateId !== String(filters.aggregateId)) {
          return false;
        }
        if (filters.claimedBy && row.claimedBy !== String(filters.claimedBy)) return false;
        if (filters.availableBefore && String(row.availableAt) > String(filters.availableBefore)) {
          return false;
        }
        if (filters.claimableOnly) {
          if (row.status !== PENDING_EVENT_STATUS.PENDING) return false;
          if (nowIso && String(row.availableAt) > nowIso) return false;
        }
        return true;
      });
      return rows.slice().sort(comparePendingEventsClaimOrder);
    },
    claim(scopeInput, request = {}) {
      const scope = resolveScope(scopeInput);
      const nowIso = String(request.nowIso || "");
      const claimedBy = String(request.claimedBy || "").trim();
      if (!claimedBy) {
        throw new Error("claim requires claimedBy.");
      }
      const limit =
        request.limit != null && Number.isInteger(Number(request.limit))
          ? Math.max(0, Number(request.limit))
          : 1;
      const claimTtlMs =
        request.claimTtlMs != null && Number.isInteger(Number(request.claimTtlMs))
          ? Number(request.claimTtlMs)
          : 60_000;

      const claimExpiresAt =
        nowIso && claimTtlMs > 0
          ? new Date(new Date(nowIso).getTime() + claimTtlMs).toISOString()
          : null;

      const candidates = store.list(scope, (row) => {
        if (row.status !== PENDING_EVENT_STATUS.PENDING) return false;
        if (nowIso && String(row.availableAt) > nowIso) return false;
        return true;
      });
      candidates.sort(comparePendingEventsClaimOrder);

      const claimed = [];
      for (const row of candidates) {
        if (claimed.length >= limit) break;
        const updated = createPendingEventRecord({
          ...row,
          status: PENDING_EVENT_STATUS.CLAIMED,
          attemptCount: (row.attemptCount || 0) + 1,
          claimedBy,
          claimedAt: nowIso || row.claimedAt,
          claimExpiresAt,
          updatedAt: nowIso || row.updatedAt,
        });
        saveRecord(scope, updated);
        claimed.push(updated);
      }
      return claimed;
    },
    update(scopeInput, recordInput) {
      const scope = resolveScope(scopeInput);
      const existing = store.getById(scope, String(recordInput?.pendingEventId || ""));
      if (!existing) {
        throw new Error(
          `Pending event not found for update: ${recordInput?.pendingEventId}`
        );
      }
      const record = createPendingEventRecord({
        ...existing,
        ...recordInput,
        pendingEventId: existing.pendingEventId,
        tenantId: scope.tenantId,
        venueId: scope.venueId,
      });
      return saveRecord(scope, record);
    },
    releaseExpiredClaims(scopeInput, request = {}) {
      const scope = resolveScope(scopeInput);
      const nowIso = String(request.nowIso || "");
      const released = [];

      const rows = store.list(scope, (row) => {
        if (row.status !== PENDING_EVENT_STATUS.CLAIMED) return false;
        if (!row.claimExpiresAt) return false;
        return String(row.claimExpiresAt) <= nowIso;
      });
      rows.sort(comparePendingEventsClaimOrder);

      for (const row of rows) {
        const updated = createPendingEventRecord({
          ...row,
          status: PENDING_EVENT_STATUS.PENDING,
          claimedBy: null,
          claimedAt: null,
          claimExpiresAt: null,
          updatedAt: nowIso || row.updatedAt,
        });
        saveRecord(scope, updated);
        released.push(updated);
      }
      return released;
    },
  };
}
