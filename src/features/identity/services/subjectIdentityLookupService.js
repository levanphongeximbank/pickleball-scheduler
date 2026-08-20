/**
 * Identity-domain point lookup for one canonical subject.
 *
 * Competition-safe evidence only. Not a directory, search, or login API.
 * Private persistence reads stay inside Identity. Callers cannot supply
 * role, status, or tenant/scope authority.
 *
 * Tenant is not venue. Missing tenant_id is null, never copied from venue_id.
 * Missing status is incomplete evidence, never synthesized as ACTIVE.
 */

import { isPlatformWideRole, normalizeRole } from "../constants/roles.js";
import { USER_STATUS } from "../../../models/user.js";

export const SUBJECT_IDENTITY_EVIDENCE_VERSION = "identity-subject-evidence-v1";

export const SUBJECT_IDENTITY_LOOKUP_CODE = Object.freeze({
  OK: "OK",
  MISSING_SUBJECT_ID: "MISSING_SUBJECT_ID",
  MALFORMED_SUBJECT_ID: "MALFORMED_SUBJECT_ID",
  FUZZY_IDENTITY_FORBIDDEN: "FUZZY_IDENTITY_FORBIDDEN",
  DISPLAY_NAME_IS_NOT_IDENTITY: "DISPLAY_NAME_IS_NOT_IDENTITY",
  SUBJECT_NOT_FOUND: "SUBJECT_NOT_FOUND",
  SCOPE_MISMATCH: "SCOPE_MISMATCH",
  MISSING_SCOPE_EVIDENCE: "MISSING_SCOPE_EVIDENCE",
  INCOMPLETE_IDENTITY: "INCOMPLETE_IDENTITY",
});

const EMAIL_LIKE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_LIKE = /^[+]?[\d\s().-]{8,}$/;
const MAX_SUBJECT_ID_LENGTH = 128;

const ACTIVE_STATUS_VALUES = Object.freeze(["active"]);
const INACTIVE_STATUS_VALUES = Object.freeze([
  "suspended",
  "inactive",
  "invited",
  "disabled",
  "locked",
]);

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function looksLikeEmailOrPhone(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return false;
  if (EMAIL_LIKE.test(trimmed) || trimmed.includes("@")) return true;
  const digits = trimmed.replace(/\D/g, "");
  return PHONE_LIKE.test(trimmed) && digits.length >= 8;
}

/**
 * Canonical subject IDs are opaque user ids (UUID or stable id).
 * Display names, email, and phone are never valid subject ids.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCanonicalSubjectId(value) {
  if (typeof value !== "string") return false;
  const id = value.trim();
  if (!id || id.length > MAX_SUBJECT_ID_LENGTH) return false;
  if (/\s/.test(id)) return false;
  if (looksLikeEmailOrPhone(id)) return false;
  return true;
}

function classifySubjectId(value) {
  if (value == null || value === "") {
    return SUBJECT_IDENTITY_LOOKUP_CODE.MISSING_SUBJECT_ID;
  }
  if (typeof value !== "string") {
    return SUBJECT_IDENTITY_LOOKUP_CODE.MALFORMED_SUBJECT_ID;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return SUBJECT_IDENTITY_LOOKUP_CODE.MISSING_SUBJECT_ID;
  }
  if (/\s/.test(trimmed)) {
    return SUBJECT_IDENTITY_LOOKUP_CODE.DISPLAY_NAME_IS_NOT_IDENTITY;
  }
  if (looksLikeEmailOrPhone(trimmed)) {
    return SUBJECT_IDENTITY_LOOKUP_CODE.FUZZY_IDENTITY_FORBIDDEN;
  }
  if (!isCanonicalSubjectId(trimmed)) {
    return SUBJECT_IDENTITY_LOOKUP_CODE.MALFORMED_SUBJECT_ID;
  }
  return null;
}

function readAuthoritativeField(record, keys) {
  for (const key of keys) {
    if (isNonEmptyString(record?.[key])) return String(record[key]).trim();
  }
  return null;
}

/**
 * Tenant identity only. Never copied from venueId.
 * @param {object|null|undefined} record
 * @returns {string|null}
 */
