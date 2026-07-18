/**
 * Shadow eligibility resolver (Phase 3A.2).
 * Default eligible=false. Sampling must be injected — never Math.random.
 */

import { createFeatureFlagSnapshot } from "../../contracts/featureFlagSnapshot.js";
import { resolveKillSwitch } from "../../resolvers/resolveKillSwitch.js";
import { isPlainObject } from "../../contracts/jsonSafe.js";
import {
  createShadowExecutionRequest,
  assertShadowExecutionRequestShape,
} from "../contracts/shadowRequest.js";
import { createShadowEligibility } from "../contracts/shadowEligibility.js";
import { SHADOW_REASON_CODE } from "../constants/shadowReasonCodes.js";

/**
 * @typedef {Object} ShadowEligibilityOptions
 * @property {string[]} [capabilityAllowlist]
 * @property {string[]} [operationAllowlist]
 * @property {boolean|null|undefined} [sampleIncluded] Injected sampling decision.
 * @property {import('../../contracts/featureFlagSnapshot.js').FeatureFlagSnapshot} [flags]
 * @property {object[]} [overrides]
 */

/**
 * @param {object} [input]
 * @param {object} [input.request]
 * @param {ShadowEligibilityOptions} [input.options]
 * @returns {import('../contracts/shadowEligibility.js').ShadowEligibility}
 */
export function resolveShadowEligibility(input = {}) {
  const request = createShadowExecutionRequest(
    isPlainObject(input.request) ? input.request : {}
  );
  const options = isPlainObject(input.options) ? input.options : {};
  const flags = createFeatureFlagSnapshot(
    isPlainObject(options.flags) ? options.flags : {}
  );
  const overrides = Array.isArray(options.overrides) ? options.overrides : [];
  const capabilityAllowlist = Array.isArray(options.capabilityAllowlist)
    ? options.capabilityAllowlist.filter((v) => typeof v === "string")
    : [];
  const operationAllowlist = Array.isArray(options.operationAllowlist)
    ? options.operationAllowlist.filter((v) => typeof v === "string")
    : [];

  /** @type {Array<{ check: string, passed: boolean, detail?: string }>} */
  const checks = [];
  /** @type {string[]} */
  const reasonCodes = [];

  const shape = assertShadowExecutionRequestShape(request);
  checks.push({
    check: "request_validity",
    passed: shape.ok,
    detail: shape.ok ? undefined : shape.errors.join("; "),
  });
  if (!shape.ok) {
    return createShadowEligibility({
      eligible: false,
      reasonCode: SHADOW_REASON_CODE.INVALID_REQUEST,
      reasonCodes: [SHADOW_REASON_CODE.INVALID_REQUEST],
      checks,
      metadata: { errors: shape.errors },
    });
  }

  const decision = request.runtimeDecision;
  const shadowAllowed = decision.shadowAllowed === true;
  checks.push({
    check: "runtime_shadow_allowed",
    passed: shadowAllowed,
  });
  if (!shadowAllowed) {
    reasonCodes.push(SHADOW_REASON_CODE.SHADOW_NOT_ALLOWED);
  }

  const canonicalAllowed = decision.canonicalAllowed === true;
  checks.push({
    check: "runtime_canonical_allowed",
    passed: canonicalAllowed,
  });
  if (!canonicalAllowed) {
    reasonCodes.push(SHADOW_REASON_CODE.CANONICAL_NOT_ALLOWED);
  }

  const kill = resolveKillSwitch({
    context: request.executionContext,
    flags,
    overrides,
  });
  checks.push({
    check: "kill_switch",
    passed: !kill.active,
    detail: kill.active ? kill.reasonCode || undefined : undefined,
  });
  if (kill.active) {
    reasonCodes.push(SHADOW_REASON_CODE.KILL_SWITCH_ACTIVE);
  }

  const shadowFlagEnabled = flags.shadow?.enabled === true;
  checks.push({
    check: "feature_flag_shadow",
    passed: shadowFlagEnabled,
  });
  if (!shadowFlagEnabled) {
    reasonCodes.push(SHADOW_REASON_CODE.SHADOW_DISABLED);
  }

  const capabilityAllowed =
    capabilityAllowlist.length === 0
      ? false
      : capabilityAllowlist.includes(request.capability);
  checks.push({
    check: "capability_allowlist",
    passed: capabilityAllowed,
    detail:
      capabilityAllowlist.length === 0
        ? "empty_allowlist_defaults_deny"
        : undefined,
  });
  if (!capabilityAllowed) {
    reasonCodes.push(SHADOW_REASON_CODE.CAPABILITY_NOT_ALLOWED);
  }

  const operationAllowed =
    operationAllowlist.length === 0
      ? false
      : operationAllowlist.includes(request.operation);
  checks.push({
    check: "operation_allowlist",
    passed: operationAllowed,
    detail:
      operationAllowlist.length === 0
        ? "empty_allowlist_defaults_deny"
        : undefined,
  });
  if (!operationAllowed) {
    reasonCodes.push(SHADOW_REASON_CODE.OPERATION_NOT_ALLOWED);
  }

  // Sampling must be injected. Missing / false → excluded.
  const sampleIncluded = options.sampleIncluded === true;
  checks.push({
    check: "sampling",
    passed: sampleIncluded,
    detail:
      options.sampleIncluded === undefined
        ? "sample_decision_not_injected"
        : undefined,
  });
  if (!sampleIncluded) {
    reasonCodes.push(SHADOW_REASON_CODE.SAMPLE_EXCLUDED);
  }

  const eligible =
    shadowAllowed &&
    canonicalAllowed &&
    !kill.active &&
    shadowFlagEnabled &&
    capabilityAllowed &&
    operationAllowed &&
    sampleIncluded;

  if (eligible) {
    return createShadowEligibility({
      eligible: true,
      reasonCode: SHADOW_REASON_CODE.ELIGIBLE,
      reasonCodes: [SHADOW_REASON_CODE.ELIGIBLE],
      checks,
      metadata: {
        samplingRate: flags.shadow?.samplingRate ?? 0,
        sampleIncluded: true,
      },
    });
  }

  // Prefer the first blocking reason in evaluation order.
  const primary =
    reasonCodes[0] || SHADOW_REASON_CODE.SHADOW_DISABLED;

  return createShadowEligibility({
    eligible: false,
    reasonCode: primary,
    reasonCodes,
    checks,
    metadata: {
      samplingRate: flags.shadow?.samplingRate ?? 0,
      sampleIncluded,
    },
  });
}
