import { createTeamTournamentIdempotencyKey } from "../services/teamTournamentRpcService.js";

/** @type {Map<string, string>} */
const activeCommandKeys = new Map();

/**
 * Stable idempotency key for an in-flight user action (double-click / timeout retry).
 * @param {string} scope e.g. "save-draft:m1:t1"
 */
export function beginUiCommandKey(scope) {
  const key = String(scope || "cmd");
  if (!activeCommandKeys.has(key)) {
    activeCommandKeys.set(key, createTeamTournamentIdempotencyKey("tt1c"));
  }
  return activeCommandKeys.get(key);
}

/** Clear after success or terminal failure so the next action gets a fresh key. */
export function endUiCommandKey(scope) {
  activeCommandKeys.delete(String(scope || "cmd"));
}

export function buildUiCommandScope(action, tournamentId, extra = "") {
  return [action, tournamentId, extra].filter(Boolean).join(":");
}
