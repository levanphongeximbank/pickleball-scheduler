/**
 * Actor + authority validation for CM-08 commands.
 * CM-08 does not own RBAC — it requires an explicit authority decision.
 */

import { COMPETITION_ARCHIVE_ERROR_CODE } from "../errors/errorCodes.js";
import {
  COMPETITION_ARCHIVE_AUTHORIZATION_DECISION,
  isCompetitionArchiveActorType,
  isCompetitionArchiveAuthorizationDecision,
} from "../constants/policies.js";
import { createFieldError } from "./validation.js";
import {
  deepFreeze,
  isNonEmptyString,
  hasControlCharacters,
} from "./shared.js";

/**
 * @param {unknown} actor
 * @param {string} expectedTenantId
 * @returns {{ errors: object[], value: object|null }}
 */
export function collectActorErrors(actor, expectedTenantId) {
  /** @type {object[]} */
  const errors = [];

  if (!actor || typeof actor !== "object" || Array.isArray(actor)) {
    errors.push(
      createFieldError(
        "actor",
        COMPETITION_ARCHIVE_ERROR_CODE.MISSING_ACTOR,
        "explicit actor is required",
        {}
      )
    );
    return { errors, value: null };
  }

  if (!isNonEmptyString(actor.actorId)) {
    errors.push(
      createFieldError(
        "actor.actorId",
        COMPETITION_ARCHIVE_ERROR_CODE.MISSING_ACTOR,
        "explicit actor.actorId is required",
        {}
      )
    );
  }
  if (!isCompetitionArchiveActorType(actor.actorType)) {
    errors.push(
      createFieldError(
        "actor.actorType",
        COMPETITION_ARCHIVE_ERROR_CODE.MISSING_ACTOR,
        "explicit actor.actorType (USER|SERVICE|SYSTEM) is required",
        { value: actor.actorType }
      )
    );
  }
  if (!isNonEmptyString(actor.tenantId)) {
    errors.push(
      createFieldError(
        "actor.tenantId",
        COMPETITION_ARCHIVE_ERROR_CODE.MISSING_ACTOR,
        "explicit actor.tenantId is required",
        {}
      )
    );
  } else if (
    isNonEmptyString(expectedTenantId) &&
    String(actor.tenantId).trim() !== String(expectedTenantId).trim()
  ) {
    errors.push(
      createFieldError(
        "actor.tenantId",
        COMPETITION_ARCHIVE_ERROR_CODE.ACTOR_TENANT_MISMATCH,
        "actor.tenantId must match command tenantId",
        {
          expected: String(expectedTenantId).trim(),
          actual: String(actor.tenantId).trim(),
        }
      )
    );
  }

  for (const forbidden of ["token", "session", "password", "secret", "accessToken"]) {
    if (Object.prototype.hasOwnProperty.call(actor, forbidden)) {
      errors.push(
        createFieldError(
          `actor.${forbidden}`,
          COMPETITION_ARCHIVE_ERROR_CODE.INVALID_CONTRACT,
          "actor must not include secrets, tokens, or session material",
          {}
        )
      );
    }
  }

  if (errors.length > 0) return { errors, value: null };

  return {
    errors,
    value: deepFreeze({
      actorId: String(actor.actorId).trim(),
      actorType: actor.actorType,
      tenantId: String(actor.tenantId).trim(),
      roleReference: isNonEmptyString(actor.roleReference)
        ? String(actor.roleReference).trim()
        : null,
    }),
  };
}

/**
 * @param {unknown} authority
 * @param {{ requireElevated?: boolean, elevatedMarker?: string }} [opts]
 * @returns {{ errors: object[], value: object|null }}
 */
