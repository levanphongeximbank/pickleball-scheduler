/**
 * Phase 1B write surface guard — facade is read-only.
 * Intentionally no create/update/delete exports from this module.
 */

export const PLAYER_FACADE_MODE = Object.freeze({
  READ_ONLY: "read_only",
  PHASE: "1B",
});

/**
 * @returns {{ allowed: false, reason: string }}
 */
export function assertReadOnlyFacade(operation = "write") {
  return {
    allowed: false,
    reason: `Player Management Phase 1B is read-only; '${operation}' is not available.`,
  };
}

/**
 * Explicit no-op stubs so accidental write imports fail closed.
 */
export function createPlayerProfile() {
  return assertReadOnlyFacade("createPlayerProfile");
}

export function updatePlayerProfile() {
  return assertReadOnlyFacade("updatePlayerProfile");
}

export function deletePlayerProfile() {
  return assertReadOnlyFacade("deletePlayerProfile");
}
