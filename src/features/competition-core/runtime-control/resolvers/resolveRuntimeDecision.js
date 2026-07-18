/**
 * Runtime decision resolver — pure, fail-safe to LEGACY_ONLY (Phase 3A.1).
 *
 * Does NOT call legacy or canonical executors.
 * Does NOT read environment variables, system clock, RNG, UI, or databases.
 */

import { createExecutionContext } from "../contracts/executionContext.js";
import { createFeatureFlagSnapshot } from "../contracts/featureFlagSnapshot.js";
import {
  createRuntimeDecision,
  clampDecisionToPhase3A1,
} from "../contracts/runtimeDecision.js";
import { createRuntimeAuditEvent } from "../contracts/auditEvents.js";
import { RUNTIME_MODE } from "../contracts/runtimeModes.js";
import { RUNTIME_EXECUTOR, RUNTIME_CONTROL_VERSION } from "../constants/runtimeScopes.js";
import { RUNTIME_DECISION_CODE } from "../constants/runtimeDecisionCodes.js";
import { cloneJsonSafe } from "../contracts/jsonSafe.js";
import {
  validateExecutionContext,
  validateFeatureFlagSnapshot,
  validateRuntimeOverrides,
} from "../validation/validateExecutionContext.js";
import { resolveFlagPrecedence } from "./resolveFlagPrecedence.js";

/**
 * @param {object} [input]
 * @param {object} [input.context]
 * @param {object} [input.flags]
 * @param {object[]} [input.overrides]
 * @returns {import('../contracts/runtimeDecision.js').RuntimeDecision}
 */
export function resolveRuntimeDecision(input = {}) {
  const diagnostics = [];

  const contextValidation = validateExecutionContext(input.context);
  diagnostics.push(...contextValidation.diagnostics);

  const flagsValidation = validateFeatureFlagSnapshot(input.flags);
  diagnostics.push(...flagsValidation.diagnostics);

  const overridesValidation = validateRuntimeOverrides(input.overrides);
  diagnostics.push(...overridesValidation.diagnostics);

  const context = createExecutionContext(input.context || {});
  const flags = flagsValidation.snapshot || createFeatureFlagSnapshot();
  const overrides = overridesValidation.overrides || [];

  if (!contextValidation.ok) {
    return finalizeDecision({
      context,
      reasonCode: RUNTIME_DECISION_CODE.INVALID_CONTEXT,
      evaluatedScopes: [{ scope: "VALIDATION", result: "INVALID_CONTEXT" }],
      diagnostics,
    });
  }

  if (!flagsValidation.ok) {
    return finalizeDecision({
      context,
      reasonCode: RUNTIME_DECISION_CODE.INVALID_FLAG_SNAPSHOT,
      evaluatedScopes: [{ scope: "VALIDATION", result: "INVALID_FLAG_SNAPSHOT" }],
      diagnostics,
    });
  }

  if (!overridesValidation.ok) {
    return finalizeDecision({
      context,
      reasonCode: RUNTIME_DECISION_CODE.INVALID_OVERRIDE,
      evaluatedScopes: [{ scope: "VALIDATION", result: "INVALID_OVERRIDE" }],
      diagnostics,
    });
  }

  if (
    context.runtimeMode &&
    context.runtimeMode !== RUNTIME_MODE.LEGACY_ONLY &&
    !Object.values(RUNTIME_MODE).includes(context.runtimeMode)
  ) {
    return finalizeDecision({
      context,
      reasonCode: RUNTIME_DECISION_CODE.UNSUPPORTED_RUNTIME_MODE,
      evaluatedScopes: [{ scope: "VALIDATION", result: "UNSUPPORTED_RUNTIME_MODE" }],
      diagnostics,
    });
  }

  const precedence = resolveFlagPrecedence({ context, flags, overrides });

  // Phase 3A.1: never activate non-legacy modes even if flags would allow.
  let reasonCode = precedence.reasonCode;
  if (
    precedence.wouldAllowCanonicalPath &&
    reasonCode !== RUNTIME_DECISION_CODE.SHADOW_DISABLED
  ) {
    reasonCode = RUNTIME_DECISION_CODE.CANONICAL_NOT_AVAILABLE;
  }
  if (
    !flags.global.enabled &&
    reasonCode === RUNTIME_DECISION_CODE.DEFAULT_LEGACY_ONLY
  ) {
    reasonCode = RUNTIME_DECISION_CODE.GLOBAL_DISABLED;
  }

  return finalizeDecision({
    context,
    reasonCode,
    evaluatedScopes: precedence.evaluatedScopes,
    diagnostics,
  });
}

/**
 * @param {object} args
 * @returns {import('../contracts/runtimeDecision.js').RuntimeDecision}
 */
function finalizeDecision({ context, reasonCode, evaluatedScopes, diagnostics }) {
  const decision = createRuntimeDecision({
    selectedMode: RUNTIME_MODE.LEGACY_ONLY,
    selectedExecutor: RUNTIME_EXECUTOR.LEGACY,
    canonicalAllowed: false,
    shadowAllowed: false,
    fallbackAllowed: true,
    reasonCode,
    evaluatedScopes: cloneJsonSafe(evaluatedScopes || []),
    diagnostics: cloneJsonSafe(diagnostics || []),
    auditEvent: createRuntimeAuditEvent({
      requestId: context.requestId,
      tenantId: context.tenantId,
      competitionId: context.competitionId,
      capability: context.capability || null,
      format: context.format || null,
      selectedMode: RUNTIME_MODE.LEGACY_ONLY,
      reasonCode,
      evaluatedAt: context.now || "",
      actorId: context.actor?.actorId ?? null,
      runtimeVersion: context.runtimeVersion || RUNTIME_CONTROL_VERSION,
      metadata: {
        phase: "3A.1",
        selectedExecutor: RUNTIME_EXECUTOR.LEGACY,
      },
    }),
  });

  return clampDecisionToPhase3A1(decision);
}
