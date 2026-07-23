import { CORE02_POLICY_ID } from "../constants/versions.js";
import {
  createAuthorizationDecision,
  createAuthorizationExplanation,
  createAuthorizationRequest,
  isAuthorizationEvidence,
  isPlainObject,
  optionalNonEmptyString,
} from "../contracts/index.js";
import { AUTHORIZATION_DENY_REASON } from "../enums/denyReasons.js";
import { matchesIdentityEvidencePort } from "../ports/identityEvidencePort.js";
import { mapActionToPermissions } from "./mapActionToPermissions.js";

/**
 * @param {string} code
 * @param {object} base
 * @returns {Readonly<import('../contracts/authorizationDecision.js').AuthorizationDecision>}
 */
function deny(code, base) {
  const requiredPermissions = base.requiredPermissions || [];
  const grantedPermissions = base.grantedPermissions || [];
  const matchedPermissions = base.matchedPermissions || [];
  return createAuthorizationDecision({
    allowed: false,
    decisionCode: code,
    denyReason: code,
    reason: base.reason || `Authorization denied: ${code}`,
    actorId: base.actorId ?? null,
    actorRole: base.actorRole ?? null,
    policyId: CORE02_POLICY_ID,
    action: base.action ?? null,
    explanation: createAuthorizationExplanation({
      summary: base.reason || `Authorization denied: ${code}`,
      requiredPermissions,
      matchedPermissions,
      grantedPermissions,
      denyReason: code,
      details: base.details || {},
    }),
    details: base.details || {},
  });
}

/**
 * @param {import('../contracts/authorizationScope.js').AuthorizationScope} scope
 * @param {import('../contracts/authorizationEvidence.js').AuthorizationEvidence} evidence
 * @returns {boolean}
 */
function scopesCompatible(scope, evidence) {
  if (
    evidence.tenantId &&
    scope.tenantId &&
    evidence.tenantId !== scope.tenantId
  ) {
    return false;
  }
  if (
    evidence.venueId &&
    scope.venueId &&
    evidence.venueId !== scope.venueId
  ) {
    return false;
  }
  if (
    evidence.competitionId &&
    scope.competitionId &&
    evidence.competitionId !== scope.competitionId
  ) {
    return false;
  }
  return true;
}

/**
 * Fail-closed authorization evaluation.
 * Never uses the client RBAC helper — evidence must be injected.
 *
 * @param {unknown} requestInput
 * @param {{ evidencePort?: unknown, evidence?: unknown }} [options]
 * @returns {Promise<Readonly<import('../contracts/authorizationDecision.js').AuthorizationDecision>>}
 */
