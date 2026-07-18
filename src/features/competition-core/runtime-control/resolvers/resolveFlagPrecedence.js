/**
 * Flag precedence evaluation (Phase 3A.1).
 * Does not activate non-LEGACY modes — only computes reason / blocking scope.
 */

import {
  RUNTIME_SCOPE,
  CAPABILITY_FLAG_KEY,
  FORMAT_FLAG_KEY,
} from "../constants/runtimeScopes.js";
import { RUNTIME_DECISION_CODE } from "../constants/runtimeDecisionCodes.js";
import { RUNTIME_MODE, isRuntimeMode } from "../contracts/runtimeModes.js";
import { resolveKillSwitch } from "./resolveKillSwitch.js";

/**
 * @typedef {Object} PrecedenceResult
 * @property {string} reasonCode
 * @property {Array<{ scope: string, result: string, detail?: string }>} evaluatedScopes
 * @property {boolean} wouldAllowCanonicalPath
 * @property {boolean} wouldAllowShadow
 * @property {string|null} requestedMode
 */

/**
 * @param {object} input
 * @returns {PrecedenceResult}
 */
export function resolveFlagPrecedence({ context, flags, overrides = [] }) {
  /** @type {Array<{ scope: string, result: string, detail?: string }>} */
  const evaluatedScopes = [];

  const kill = resolveKillSwitch({ context, flags, overrides });
  if (kill.active) {
    evaluatedScopes.push({
      scope: kill.scope || RUNTIME_SCOPE.GLOBAL,
      result: "KILL_SWITCH",
      detail: kill.detail || undefined,
    });
    return {
      reasonCode: kill.reasonCode || RUNTIME_DECISION_CODE.GLOBAL_KILL_SWITCH,
      evaluatedScopes,
      wouldAllowCanonicalPath: false,
      wouldAllowShadow: false,
      requestedMode: RUNTIME_MODE.LEGACY_ONLY,
    };
  }
  evaluatedScopes.push({ scope: RUNTIME_SCOPE.GLOBAL, result: "KILL_SWITCH_CLEAR" });

  if (!flags?.global?.enabled) {
    evaluatedScopes.push({
      scope: RUNTIME_SCOPE.GLOBAL,
      result: "DISABLED",
      detail: "global.enabled=false",
    });
    return {
      reasonCode: RUNTIME_DECISION_CODE.GLOBAL_DISABLED,
      evaluatedScopes,
      wouldAllowCanonicalPath: false,
      wouldAllowShadow: false,
      requestedMode: RUNTIME_MODE.LEGACY_ONLY,
    };
  }
  evaluatedScopes.push({ scope: RUNTIME_SCOPE.GLOBAL, result: "ENABLED" });

  if (flags?.rollback?.active) {
    const target = isRuntimeMode(flags.rollback.targetMode)
      ? flags.rollback.targetMode
      : RUNTIME_MODE.LEGACY_ONLY;
    evaluatedScopes.push({
      scope: RUNTIME_SCOPE.GLOBAL,
      result: "ROLLBACK",
      detail: target,
    });
    return {
      reasonCode: RUNTIME_DECISION_CODE.ROLLBACK_ACTIVE,
      evaluatedScopes,
      wouldAllowCanonicalPath: false,
      wouldAllowShadow: false,
      requestedMode: target === RUNTIME_MODE.LEGACY_FALLBACK
        ? RUNTIME_MODE.LEGACY_FALLBACK
        : RUNTIME_MODE.LEGACY_ONLY,
    };
  }

  const competitionId = context?.competitionId;
  const competitionFlag = competitionId ? flags?.competitions?.[competitionId] : null;
  if (competitionFlag && competitionFlag.enabled === false) {
    evaluatedScopes.push({
      scope: RUNTIME_SCOPE.COMPETITION,
      result: "DISABLED",
      detail: competitionId,
    });
    return {
      reasonCode: RUNTIME_DECISION_CODE.COMPETITION_DISABLED,
      evaluatedScopes,
      wouldAllowCanonicalPath: false,
      wouldAllowShadow: false,
      requestedMode: RUNTIME_MODE.LEGACY_ONLY,
    };
  }
  for (const ov of overrides) {
    if (
      ov.scope === RUNTIME_SCOPE.COMPETITION &&
      ov.scopeId === competitionId &&
      ov.enabled === false
    ) {
      evaluatedScopes.push({
        scope: RUNTIME_SCOPE.COMPETITION,
        result: "DISABLED",
        detail: "override",
      });
      return {
        reasonCode: RUNTIME_DECISION_CODE.COMPETITION_DISABLED,
        evaluatedScopes,
        wouldAllowCanonicalPath: false,
        wouldAllowShadow: false,
        requestedMode: RUNTIME_MODE.LEGACY_ONLY,
      };
    }
  }
  if (competitionId) {
    evaluatedScopes.push({
      scope: RUNTIME_SCOPE.COMPETITION,
      result: competitionFlag?.enabled === true ? "ENABLED" : "UNSET",
      detail: competitionId,
    });
  }

  const tenantId = context?.tenantId;
  const tenantFlag = tenantId ? flags?.tenants?.[tenantId] : null;
  if (tenantFlag && tenantFlag.enabled === false) {
    evaluatedScopes.push({
      scope: RUNTIME_SCOPE.TENANT,
      result: "DISABLED",
      detail: tenantId,
    });
    return {
      reasonCode: RUNTIME_DECISION_CODE.TENANT_DISABLED,
      evaluatedScopes,
      wouldAllowCanonicalPath: false,
      wouldAllowShadow: false,
      requestedMode: RUNTIME_MODE.LEGACY_ONLY,
    };
  }
  for (const ov of overrides) {
    if (
      ov.scope === RUNTIME_SCOPE.TENANT &&
      ov.scopeId === tenantId &&
      ov.enabled === false
    ) {
      evaluatedScopes.push({
        scope: RUNTIME_SCOPE.TENANT,
        result: "DISABLED",
        detail: "override",
      });
      return {
        reasonCode: RUNTIME_DECISION_CODE.TENANT_DISABLED,
        evaluatedScopes,
        wouldAllowCanonicalPath: false,
        wouldAllowShadow: false,
        requestedMode: RUNTIME_MODE.LEGACY_ONLY,
      };
    }
  }
  if (tenantId) {
    evaluatedScopes.push({
      scope: RUNTIME_SCOPE.TENANT,
      result: tenantFlag?.enabled === true ? "ENABLED" : "UNSET",
      detail: tenantId,
    });
  }

  const formatKey = FORMAT_FLAG_KEY[context?.format];
  const formatEnabled = formatKey ? flags?.formats?.[formatKey] === true : false;
  if (!formatEnabled) {
    evaluatedScopes.push({
      scope: RUNTIME_SCOPE.FORMAT,
      result: "DISABLED",
      detail: formatKey || context?.format,
    });
    return {
      reasonCode: RUNTIME_DECISION_CODE.FORMAT_DISABLED,
      evaluatedScopes,
      wouldAllowCanonicalPath: false,
      wouldAllowShadow: false,
      requestedMode: RUNTIME_MODE.LEGACY_ONLY,
    };
  }
  evaluatedScopes.push({
    scope: RUNTIME_SCOPE.FORMAT,
    result: "ENABLED",
    detail: formatKey,
  });

  const capKey = CAPABILITY_FLAG_KEY[context?.capability];
  const capabilityEnabled = capKey ? flags?.capabilities?.[capKey] === true : false;
  if (!capabilityEnabled) {
    evaluatedScopes.push({
      scope: RUNTIME_SCOPE.CAPABILITY,
      result: "DISABLED",
      detail: capKey || context?.capability,
    });
    return {
      reasonCode: RUNTIME_DECISION_CODE.CAPABILITY_DISABLED,
      evaluatedScopes,
      wouldAllowCanonicalPath: false,
      wouldAllowShadow: false,
      requestedMode: RUNTIME_MODE.LEGACY_ONLY,
    };
  }
  evaluatedScopes.push({
    scope: RUNTIME_SCOPE.CAPABILITY,
    result: "ENABLED",
    detail: capKey,
  });

  const shadowEnabled = flags?.shadow?.enabled === true;
  evaluatedScopes.push({
    scope: RUNTIME_SCOPE.GLOBAL,
    result: shadowEnabled ? "SHADOW_ENABLED" : "SHADOW_DISABLED",
  });

  let requestedMode = RUNTIME_MODE.SHADOW;
  if (competitionFlag && isRuntimeMode(competitionFlag.runtimeMode)) {
    requestedMode = competitionFlag.runtimeMode;
    evaluatedScopes.push({
      scope: RUNTIME_SCOPE.COMPETITION,
      result: "MODE_REQUEST",
      detail: requestedMode,
    });
  }

  if (!shadowEnabled && requestedMode === RUNTIME_MODE.SHADOW) {
    return {
      reasonCode: RUNTIME_DECISION_CODE.SHADOW_DISABLED,
      evaluatedScopes,
      wouldAllowCanonicalPath: true,
      wouldAllowShadow: false,
      requestedMode: RUNTIME_MODE.LEGACY_ONLY,
    };
  }

  return {
    reasonCode: RUNTIME_DECISION_CODE.CANONICAL_NOT_AVAILABLE,
    evaluatedScopes,
    wouldAllowCanonicalPath: true,
    wouldAllowShadow: shadowEnabled,
    requestedMode,
  };
}

export function resolveRuntimeMode(input) {
  return resolveFlagPrecedence(input);
}
