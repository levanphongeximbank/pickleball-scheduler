/**
 * PR-4.25 — Canonical Club & Player Repository feature flags.
 * Production default OFF. Prefer injectable envSource in tests.
 */

export const CANONICAL_REPOSITORY_FLAG_KEYS = Object.freeze({
  CLUB: "VITE_CANONICAL_CLUB_REPOSITORY_ENABLED",
  PLAYER: "VITE_CANONICAL_PLAYER_REPOSITORY_ENABLED",
});

/**
 * @param {Record<string, unknown>|undefined|null} [envSource]
 * @param {string} key
 * @returns {boolean}
 */
export function readCanonicalFlag(envSource, key) {
  const source = envSource || (typeof import.meta !== "undefined" ? import.meta.env : {});
  const raw = source?.[key];
  return raw === true || raw === "true" || raw === "1";
}

/**
 * When ON: club list/membership resolution prefer public.clubs / club_members RPCs.
 * @param {Record<string, unknown>|undefined|null} [envSource]
 */
export function isCanonicalClubRepositoryEnabled(envSource) {
  return readCanonicalFlag(envSource, CANONICAL_REPOSITORY_FLAG_KEYS.CLUB);
}

/**
 * When ON: player picker prefers membership-backed CanonicalPlayerRepository.
 * @param {Record<string, unknown>|undefined|null} [envSource]
 */
export function isCanonicalPlayerRepositoryEnabled(envSource) {
  return readCanonicalFlag(envSource, CANONICAL_REPOSITORY_FLAG_KEYS.PLAYER);
}
