/**
 * Standard request context for Canonical Competition Adapter Contracts.
 * Tenant-sensitive operations fail closed. Display names are never identity.
 */

import {
  CANONICAL_CONTEXT_FIELDS,
  COMPETITION_ADAPTER_CONTRACT_VERSION_V1,
  DISTINCT_SCOPE_KEYS,
  FUZZY_IDENTITY_FIELDS,
  SHARED_ADAPTER_ERROR_CODE,
} from "./constants.js";
import { failCompetitionAdapter } from "./errors.js";
import { freezeClone, isNonEmptyString, isPlainObject } from "./helpers.js";

const EMAIL_LIKE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_LIKE = /^[+]?[\d\s().-]{8,}$/;

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function looksLikeFuzzyIdentity(value) {
  if (!isNonEmptyString(value)) return false;
  const trimmed = String(value).trim();
  if (EMAIL_LIKE.test(trimmed)) return true;
  const digits = trimmed.replace(/\D/g, "");
  if (PHONE_LIKE.test(trimmed) && digits.length >= 8) return true;
  return false;
}

/**
 * @param {unknown} context
 * @param {{
 *   requiredFields?: string[],
 *   boundTenantId?: string|null,
 *   requireActor?: boolean,
 *   mutation?: boolean,
 *   requireExpectedVersion?: boolean,
 *   requireIdempotencyKey?: boolean,
 * }} [options]
 */
export function requireAdapterContext(context, options = {}) {
  if (!isPlainObject(context)) {
    failCompetitionAdapter(
      SHARED_ADAPTER_ERROR_CODE.MISSING_REQUIRED_CONTEXT,
      "Adapter context must be a plain object",
      { contextType: context == null ? "null" : typeof context }
    );
  }

  const requiredFields = Array.isArray(options.requiredFields)
    ? options.requiredFields
    : ["tenantId"];

  /** @type {Record<string, string|null>} */
  const normalized = {};
  for (const field of requiredFields) {
    const raw = context[field];
    if (!isNonEmptyString(raw)) {
      failCompetitionAdapter(
        SHARED_ADAPTER_ERROR_CODE.MISSING_REQUIRED_CONTEXT,
        `${field} is required`,
        { field }
      );
    }
    normalized[field] = String(raw).trim();
  }

  if (normalized.contractVersion && normalized.contractVersion !== COMPETITION_ADAPTER_CONTRACT_VERSION_V1) {
    failCompetitionAdapter(
      SHARED_ADAPTER_ERROR_CODE.INCOMPATIBLE_CONTRACT_VERSION,
      "contractVersion must be 1.0.0",
      { contractVersion: normalized.contractVersion }
    );
  }

  const tenantId = isNonEmptyString(context.tenantId)
    ? String(context.tenantId).trim()
    : normalized.tenantId || null;

  if (requiredFields.includes("tenantId") && !tenantId) {
    failCompetitionAdapter(
      SHARED_ADAPTER_ERROR_CODE.MISSING_REQUIRED_CONTEXT,
      "tenantId is required",
      { field: "tenantId" }
    );
  }

  if (options.boundTenantId && tenantId && options.boundTenantId !== tenantId) {
    failCompetitionAdapter(
      SHARED_ADAPTER_ERROR_CODE.CROSS_TENANT_CONTEXT,
      "Request tenantId does not match adapter bound tenant",
      { tenantId, boundTenantId: options.boundTenantId }
    );
  }

  const resourceTenantId = isNonEmptyString(context.resourceTenantId)
    ? String(context.resourceTenantId).trim()
    : isNonEmptyString(context.claimedTenantId)
      ? String(context.claimedTenantId).trim()
      : null;
  if (tenantId && resourceTenantId && resourceTenantId !== tenantId) {
    failCompetitionAdapter(
      SHARED_ADAPTER_ERROR_CODE.CROSS_TENANT_CONTEXT,
      "Cross-tenant context is forbidden",
      { tenantId, resourceTenantId }
    );
  }

  for (const fuzzyField of FUZZY_IDENTITY_FIELDS) {
    if (context[fuzzyField] != null && context.useDisplayNameAsIdentity === true) {
      failCompetitionAdapter(
        SHARED_ADAPTER_ERROR_CODE.DISPLAY_NAME_IS_NOT_IDENTITY,
        "Display name / email / phone is never canonical identity authority",
        { field: fuzzyField }
      );
    }
  }

  const identityCandidates = [
    "actorId",
    "participantId",
    "playerId",
    "canonicalPlayerId",
    "subjectId",
  ];
  for (const key of identityCandidates) {
    if (isNonEmptyString(context[key]) && looksLikeFuzzyIdentity(context[key])) {
      failCompetitionAdapter(
        SHARED_ADAPTER_ERROR_CODE.FUZZY_IDENTITY_FORBIDDEN,
        "Canonical identity must not be an email or phone",
        { field: key }
      );
    }
  }

  if (options.requireActor && !isNonEmptyString(context.actorId)) {
    failCompetitionAdapter(
      SHARED_ADAPTER_ERROR_CODE.MISSING_REQUIRED_CONTEXT,
      "actorId is required for actor-sensitive operations",
      { field: "actorId" }
    );
  }

  if (options.requireExpectedVersion && !isNonEmptyString(context.expectedVersion)) {
    failCompetitionAdapter(
      SHARED_ADAPTER_ERROR_CODE.STALE_WRITE,
      "expectedVersion is required for this command",
      { field: "expectedVersion" }
    );
  }

  if (options.requireIdempotencyKey && !isNonEmptyString(context.idempotencyKey)) {
    failCompetitionAdapter(
      SHARED_ADAPTER_ERROR_CODE.MISSING_IDEMPOTENCY,
      "idempotencyKey is required for this command/event",
      { field: "idempotencyKey" }
    );
  }

  const optionalKeys = [
    ...CANONICAL_CONTEXT_FIELDS.ALWAYS_APPLICABLE,
    ...CANONICAL_CONTEXT_FIELDS.ACTOR_SENSITIVE,
    ...CANONICAL_CONTEXT_FIELDS.WHEN_APPLICABLE,
    ...CANONICAL_CONTEXT_FIELDS.MUTATION,
    "playerId",
    "canonicalPlayerId",
    "eventType",
    "action",
    "entityRef",
    "role",
  ];

  /** @type {Record<string, string|null>} */
  const out = {
    contractVersion: isNonEmptyString(context.contractVersion)
      ? String(context.contractVersion).trim()
      : COMPETITION_ADAPTER_CONTRACT_VERSION_V1,
    tenantId,
  };
  for (const key of optionalKeys) {
    if (key === "tenantId" || key === "contractVersion") continue;
    out[key] = isNonEmptyString(context[key]) ? String(context[key]).trim() : null;
  }

  return freezeClone(out);
}

