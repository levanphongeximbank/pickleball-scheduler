/**
 * Player id helpers — parse / validate without minting new stores.
 */
import { buildDerivedAuthPlayerId } from "../../club/repositories/canonicalRepositoryTypes.js";

const AUTH_LINKED_PREFIX = "player-auth-";
const NON_AUTH_PREFIX = "player-";
const ROUTE_PROFILE_PREFIX = "profile-";
const ROUTE_ATHLETE_PREFIX = "athlete-";

/**
 * @param {unknown} value
 * @returns {string}
 */
export function trimId(value) {
  return String(value ?? "").trim();
}

/**
 * @param {unknown} authUserId
 * @returns {string}
 */
export function buildAuthLinkedPlayerId(authUserId) {
  return buildDerivedAuthPlayerId(authUserId);
}

/**
 * @param {unknown} playerId
 * @returns {boolean}
 */
export function isAuthLinkedPlayerId(playerId) {
  const id = trimId(playerId);
  return id.startsWith(AUTH_LINKED_PREFIX) && id.length > AUTH_LINKED_PREFIX.length;
}

/**
 * @param {unknown} playerId
 * @returns {boolean}
 */
export function isNonAuthPlayerId(playerId) {
  const id = trimId(playerId);
  if (!id.startsWith(NON_AUTH_PREFIX) || isAuthLinkedPlayerId(id)) return false;
  return id.length > NON_AUTH_PREFIX.length;
}

/**
 * Route aliases — not canonical player ids.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isRouteAliasId(value) {
  const id = trimId(value);
  return id.startsWith(ROUTE_PROFILE_PREFIX) || id.startsWith(ROUTE_ATHLETE_PREFIX);
}

/**
 * Structurally plausible player id (canonical or legacy opaque roster id).
 * Empty / route aliases are not valid canonical references.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isPlausiblePlayerId(value) {
  const id = trimId(value);
  if (!id) return false;
  if (isRouteAliasId(id)) return false;
  // Reject bare whitespace-only already handled; reject obvious non-ids
  if (id === "null" || id === "undefined") return false;
  return true;
}

/**
 * Extract auth user id from player-auth-{authUserId} when present.
 * @param {unknown} playerId
 * @returns {string|null}
 */
export function authUserIdFromAuthLinkedPlayerId(playerId) {
  const id = trimId(playerId);
  if (!isAuthLinkedPlayerId(id)) return null;
  return id.slice(AUTH_LINKED_PREFIX.length) || null;
}

export const PLAYER_ID_PREFIX = Object.freeze({
  AUTH_LINKED: AUTH_LINKED_PREFIX,
  NON_AUTH: NON_AUTH_PREFIX,
  ROUTE_PROFILE: ROUTE_PROFILE_PREFIX,
  ROUTE_ATHLETE: ROUTE_ATHLETE_PREFIX,
});
