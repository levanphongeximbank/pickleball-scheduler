/**
 * CrmTag and TagAssignment foundation models (Phase 1B + Phase 1F).
 */

import { CRM_ERROR_CODES, CrmError } from "../constants/errorCodes.js";
import { normalizeIsoTimestamp } from "../constants/timestamps.js";
import { isTagTargetType } from "../constants/tagTargetTypes.js";
import { createTenantVenueScope, requireNonEmptyId } from "./scope.js";

export const CRM_TAG_NAME_MAX_LENGTH = 120;
export const CRM_TAG_CODE_MAX_LENGTH = 64;
export const CRM_TAG_DESCRIPTION_MAX_LENGTH = 500;

/**
 * Normalize tag codes deterministically (unique within tenant/venue).
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeTagCode(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

/**
 * @param {object} input
 * @returns {object}
 */
export function createCrmTag(input = {}) {
  const scope = createTenantVenueScope(input);
  const tagId = requireNonEmptyId(input.tagId ?? input.id, "tagId");

  const nameRaw = input.name != null ? String(input.name).trim() : "";
  if (!nameRaw) {
    throw new CrmError(CRM_ERROR_CODES.INVALID_INPUT, "name is required.");
  }
  if (nameRaw.length > CRM_TAG_NAME_MAX_LENGTH) {
    throw new CrmError(
      CRM_ERROR_CODES.INVALID_INPUT,
      `name must be at most ${CRM_TAG_NAME_MAX_LENGTH} characters.`
    );
  }

  const codeRaw = input.code != null ? String(input.code).trim() : "";
  const code = normalizeTagCode(codeRaw || nameRaw);
  if (!code) {
    throw new CrmError(CRM_ERROR_CODES.INVALID_INPUT, "code is required.");
  }
  if (code.length > CRM_TAG_CODE_MAX_LENGTH) {
    throw new CrmError(
      CRM_ERROR_CODES.INVALID_INPUT,
      `code must be at most ${CRM_TAG_CODE_MAX_LENGTH} characters after normalization.`
    );
  }

  const description =
    input.description != null && String(input.description).trim()
      ? String(input.description).trim().slice(0, CRM_TAG_DESCRIPTION_MAX_LENGTH)
      : null;

  const active = input.active === false ? false : true;

  return Object.freeze({
    tagId,
    tenantId: scope.tenantId,
    venueId: scope.venueId,
    name: nameRaw,
    code,
    description,
    active,
    createdAt: normalizeIsoTimestamp(input.createdAt),
    updatedAt: normalizeIsoTimestamp(input.updatedAt ?? input.createdAt),
  });
}

/**
 * @param {object} input
 * @returns {object}
 */
export function createTagAssignment(input = {}) {
  const scope = createTenantVenueScope(input);
  const assignmentId = requireNonEmptyId(
    input.assignmentId ?? input.id,
    "assignmentId"
  );
  const tagId = requireNonEmptyId(input.tagId, "tagId");
  const targetType = requireNonEmptyId(input.targetType, "targetType");
  if (!isTagTargetType(targetType)) {
    throw new CrmError(
      CRM_ERROR_CODES.INVALID_INPUT,
      `Invalid tag target type: ${targetType}`
    );
  }
  const targetId = requireNonEmptyId(input.targetId, "targetId");
  const assignedByActorId = requireNonEmptyId(
    input.assignedByActorId,
    "assignedByActorId"
  );

  return Object.freeze({
    assignmentId,
    tenantId: scope.tenantId,
    venueId: scope.venueId,
    tagId,
    targetType,
    targetId,
    assignedByActorId,
    assignedAt: normalizeIsoTimestamp(input.assignedAt),
  });
}

/**
 * @deprecated Use createTagAssignment with targetType CONTACT_REFERENCE.
 * @param {object} input
 * @returns {object}
 */
export function createContactTagLink(input = {}) {
  const scope = createTenantVenueScope(input);
  const tagId = requireNonEmptyId(input.tagId, "tagId");
  const contactRefId = requireNonEmptyId(input.contactRefId, "contactRefId");

  return Object.freeze({
    tenantId: scope.tenantId,
    venueId: scope.venueId,
    tagId,
    contactRefId,
    createdAt: normalizeIsoTimestamp(input.createdAt),
  });
}

/**
 * Deterministic tag list order: normalized name, code, tagId.
 * @param {object} a
 * @param {object} b
 */
export function compareTagsList(a, b) {
  const nameCmp = String(a.name || "")
    .trim()
    .toLowerCase()
    .localeCompare(String(b.name || "").trim().toLowerCase());
  if (nameCmp !== 0) return nameCmp;

  const codeCmp = String(a.code || "").localeCompare(String(b.code || ""));
  if (codeCmp !== 0) return codeCmp;

  return String(a.tagId || "").localeCompare(String(b.tagId || ""));
}

/**
 * Deterministic assignment list order: assignedAt, assignmentId.
 * @param {object} a
 * @param {object} b
 */
export function compareTagAssignmentsList(a, b) {
  const atCmp = String(a.assignedAt || "").localeCompare(String(b.assignedAt || ""));
  if (atCmp !== 0) return atCmp;
  return String(a.assignmentId || "").localeCompare(String(b.assignmentId || ""));
}
