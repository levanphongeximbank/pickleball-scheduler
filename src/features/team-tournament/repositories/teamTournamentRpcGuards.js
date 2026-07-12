/**
 * TT-1B server-side guard deployment flags.
 * Cloud repository fail-fast until PHASE_TT1B section 11 SQL is applied on staging.
 */

export const TT1B_RPC_GUARD_METHODS = Object.freeze({
  saveDraftLineup: {
    rpcName: "team_tournament_save_lineup_draft",
    sqlSection: "PHASE_TT1B_TEAM_TOURNAMENT_SSOT.sql §11 save_lineup_draft",
  },
  recalculateStandings: {
    rpcName: "team_tournament_upsert_standings",
    sqlSection: "PHASE_TT1B_TEAM_TOURNAMENT_SSOT.sql §11 upsert_standings",
  },
});

/** @type {Record<string, boolean>} */
let testGuardOverrides = {};

export function __setTeamTournamentRpcGuardsForTests(overrides = {}) {
  testGuardOverrides = { ...overrides };
}

export function __resetTeamTournamentRpcGuardsForTests() {
  testGuardOverrides = {};
}

function readEnvFlag(name) {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return import.meta.env[name];
  }
  return globalThis.process?.env?.[name];
}

/**
 * @param {'saveDraftLineup'|'recalculateStandings'} methodName
 * @returns {boolean}
 */
export function isTeamTournamentRpcGuardDeployed(methodName) {
  if (methodName in testGuardOverrides) {
    return Boolean(testGuardOverrides[methodName]);
  }

  const globalFlag = String(readEnvFlag("VITE_TEAM_TOURNAMENT_TT1B_RPC_GUARDS") || "").toLowerCase();
  if (globalFlag === "deployed" || globalFlag === "true") {
    return true;
  }

  return false;
}

/**
 * @param {'saveDraftLineup'|'recalculateStandings'} methodName
 */
export function describeTeamTournamentRpcGuard(methodName) {
  return TT1B_RPC_GUARD_METHODS[methodName];
}
