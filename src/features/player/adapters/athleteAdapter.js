/**
 * Adapt Phase 42 `athletes` row → player profile partial (read-only).
 * athletes.id is an alias — not a second person SSOT.
 */
import { normalizePlayerGender } from "./genderAdapter.js";

/**
 * @param {object|null|undefined} athlete
 * @returns {object|null}
 */
export function adaptAthleteRow(athlete) {
  if (!athlete || typeof athlete !== "object") return null;

  const athleteId = String(athlete.id || athlete.athleteId || "").trim() || null;
  if (!athleteId) return null;

  const authUserId =
    String(athlete.user_id || athlete.userId || athlete.authUserId || "").trim() || null;

  const genderRaw = athlete.gender;
  const hasGender = genderRaw !== undefined && genderRaw !== null && String(genderRaw).trim() !== "";

  return {
    source: "athletes",
    athleteId,
    authUserId,
    // Do not invent playerId from athlete UUID
    playerId: athlete.player_id || athlete.playerId || null,
    displayName: athlete.display_name || athlete.displayName || null,
    phone: athlete.phone ?? null,
    gender: hasGender ? normalizePlayerGender(genderRaw) : null,
    profileStatus: athlete.status ?? null,
    sourceReferences: [
      {
        source: "athletes",
        athleteId,
        authUserId,
      },
    ],
  };
}
