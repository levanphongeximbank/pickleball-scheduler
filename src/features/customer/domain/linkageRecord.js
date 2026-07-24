/**
 * Customer linkage record domain (CUSTOMER-05).
 *
 * Customer Management owns customer-side linkage records only.
 * Identity, Player Management and CRM remain sources of truth for their entities.
 * Matching email, phone or name is not sufficient evidence to create a link.
 */

import {
  CUSTOMER_LINKAGE_ACTION,
  isCustomerLinkageAction,
} from "../constants/linkageActions.js";
import {
  CUSTOMER_LINKAGE_EXTERNAL_SYSTEM,
  CUSTOMER_LINKAGE_TYPE,
  isCustomerLinkageType,
} from "../constants/linkageTypes.js";
import {
  CUSTOMER_LINKAGE_SOURCE,
  isCustomerLinkageSource,
} from "../constants/linkageSources.js";
import {
  CUSTOMER_LINKAGE_STATUS,
  isActiveCustomerLinkageStatus,
  isCustomerLinkageStatus,
} from "../constants/linkageStatuses.js";
import { CUSTOMER_ERROR_CODES } from "../errors/codes.js";
import { throwCustomerError } from "../errors/CustomerError.js";
import { optionalOpaqueId, requireOpaqueId } from "./identifiers.js";
import { createCustomerScope } from "./scope.js";

const LINKAGE_ID_PREFIX = "lnk";

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string|null}
 */
function optionalIso(value, field) {
  if (value == null || value === "") return null;
  const s = String(value);
  if (Number.isNaN(Date.parse(s))) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_CUSTOMER_LINKAGE,
      `${field} must be a valid ISO-8601 timestamp.`,
      { field, value: s }
    );
  }
  return s;
}

/**
 * @param {string} linkageType
 * @returns {string}
 */
export function defaultExternalSystemForLinkageType(linkageType) {
  if (linkageType === CUSTOMER_LINKAGE_TYPE.IDENTITY_ACCOUNT) {
    return CUSTOMER_LINKAGE_EXTERNAL_SYSTEM.IDENTITY;
  }
  if (linkageType === CUSTOMER_LINKAGE_TYPE.PLAYER) {
    return CUSTOMER_LINKAGE_EXTERNAL_SYSTEM.PLAYER;
  }
  if (linkageType === CUSTOMER_LINKAGE_TYPE.CRM_CONTACT) {
    return CUSTOMER_LINKAGE_EXTERNAL_SYSTEM.CRM;
  }
  throwCustomerError(
    CUSTOMER_ERROR_CODES.UNSUPPORTED_LINKAGE_TYPE,
    "Unsupported linkage type.",
    { linkageType }
  );
}

/**
 * @param {string} linkageType
 * @returns {string}
 */
export function defaultExternalReferenceType(linkageType) {
  if (linkageType === CUSTOMER_LINKAGE_TYPE.IDENTITY_ACCOUNT) {
    return "AUTH_USER";
  }
  if (linkageType === CUSTOMER_LINKAGE_TYPE.PLAYER) {
    return "PLAYER";
  }
  if (linkageType === CUSTOMER_LINKAGE_TYPE.CRM_CONTACT) {
    return "CONTACT_REF";
  }
  return "EXTERNAL";
}

/**
 * @param {object} input
 * @param {{ nowIso?: () => string, nextId?: (prefix: string) => string }} [deps]
 * @returns {Readonly<object>}
 */