export function authoritativeTenantId(record) {
  return readAuthoritativeField(record, ["tenantId", "tenant_id"]);
}

/**
 * Home/resource venue only. Never copied from tenantId.
 * @param {object|null|undefined} record
 * @returns {string|null}
 */
export function authoritativeVenueId(record) {
  return readAuthoritativeField(record, ["venueId", "venue_id"]);
}

function authoritativeClubId(record) {
  return readAuthoritativeField(record, ["clubId", "club_id"]);
}

function authoritativeOrganizationId(record) {
  return readAuthoritativeField(record, ["organizationId", "organization_id"]);
}

/**
 * Explicit Identity status only. Missing/unreadable status is null.
 * Never synthesized as ACTIVE.
 * @param {unknown} raw
 * @returns {string|null}
 */
export function authoritativeStatus(raw) {
  if (typeof raw !== "string") return null;
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return null;
  if (ACTIVE_STATUS_VALUES.includes(normalized)) return USER_STATUS.ACTIVE;
  if (normalized === USER_STATUS.SUSPENDED || normalized === "suspended") {
    return USER_STATUS.SUSPENDED;
  }
  if (normalized === USER_STATUS.INVITED || normalized === "invited") {
    return USER_STATUS.INVITED;
  }
  if (INACTIVE_STATUS_VALUES.includes(normalized)) return normalized;
  return null;
}

function toCompetitionSafeEvidence(record) {
  const subjectId = String(record.id).trim();
  const role = normalizeRole(record.role);
  const status = authoritativeStatus(record.status);
  const tenantId = authoritativeTenantId(record);
  const venueId = authoritativeVenueId(record);
  const clubId = authoritativeClubId(record);
  const organizationId = authoritativeOrganizationId(record);

  return Object.freeze({
    subjectId,
    canonicalSubjectId: subjectId,
    role,
    status,
    active: status === USER_STATUS.ACTIVE,
    tenantId,
    venueId,
    clubId,
    organizationId,
    scopeIds: Object.freeze({
      tenantId,
      venueId,
      clubId,
      organizationId,
    }),
    source: "identity",
    evidenceVersion: SUBJECT_IDENTITY_EVIDENCE_VERSION,
  });
}

function subjectMatchesRequestedTenant(evidence, requestedTenantId) {
  if (!requestedTenantId) return false;
  if (evidence.tenantId && evidence.tenantId === requestedTenantId) return true;
  // Platform-wide roles may pass without tenant evidence (global-role semantics).
  // venueId is never tenant proof, even when the string equals requestedTenantId.
  if (!evidence.tenantId && isPlatformWideRole(evidence.role)) return true;
  return false;
}

function incompleteResult(subjectId) {
  return Object.freeze({
    ok: false,
    code: SUBJECT_IDENTITY_LOOKUP_CODE.INCOMPLETE_IDENTITY,
    evidence: Object.freeze({
      subjectId,
      source: "identity",
      evidenceVersion: SUBJECT_IDENTITY_EVIDENCE_VERSION,
    }),
  });
}

async function defaultLoadIdentitySubjectById(subjectId) {
  const persistence = await import("./subjectIdentityPersistence.js");
  return persistence.loadIdentitySubjectByIdFromPersistence(subjectId);
}

/**
 * Identity-owned point loader. Competition injects getAuthClient and must not
 * import subjectIdentityPersistence.js.
 *
 * @param {{
 *   getAuthClient?: () => { from: Function }|null,
 * }} [deps]
 * @returns {(subjectId: string) => Promise<object|null>}
 */
export function createIdentitySubjectPointLoader(deps = {}) {
  const getAuthClient =
    typeof deps.getAuthClient === "function" ? deps.getAuthClient : undefined;
  return async function loadIdentitySubjectById(subjectId) {
    const persistence = await import("./subjectIdentityPersistence.js");
    return persistence.loadIdentitySubjectByIdFromPersistence(subjectId, {
      getAuthClient,
    });
  };
}

