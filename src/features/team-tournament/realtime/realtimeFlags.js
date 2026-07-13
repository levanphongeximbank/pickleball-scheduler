/**
 * TT-6B — single feature flag for Team Tournament Realtime.
 * Default false when unset — Production unchanged until explicitly enabled.
 */
export function isTeamTournamentRealtimeEnabled() {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return String(import.meta.env.VITE_TT_REALTIME_ENABLED || "").toLowerCase() === "true";
  }
  if (typeof globalThis.process !== "undefined" && globalThis.process.env) {
    return String(globalThis.process.env.VITE_TT_REALTIME_ENABLED || "").toLowerCase() === "true";
  }
  return false;
}
