/**
 * Daily Play lease projection — NOT Capacity SSOT.
 *
 * Capacity authority remains court_resource_reservations via Head A.
 * This module only records live-execution lease projections after a successful
 * Head A reserve, and clears them after Head A release.
 *
 * Forbidden: calling the certified D4 acquire RPC / D4 reserve paths
 * (those also write capacity and would double-reserve).
 */
export const DAILY_PLAY_LEASE_IS_CAPACITY_SSOT = false;
export const DAILY_PLAY_LEASE_IS_PROJECTION = true;
export const DAILY_PLAY_CAPACITY_AUTHORITY = "court_resource_reservations";

export const DAILY_PLAY_LEASE_STATUS = Object.freeze({
  ACTIVE: "active",
  RELEASED: "released",
});

function trimId(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

function keyOf(lease) {
  return [
    trimId(lease.tenantId),
    trimId(lease.competitionId),
    trimId(lease.matchId),
    trimId(lease.physicalCourtId),
  ].join("::");
}

/**
 * In-memory projection store for canonical Daily Play Adapter B path.
 * Production durable projection may be added later as an additive package;
 * D4 certified SQL is never edited here.
 */
export function createDailyPlayLeaseProjectionStore(seed = []) {
  const leases = new Map();
  for (const row of seed) {
    leases.set(keyOf(row), { ...row });
  }

  return {
    listActive({ tenantId, competitionId, physicalCourtId } = {}) {
      return [...leases.values()].filter((lease) => {
        if (lease.status !== DAILY_PLAY_LEASE_STATUS.ACTIVE) return false;
        if (tenantId && lease.tenantId !== tenantId) return false;
        if (competitionId && lease.competitionId !== competitionId) return false;
        if (physicalCourtId && lease.physicalCourtId !== physicalCourtId) return false;
        return true;
      });
    },

    recordAcquire(input = {}) {
      const lease = {
        tenantId: trimId(input.tenantId),
        clubId: trimId(input.clubId),
        competitionId: trimId(input.competitionId),
        matchId: trimId(input.matchId),
        physicalCourtId: trimId(input.physicalCourtId),
        status: DAILY_PLAY_LEASE_STATUS.ACTIVE,
        reservationRef: trimId(input.reservationRef) || null,
        acquiredAt: input.acquiredAt || new Date().toISOString(),
        capacityAuthority: DAILY_PLAY_CAPACITY_AUTHORITY,
        leaseRole: "LIVE_EXECUTION_PROJECTION",
      };
      if (!lease.tenantId || !lease.competitionId || !lease.physicalCourtId) {
        return {
          ok: false,
          code: "MISSING_LEASE_SCOPE",
          error: "Lease projection requires tenantId, competitionId, physicalCourtId.",
        };
      }
      leases.set(keyOf(lease), lease);
      return { ok: true, lease };
    },

    recordRelease(input = {}) {
      const matchKey = keyOf({
        tenantId: input.tenantId,
        competitionId: input.competitionId,
        matchId: input.matchId,
        physicalCourtId: input.physicalCourtId,
      });
      const existing = leases.get(matchKey);
      if (!existing) {
        return { ok: true, replay: true, lease: null };
      }
      const released = {
        ...existing,
        status: DAILY_PLAY_LEASE_STATUS.RELEASED,
        releasedAt: input.releasedAt || new Date().toISOString(),
      };
      leases.set(matchKey, released);
      return { ok: true, lease: released };
    },

    /** @internal */
    __dump() {
      return [...leases.values()].map((row) => ({ ...row }));
    },
  };
}

export const defaultDailyPlayLeaseProjectionStore = createDailyPlayLeaseProjectionStore();