export function collectAuthorityErrors(authority, opts = {}) {
  /** @type {object[]} */
  const errors = [];

  if (!authority || typeof authority !== "object" || Array.isArray(authority)) {
    errors.push(
      createFieldError(
        "authority",
        COMPETITION_ARCHIVE_ERROR_CODE.MISSING_AUTHORITY_REFERENCE,
        "explicit authority decision is required",
        {}
      )
    );
    return { errors, value: null };
  }

  if (!isCompetitionArchiveAuthorizationDecision(authority.authorizationDecision)) {
    errors.push(
      createFieldError(
        "authority.authorizationDecision",
        COMPETITION_ARCHIVE_ERROR_CODE.MISSING_AUTHORITY_REFERENCE,
        "authority.authorizationDecision must be ALLOWED or DENIED",
        { value: authority.authorizationDecision }
      )
    );
  } else if (
    authority.authorizationDecision ===
    COMPETITION_ARCHIVE_AUTHORIZATION_DECISION.DENIED
  ) {
    errors.push(
      createFieldError(
        "authority.authorizationDecision",
        COMPETITION_ARCHIVE_ERROR_CODE.AUTHORITY_DENIED,
        "authority decision is DENIED — command rejected fail-closed",
        {}
      )
    );
  }

  if (!isNonEmptyString(authority.authorizationPolicyId)) {
    errors.push(
      createFieldError(
        "authority.authorizationPolicyId",
        COMPETITION_ARCHIVE_ERROR_CODE.MISSING_AUTHORITY_REFERENCE,
        "explicit authorizationPolicyId is required",
        {}
      )
    );
  }
  if (!isNonEmptyString(authority.authorizationPolicyVersion)) {
    errors.push(
      createFieldError(
        "authority.authorizationPolicyVersion",
        COMPETITION_ARCHIVE_ERROR_CODE.MISSING_AUTHORITY_REFERENCE,
        "explicit authorizationPolicyVersion is required",
        {}
      )
    );
  }
  if (!isNonEmptyString(authority.decisionReference)) {
    errors.push(
      createFieldError(
        "authority.decisionReference",
        COMPETITION_ARCHIVE_ERROR_CODE.MISSING_AUTHORITY_REFERENCE,
        "explicit decisionReference is required",
        {}
      )
    );
  }

  let decidedAt = null;
  if (authority.decidedAt != null) {
    if (
      typeof authority.decidedAt === "string" &&
      !Number.isNaN(Date.parse(authority.decidedAt))
    ) {
      decidedAt = new Date(authority.decidedAt).toISOString();
    } else {
      errors.push(
        createFieldError(
          "authority.decidedAt",
          COMPETITION_ARCHIVE_ERROR_CODE.INVALID_CONTRACT,
          "authority.decidedAt must be a valid timestamp when provided",
          {}
        )
      );
    }
  }

  for (const forbidden of ["token", "session", "password", "secret", "accessToken"]) {
    if (Object.prototype.hasOwnProperty.call(authority, forbidden)) {
      errors.push(
        createFieldError(
          `authority.${forbidden}`,
          COMPETITION_ARCHIVE_ERROR_CODE.INVALID_CONTRACT,
          "authority must not include secrets, tokens, or session material",
          {}
        )
      );
    }
  }

  if (opts.requireElevated === true) {
    const marker = opts.elevatedMarker || "ELEVATED";
    const scope = isNonEmptyString(authority.authorityScope)
      ? String(authority.authorityScope).trim()
      : "";
    const elevated =
      authority.elevated === true ||
      scope === marker ||
      (Array.isArray(authority.scopes) &&
        authority.scopes.map(String).includes(marker));
    if (!elevated) {
      errors.push(
        createFieldError(
          "authority.authorityScope",
          COMPETITION_ARCHIVE_ERROR_CODE.ELEVATED_AUTHORITY_REQUIRED,
          `elevated authority marker '${marker}' is required`,
          { requiredMarker: marker }
        )
      );
    }
  }

  if (errors.length > 0) return { errors, value: null };

  const policyId = String(authority.authorizationPolicyId).trim();
  const policyVersion = String(authority.authorizationPolicyVersion).trim();
  const decisionReference = String(authority.decisionReference).trim();
  if (
    hasControlCharacters(policyId) ||
    hasControlCharacters(policyVersion) ||
    hasControlCharacters(decisionReference)
  ) {
    errors.push(
      createFieldError(
        "authority",
        COMPETITION_ARCHIVE_ERROR_CODE.INVALID_CONTRACT,
        "authority references must not contain control characters",
        {}
      )
    );
    return { errors, value: null };
  }

  return {
    errors,
    value: deepFreeze({
      authorizationDecision: COMPETITION_ARCHIVE_AUTHORIZATION_DECISION.ALLOWED,
      authorizationPolicyId: policyId,
      authorizationPolicyVersion: policyVersion,
      decisionReference,
      decidedAt,
      authorityScope: isNonEmptyString(authority.authorityScope)
        ? String(authority.authorityScope).trim()
        : null,
      elevated: authority.elevated === true,
    }),
  };
}
