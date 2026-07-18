/**
 * searchPlayers — optional low-risk read helper over an injected directory.
 * Does not write; does not invent players; does not silently merge identities.
 */
import { RESOLUTION_OUTCOME } from "../constants/resolutionOutcomes.js";
import { normalizePlayerGender } from "../adapters/genderAdapter.js";
import { adaptBlobPlayerRow } from "../adapters/blobPlayerAdapter.js";
import { normalizePlayerProfile } from "../models/playerProfile.js";
import { trimId } from "../utils/playerId.js";

/**
 * @param {object} [filters]
 * @param {string} [filters.query]
 * @param {string} [filters.clubId]
 * @param {string} [filters.gender] — canonical or legacy; filtered via adapter
 * @param {object} [options]
 * @param {object[]} [options.players] — injected roster (required for deterministic search)
 * @param {number} [options.limit=50]
 */
export function searchPlayers(filters = {}, options = {}) {
  const players = Array.isArray(options.players) ? options.players : [];
  const limit = Math.max(1, Math.min(200, Number(options.limit) || 50));
  const query = trimId(filters.query || filters.q).toLowerCase();
  const genderFilter = filters.gender != null && String(filters.gender).trim() !== ""
    ? normalizePlayerGender(filters.gender)
    : null;
  const clubId = trimId(filters.clubId) || null;

  const results = [];
  for (const row of players) {
    const adapted = adaptBlobPlayerRow(row, { clubId: clubId || row?.clubId || null });
    if (!adapted?.playerId) continue;

    if (genderFilter && normalizePlayerGender(adapted.gender) !== genderFilter) {
      continue;
    }

    if (query) {
      const hay = `${adapted.displayName || ""} ${adapted.playerId} ${adapted.authUserId || ""}`.toLowerCase();
      if (!hay.includes(query)) continue;
    }

    results.push(
      normalizePlayerProfile({
        ...adapted,
        sourceReferences: adapted.sourceReferences,
      })
    );

    if (results.length >= limit) break;
  }

  return {
    ok: true,
    outcome: RESOLUTION_OUTCOME.MAPPED,
    data: results,
    meta: {
      count: results.length,
      limit,
      readOnly: true,
    },
  };
}
