/**
 * Adapt Identity `profiles` row → player profile partial (read-only).
 * Account fields remain owned by Identity; Player Management only normalizes reads.
 */
import { normalizePlayerGender } from "./genderAdapter.js";

/**
 * @param {object|null|undefined} profile
 * @returns {object|null}
 */
export function adaptProfileRow(profile) {
  if (!profile || typeof profile !== "object") return null;

  const authUserId = String(profile.id || profile.user_id || profile.userId || "").trim() || null;
  const mappedPlayerId =
    String(profile.player_id || profile.playerId || "").trim() || null;

  const genderRaw = profile.gender;
  const hasGender = genderRaw !== undefined && genderRaw !== null && String(genderRaw).trim() !== "";

  return {
    source: "profiles",
    playerId: mappedPlayerId,
    authUserId,
    displayName: profile.display_name || profile.displayName || null,
    phone: profile.phone ?? null,
    email: profile.email ?? null,
    avatarUrl: profile.avatar_url || profile.avatarUrl || null,
    gender: hasGender ? normalizePlayerGender(genderRaw) : null,
    birthYear: profile.birth_year ?? profile.birthYear ?? null,
    accountStatus: profile.status ?? null,
    // profiles.status is account status — not profileStatus
    profileStatus: null,
    sourceReferences: [
      {
        source: "profiles",
        id: authUserId,
        playerId: mappedPlayerId,
      },
    ],
  };
}
