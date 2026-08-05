import { getPlayerGenderKey, normalizePlayer } from "../../models/player.js";
import { PLAYER_TYPE } from "../../models/tournament/constants.js";

/**
 * Build the guest player payload for QuickAdd persist.
 * Always stores canonical gender (male|female|other|null) — never Nam/Nữ.
 * @param {{ name?: string, gender?: unknown, level?: number, phone?: string, clubName?: string }} form
 * @param {{ id?: string|number }} [options]
 */
export function buildTournamentQuickAddPlayer(form = {}, options = {}) {
  const name = String(form.name || "").trim();
  const gender = getPlayerGenderKey(form.gender);
  const level = Number(form.level) || 3.5;
  return normalizePlayer({
    id: options.id ?? Date.now(),
    name,
    gender,
    level,
    rating: level,
    phone: String(form.phone || "").trim(),
    clubName: String(form.clubName || "").trim(),
    playerType: PLAYER_TYPE.GUEST,
  });
}
