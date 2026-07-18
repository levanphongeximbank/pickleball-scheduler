/**
 * Display selectors — pure reads over normalized profiles.
 */

/**
 * @param {object|null|undefined} profile
 * @returns {string}
 */
export function selectDisplayName(profile) {
  if (!profile || typeof profile !== "object") return "";
  return String(profile.displayName || profile.fullName || profile.playerId || "").trim();
}

/**
 * @param {object|null|undefined} profile
 * @returns {"male"|"female"|"unknown"|null}
 */
export function selectGender(profile) {
  if (!profile || typeof profile !== "object") return null;
  return profile.gender ?? null;
}
