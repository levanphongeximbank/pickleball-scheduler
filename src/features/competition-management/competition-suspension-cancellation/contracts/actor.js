/**
 * Actor + authority validation for CM-07 commands.
 * CM-07 does not own RBAC — it requires an explicit authority decision.
 */

import { COMPETITION_LIFECYCLE_ERROR_CODE } from "../errors/errorCodes.js";
import {
  COMPETITION_LIFECYCLE_AUTHORIZATION_DECISION,
  isCompetitionLifecycleActorType,
  isCompetitionLifecycleAuthorizationDecision,
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
        COMPETITION_LIFECYCLE_ERROR_CODE.MISSING_ACTOR,
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
        COMPETITION_LIFECYCLE_ERROR_CODE.MISSING_ACTOR,
        "explicit actor.actorId is required",
        {}
      )
    );
  }
  if (!isCompetitionLifecycleActorType(actor.actorType)) {
    errors.push(
      createFieldError(
        "actor.actorType",
        COMPETITION_LIFECYCLE_ERROR_CODE.MISSING_ACTOR,
        "explicit actor.actorType (USER|SERVICE|SYSTEM) is required",
        { value: actor.actorType }
      )
    );
  }
  if (!isNonEmptyString(actor.tenantId)) {
    errors.push(
      createFieldError(
        "actor.tenantId",
        COMPETITION_LIFECYCLE_ERROR_CODE.MISSING_ACTOR,
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
        COMPETITION_LIFECYCLE_ERROR_CODE.ACTOR_TENANT_MISMATCH,
        "actor.tenantId must match command tenantId",
        {
          expected: String(expectedTenantId).trim(),
          actual: String(actor.tenantId).trim(),
        }
      )
    );
  }

  // Reject accidental secret leakage fields.
  for (const forbidden of ["token", "session", "password", "secret", "accessToken"]) {
    if (Object.prototype.hasOwnProperty.call(actor, forbidden)) {
      errors.push(
        createFieldError(
          `actor.${forbidden}`,
          COMPETITION_LIFECYCLE_ERROR_CODE.INVALID_CONTRACT,
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
 * @returns {{ errors: object[], value: object|null }}
 */
export function collectAuthorityErrors(authority) {
  /** @type {object[]} */
  const errors = [];

  if (!authority || typeof authority !== "object" || Array.isArray(authority)) {
    errors.push(
      createFieldError(
        "authority",
        COMPETITION_LIFECYCLE_ERROR_CODE.MISSING_AUTHORITY_REFERENCE,
        "explicit authority decision is required",
        {}
      )
    );
    return { errors, value: null };
  }

  if (!isCompetitionLifecycleAuthorizationDecision(authority.authorizationDecision)) {
    errors.push(
      createFieldError(
        "authority.authorizationDecision",
        COMPETITION_LIFECYCLE_ERROR_CODE.MISSING_AUTHORITY_REFERENCE,
        "authority.authorizationDecision must be ALLOWED or DENIED",
        { value: authority.authorizationDecision }
      )
    );
  } else if (
    authority.authorizationDecision ===
    COMPETITION_LIFECYCLE_AUTHORIZATION_DECISION.DENIED
  ) {
    errors.push(
      createFieldError(
        "authority.authorizationDecision",
        COMPETITION_LIFECYCLE_ERROR_CODE.AUTHORITY_DENIED,
        "authority decision is DENIED — command rejected fail-closed",
        {}
      )
    );
  }

  if (!isNonEmptyString(authority.authorizationPolicyId)) {
    errors.push(
      createFieldError(
        "authority.authorizationPolicyId",
        COMPETITION_LIFECYCLE_ERROR_CODE.MISSING_AUTHORITY_REFERENCE,
        "explicit authorizationPolicyId is required",
        {}
      )
    );
  }
  if (!isNonEmptyString(authority.authorizationPolicyVersion)) {
    errors.push(
      createFieldError(
        "authority.authorizationPolicyVersion",
        COMPETITION_LIFECYCLE_ERROR_CODE.MISSING_AUTHORITY_REFERENCE,
        "explicit authorizationPolicyVersion is required",
        {}
      )
    );
  }
  if (!isNonEmptyString(authority.decisionReference)) {
    errors.push(
      createFieldError(
        "authority.decisionReference",
        COMPETITION_LIFECYCLE_ERROR_CODE.MISSING_AUTHORITY_REFERENCE,
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
          COMPETITION_LIFECYCLE_ERROR_CODE.INVALID_CONTRACT,
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
          COMPETITION_LIFECYCLE_ERROR_CODE.INVALID_CONTRACT,
          "authority must not include secrets, tokens, or session material",
          {}
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
        COMPETITION_LIFECYCLE_ERROR_CODE.INVALID_CONTRACT,
        "authority references must not contain control characters",
        {}
      )
    );
    return { errors, value: null };
  }

  return {
    errors,
    value: deepFreeze({
      authorizationDecision: COMPETITION_LIFECYCLE_AUTHORIZATION_DECISION.ALLOWED,
      authorizationPolicyId: policyId,
      authorizationPolicyVersion: policyVersion,
      decisionReference,
      decidedAt,
    }),
  };
}
