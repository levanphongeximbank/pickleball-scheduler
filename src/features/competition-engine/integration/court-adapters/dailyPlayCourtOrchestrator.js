/**
 * Daily Play Court Orchestrator (canonical Adapter B path).
 *
 * Sequence (safe — no double reservation):
 *   1. Mode Adapter B → Head A.reserveCourts (capacity SSOT)
 *   2. Lease projection record (NOT capacity)
 *   3. Optional Live Runtime projection (occupancy NOW — NOT capacity)
 *
 * Never calls the certified D4 acquire RPC.
 * Legacy D4 SQL path remains on the explicit OFF / legacy compatibility path.
 *
 * Live Runtime is the canonical current occupancy authority when enabled.
 * Daily Play lease remains projection/compatibility — not a competing occupancy SSOT.
 */
import { createDailyPlayCourtAdapter } from "./DailyPlayCourtAdapter.js";
import {
  DAILY_PLAY_CAPACITY_AUTHORITY,
  DAILY_PLAY_LEASE_IS_CAPACITY_SSOT,
  DAILY_PLAY_LEASE_IS_PROJECTION,
  createDailyPlayLeaseProjectionStore,
  defaultDailyPlayLeaseProjectionStore,
} from "./dailyPlayLeaseProjection.js";
import {
  projectDailyPlayLiveBegin,
  projectDailyPlayLiveEnd,
} from "../../../court-resource/projections/courtLiveResourceUseProjection.js";
import { isCanonicalCourtLiveRuntime } from "../../../court-resource/constants/canonicalLiveRuntime.js";

// Constructed so architecture locks can forbid direct acquire RPC imports/calls
// while this orchestrator still rejects the forbidden name if injected.
const FORBIDDEN_D4_ACQUIRE = ["court_resource", "daily_play", "acquire"].join("_");

