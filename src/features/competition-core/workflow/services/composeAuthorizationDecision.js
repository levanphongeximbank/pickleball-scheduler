/**
 * CORE-19 — compose one or more authorization decisions into a single decision.
 * Does not implement RBAC; facts must be supplied by callers/ports.
 */

import { WORKFLOW_ERROR_CODE } from "../errors/workflowErrorCodes.js";
import { createTransitionAuthorizationDecision } from "../contracts/workflowDecisions.js";
import {
  compareStableString,
  isPlainObject,
} from "../utils/canonicalizeWorkflowPayload.js";

/**
 * @param {unknown} decision
 * @returns {boolean}
 */
function isMandatory(decision) {
  if (!isPlainObject(decision)) return true;
  if (decision.mandatory === false) return false;
  if (isPlainObject(decision.details) && decision.details.mandatory === false) {
    return false;
  }
  return true;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function decisionSortKey(value) {
  if (!isPlainObject(value)) return "";
  return [
    String(value.decisionCode ?? ""),
    String(value.actorId ?? ""),
    String(value.reason ?? ""),
    String(value.details?.decisionId ?? ""),
  ].join("|");
}

/**
 * @param {unknown} decisions
 * @returns {unknown[]}
 */
function toList(decisions) {
  if (decisions == null) return [];
  if (Array.isArray(decisions)) return decisions;
  if (isPlainObject(decisions) && Array.isArray(decisions.decisions)) {
    return decisions.decisions;
  }
  if (isPlainObject(decisions)) return [decisions];
  return [];
}

/**
 * Compose authorization decisions.
 *
 * @param {unknown} decisions — one decision, an array, null/undefined, or { decisions }
 * @returns {Readonly<import('../contracts/workflowDecisions.js').TransitionAuthorizationDecision>}
 */
export function composeAuthorizationDecision(decisions) {
  const list = toList(decisions).filter((item) => item != null);

  /** @type {Array<{ decision: ReturnType<typeof createTransitionAuthorizationDecision>, mandatory: boolean }>} */
  const prepared = list
    .map((item) => ({
      decision: createTransitionAuthorizationDecision(item),
      mandatory: isMandatory(item),
    }))
    .sort((a, b) =>
      compareStableString(decisionSortKey(a.decision), decisionSortKey(b.decision))
    );

  if (prepared.length === 0) {
    return createTransitionAuthorizationDecision({
      allowed: false,
      decisionCode: "MISSING_AUTHORIZATION_CONTEXT",
      reason: "Missing mandatory authorization context",
      details: {
        dependency: "authorization",
        dependencyCode: WORKFLOW_ERROR_CODE.TRANSITION_UNAUTHORIZED,
        missingAuthorizationContext: true,
        actorDenial: false,
        denialReasons: Object.freeze(["Missing mandatory authorization context"]),
        blockingReasons: Object.freeze(["Missing mandatory authorization context"]),
        warnings: Object.freeze([]),
        composedCount: 0,
      },
    });
  }

  const enforceable = prepared.filter((item) => item.mandatory);
  const active = enforceable.length > 0 ? enforceable : prepared;

  const denials = active
    .map((item) => item.decision)
    .filter((d) => d.allowed !== true)
    .sort((a, b) => compareStableString(decisionSortKey(a), decisionSortKey(b)));

  const denialReasons = denials
    .map((d) => d.reason || d.decisionCode || "Authorization denied")
    .sort(compareStableString);

  const missingContext = denials.some(
    (d) =>
      d.decisionCode === "MISSING_AUTHORIZATION_CONTEXT" ||
      (isPlainObject(d.details) && d.details.missingAuthorizationContext === true)
  );

  const actorDenial = denials.some(
    (d) =>
      d.actorId != null ||
      d.decisionCode === "ACTOR_DENIED" ||
      d.decisionCode === "DENIED_ROLE" ||
      (isPlainObject(d.details) && d.details.actorDenial === true)
  );

  if (denials.length > 0) {
    const primary = denials[0];
    return createTransitionAuthorizationDecision({
      allowed: false,
      actorId: primary.actorId,
      actorType: primary.actorType,
      decisionCode: missingContext
        ? "MISSING_AUTHORIZATION_CONTEXT"
        : primary.decisionCode ||
          (actorDenial ? "ACTOR_DENIED" : WORKFLOW_ERROR_CODE.TRANSITION_UNAUTHORIZED),
      reason:
        denialReasons.length === 1
          ? denialReasons[0]
          : `Authorization denied (${denialReasons.length} reasons)`,
      details: {
        dependency: "authorization",
        dependencyCode: WORKFLOW_ERROR_CODE.TRANSITION_UNAUTHORIZED,
        missingAuthorizationContext: missingContext === true,
        actorDenial: actorDenial === true && missingContext !== true,
        denialReasons: Object.freeze([...denialReasons]),
        decisionIds: Object.freeze(
          denials
            .map((d) =>
              d.details?.decisionId != null ? String(d.details.decisionId) : null
            )
            .filter(Boolean)
            .sort(compareStableString)
        ),
        blockingReasons: Object.freeze([...denialReasons]),
        warnings: Object.freeze([]),
        composedCount: prepared.length,
      },
    });
  }

  const primary = active[0].decision;
  return createTransitionAuthorizationDecision({
    allowed: true,
    actorId: primary.actorId,
    actorType: primary.actorType,
    decisionCode: primary.decisionCode || "ALLOWED",
    reason: primary.reason || "ALLOWED",
    details: {
      dependency: "authorization",
      missingAuthorizationContext: false,
      actorDenial: false,
      denialReasons: Object.freeze([]),
      blockingReasons: Object.freeze([]),
      warnings: Object.freeze([]),
      composedCount: prepared.length,
    },
  });
}
