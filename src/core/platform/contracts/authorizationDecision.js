/**
 * Authorization Decision contract (Platform Core Phase 1E).
 *
 * Represents an authorization outcome already produced by an external
 * evaluator. Does not evaluate roles, permissions, actions, eligibility,
 * ownership, or call any runtime/database.
 */

import { fail, ok } from "./result.js";
import { isPlatformScope } from "./platformScope.js";

/**
 * @typedef {{
 *   allowed: boolean,
 *   decisionCode: string,
 *   reason?: string,
 *   scope?: import("./platformScope.js").PlatformScope,
 * }} AuthorizationDecision
 */

export const AUTHORIZATION_DECISION_ERROR = Object.freeze({
  INVALID: "AUTHORIZATION_DECISION_INVALID",
  ALLOWED_INVALID: "AUTHORIZATION_DECISION_ALLOWED_INVALID",
  CODE_INVALID: "AUTHORIZATION_DECISION_CODE_INVALID",
  REASON_INVALID: "AUTHORIZATION_DECISION_REASON_INVALID",
  SCOPE_INVALID: "AUTHORIZATION_DECISION_SCOPE_INVALID",
});

/**
 * @param {string} code
 * @param {string} message
 * @param {string} [field]
 * @returns {{ code: string, message: string, field?: string }}
 */
function authorizationDecisionError(code, message, field) {
  /** @type {{ code: string, message: string, field?: string }} */
  const error = { code, message };
  if (field !== undefined) {
    error.field = field;
  }
  return Object.freeze(error);
}

/**
 * @param {*} input
 * @returns {import("./result.js").Result}
 */
export function createAuthorizationDecision(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return fail(
      authorizationDecisionError(
        AUTHORIZATION_DECISION_ERROR.INVALID,
        "AuthorizationDecision input must be a plain object"
      )
    );
  }

  if (!("allowed" in input) || typeof input.allowed !== "boolean") {
    return fail(
      authorizationDecisionError(
        AUTHORIZATION_DECISION_ERROR.ALLOWED_INVALID,
        "AuthorizationDecision allowed must be a boolean",
        "allowed"
      )
    );
  }

  if (typeof input.decisionCode !== "string") {
    return fail(
      authorizationDecisionError(
        AUTHORIZATION_DECISION_ERROR.CODE_INVALID,
        "AuthorizationDecision decisionCode must be a string",
        "decisionCode"
      )
    );
  }

  const decisionCode = input.decisionCode.trim();
  if (decisionCode.length === 0) {
    return fail(
      authorizationDecisionError(
        AUTHORIZATION_DECISION_ERROR.CODE_INVALID,
        "AuthorizationDecision decisionCode must be a non-empty string",
        "decisionCode"
      )
    );
  }

  /** @type {AuthorizationDecision} */
  const decision = {
    allowed: input.allowed,
    decisionCode,
  };

  if ("reason" in input && input.reason !== undefined) {
    if (typeof input.reason !== "string") {
      return fail(
        authorizationDecisionError(
          AUTHORIZATION_DECISION_ERROR.REASON_INVALID,
          "AuthorizationDecision reason must be a string",
          "reason"
        )
      );
    }

    const reason = input.reason.trim();
    if (reason.length === 0) {
      return fail(
        authorizationDecisionError(
          AUTHORIZATION_DECISION_ERROR.REASON_INVALID,
          "AuthorizationDecision reason must be a non-empty string",
          "reason"
        )
      );
    }
    decision.reason = reason;
  }

  if ("scope" in input && input.scope !== undefined) {
    if (!isPlatformScope(input.scope)) {
      return fail(
        authorizationDecisionError(
          AUTHORIZATION_DECISION_ERROR.SCOPE_INVALID,
          "AuthorizationDecision scope must be a valid PlatformScope",
          "scope"
        )
      );
    }
    // Preserve caller reference; do not clone or re-freeze nested scope.
    decision.scope = input.scope;
  }

  return ok(Object.freeze(decision));
}

/**
 * @param {*} value
 * @returns {value is AuthorizationDecision}
 */
export function isAuthorizationDecision(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  if (typeof value.allowed !== "boolean" || typeof value.decisionCode !== "string") {
    return false;
  }
  if ("scope" in value && value.scope !== undefined) {
    if (!isPlatformScope(value.scope)) {
      return false;
    }
  }
  return createAuthorizationDecision(value).ok === true;
}
