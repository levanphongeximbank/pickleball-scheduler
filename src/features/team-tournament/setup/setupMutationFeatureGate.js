/**
 * P1.2 S1-E — setup mutation v7 foundation feature gate.
 *
 * Default: OFF
 * Ownership: Team Tournament V6 / P1.2 foundation
 * Retirement: after P1.3 domain setup RPCs are Staging-certified
 *             and Production apply is explicitly approved — then remove this
 *             gate or flip default ON only for Production-approved surfaces.
 *
 * Enabling the gate unlocks foundation orchestration + fail-closed transport.
 * It does NOT deploy undeployed domain RPCs and does NOT change default
 * Preview/Production setup write paths (those stay v6 / legacy).
 */

import { SETUP_MUTATION_CODES } from "./setupMutationCodes.js";

export const SETUP_MUTATION_GATE_ENV = "VITE_TEAM_TOURNAMENT_SETUP_MUTATION_V7";

export const SETUP_MUTATION_GATE_META = Object.freeze({
  env: SETUP_MUTATION_GATE_ENV,
  default: "OFF",
  ownership: "Team Tournament V6 — P1.2 S1-D/S1-E foundation",
  retirementPoint:
    "Retire after P1.3 Discipline/Groups/Matchups/Schedule domain RPCs pass Staging QA and Production apply is owner-approved.",
});

function readEnvFlag(name, envSource) {
  if (envSource && Object.prototype.hasOwnProperty.call(envSource, name)) {
    return envSource[name];
  }
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return import.meta.env[name];
  }
  return globalThis.process?.env?.[name];
}

/**
 * @param {Record<string, string|undefined>} [envSource]
 * @returns {boolean}
 */
export function isSetupMutationFoundationEnabled(envSource) {
  const raw = String(readEnvFlag(SETUP_MUTATION_GATE_ENV, envSource) || "")
    .trim()
    .toLowerCase();
  return raw === "true" || raw === "1" || raw === "on" || raw === "enabled";
}

/**
 * @param {Record<string, string|undefined>} [envSource]
 * @returns {{ ok: false, code: string, error: string } | null}
 */
export function rejectIfSetupMutationGateOff(envSource) {
  if (isSetupMutationFoundationEnabled(envSource)) {
    return null;
  }
  return {
    ok: false,
    code: SETUP_MUTATION_CODES.GATE_OFF,
    error:
      "Setup mutation v7 foundation đang tắt (VITE_TEAM_TOURNAMENT_SETUP_MUTATION_V7). " +
      "Default Preview/Production setup writes không đổi.",
  };
}