export async function evaluateAuthorization(requestInput, options = {}) {
  if (!isPlainObject(requestInput) && requestInput != null) {
    return deny(AUTHORIZATION_DENY_REASON.INVALID_REQUEST, {
      reason: "Authorization request must be a plain object",
    });
  }

  let request;
  try {
    if (!isPlainObject(requestInput)) {
      return deny(AUTHORIZATION_DENY_REASON.INVALID_REQUEST, {
        reason: "Authorization request is required",
      });
    }
    if (!isPlainObject(requestInput.subject)) {
      return deny(AUTHORIZATION_DENY_REASON.MISSING_SUBJECT, {
        action: optionalNonEmptyString(requestInput.action),
        reason: "Authorization subject is required",
      });
    }
    if (!isPlainObject(requestInput.scope)) {
      return deny(AUTHORIZATION_DENY_REASON.MISSING_SCOPE, {
        action: optionalNonEmptyString(requestInput.action),
        actorId: optionalNonEmptyString(requestInput.subject?.actorId),
        actorRole: optionalNonEmptyString(requestInput.subject?.role),
        reason: "Authorization scope is required",
      });
    }
    if (!optionalNonEmptyString(requestInput.action)) {
      return deny(AUTHORIZATION_DENY_REASON.MISSING_ACTION, {
        actorId: optionalNonEmptyString(requestInput.subject?.actorId),
        actorRole: optionalNonEmptyString(requestInput.subject?.role),
        reason: "Authorization action is required",
      });
    }
    request = createAuthorizationRequest(requestInput);
  } catch (error) {
    const message =
      error && typeof error === "object" && "message" in error
        ? String(error.message)
        : "Invalid authorization request";
    const code = /competitionId/i.test(message)
      ? AUTHORIZATION_DENY_REASON.MISSING_SCOPE
      : AUTHORIZATION_DENY_REASON.INVALID_REQUEST;
    return deny(code, { reason: message });
  }

  const actorId = request.subject.actorId;
  const actorRole = request.subject.role;
  const mapping = mapActionToPermissions(request.action);
  const requiredPermissions =
    request.requiredPermissions.length > 0
      ? [...request.requiredPermissions]
      : mapping.requiredPermissions;

  if (request.requiredPermissions.length === 0 && !mapping.known) {
    return deny(AUTHORIZATION_DENY_REASON.UNKNOWN_ACTION, {
      action: request.action,
      actorId,
      actorRole,
      requiredPermissions: [],
      reason: `Unknown competition action: ${request.action}`,
    });
  }

  let evidence = options.evidence;
  if (evidence == null) {
    const port = options.evidencePort;
    if (!matchesIdentityEvidencePort(port)) {
      return deny(AUTHORIZATION_DENY_REASON.EVIDENCE_UNAVAILABLE, {
        action: request.action,
        actorId,
        actorRole,
        requiredPermissions,
        reason: "Identity evidence port is required",
      });
    }
    try {
      evidence = await port.getEvidence({
        subject: request.subject,
        scope: request.scope,
        action: request.action,
        context: request.context,
      });
    } catch {
      return deny(AUTHORIZATION_DENY_REASON.EVIDENCE_UNAVAILABLE, {
        action: request.action,
        actorId,
        actorRole,
        requiredPermissions,
        reason: "Identity evidence port failed",
      });
    }
  }

  if (evidence == null) {
    return deny(AUTHORIZATION_DENY_REASON.EVIDENCE_UNAVAILABLE, {
      action: request.action,
      actorId,
      actorRole,
      requiredPermissions,
      reason: "Authorization evidence is unavailable",
    });
  }

  if (!isAuthorizationEvidence(evidence)) {
    return deny(AUTHORIZATION_DENY_REASON.EVIDENCE_MALFORMED, {
      action: request.action,
      actorId,
      actorRole,
      requiredPermissions,
      reason: "Authorization evidence is malformed",
    });
  }

  const normalizedEvidence = evidence;
  if (!scopesCompatible(request.scope, normalizedEvidence)) {
    return deny(AUTHORIZATION_DENY_REASON.SCOPE_MISMATCH, {
      action: request.action,
      actorId,
      actorRole,
      requiredPermissions,
      grantedPermissions: [...normalizedEvidence.grantedPermissions],
      reason: "Evidence scope does not match authorization scope",
    });
  }

  const granted = new Set(normalizedEvidence.grantedPermissions);
  const matchedPermissions = requiredPermissions.filter((p) => granted.has(p));

  if (requiredPermissions.length === 0 || matchedPermissions.length === 0) {
    return deny(AUTHORIZATION_DENY_REASON.PERMISSION_DENIED, {
      action: request.action,
      actorId,
      actorRole,
      requiredPermissions,
      matchedPermissions,
      grantedPermissions: [...normalizedEvidence.grantedPermissions],
      reason: `Missing required permission for action ${request.action}`,
    });
  }

  return createAuthorizationDecision({
    allowed: true,
    decisionCode: "ALLOW",
    reason: `Allowed by permission ${matchedPermissions[0]}`,
    actorId,
    actorRole,
    policyId: CORE02_POLICY_ID,
    action: request.action,
    explanation: createAuthorizationExplanation({
      summary: `Allowed by permission ${matchedPermissions[0]}`,
      requiredPermissions,
      matchedPermissions,
      grantedPermissions: [...normalizedEvidence.grantedPermissions],
      denyReason: null,
      details: {
        evidenceSource: normalizedEvidence.source,
        mapVersion: mapping.mapVersion,
      },
    }),
    details: {
      evidenceSource: normalizedEvidence.source,
      mapVersion: mapping.mapVersion,
    },
  });
}
