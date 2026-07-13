/**
 * TT-6D — staging/debug observability flag.
 * Default false — Production unchanged until explicitly enabled.
 */
export function isTeamTournamentRealtimeDebugEnabled() {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return String(import.meta.env.VITE_TT_REALTIME_DEBUG || "").toLowerCase() === "true";
  }
  if (typeof globalThis.process !== "undefined" && globalThis.process.env) {
    return String(globalThis.process.env.VITE_TT_REALTIME_DEBUG || "").toLowerCase() === "true";
  }
  return false;
}
