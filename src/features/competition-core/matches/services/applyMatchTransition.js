/**
 * CORE-15 — apply match lifecycle transition (pure, additive).
 * Does not mutate the input match. Does not calculate scores or winners.
 * Does not write platform audit logs.
 */

import {
  cloneJsonSafe,
  isNonEmptyString,
} from "../../participants/contracts/shared.js";
import {
  createCompetitionMatch,
  createMatchResultReference,
} from "../contracts/competitionMatch.js";
import { isMatchPolicy } from "../contracts/matchPolicy.js";
import { MATCH_COMPLETION_REASON, isMatchCompletionReason } from "../enums/completionReasons.js";
import { MATCH_STATUS } from "../enums/matchStatuses.js";
import { MATCH_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { MatchRuntimeError } from "../errors/MatchRuntimeError.js";
import { createMatchLifecycleAuditEvent } from "../domain/createMatchLifecycleAuditEvent.js";
import { evaluatePreMatchReadiness } from "./preMatchReadiness.js";
import {
  MATCH_ACTION,
  assertMatchTransitionAllowed,
} from "./transitions.js";

/**
 * @typedef {Object} MatchAuthorizationDecision
 * @property {boolean} allowed
 * @property {string|null} [actorId]
 * @property {string|null} [actorRole]
 * @property {string|null} [decisionCode]
 * @property {string|null} [policyId]
 * @property {Record<string, unknown>} [details]
 */

/**
 * @typedef {Object} ApplyMatchTransitionRequest
 * @property {import('../contracts/competitionMatch.js').CompetitionMatch|Record<string, unknown>} match
 * @property {string} action
 * @property {MatchAuthorizationDecision|null|undefined} [authorization]
 * @property {boolean} [requireAuthorization]
 * @property {boolean} [enforceReadiness]
 * @property {import('../contracts/matchPolicy.js').MatchPolicy|null} [matchPolicy]
 * @property {string|null} [reason]
 * @property {string[]} [reasonCodes]
 * @property {Record<string, unknown>} [metadata]
 * @property {string|null} [completionReason]
 * @property {import('../contracts/competitionMatch.js').MatchResultReference|Record<string, unknown>|null} [resultReference]
 * @property {string|Date} [now]
 * @property {() => string|Date} [clock]
 * @property {string|null} [requestId]
 * @property {string|null} [correlationId]
 * @property {string|null} [idempotencyKey]
 * @property {string|null} [eventId]
 * @property {Record<string, unknown>} [readinessOptions]
 */

/**
 * @typedef {Object} ApplyMatchTransitionResult
 * @property {true} ok
 * @property {import('../contracts/competitionMatch.js').CompetitionMatch} match
 * @property {string} fromStatus
 * @property {string} toStatus
 * @property {string} action
 * @property {Record<string, string|null>} timestampsDelta
 * @property {import('../domain/createMatchLifecycleAuditEvent.js').MatchLifecycleAuditEvent} auditEvent
 * @property {MatchAuthorizationDecision} authorization
 */

/**
 * @param {unknown} value
 * @param {() => string|Date} [clock]
 * @returns {string}
 */
function resolveNowIso(value, clock) {
  const raw = value != null ? value : typeof clock === "function" ? clock() : null;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw.toISOString();
  }
  if (isNonEmptyString(raw)) {
    const parsed = new Date(String(raw));
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    return String(raw).trim();
  }
  throw new MatchRuntimeError(
    MATCH_RUNTIME_ERROR_CODE.MATCH_INVALID_INPUT,
    "Deterministic now/clock is required for lifecycle transitions",
    {}
  );
}

/**
 * @param {unknown} raw
 * @param {{ requireAuthorization?: boolean, action: string }} ctx
 * @returns {MatchAuthorizationDecision}
 */
