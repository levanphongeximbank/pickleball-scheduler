/**
 * Private Pairing rating resolution under platform hard cutover.
 * Hard cutover OFF keeps legacy silent 3.5 default.
 * Hard cutover ON: no silent invent — warn / exclude / fail-closed.
 */

import { isPlatformHardCutoverEnabled } from "../../platform-hard-cutover/runtimeAuthorityMatrix.js";
import { PRIVATE_PAIRING_RUNTIME_CODE } from "./runtimeCodes.js";

export const LEGACY_PRIVATE_PAIRING_RATING_DEFAULT = 3.5;

/**
 * @param {object|null|undefined} player
 * @returns {number|null}
 */
export function extractRawPrivatePairingRating(player) {
  const raw = player?.rating ?? player?.level ?? player?.skillLevel;
  if (raw === null || raw === undefined || raw === "") {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/**
 * @param {object|null|undefined} player
 * @param {{ hardCutover?: boolean, env?: Record<string, unknown>|null }} [options]
 * @returns {{
 *   ok: boolean,
 *   rating: number|null,
 *   defaulted: boolean,
 *   excluded?: boolean,
 *   code?: string,
 *   playerId?: string,
 * }}
 */
export function resolvePrivatePairingPlayerRating(player, options = {}) {
  const hardCutover =
    options.hardCutover === true ||
    (options.hardCutover !== false && isPlatformHardCutoverEnabled(options.env));
  const playerId = String(player?.playerId || player?.id || "").trim() || null;
  const rating = extractRawPrivatePairingRating(player);

  if (rating != null) {
    return { ok: true, rating, defaulted: false, playerId };
  }

  if (!hardCutover) {
    return {
      ok: true,
      rating: LEGACY_PRIVATE_PAIRING_RATING_DEFAULT,
      defaulted: true,
      code: PRIVATE_PAIRING_RUNTIME_CODE.MISSING_RATING_LEGACY_DEFAULT,
      playerId,
    };
  }

  return {
    ok: false,
    rating: null,
    defaulted: false,
    excluded: true,
    code: PRIVATE_PAIRING_RUNTIME_CODE.MISSING_PLAYER_RATING,
    playerId,
  };
}

/**
 * Partition players for team generation under hard-cutover rating policy.
 * @param {object[]} players
 * @param {{ hardCutover?: boolean, env?: Record<string, unknown>|null }} [options]
 */
export function partitionPlayersByPrivatePairingRating(players = [], options = {}) {
  const eligible = [];
  const excluded = [];
  const warnings = [];

  for (const player of players || []) {
    const resolved = resolvePrivatePairingPlayerRating(player, options);
    if (resolved.ok) {
      eligible.push(player);
      if (resolved.defaulted) {
        warnings.push({
          code: resolved.code,
          playerId: resolved.playerId,
          defaultRating: resolved.rating,
        });
      }
      continue;
    }
    excluded.push(player);
    warnings.push({
      code: resolved.code || PRIVATE_PAIRING_RUNTIME_CODE.MISSING_PLAYER_RATING,
      playerId: resolved.playerId,
    });
  }

  return { eligible, excluded, warnings };
}
