/**
 * NON-DISCOVERY — legacy guest append write only.
 *
 * Must NEVER be used as athlete-pool SSOT, picker population, or name authority.
 * Team Tournament discovery SSOT:
 *   teamTournamentAthletePoolService.listAvailableAthletes
 *
 * Guest create still persists a local club-blob row so Quick-Add can hand the
 * new guest object back to the open picker session. That blob row is not a
 * canonical athlete identity until mapped via pairing gateway / athletes.id.
 */

import { loadPlayersForClub, savePlayersForClub } from "./clubStorage.js";

/**
 * @param {string} hostClubId
 * @param {object} player — normalized guest player (local blob shape)
 * @returns {{ ok: true, player: object, source: string } | { ok: false, error: string }}
 */
export function appendGuestPlayerToClubBlobLegacy(hostClubId, player) {
  const clubId = String(hostClubId || "").trim();
  if (!clubId) {
    return { ok: false, error: "Chưa xác định CLB chủ nhà giải." };
  }
  if (!player) {
    return { ok: false, error: "Thiếu hồ sơ VĐV khách." };
  }

  const existing = loadPlayersForClub(clubId);
  savePlayersForClub([...existing, player], clubId);
  return {
    ok: true,
    player,
    source: "legacy-guest-blob-write-non-discovery",
  };
}
