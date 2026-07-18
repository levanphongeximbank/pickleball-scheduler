/**
 * Adapt club_data_v3.data.players[] row → player profile partial (read-only).
 */
import { normalizePlayerGender } from "./genderAdapter.js";

/**
 * @param {object|null|undefined} player
 * @param {object} [context]
 * @param {string|null} [context.clubId]
 * @returns {object|null}
 */
export function adaptBlobPlayerRow(player, context = {}) {
  if (!player || typeof player !== "object") return null;

  const playerId = String(player.id || player.playerId || "").trim() || null;
  if (!playerId) return null;

  const authUserId =
    String(player.authUserId || player.auth_user_id || player.userId || player.user_id || "").trim() ||
    null;

  const genderRaw = player.gender;
  const hasGender = genderRaw !== undefined && genderRaw !== null && String(genderRaw).trim() !== "";

  const clubId = context.clubId ? String(context.clubId).trim() : null;

  return {
    source: "club_data_v3.players",
    playerId,
    authUserId,
    displayName: player.name || player.displayName || null,
    phone: player.phone ?? null,
    gender: hasGender ? normalizePlayerGender(genderRaw) : null,
    profileStatus: player.status ?? null,
    clubMembershipReferences: clubId
      ? [
          {
            clubId,
            playerId,
            status: player.status || null,
          },
        ]
      : [],
    sourceReferences: [
      {
        source: "club_data_v3.players",
        playerId,
        clubId,
      },
    ],
  };
}
