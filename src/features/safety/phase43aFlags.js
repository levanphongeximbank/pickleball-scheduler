/**
 * Phase 43A — safety/isolation feature flag.
 * Default ON. Set VITE_PHASE43A_SAFETY=false to restore legacy queue flush behavior.
 */
function readPhase43aEnv() {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return import.meta.env;
  }
  if (typeof process !== "undefined" && process.env) {
    return process.env;
  }
  return {};
}

export function isPhase43aSafetyEnabled() {
  const raw = String(readPhase43aEnv().VITE_PHASE43A_SAFETY || "").toLowerCase();
  if (raw === "false") {
    return false;
  }
  return true;
}
