/**
 * Identity-domain point lookup for one canonical subject.
 *
 * Competition-safe evidence only. Not a directory, search, or login API.
 * Private persistence reads stay inside Identity. Callers cannot supply
 * role, status, or tenant/scope authority.
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
  INCOMPLETE_IDENTITY: "INCOMPLETE_IDENTITY",
});

const EMAIL_LIKE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_LIKE = /^[+]?[\d\s().-]{8,}$/;
const MAX_SUBJECT_ID_LENGTH = 128;

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

function authoritativeTenantId(record) {
  if (isNonEmptyString(record?.tenantId)) return String(record.tenantId).trim();
  if (isNonEmptyString(record?.venueId)) return String(record.venueId).trim();
  return null;
}

function toCompetitionSafeEvidence(record) {
  const subjectId = String(record.id).trim();
  const role = normalizeRole(record.role);
  const status = isNonEmptyString(record.status)
    ? String(record.status).trim()
    : USER_STATUS.ACTIVE;
  const tenantId = authoritativeTenantId(record);
  const venueId = isNonEmptyString(record.venueId)
    ? String(record.venueId).trim()
    : tenantId;
  const clubId = isNonEmptyString(record.clubId)
    ? String(record.clubId).trim()
    : null;

  return Object.freeze({
    subjectId,
    role,
    status,
    active: status === USER_STATUS.ACTIVE,
    tenantId,
    venueId,
    clubId,
    scopeIds: Object.freeze({
      tenantId,
      venueId,
      clubId,
      organizationId: null,
    }),
    source: "identity",
    evidenceVersion: SUBJECT_IDENTITY_EVIDENCE_VERSION,
  });
}

function subjectMatchesRequestedTenant(evidence, requestedTenantId) {
  if (!requestedTenantId) return false;
  if (evidence.tenantId && evidence.tenantId === requestedTenantId) return true;
  if (evidence.venueId && evidence.venueId === requestedTenantId) return true;
  if (!evidence.tenantId && isPlatformWideRole(evidence.role)) return true;
  return false;
}

async function defaultLoadIdentitySubjectById(subjectId) {
  const persistence = await import("./subjectIdentityPersistence.js");
  return persistence.loadIdentitySubjectByIdFromPersistence(subjectId);
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

  const evidence = toCompetitionSafeEvidence(record);
  if (requestedTenantId && !subjectMatchesRequestedTenant(evidence, requestedTenantId)) {
    return Object.freeze({
      ok: false,
      code: SUBJECT_IDENTITY_LOOKUP_CODE.SCOPE_MISMATCH,
      evidence: Object.freeze({
        subjectId: evidence.subjectId,
        tenantId: evidence.tenantId,
        venueId: evidence.venueId,
        clubId: evidence.clubId,
        scopeIds: evidence.scopeIds,
        matchesRequestedTenant: false,
        source: evidence.source,
        evidenceVersion: evidence.evidenceVersion,
      }),
    });
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
