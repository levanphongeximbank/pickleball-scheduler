/**
 * In-memory privacy policy source (I&A-11 certification only).
 * No Production adapter. No global singleton.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { deepFreeze, isNonEmptyString, isPlainObject } from "../contracts/shared.js";
import { createAnalyticsPrivacyPolicy } from "./policy.js";
import { wrapPrivacyPolicySourceFailure } from "./errorSanitizer.js";

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createInMemoryPrivacyPolicySource(input = {}) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_POLICY_INVALID,
        "InMemoryPrivacyPolicySource input must be a plain object",
        "input"
      )
    );
  }

  /** @type {Map<string, Readonly<Record<string, unknown>>>} */
  const policies = new Map();

  const seed = Array.isArray(input.policies) ? input.policies : [];
  for (const item of seed) {
    const policyResult = createAnalyticsPrivacyPolicy(item);
    if (!policyResult.ok) return policyResult;
    const key = `${policyResult.value.policyId}@${policyResult.value.policyVersion}`;
    policies.set(key, policyResult.value);
  }

  const failMode = isNonEmptyString(input.failMode)
    ? String(input.failMode).trim()
    : null;

  /**
   * @param {unknown} request
   */
  function load(request) {
    if (failMode === "throw") {
      throw new Error("in-memory privacy policy source forced failure");
    }
    if (failMode === "failure") {
      return wrapPrivacyPolicySourceFailure({
        code: ANALYTICS_ERROR_CODE.PRIVACY_POLICY_SOURCE_FAILURE,
        message: "Forced policy source failure",
      });
    }

    if (!isPlainObject(request)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.PRIVACY_POLICY_INVALID,
          "policy load request must be a plain object",
          "request"
        )
      );
    }

    if (!isNonEmptyString(request.policyId) || !isNonEmptyString(request.policyVersion)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.PRIVACY_POLICY_INVALID,
          "policyId and policyVersion are required",
          "request"
        )
      );
    }

    const key = `${String(request.policyId).trim()}@${String(request.policyVersion).trim()}`;
    const policy = policies.get(key);
    if (!policy) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.PRIVACY_POLICY_INVALID,
          "Privacy policy not found in in-memory source",
          "request",
          { policyId: String(request.policyId).trim() }
        )
      );
    }

    return ok(policy);
  }

  /**
   * @returns {import("../contracts/result.js").Result}
   */
  function list() {
    if (failMode === "failure") {
      return wrapPrivacyPolicySourceFailure({
        code: ANALYTICS_ERROR_CODE.PRIVACY_POLICY_SOURCE_FAILURE,
        message: "Forced policy source failure",
      });
    }
    return ok(Object.freeze([...policies.values()]));
  }

  return ok(
    deepFreeze({
      kind: "in-memory-privacy-policy-source",
      load,
      list,
    })
  );
}