export function normalizeMatchAuthorizationDecision(raw, ctx) {
  const requireAuthorization = ctx.requireAuthorization !== false;

  if (raw == null) {
    if (!requireAuthorization) {
      return {
        allowed: true,
        actorId: null,
        actorRole: null,
        decisionCode: "NOT_REQUIRED",
        policyId: null,
        details: {},
      };
    }
    throw new MatchRuntimeError(
      MATCH_RUNTIME_ERROR_CODE.MATCH_AUTHORIZATION_REQUIRED,
      "authorization decision is required for mutating transitions",
      { action: ctx.action }
    );
  }

  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new MatchRuntimeError(
      MATCH_RUNTIME_ERROR_CODE.MATCH_AUTHORIZATION_REQUIRED,
      "authorization decision must be an object",
      { action: ctx.action }
    );
  }

  const input = /** @type {Record<string, unknown>} */ (raw);
  const allowed = input.allowed === true;
  const actorId =
    input.actorId == null || input.actorId === ""
      ? null
      : String(input.actorId);
  const actorRole =
    input.actorRole == null || input.actorRole === ""
      ? null
      : String(input.actorRole);

  if (!allowed) {
    throw new MatchRuntimeError(
      MATCH_RUNTIME_ERROR_CODE.MATCH_AUTHORIZATION_DENIED,
      "authorization decision denied this transition",
      {
        action: ctx.action,
        decisionCode:
          input.decisionCode == null ? null : String(input.decisionCode),
        policyId: input.policyId == null ? null : String(input.policyId),
      }
    );
  }

  if (requireAuthorization && !isNonEmptyString(actorId)) {
    throw new MatchRuntimeError(
      MATCH_RUNTIME_ERROR_CODE.MATCH_AUTHORIZATION_REQUIRED,
      "authorization.actorId is required when authorization is enforced",
      { action: ctx.action }
    );
  }

  return {
    allowed: true,
    actorId,
    actorRole,
    decisionCode:
      input.decisionCode == null || input.decisionCode === ""
        ? "ALLOWED"
        : String(input.decisionCode),
    policyId:
      input.policyId == null || input.policyId === ""
        ? null
        : String(input.policyId),
    details:
      input.details && typeof input.details === "object" && !Array.isArray(input.details)
        ? /** @type {Record<string, unknown>} */ (cloneJsonSafe(input.details))
        : {},
  };
}

/**
 * @param {string} action
 * @param {string|null|undefined} requestedReason
 * @returns {string}
 */
function resolveCompletionReason(action, requestedReason) {
  if (action === MATCH_ACTION.ABANDON) {
    return MATCH_COMPLETION_REASON.ABANDONED;
  }
  if (action === MATCH_ACTION.CANCEL) {
    return MATCH_COMPLETION_REASON.CANCELLED;
  }
  if (action === MATCH_ACTION.COMPLETE) {
    if (requestedReason == null || requestedReason === "") {
      return MATCH_COMPLETION_REASON.COMPLETED;
    }
    const upper = String(requestedReason).trim().toUpperCase();
    if (!isMatchCompletionReason(upper) || upper === MATCH_COMPLETION_REASON.NONE) {
      throw new MatchRuntimeError(
        MATCH_RUNTIME_ERROR_CODE.MATCH_INVALID_INPUT,
        "completionReason is invalid for COMPLETE",
        { completionReason: requestedReason }
      );
    }
    return upper;
  }
  return MATCH_COMPLETION_REASON.NONE;
}

/**
 * @param {import('../contracts/competitionMatch.js').CompetitionMatch} match
 * @param {string} action
 * @param {string} toStatus
 * @param {string} nowIso
 * @param {string} completionReason
 * @param {unknown} resultReferenceInput
 * @returns {{ next: import('../contracts/competitionMatch.js').CompetitionMatch, timestampsDelta: Record<string, string|null> }}
 */