/**
 * Tenant, organization, club, and venue IDs must remain distinct concepts.
 * @param {unknown} scope
 */
export function distinguishScopeIds(scope) {
  const ctx = isPlainObject(scope) ? scope : {};
  const distinguished = {};
  for (const key of DISTINCT_SCOPE_KEYS) {
    distinguished[key] = isNonEmptyString(ctx[key]) ? String(ctx[key]).trim() : null;
  }
  const present = Object.values(distinguished).filter(Boolean);
  const unique = new Set(present);
  if (present.length >= 2 && unique.size === 1) {
    // Same string reused across distinct concepts is not automatic proof of
    // collapse, but collapsing via explicit alias flags is forbidden.
  }
  if (ctx.collapseScopeIds === true || ctx.tenantIdIsVenueId === true) {
    failCompetitionAdapter(
      SHARED_ADAPTER_ERROR_CODE.MALFORMED_ADAPTER,
      "tenantId, organizationId, clubId, and venueId must not be collapsed",
      { distinguished }
    );
  }
  return freezeClone(distinguished);
}

/**
 * Never infer a tenant from a display name.
 * @param {unknown} context
 * @returns {string}
 */
export function requireCanonicalTenantId(context) {
  if (!isPlainObject(context)) {
    failCompetitionAdapter(
      SHARED_ADAPTER_ERROR_CODE.MISSING_REQUIRED_CONTEXT,
      "tenantId is required",
      {}
    );
  }
  if (isNonEmptyString(context.tenantId)) {
    return String(context.tenantId).trim();
  }
  if (isNonEmptyString(context.tenantName) || isNonEmptyString(context.displayName)) {
    failCompetitionAdapter(
      SHARED_ADAPTER_ERROR_CODE.DISPLAY_NAME_IS_NOT_IDENTITY,
      "Never infer a tenant from display names",
      {}
    );
  }
  failCompetitionAdapter(
    SHARED_ADAPTER_ERROR_CODE.MISSING_REQUIRED_CONTEXT,
    "tenantId is required",
    { field: "tenantId" }
  );
}
