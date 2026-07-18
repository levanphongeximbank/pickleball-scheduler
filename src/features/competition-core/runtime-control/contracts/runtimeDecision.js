/**
 * Runtime decision contract (Phase 3A.1).
 */

import { RUNTIME_MODE } from "./runtimeModes.js";
import { RUNTIME_EXECUTOR } from "../constants/runtimeScopes.js";
import { RUNTIME_DECISION_CODE } from "../constants/runtimeDecisionCodes.js";
import { createRuntimeDiagnostic } from "./decisionDiagnostics.js";
import { createRuntimeAuditEvent } from "./auditEvents.js";
import { isPlainObject, cloneJsonSafe } from "./jsonSafe.js";

/**
 * @typedef {Object} RuntimeDecision
 * @property {string} selectedMode
 * @property {string} selectedExecutor
 * @property {boolean} canonicalAllowed
 * @property {boolean} shadowAllowed
 * @property {boolean} fallbackAllowed
 * @property {string} reasonCode
 * @property {Array<{ scope: string, result: string, detail?: string }>} evaluatedScopes
 * @property {import('./decisionDiagnostics.js').RuntimeDiagnostic[]} diagnostics
 * @property {import('./auditEvents.js').RuntimeAuditEvent} auditEvent
 */

/**
 * @param {Partial<RuntimeDecision>|null|undefined} partial
 * @returns {RuntimeDecision}
 */
export function createRuntimeDecision(partial = {}) {
  const diagnostics = Array.isArray(partial?.diagnostics)
    ? partial.diagnostics.map((d) => createRuntimeDiagnostic(d))
    : [];
  const evaluatedScopes = Array.isArray(partial?.evaluatedScopes)
    ? partial.evaluatedScopes
        .filter((s) => isPlainObject(s))
        .map((s) => ({
          scope: typeof s.scope === "string" ? s.scope : "",
          result: typeof s.result === "string" ? s.result : "",
          detail: typeof s.detail === "string" ? s.detail : undefined,
        }))
    : [];

  return {
    selectedMode:
      typeof partial?.selectedMode === "string"
        ? partial.selectedMode
        : RUNTIME_MODE.LEGACY_ONLY,
    selectedExecutor:
      typeof partial?.selectedExecutor === "string"
        ? partial.selectedExecutor
        : RUNTIME_EXECUTOR.LEGACY,
    canonicalAllowed: Boolean(partial?.canonicalAllowed),
    shadowAllowed: Boolean(partial?.shadowAllowed),
    fallbackAllowed:
      typeof partial?.fallbackAllowed === "boolean" ? partial.fallbackAllowed : true,
    reasonCode:
      typeof partial?.reasonCode === "string"
        ? partial.reasonCode
        : RUNTIME_DECISION_CODE.DEFAULT_LEGACY_ONLY,
    evaluatedScopes,
    diagnostics,
    auditEvent: createRuntimeAuditEvent(
      isPlainObject(partial?.auditEvent) ? partial.auditEvent : {}
    ),
  };
}

/**
 * Phase 3A.1 safety clamp — always LEGACY executor / mode.
 * @param {RuntimeDecision} decision
 * @returns {RuntimeDecision}
 */
export function clampDecisionToPhase3A1(decision) {
  const next = createRuntimeDecision({
    ...decision,
    selectedMode: RUNTIME_MODE.LEGACY_ONLY,
    selectedExecutor: RUNTIME_EXECUTOR.LEGACY,
    canonicalAllowed: false,
    shadowAllowed: false,
    fallbackAllowed: true,
    evaluatedScopes: cloneJsonSafe(decision.evaluatedScopes || []),
    diagnostics: decision.diagnostics,
    auditEvent: {
      ...decision.auditEvent,
      selectedMode: RUNTIME_MODE.LEGACY_ONLY,
    },
  });
  return next;
}
