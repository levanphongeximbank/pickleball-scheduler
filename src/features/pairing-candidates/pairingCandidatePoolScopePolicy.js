/**
 * Candidate directory scope policy — Phase 2E authz integrity.
 *
 * Same authorized club/tenant refresh may keep the visible list.
 * Real club/tenant switch or empty scope (logout / access loss) must clear.
 */

export function resolvePairingCandidatePoolScopePolicy({
  nextScopeId = "",
  prevScopeId = "",
} = {}) {
  const next = String(nextScopeId || "").trim();
  const prev = String(prevScopeId || "").trim();

  if (!next) {
    return {
      mode: "clear",
      keepPlayers: false,
      reason: prev ? "scope_cleared" : "no_scope",
    };
  }

  if (prev && prev !== next) {
    return {
      mode: "switch",
      keepPlayers: false,
      reason: "scope_changed",
    };
  }

  return {
    mode: "reload",
    keepPlayers: Boolean(prev) && prev === next,
    reason: prev === next ? "same_scope_refresh" : "initial_load",
  };
}