export function createCustomerLinkageRecord(input = {}, deps = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_CUSTOMER_LINKAGE,
      "Linkage input must be a plain object."
    );
  }

  const scope = createCustomerScope(input);
  const nowIso =
    typeof deps.nowIso === "function" ? deps.nowIso() : new Date().toISOString();
  const nextId =
    typeof deps.nextId === "function"
      ? deps.nextId
      : (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

  const linkageType = String(input.linkageType || "").trim();
  if (!isCustomerLinkageType(linkageType)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.UNSUPPORTED_LINKAGE_TYPE,
      "Unsupported linkage type.",
      { field: "linkageType", linkageType }
    );
  }

  const status = String(input.status || CUSTOMER_LINKAGE_STATUS.ACTIVE).trim();
  if (!isCustomerLinkageStatus(status)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_CUSTOMER_LINKAGE,
      "Invalid linkage status.",
      { field: "status", status }
    );
  }

  const source = String(input.source || CUSTOMER_LINKAGE_SOURCE.MANUAL).trim();
  if (!isCustomerLinkageSource(source)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_CUSTOMER_LINKAGE,
      "Invalid linkage source.",
      { field: "source", source }
    );
  }

  const externalReferenceId = requireOpaqueId(
    input.externalReferenceId,
    "externalReferenceId"
  );
  const externalSystem = String(
    input.externalSystem || defaultExternalSystemForLinkageType(linkageType)
  ).trim();
  if (!externalSystem) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_CUSTOMER_LINKAGE,
      "externalSystem is required.",
      { field: "externalSystem" }
    );
  }

  const externalReferenceType = String(
    input.externalReferenceType || defaultExternalReferenceType(linkageType)
  ).trim();

  const effectiveAt = optionalIso(input.effectiveAt, "effectiveAt") || nowIso;
  const endedAt = optionalIso(input.endedAt, "endedAt");
  if (isActiveCustomerLinkageStatus(status) && endedAt != null) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_CUSTOMER_LINKAGE,
      "ACTIVE linkage must not have endedAt.",
      { field: "endedAt" }
    );
  }
  if (!isActiveCustomerLinkageStatus(status) && endedAt == null) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_CUSTOMER_LINKAGE,
      "Inactive/unlinked linkage requires endedAt.",
      { field: "endedAt" }
    );
  }

  const version =
    input.version == null ? 1 : Number(input.version);
  if (!Number.isInteger(version) || version < 1) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_CUSTOMER_LINKAGE,
      "version must be an integer >= 1.",
      { field: "version", version }
    );
  }

  const createdAt = optionalIso(input.createdAt, "createdAt") || nowIso;
  const updatedAt = optionalIso(input.updatedAt, "updatedAt") || nowIso;

  return Object.freeze({
    linkageId: requireOpaqueId(
      input.linkageId || nextId(LINKAGE_ID_PREFIX),
      "linkageId"
    ),
    customerId: requireOpaqueId(input.customerId, "customerId"),
    tenantId: scope.tenantId,
    venueId: scope.venueId,
    linkageType,
    externalReferenceId,
    externalReferenceType,
    externalSystem,
    status,
    source,
    evidenceReference: optionalOpaqueId(
      input.evidenceReference,
      "evidenceReference"
    ),
    actorReference: optionalOpaqueId(input.actorReference, "actorReference"),
    effectiveAt,
    endedAt,
    version,
    createdAt,
    updatedAt,
  });
}

/**
 * Activate / re-link an existing inactive linkage to the same external reference.
 * @param {object} current
 * @param {object} [input]
 * @param {{ nowIso?: () => string }} [deps]
 */
export function activateCustomerLinkage(current, input = {}, deps = {}) {
  if (!current || typeof current !== "object") {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.LINKAGE_NOT_FOUND,
      "Linkage not found."
    );
  }
  const nowIso =
    typeof deps.nowIso === "function" ? deps.nowIso() : new Date().toISOString();
  const source = String(input.source || current.source || CUSTOMER_LINKAGE_SOURCE.MANUAL);
  if (!isCustomerLinkageSource(source)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_CUSTOMER_LINKAGE,
      "Invalid linkage source.",
      { field: "source", source }
    );
  }
  return Object.freeze({
    ...current,
    status: CUSTOMER_LINKAGE_STATUS.ACTIVE,
    source,
    evidenceReference:
      input.evidenceReference === undefined
        ? current.evidenceReference
        : optionalOpaqueId(input.evidenceReference, "evidenceReference"),
    actorReference:
      input.actorReference === undefined
        ? current.actorReference
        : optionalOpaqueId(input.actorReference, "actorReference"),
    effectiveAt: optionalIso(input.effectiveAt, "effectiveAt") || nowIso,
    endedAt: null,
    updatedAt: nowIso,
    version: current.version + 1,
  });
}

