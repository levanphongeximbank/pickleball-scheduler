/**
 * P1.2 S1-E — setup mutation v7 foundation feature gate.
 *
 * Disposition after post-#417 regression closure: RETIRE default ON.
 * Canonical setup writers (update_setup_config, groups.replace, save_draft,
 * discipline.*) are Staging-certified. An OFF-by-default switch left Preview
 * unable to persist Format/Venue, captain confirm, or Save Draft.
 *
 * Explicit env false/0/off remains an emergency kill-switch.
 * Missing RPC still fails closed — this gate does not invent writers.
 */

import { SETUP_MUTATION_CODES } from "./setupMutationCodes.js";

export const SETUP_MUTATION_GATE_ENV = "VITE_TEAM_TOURNAMENT_SETUP_MUTATION_V7";

export const SETUP_MUTATION_GATE_META = Object.freeze({
  env: SETUP_MUTATION_GATE_ENV,
  default: "ON",
  killSwitch: true,
  ownership: "Team Tournament V6 — P1.2 S1-D/S1-E foundation",
  retirementPoint:
    "Retired to default ON after P1.3 Discipline/Groups/Matchups/Schedule RPCs + #417 create/read were Staging-certified. Explicit OFF remains a kill-switch.",
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

const EXPLICIT_OFF = new Set(["0", "false", "off", "no", "disabled"]);

/**
 * @param {Record<string, string|undefined>} [envSource]
 * @returns {boolean}
 */
export function isSetupMutationFoundationEnabled(envSource) {
  const raw = readEnvFlag(SETUP_MUTATION_GATE_ENV, envSource);
  if (raw == null || String(raw).trim() === "") {
    return true;
  }
  return !EXPLICIT_OFF.has(String(raw).trim().toLowerCase());
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
      "Setup mutation v7 đang tắt (VITE_TEAM_TOURNAMENT_SETUP_MUTATION_V7=false). " +
      "Kill-switch khẩn cấp — không ghi setup domain.",
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
        "Setup mutation v7 đang tắt (VITE_TEAM_TOURNAMENT_SETUP_MUTATION_V7=false). " +
        "Không ghi đội/đội trưởng/bảng một phần.",
      writeAttempted: false,
      gateEnabled: false,
    };
  }
  return { ok: true, gateEnabled: true };
}

/**
 * Hard-cutover: default ON. Do not restore OFF-by-default.
 */
export const V7_GATE_RETIREMENT_RECOMMENDATION =
  "RETIRE_DEFAULT_ON_EXPLICIT_OFF_KILLSWITCH";
