/**
 * Domain-level authorization for Player Rating secure reads (Phase 1I).
 * Caller-supplied context only. Does not import Auth/RBAC runtime.
 */

import {
  clonePlain,
  deepFreeze,
  isNonEmptyString,
  requireNonEmptyString,
} from "../contracts/shared.js";
import {
  PLAYER_RATING_PRIVACY_PROJECTION_LEVEL,
  isSupportedPrivacyProjectionLevel,
  requiredCapabilityForProjectionLevel,
} from "./privacyProjectionLevels.js";
import {
  PLAYER_RATING_SECURITY_PRIVACY_ERROR_CODE,
  failSecurityPrivacy,
} from "./securityPrivacyErrors.js";
import { validatePlayerRatingScopeAccess } from "./validatePlayerRatingScopeAccess.js";

/**
 * @param {Record<string, unknown>} raw
 * @returns {string[]}
 */
function collectCapabilities(raw) {
  /** @type {string[]} */
  const out = [];
  const sources = [raw.capabilities, raw.permissions];
  for (const source of sources) {
    if (!Array.isArray(source)) continue;
    for (const item of source) {
      if (isNonEmptyString(item)) out.push(String(item).trim());
    }
  }
  if (isNonEmptyString(raw.permission)) {
    out.push(String(raw.permission).trim());
  }
  if (isNonEmptyString(raw.capability)) {
    out.push(String(raw.capability).trim());
  }
  return [...new Set(out)];
}

/**
 * Authorize a Player Rating read and return a frozen access context.
 *
 * Required access-context fields:
 * actorId, capabilities, tenantId|globalScope, projectionLevel,
 * subjectPlayerId, correlationId
 *
 * @param {unknown} accessInput
 * @param {{
 *   subjectScope: unknown,
 *   expectedProjectionLevel?: string,
 * }} options
 */