function buildNextMatch(
  match,
  action,
  toStatus,
  nowIso,
  completionReason,
  resultReferenceInput
) {
  /** @type {Record<string, string|null>} */
  const timestampsDelta = {};
  /** @type {Record<string, unknown>} */
  const patch = {
    status: toStatus,
    revision: (match.revision || 1) + 1,
  };

  if (action === MATCH_ACTION.START) {
    if (!match.startedAt) {
      patch.startedAt = nowIso;
      timestampsDelta.startedAt = nowIso;
    }
  }

  if (action === MATCH_ACTION.PAUSE) {
    patch.pausedAt = nowIso;
    timestampsDelta.pausedAt = nowIso;
  }

  if (action === MATCH_ACTION.RESUME) {
    patch.resumedAt = nowIso;
    timestampsDelta.resumedAt = nowIso;
  }

  if (action === MATCH_ACTION.SUSPEND) {
    patch.suspendedAt = nowIso;
    timestampsDelta.suspendedAt = nowIso;
  }

  if (action === MATCH_ACTION.COMPLETE || action === MATCH_ACTION.ABANDON) {
    patch.completedAt = nowIso;
    timestampsDelta.completedAt = nowIso;
    patch.completionReason = completionReason;
    if (action === MATCH_ACTION.ABANDON) {
      patch.abandonedAt = nowIso;
      timestampsDelta.abandonedAt = nowIso;
      // Abandon must not fabricate result data.
      patch.resultReference = null;
    } else if (resultReferenceInput !== undefined) {
      // Attach opaque reference only — never inspect score/winner content.
      patch.resultReference = createMatchResultReference(
        /** @type {any} */ (resultReferenceInput)
      );
    }
  }

  if (action === MATCH_ACTION.CANCEL) {
    patch.cancelledAt = nowIso;
    timestampsDelta.cancelledAt = nowIso;
    patch.completionReason = MATCH_COMPLETION_REASON.CANCELLED;
    // Cancel must not fabricate result data.
    patch.resultReference = null;
  }

  const next = createCompetitionMatch({
    ...match,
    ...patch,
    metadata:
      match.metadata && typeof match.metadata === "object"
        ? cloneJsonSafe(match.metadata)
        : {},
  });

  return { next, timestampsDelta };
}

/**
 * @param {ApplyMatchTransitionRequest} request
 * @returns {ApplyMatchTransitionResult}
 */
