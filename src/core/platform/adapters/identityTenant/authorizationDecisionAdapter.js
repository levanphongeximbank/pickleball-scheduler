/**
 * Authorization Decision Adapter — projects an already-resolved authorization
 * outcome into Platform Core AuthorizationDecision.
 *
 * Does not invoke RBAC evaluators or alter fail-open/fail-closed semantics.
 * The evaluator result must be supplied by the caller.
 */

import { fail } from "../../contracts/result.js";
import { createAuthorizationDecision } from "../../contracts/authorizationDecision.js";
import { isPlatformScope } from "../../contracts/platformScope.js";
import { projectTenantScope } from "./tenantScopeAdapter.js";

export const AUTHORIZATION_DECISION_ADAPTER_ERROR = Object.freeze({
  INVALID: "AUTHORIZATION_DECISION_ADAPTER_INVALID",
  ALLOWED_REQUIRED: "AUTHORIZATION_DECISION_ADAPTER_ALLOWED_REQUIRED",
  DECISION_CODE_REQUIRED: "AUTHORIZATION_DECISION_ADAPTER_DECISION_CODE_REQUIRED",
  SCOPE_INVALID: "AUTHORIZATION_DECISION_ADAPTER_SCOPE_INVALID",
});

/**
 * @param {string} code
 * @param {string} message
 * @param {string} [field]
 * @returns {{ code: string, message: string, field?: string }}
 */
function adapterError(code, message, field) {
  /** @type {{ code: string, message: string, field?: string }} */
  const error = { code, message };
  if (field !== undefined) {
    error.field = field;
  }
  return Object.freeze(error);
}

/**
 * Normalize caller-supplied allow/deny flags without evaluating policy.
 *
 * Supported shapes (caller-resolved only):
 * - `{ allowed, decisionCode, reason?, scope? }`
 * - `{ ok, code?, error?, reason?, scope? }` (assertCan / guard style)
 *
 * @param {*} input
 * @returns {import("../../contracts/result.js").Result}
 */
export function projectAuthorizationDecision(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return fail(
      adapterError(
        AUTHORIZATION_DECISION_ADAPTER_ERROR.INVALID,
        "Authorization decision input must be a plain object"
      )
    );
  }

  let allowed;
  if ("allowed" in input && typeof input.allowed === "boolean") {
    allowed = input.allowed;
  } else if ("ok" in input && typeof input.ok === "boolean") {
    allowed = input.ok;
  } else {
    return fail(
      adapterError(
        AUTHORIZATION_DECISION_ADAPTER_ERROR.ALLOWED_REQUIRED,
        "Authorization decision projection requires explicit allowed (or ok)",
        "allowed"
      )
    );
  }

  let decisionCode;
  if (typeof input.decisionCode === "string") {
    decisionCode = input.decisionCode;
  } else if (typeof input.code === "string") {
    decisionCode = input.code;
  } else if (allowed === true) {
    decisionCode = "ALLOW";
  } else {
    return fail(
      adapterError(
        AUTHORIZATION_DECISION_ADAPTER_ERROR.DECISION_CODE_REQUIRED,
        "Authorization decision projection requires explicit decisionCode on deny",
        "decisionCode"
      )
    );
  }

  /** @type {{ allowed: boolean, decisionCode: string, reason?: string, scope?: * }} */
  const payload = { allowed, decisionCode };

  if ("reason" in input && input.reason !== undefined) {
    payload.reason = input.reason;
  } else if ("error" in input && typeof input.error === "string") {
    payload.reason = input.error;
  }

  if ("scope" in input && input.scope !== undefined) {
    if (isPlatformScope(input.scope)) {
      payload.scope = input.scope;
    } else {
      const scopeResult = projectTenantScope(input.scope);
      if (!scopeResult.ok) {
        return fail(
          adapterError(
            AUTHORIZATION_DECISION_ADAPTER_ERROR.SCOPE_INVALID,
            "Authorization decision scope must be a valid PlatformScope",
            "scope"
          )
        );
      }
      payload.scope = scopeResult.value;
    }
  }

  return createAuthorizationDecision(payload);
}
