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

/**
 * Fail-closed preflight before any partial team/captain/group write sequence.
 * Does not bypass the gate — returns explicit error when OFF.
 *
 * @param {{ envSource?: Record<string, string|undefined> }} [options]
 * @returns {{ ok: true, gateEnabled: true } | { ok: false, code: string, error: string, writeAttempted: false, gateEnabled: false }}
 */
export function preflightSetupMutationCapability(options = {}) {
  const gateOff = rejectIfSetupMutationGateOff(options.envSource);
  if (gateOff) {
    return {
      ok: false,
      code: gateOff.code,
      error:
        "Setup mutation v7 đang tắt (VITE_TEAM_TOURNAMENT_SETUP_MUTATION_V7). " +
        "Không ghi đội/đội trưởng/bảng một phần. Bật gate sau Owner GO.",
      writeAttempted: false,
      gateEnabled: false,
    };
  }
  return { ok: true, gateEnabled: true };
}

/**
 * Hard-cutover recommendation after certification.
 * Keep gate until setup config + groups.replace are Staging-certified and Owner GO.
 */
export const V7_GATE_RETIREMENT_RECOMMENDATION =
  "KEEP_UNTIL_STAGING_CERTIFIED_THEN_OWNER_GO_DEFAULT_ON — do not silently retire; flip env only after Production apply approval.";

