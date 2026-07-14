/**
 * TT-6B — single feature flag for Team Tournament Realtime.
 * Default false when unset — Production unchanged until explicitly enabled.
 *
 * S2-G: stage policy lives in teamRealtimeEnableGatesEngine.js
 * (Staging/Preview may set true; Production remains Owner-gated).
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

/** Read env bag for gate evaluation (browser or Node tests). */
export function readTeamTournamentRealtimeEnv() {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return { ...import.meta.env };
  }
  if (typeof globalThis.process !== "undefined" && globalThis.process.env) {
    return { ...globalThis.process.env };
  }
  return {};
}