/**
 * Resolve one known canonical subject by subjectId.
 *
 * Input authority that is ignored: role, status, active, tenant claims on the
 * subject record. Requested tenantId is used only for fail-closed scope check.
 *
 * @param {{
 *   subjectId?: unknown,
 *   requestedTenantId?: unknown,
 *   tenantId?: unknown,
 *   correlationId?: unknown,
 *   role?: unknown,
 *   status?: unknown,
 *   active?: unknown,
 * }} [input]
 * @param {{
 *   loadIdentitySubjectById?: (subjectId: string) => Promise<object|null>|object|null,
 * }} [deps]
 */
export async function resolveSubjectIdentityRecord(input = {}, deps = {}) {
  const malformed = classifySubjectId(input?.subjectId);
  if (malformed) {
    return Object.freeze({
      ok: false,
      code: malformed,
      evidence: null,
    });
  }

  const subjectId = String(input.subjectId).trim();
  const requestedTenantId = isNonEmptyString(input.requestedTenantId)
    ? String(input.requestedTenantId).trim()
    : isNonEmptyString(input.tenantId)
      ? String(input.tenantId).trim()
      : null;

  const load =
    typeof deps.loadIdentitySubjectById === "function"
      ? deps.loadIdentitySubjectById
      : defaultLoadIdentitySubjectById;

  const record = await load(subjectId);
  if (!record || !isNonEmptyString(record.id)) {
    return Object.freeze({
      ok: false,
      code: SUBJECT_IDENTITY_LOOKUP_CODE.SUBJECT_NOT_FOUND,
      evidence: Object.freeze({
        subjectId,
        source: "identity",
        evidenceVersion: SUBJECT_IDENTITY_EVIDENCE_VERSION,
      }),
    });
  }

  const loadedId = String(record.id).trim();
  if (loadedId !== subjectId) {
    return Object.freeze({
      ok: false,
      code: SUBJECT_IDENTITY_LOOKUP_CODE.SUBJECT_NOT_FOUND,
      evidence: Object.freeze({
        subjectId,
        source: "identity",
        evidenceVersion: SUBJECT_IDENTITY_EVIDENCE_VERSION,
      }),
    });
  }

  const role = normalizeRole(record.role);
  if (!role) {
    return incompleteResult(subjectId);
  }

  const status = authoritativeStatus(record.status);
  if (!status) {
    return incompleteResult(subjectId);
  }

  const evidence = toCompetitionSafeEvidence(record);

  if (requestedTenantId) {
    if (!evidence.tenantId && !isPlatformWideRole(evidence.role)) {
      return Object.freeze({
        ok: false,
        code: SUBJECT_IDENTITY_LOOKUP_CODE.MISSING_SCOPE_EVIDENCE,
        evidence: Object.freeze({
          subjectId: evidence.subjectId,
          tenantId: null,
          venueId: evidence.venueId,
          clubId: evidence.clubId,
          organizationId: evidence.organizationId,
          scopeIds: evidence.scopeIds,
          matchesRequestedTenant: false,
          source: evidence.source,
          evidenceVersion: evidence.evidenceVersion,
        }),
      });
    }
    if (!subjectMatchesRequestedTenant(evidence, requestedTenantId)) {
      return Object.freeze({
        ok: false,
        code: SUBJECT_IDENTITY_LOOKUP_CODE.SCOPE_MISMATCH,
        evidence: Object.freeze({
          subjectId: evidence.subjectId,
          tenantId: evidence.tenantId,
          venueId: evidence.venueId,
          clubId: evidence.clubId,
          organizationId: evidence.organizationId,
          scopeIds: evidence.scopeIds,
          matchesRequestedTenant: false,
          source: evidence.source,
          evidenceVersion: evidence.evidenceVersion,
        }),
      });
    }
  }

  return Object.freeze({
    ok: true,
    code: SUBJECT_IDENTITY_LOOKUP_CODE.OK,
    evidence: Object.freeze({
      ...evidence,
      matchesRequestedTenant: requestedTenantId
        ? subjectMatchesRequestedTenant(evidence, requestedTenantId)
        : null,
    }),
  });
}