/**
 * @param {object} current
 * @param {"UNLINKED"|"INACTIVE"} nextStatus
 * @param {object} [input]
 * @param {{ nowIso?: () => string }} [deps]
 */
export function endCustomerLinkage(
  current,
  nextStatus,
  input = {},
  deps = {}
) {
  if (!current || typeof current !== "object") {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.LINKAGE_NOT_FOUND,
      "Linkage not found."
    );
  }
  if (
    nextStatus !== CUSTOMER_LINKAGE_STATUS.UNLINKED &&
    nextStatus !== CUSTOMER_LINKAGE_STATUS.INACTIVE
  ) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_CUSTOMER_LINKAGE,
      "endCustomerLinkage requires UNLINKED or INACTIVE.",
      { nextStatus }
    );
  }
  if (!isActiveCustomerLinkageStatus(current.status)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.LINKAGE_ALREADY_INACTIVE,
      "Linkage is already inactive.",
      {
        linkageId: current.linkageId,
        status: current.status,
      }
    );
  }
  const nowIso =
    typeof deps.nowIso === "function" ? deps.nowIso() : new Date().toISOString();
  const source = String(input.source || current.source || CUSTOMER_LINKAGE_SOURCE.MANUAL);
  if (!isCustomerLinkageSource(source)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_CUSTOMER_LINKAGE,
      "Invalid linkage source.",
      { field: "source", source }
    );
  }
  return Object.freeze({
    ...current,
    status: nextStatus,
    source,
    actorReference:
      input.actorReference === undefined
        ? current.actorReference
        : optionalOpaqueId(input.actorReference, "actorReference"),
    endedAt: optionalIso(input.endedAt, "endedAt") || nowIso,
    updatedAt: nowIso,
    version: current.version + 1,
  });
}

/**
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function createCustomerLinkageHistoryRecord(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_CUSTOMER_LINKAGE,
      "Linkage history input must be a plain object."
    );
  }
  const scope = createCustomerScope(input);
  const action = String(input.action || "").trim();
  if (!isCustomerLinkageAction(action)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_CUSTOMER_LINKAGE,
      "Invalid linkage history action.",
      { field: "action", action }
    );
  }
  const sequence = Number(input.sequence);
  if (!Number.isInteger(sequence) || sequence < 1) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_CUSTOMER_LINKAGE,
      "history sequence must be an integer >= 1.",
      { field: "sequence", sequence }
    );
  }
  const customerVersion = Number(input.customerVersion);
  if (!Number.isInteger(customerVersion) || customerVersion < 1) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_CUSTOMER_LINKAGE,
      "customerVersion must be an integer >= 1.",
      { field: "customerVersion", customerVersion }
    );
  }

  return Object.freeze({
    historyId: requireOpaqueId(input.historyId, "historyId"),
    linkageId: requireOpaqueId(input.linkageId, "linkageId"),
    customerId: requireOpaqueId(input.customerId, "customerId"),
    tenantId: scope.tenantId,
    venueId: scope.venueId,
    linkageType: String(input.linkageType || "").trim(),
    externalReferenceId: requireOpaqueId(
      input.externalReferenceId,
      "externalReferenceId"
    ),
    previousStatus: String(input.previousStatus || "").trim() || null,
    nextStatus: String(input.nextStatus || "").trim(),
    action,
    source: String(input.source || "").trim() || null,
    reason: input.reason == null || input.reason === "" ? null : String(input.reason),
    evidenceReference: optionalOpaqueId(
      input.evidenceReference,
      "evidenceReference"
    ),
    actorReference: optionalOpaqueId(input.actorReference, "actorReference"),
    effectiveAt: optionalIso(input.effectiveAt, "effectiveAt"),
    sequence,
    customerVersion,
    recordedAt: optionalIso(input.recordedAt, "recordedAt") || new Date().toISOString(),
  });
}

export { CUSTOMER_LINKAGE_ACTION };