export function applyMatchTransition(request = /** @type {any} */ ({})) {
  if (!request || typeof request !== "object") {
    throw new MatchRuntimeError(
      MATCH_RUNTIME_ERROR_CODE.MATCH_INVALID_INPUT,
      "applyMatchTransition request is required",
      {}
    );
  }

  const action = String(request.action || "").trim();
  if (!action) {
    throw new MatchRuntimeError(
      MATCH_RUNTIME_ERROR_CODE.MATCH_INVALID_INPUT,
      "action is required",
      {}
    );
  }

  if (!request.match || typeof request.match !== "object") {
    throw new MatchRuntimeError(
      MATCH_RUNTIME_ERROR_CODE.MATCH_INVALID_INPUT,
      "match is required",
      {}
    );
  }

  // Snapshot input identity for mutation guard (tests freeze or compare).
  const inputMatch = request.match;
  const fromStatus = String(inputMatch.status || MATCH_STATUS.DRAFT)
    .trim()
    .toUpperCase();

  const authorization = normalizeMatchAuthorizationDecision(
    request.authorization,
    {
      action,
      requireAuthorization: request.requireAuthorization !== false,
    }
  );

  const allowed = assertMatchTransitionAllowed({ action, fromStatus });
  const nowIso = resolveNowIso(request.now, request.clock);

  if (action === MATCH_ACTION.START && request.enforceReadiness === true) {
    const readiness = evaluatePreMatchReadiness(inputMatch, {
      matchPolicy: request.matchPolicy || null,
      now: nowIso,
      ...(request.readinessOptions && typeof request.readinessOptions === "object"
        ? request.readinessOptions
        : {}),
    });
    if (!readiness.readyToStart) {
      throw new MatchRuntimeError(
        MATCH_RUNTIME_ERROR_CODE.MATCH_NOT_READY,
        "Match is not ready to start",
        { blockers: readiness.blockers, requiredRefs: readiness.requiredRefs }
      );
    }
  }

  if (isMatchPolicy(request.matchPolicy)) {
    const policyCtx = {
      match: /** @type {import('../contracts/competitionMatch.js').CompetitionMatch} */ (
        inputMatch
      ),
      action,
      actorRole: authorization.actorRole,
      now: nowIso,
      extras: {
        completionReason: request.completionReason ?? null,
        reason: request.reason ?? null,
      },
    };

    if (
      action === MATCH_ACTION.START &&
      typeof request.matchPolicy.canStart === "function"
    ) {
      const policyResult = request.matchPolicy.canStart(policyCtx);
      if (policyResult && policyResult.ok === false) {
        throw new MatchRuntimeError(
          policyResult.code || MATCH_RUNTIME_ERROR_CODE.MATCH_NOT_READY,
          policyResult.message || "MatchPolicy.canStart denied",
          policyResult.details || {}
        );
      }
    }

    if (
      (action === MATCH_ACTION.COMPLETE || action === MATCH_ACTION.ABANDON) &&
      typeof request.matchPolicy.canComplete === "function"
    ) {
      const policyResult = request.matchPolicy.canComplete(policyCtx);
      if (policyResult && policyResult.ok === false) {
        throw new MatchRuntimeError(
          policyResult.code || MATCH_RUNTIME_ERROR_CODE.MATCH_INVALID_INPUT,
          policyResult.message || "MatchPolicy.canComplete denied",
          policyResult.details || {}
        );
      }
    }

    if (typeof request.matchPolicy.assertTransition === "function") {
      const policyResult = request.matchPolicy.assertTransition(policyCtx);
      if (policyResult && policyResult.ok === false) {
        throw new MatchRuntimeError(
          policyResult.code ||
            MATCH_RUNTIME_ERROR_CODE.MATCH_STATE_TRANSITION_INVALID,
          policyResult.message || "MatchPolicy.assertTransition denied",
          policyResult.details || {}
        );
      }
    }
  }

  const completionReason = resolveCompletionReason(
    action,
    request.completionReason
  );

  // Never inspect resultReference score/winner fields — opaque attach only.
  const { next, timestampsDelta } = buildNextMatch(
    /** @type {import('../contracts/competitionMatch.js').CompetitionMatch} */ (
      createCompetitionMatch(inputMatch)
    ),
    action,
    allowed.toStatus,
    nowIso,
    completionReason,
    action === MATCH_ACTION.COMPLETE ? request.resultReference : undefined
  );

  const reasonCodes = Array.isArray(request.reasonCodes)
    ? request.reasonCodes.map((c) => String(c)).filter(Boolean)
    : completionReason !== MATCH_COMPLETION_REASON.NONE
      ? [completionReason]
      : [];

  const auditEvent = createMatchLifecycleAuditEvent({
    eventId: request.eventId,
    matchIdentityKey: next.identityKey,
    previousStatus: fromStatus,
    nextStatus: allowed.toStatus,
    action,
    actorProvenance: {
      actorId: authorization.actorId,
      actorRole: authorization.actorRole,
    },
    authorizationProvenance: {
      allowed: authorization.allowed,
      decisionCode: authorization.decisionCode,
      policyId: authorization.policyId,
      details: authorization.details,
    },
    reason: request.reason ?? null,
    reasonCodes,
    metadata:
      request.metadata && typeof request.metadata === "object"
        ? request.metadata
        : {
            completionReason:
              completionReason !== MATCH_COMPLETION_REASON.NONE
                ? completionReason
                : null,
          },
    occurredAt: nowIso,
    requestId: request.requestId ?? null,
    correlationId: request.correlationId ?? null,
    idempotencyKey: request.idempotencyKey ?? null,
  });

  return {
    ok: true,
    match: next,
    fromStatus,
    toStatus: allowed.toStatus,
    action,
    timestampsDelta,
    auditEvent,
    authorization,
  };
}
