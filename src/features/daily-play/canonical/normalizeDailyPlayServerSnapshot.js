/**
 * Normalize Daily Play RPC payloads into the stable client session contract.
 *
 * Real SQL `daily_play_get_state` returns:
 *   { ok, tournamentId, state, courts, activeLeases, occupiedCourtIds }
 *
 * In-memory authority may already return a richer client-ready shape.
 * Mutation RPCs return compact { ok, revision, state?, match?, matches? }
 * and must NOT be treated as full session snapshots.
 */

import { DAILY_PLAY_CODE, DAILY_PLAY_LEASE_ACTIVE } from "./dailyPlayCodes.js";
import {
  buildCourtRuntimeView,
  listAvailableCourts,
  normalizeCanonicalCourt,
  normalizeDailyPlayCanonicalState,
  resolveOccupiedCourtIds,
} from "./dailyPlayCanonicalDomain.js";

function normalizeLease(lease = {}, index = 0) {
  const status = String(
    lease.status ||
      (lease.releasedAt || lease.released_at ? "released" : DAILY_PLAY_LEASE_ACTIVE)
  );
  return {
    id: String(lease.id || `lease-${index + 1}`),
    matchId: String(lease.matchId ?? lease.match_id ?? ""),
    courtId: String(lease.courtId ?? lease.court_id ?? ""),
    status,
    leasedAt: lease.leasedAt || lease.leased_at || null,
    releasedAt: lease.releasedAt || lease.released_at || null,
  };
}

function pickDailyPlayRaw(raw = {}) {
  if (raw.dailyPlay && typeof raw.dailyPlay === "object") {
    return raw.dailyPlay;
  }
  if (raw.state && typeof raw.state === "object") {
    return raw.state;
  }
  return {};
}

function pickOccupiedCourtIdsRaw(raw = {}) {
  if (Array.isArray(raw.occupiedCourtIds)) return raw.occupiedCourtIds;
  if (Array.isArray(raw.occupied_court_ids)) return raw.occupied_court_ids;
  return null;
}

function pickLeasesRaw(raw = {}) {
  if (Array.isArray(raw.leases)) return raw.leases;
  if (Array.isArray(raw.activeLeases)) return raw.activeLeases;
  return [];
}

/**
 * @param {object|null|undefined} raw
 * @returns {{ ok: false, code: string, error?: string } | {
 *   ok: true,
 *   tournamentId: string|null,
 *   revision: number,
 *   dailyPlay: object,
 *   courts: object[],
 *   leases: object[],
 *   occupiedCourtIds: string[],
 *   courtStates: object[],
 *   availableCourts: object[],
 *   hasCourtCapability: boolean,
 * }}
 */
export function normalizeDailyPlayServerSnapshot(raw) {
  if (!raw || typeof raw !== "object") {
    return {
      ok: false,
      code: DAILY_PLAY_CODE.VALIDATION,
      error: "Phản hồi Daily Play không hợp lệ.",
    };
  }

  if (raw.ok === false) {
    return raw;
  }

  const dailyPlay = normalizeDailyPlayCanonicalState(pickDailyPlayRaw(raw));
  const courts = (Array.isArray(raw.courts) ? raw.courts : []).map((court, index) =>
    normalizeCanonicalCourt(court, index)
  );
  const leases = pickLeasesRaw(raw).map((lease, index) => normalizeLease(lease, index));
  const occupiedCourtIds = resolveOccupiedCourtIds({
    occupiedCourtIds: pickOccupiedCourtIdsRaw(raw),
    leases,
  });
  const occupancy = { courts, matches: dailyPlay.matches, leases, occupiedCourtIds };
  const courtStates = buildCourtRuntimeView(occupancy);
  const availableCourts = listAvailableCourts(occupancy);

  return {
    ok: true,
    tournamentId:
      raw.tournamentId == null && raw.tournament_id == null
        ? null
        : String(raw.tournamentId ?? raw.tournament_id),
    revision: Number(dailyPlay.revision || 0),
    dailyPlay,
    courts,
    leases,
    occupiedCourtIds,
    courtStates,
    availableCourts,
    hasCourtCapability: courts.length > 0,
  };
}

/**
 * True when payload already looks like a full get_state/client snapshot
 * (has courts array and a dailyPlay/state bag), not a compact mutation result.
 */
export function isFullDailyPlaySnapshot(raw) {
  if (!raw || raw.ok !== true || typeof raw !== "object") return false;
  if (!Array.isArray(raw.courts)) return false;
  return Boolean(raw.dailyPlay || raw.state);
}
