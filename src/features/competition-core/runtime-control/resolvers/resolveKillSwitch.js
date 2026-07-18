/**
 * Kill-switch evaluation from flag snapshot + overrides (pure data).
 */

import { RUNTIME_SCOPE } from "../constants/runtimeScopes.js";
import { RUNTIME_DECISION_CODE } from "../constants/runtimeDecisionCodes.js";
import {
  CAPABILITY_FLAG_KEY,
  FORMAT_FLAG_KEY,
} from "../constants/runtimeScopes.js";

/**
 * @typedef {Object} KillSwitchHit
 * @property {boolean} active
 * @property {string|null} reasonCode
 * @property {string|null} scope
 * @property {string|null} detail
 */

/**
 * @param {object} input
 * @param {import('../contracts/executionContext.js').ExecutionContext} input.context
 * @param {import('../contracts/featureFlagSnapshot.js').FeatureFlagSnapshot} input.flags
 * @param {object[]} [input.overrides]
 * @returns {KillSwitchHit}
 */
export function resolveKillSwitch({ context, flags, overrides = [] }) {
  if (flags?.global?.killSwitch === true) {
    return {
      active: true,
      reasonCode: RUNTIME_DECISION_CODE.GLOBAL_KILL_SWITCH,
      scope: RUNTIME_SCOPE.GLOBAL,
      detail: "global.killSwitch",
    };
  }

  for (const ov of overrides) {
    if (ov?.killSwitch !== true) continue;
    if (ov.scope === RUNTIME_SCOPE.GLOBAL) {
      return {
        active: true,
        reasonCode: RUNTIME_DECISION_CODE.GLOBAL_KILL_SWITCH,
        scope: RUNTIME_SCOPE.GLOBAL,
        detail: "override.global",
      };
    }
  }

  const competitionId = context?.competitionId;
  if (competitionId && flags?.competitions?.[competitionId]?.killSwitch === true) {
    return {
      active: true,
      reasonCode: RUNTIME_DECISION_CODE.COMPETITION_KILL_SWITCH,
      scope: RUNTIME_SCOPE.COMPETITION,
      detail: competitionId,
    };
  }
  for (const ov of overrides) {
    if (
      ov?.killSwitch === true &&
      ov.scope === RUNTIME_SCOPE.COMPETITION &&
      ov.scopeId === competitionId
    ) {
      return {
        active: true,
        reasonCode: RUNTIME_DECISION_CODE.COMPETITION_KILL_SWITCH,
        scope: RUNTIME_SCOPE.COMPETITION,
        detail: competitionId,
      };
    }
  }

  const tenantId = context?.tenantId;
  if (tenantId && flags?.tenants?.[tenantId]?.killSwitch === true) {
    return {
      active: true,
      reasonCode: RUNTIME_DECISION_CODE.TENANT_KILL_SWITCH,
      scope: RUNTIME_SCOPE.TENANT,
      detail: tenantId,
    };
  }
  for (const ov of overrides) {
    if (
      ov?.killSwitch === true &&
      ov.scope === RUNTIME_SCOPE.TENANT &&
      ov.scopeId === tenantId
    ) {
      return {
        active: true,
        reasonCode: RUNTIME_DECISION_CODE.TENANT_KILL_SWITCH,
        scope: RUNTIME_SCOPE.TENANT,
        detail: tenantId,
      };
    }
  }

  const formatKey = FORMAT_FLAG_KEY[context?.format];
  if (formatKey && flags?.formats?.[`${formatKey}KillSwitch`] === true) {
    return {
      active: true,
      reasonCode: RUNTIME_DECISION_CODE.FORMAT_KILL_SWITCH,
      scope: RUNTIME_SCOPE.FORMAT,
      detail: formatKey,
    };
  }
  for (const ov of overrides) {
    if (
      ov?.killSwitch === true &&
      ov.scope === RUNTIME_SCOPE.FORMAT &&
      (ov.format === context?.format || ov.scopeId === context?.format)
    ) {
      return {
        active: true,
        reasonCode: RUNTIME_DECISION_CODE.FORMAT_KILL_SWITCH,
        scope: RUNTIME_SCOPE.FORMAT,
        detail: context?.format,
      };
    }
  }

  const capKey = CAPABILITY_FLAG_KEY[context?.capability];
  if (capKey && flags?.capabilities?.[`${capKey}KillSwitch`] === true) {
    return {
      active: true,
      reasonCode: RUNTIME_DECISION_CODE.CAPABILITY_KILL_SWITCH,
      scope: RUNTIME_SCOPE.CAPABILITY,
      detail: capKey,
    };
  }
  for (const ov of overrides) {
    if (
      ov?.killSwitch === true &&
      ov.scope === RUNTIME_SCOPE.CAPABILITY &&
      (ov.capability === context?.capability || ov.scopeId === context?.capability)
    ) {
      return {
        active: true,
        reasonCode: RUNTIME_DECISION_CODE.CAPABILITY_KILL_SWITCH,
        scope: RUNTIME_SCOPE.CAPABILITY,
        detail: context?.capability,
      };
    }
  }

  return {
    active: false,
    reasonCode: null,
    scope: null,
    detail: null,
  };
}
