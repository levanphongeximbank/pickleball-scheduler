import { CORE02_POLICY_ID } from "../constants/versions.js";
import {
  createAuthorizationDecision,
  isPlainObject,
  optionalNonEmptyString,
} from "../contracts/index.js";

/**
 * Project CORE-02 AuthorizationDecision → MatchAuthorizationDecision shape.
 * Does not import Match runtime (avoids coupling); returns plain object.
 *
 * @param {unknown} decision
 * @returns {{
 *   allowed: boolean,
 *   actorId: string|null,
 *   actorRole: string|null,
 *   decisionCode: string|null,
 *   policyId: string|null,
 *   details: Record<string, unknown>,
 * }}
 */
export function projectToMatchAuthorizationDecision(decision) {
  const normalized = isPlainObject(decision)
    ? createAuthorizationDecision(decision)
    : createAuthorizationDecision({
        allowed: false,
        denyReason: "INVALID_REQUEST",
        reason: "Match projection requires AuthorizationDecision",
      });

  return Object.freeze({
    allowed: normalized.allowed === true,
    actorId: optionalNonEmptyString(normalized.actorId),
    actorRole: optionalNonEmptyString(normalized.actorRole),
    decisionCode: optionalNonEmptyString(normalized.decisionCode),
    policyId: optionalNonEmptyString(normalized.policyId) || CORE02_POLICY_ID,
    details: Object.freeze({
      ...(normalized.details || {}),
      core02Reason: normalized.reason,
      core02DenyReason: normalized.denyReason,
      core02Explanation: normalized.explanation,
    }),
  });
}
