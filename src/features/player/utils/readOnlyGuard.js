/**
 * Phase 1B/1C write surface notes.
 * create/delete remain closed. updatePlayerProfile lives in services/ (Phase 1C).
 */

export const PLAYER_FACADE_MODE = Object.freeze({
  READ_ONLY_CREATE_DELETE: "read_only_create_delete",
  PHASE: "1C",
});

/**
 * @returns {{ allowed: false, reason: string }}
 */
export function assertCreateDeleteClosed(operation = "write") {
  return {
    allowed: false,
    reason: `Player Management does not allow '${operation}' in Phase 1C; use updatePlayerProfile for owned field patches only.`,
  };
}

export function createPlayerProfile() {
  return assertCreateDeleteClosed("createPlayerProfile");
}

export function deletePlayerProfile() {
  return assertCreateDeleteClosed("deletePlayerProfile");
}