export function authorizePlayerRatingRead(accessInput, options) {
  if (!options || typeof options !== "object") {
    failSecurityPrivacy(
      PLAYER_RATING_SECURITY_PRIVACY_ERROR_CODE.INVALID_RATING_CONTRACT,
      "authorizePlayerRatingRead requires options with subjectScope"
    );
  }

  if (!accessInput || typeof accessInput !== "object") {
    failSecurityPrivacy(
      PLAYER_RATING_SECURITY_PRIVACY_ERROR_CODE.RATING_READ_UNAUTHORIZED,
      "Rating read requires explicit access context"
    );
  }

  const raw = /** @type {Record<string, unknown>} */ (accessInput);

  if (!isNonEmptyString(raw.actorId)) {
    failSecurityPrivacy(
      PLAYER_RATING_SECURITY_PRIVACY_ERROR_CODE.RATING_READ_UNAUTHORIZED,
      "Rating read requires actorId (fail closed)",
      { field: "actorId" }
    );
  }

  const projectionLevel = requireNonEmptyString(
    raw.projectionLevel,
    "projectionLevel"
  );
  if (!isSupportedPrivacyProjectionLevel(projectionLevel)) {
    failSecurityPrivacy(
      PLAYER_RATING_SECURITY_PRIVACY_ERROR_CODE.RATING_PROJECTION_LEVEL_UNSUPPORTED,
      "Unsupported Player Rating projection level",
      { projectionLevel }
    );
  }

  if (
    isNonEmptyString(options.expectedProjectionLevel) &&
    String(options.expectedProjectionLevel) !== projectionLevel
  ) {
    failSecurityPrivacy(
      PLAYER_RATING_SECURITY_PRIVACY_ERROR_CODE.RATING_PROJECTION_LEVEL_UNSUPPORTED,
      "Access context projectionLevel does not match requested read method",
      { projectionLevel }
    );
  }

  const subjectPlayerId = requireNonEmptyString(
    raw.subjectPlayerId,
    "subjectPlayerId"
  );
  const correlationId = requireNonEmptyString(
    raw.correlationId,
    "correlationId"
  );

  const capabilities = collectCapabilities(raw);
  const requiredCapability =
    requiredCapabilityForProjectionLevel(projectionLevel);

  if (
    raw.isAdmin === true &&
    !capabilities.includes(requiredCapability)
  ) {
    failSecurityPrivacy(
      PLAYER_RATING_SECURITY_PRIVACY_ERROR_CODE.RATING_READ_UNAUTHORIZED,
      "Client-provided isAdmin is not trusted without required capability",
      { actorId: String(raw.actorId).trim(), requiredCapability }
    );
  }

  if (!capabilities.includes(requiredCapability)) {
    failSecurityPrivacy(
      PLAYER_RATING_SECURITY_PRIVACY_ERROR_CODE.RATING_READ_UNAUTHORIZED,
      `Missing required capability: ${requiredCapability}`,
      {
        actorId: String(raw.actorId).trim(),
        requiredCapability,
        projectionLevel,
      }
    );
  }

  if (projectionLevel === PLAYER_RATING_PRIVACY_PROJECTION_LEVEL.PLAYER_SELF) {
    if (raw.subjectMappingConfirmed !== true) {
      failSecurityPrivacy(
        PLAYER_RATING_SECURITY_PRIVACY_ERROR_CODE.RATING_SUBJECT_MISMATCH,
        "PLAYER_SELF requires confirmed subject mapping context",
        { subjectPlayerId, reasonCode: "SUBJECT_MAPPING_UNCONFIRMED" }
      );
    }
    const mappedSubjectPlayerId = isNonEmptyString(raw.mappedSubjectPlayerId)
      ? String(raw.mappedSubjectPlayerId).trim()
      : null;
    if (!mappedSubjectPlayerId || mappedSubjectPlayerId !== subjectPlayerId) {
      failSecurityPrivacy(
        PLAYER_RATING_SECURITY_PRIVACY_ERROR_CODE.RATING_SUBJECT_MISMATCH,
        "PLAYER_SELF mappedSubjectPlayerId must equal subjectPlayerId",
        { subjectPlayerId, reasonCode: "MAPPED_SUBJECT_MISMATCH" }
      );
    }
  }

  if (
    projectionLevel === PLAYER_RATING_PRIVACY_PROJECTION_LEVEL.INTERNAL_SYSTEM
  ) {
    if (raw.trustedServerContext !== true) {
      failSecurityPrivacy(
        PLAYER_RATING_SECURITY_PRIVACY_ERROR_CODE.RATING_READ_UNAUTHORIZED,
        "INTERNAL_SYSTEM requires trustedServerContext=true",
        {
          actorId: String(raw.actorId).trim(),
          requiredCapability,
          projectionLevel,
        }
      );
    }
  }

  const accessForScope = {
    ...raw,
    capabilities,
  };
  const subjectScope = validatePlayerRatingScopeAccess({
    accessContext: accessForScope,
    subjectScope: options.subjectScope,
  });

  /** @type {Record<string, unknown>} */
  const context = {
    actorId: String(raw.actorId).trim(),
    capabilities: Object.freeze([...capabilities]),
    projectionLevel,
    subjectPlayerId,
    correlationId,
    subjectScope: clonePlain(subjectScope),
  };

  if (isNonEmptyString(raw.tenantId)) {
    context.tenantId = String(raw.tenantId).trim();
  }
  if (
    raw.globalScope === "global" ||
    raw.scopeKind === "global" ||
    subjectScope.kind === "global"
  ) {
    context.globalScope = "global";
  }
  if (raw.subjectMappingConfirmed === true) {
    context.subjectMappingConfirmed = true;
    context.mappedSubjectPlayerId = subjectPlayerId;
  }
  if (raw.trustedServerContext === true) {
    context.trustedServerContext = true;
  }

  return deepFreeze(clonePlain(context));
}