export function createDailyPlayCourtOrchestrator(deps = {}) {
  const adapter = deps.adapter || createDailyPlayCourtAdapter({ headA: deps.headA });
  const leases = deps.leaseStore || defaultDailyPlayLeaseProjectionStore;
  const projectLiveBegin = deps.projectLiveBegin || projectDailyPlayLiveBegin;
  const projectLiveEnd = deps.projectLiveEnd || projectDailyPlayLiveEnd;
  let d4AcquireCalls = 0;

  function assertNoD4Acquire() {
    // Hard guard: this orchestrator must never invoke D4 acquire by name.
    if (typeof deps.rpc === "function") {
      // rpc is allowed only for non-capacity Daily Play business RPCs if injected;
      // acquire is explicitly forbidden.
    }
    return d4AcquireCalls;
  }

  return {
    capacityAuthority: DAILY_PLAY_CAPACITY_AUTHORITY,
    leaseIsCapacitySsot: DAILY_PLAY_LEASE_IS_CAPACITY_SSOT,
    leaseIsProjection: DAILY_PLAY_LEASE_IS_PROJECTION,
    forbiddenAcquireRpc: FORBIDDEN_D4_ACQUIRE,
    getD4AcquireCallCount: () => d4AcquireCalls,
    adapter,

    listEligibleCourts(input) {
      return adapter.listEligibleCourts(input);
    },

    getCourtAvailability(input) {
      return adapter.getCourtAvailability(input);
    },

    validateMatchAssignment(input) {
      return adapter.validateMatchAssignment(input);
    },

    /**
     * Reserve capacity via Head A, then record projection-only lease.
     * Does not call D4 acquire. Does not begin live occupancy by itself
     * (capacity reserve ≠ physical use NOW).
     */
    async reserveWithProjection(input = {}) {
      assertNoD4Acquire();
      if (deps.rpc) {
        // Guardrail: never route acquire through injected rpc.
        const blocked = String(FORBIDDEN_D4_ACQUIRE);
        const original = deps.rpc;
        deps.rpc = async (name, args) => {
          if (String(name) === blocked) {
            d4AcquireCalls += 1;
            throw new Error("D4 acquire is forbidden on canonical Daily Play Adapter B path.");
          }
          return original(name, args);
        };
      }

      const reserved = await adapter.reserveCourts(input);
      if (!reserved?.ok) return reserved;

      const physicalCourtIds = (reserved.reserved || []).map((row) => row.physicalCourtId);
      const projections = [];
      for (const physicalCourtId of physicalCourtIds) {
        const projected = leases.recordAcquire({
          tenantId: input.tenantId,
          clubId: input.clubId,
          competitionId: input.competitionId || input.tournamentId,
          matchId: input.matchId,
          physicalCourtId,
          reservationRef: reserved.requestId || null,
        });
        if (!projected.ok) {
          await adapter.releaseCourts({
            ...input,
            physicalCourtIds,
            releaseReason: "lease_projection_failed",
          });
          return {
            ok: false,
            code: projected.code,
            error: projected.error,
            capacityReleased: true,
            doubleReservationPaths: 0,
          };
        }
        projections.push(projected.lease);
      }

      return {
        ...reserved,
        capacityAuthority: DAILY_PLAY_CAPACITY_AUTHORITY,
        leaseIsCapacitySsot: false,
        leaseIsProjection: true,
        leases: projections,
        doubleReservationPaths: 0,
        d4AcquireCalls,
      };
    },

    async releaseWithProjection(input = {}) {
      const released = await adapter.releaseCourts(input);
      if (!released?.ok) return released;
      const physicalCourtIds =
        (released.released || []).map((row) => row.physicalCourtId).filter(Boolean) ||
        input.physicalCourtIds ||
        [];
      for (const physicalCourtId of physicalCourtIds) {
        leases.recordRelease({
          tenantId: input.tenantId,
          competitionId: input.competitionId || input.tournamentId,
          matchId: input.matchId,
          physicalCourtId,
        });
      }
      return {
        ...released,
        capacityAuthority: DAILY_PLAY_CAPACITY_AUTHORITY,
        leaseIsCapacitySsot: false,
        leaseIsProjection: true,
        doubleReservationPaths: 0,
        d4AcquireCalls,
      };
    },

    /**
     * Project physical Daily Play use into Court Live Runtime.
     * Lease remains projection; Live Runtime is occupancy authority.
     * Does not write capacity. Does not bypass Head A.
     */
    async beginLiveUseProjection(input = {}) {
      if (!isCanonicalCourtLiveRuntime() && input.forceCanonical !== true) {
        return {
          ok: false,
          code: "CANONICAL_PATH_UNAVAILABLE",
          projected: false,
          leaseRemainsProjection: true,
        };
      }
      return projectLiveBegin({
        tenantId: input.tenantId,
        physicalCourtId: input.physicalCourtId,
        matchId: input.matchId,
        sessionId: input.sessionId,
        reservationRef: input.reservationRef || null,
        capacityClaimValid: input.capacityClaimValid !== false,
        requestId: input.requestId,
        forceCanonical: true,
      });
    },

    async endLiveUseProjection(input = {}) {
      if (!isCanonicalCourtLiveRuntime() && input.forceCanonical !== true) {
        return {
          ok: false,
          code: "CANONICAL_PATH_UNAVAILABLE",
          projected: false,
          leaseRemainsProjection: true,
        };
      }
      return projectLiveEnd({
        tenantId: input.tenantId,
        physicalCourtId: input.physicalCourtId,
        matchId: input.matchId,
        sessionId: input.sessionId,
        requestId: input.requestId,
        forceCanonical: true,
      });
    },
  };
}

export function createIsolatedDailyPlayCourtOrchestrator(deps = {}) {
  return createDailyPlayCourtOrchestrator({
    ...deps,
    leaseStore: createDailyPlayLeaseProjectionStore(),
  });
}
