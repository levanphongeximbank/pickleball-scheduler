/**
 * Customer master profile domain model (CUSTOMER-01).
 *
 * Pure factories + transition helpers. No persistence, network, or UI.
 * Does not embed credentials, player sports profile, CRM pipeline, or balances.
 */

import { CUSTOMER_TYPE, isCustomerType } from "../constants/customerTypes.js";
import {
  CUSTOMER_STATUS,
  isCustomerStatus,
  isAllowedCustomerStatusTransition,
} from "../constants/customerStatuses.js";
import { CUSTOMER_ERROR_CODES } from "../errors/codes.js";
import { throwCustomerError } from "../errors/CustomerError.js";
import {
  assertPrimaryContactUniqueness,
  createContactPoint,
} from "./contactPoint.js";
import {
  createAccountLinkage,
  createOrganizationLinkage,
  createPlayerLinkage,
} from "./linkages.js";
import {
  createClassificationEntry,
  createSegmentReference,
  normalizeControlledTags,
} from "./classification.js";
import {
  createCommunicationPreference,
  createConsentReference,
} from "./communicationPreference.js";
import {
  mintCustomerId,
  mintCustomerNumber,
  requireOpaqueId,
} from "./identifiers.js";
import { createCustomerScope } from "./scope.js";

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
function requireDisplayName(value, field) {
  if (value == null || typeof value !== "string" || !value.trim()) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_INPUT,
      `${field} is required.`,
      { field }
    );
  }
  return value.trim();
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
function optionalTrimmed(value) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_INPUT,
      "Optional string field must be a string when provided."
    );
  }
  const trimmed = value.trim();
  return trimmed || null;
}

/**
 * @param {unknown} metadata
 * @returns {Readonly<Record<string, unknown>>}
 */
function normalizeMetadata(metadata) {
  if (metadata == null) return Object.freeze({});
  if (typeof metadata !== "object" || Array.isArray(metadata)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_INPUT,
      "metadata must be a plain object when provided.",
      { field: "metadata" }
    );
  }
  const banned = ["password", "credential", "secret", "token", "balance", "debtAmount"];
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (banned.includes(key)) {
      throwCustomerError(
        CUSTOMER_ERROR_CODES.INVALID_INPUT,
        `metadata key "${key}" is not allowed on Customer profile.`,
        { field: "metadata", key }
      );
    }
    out[key] = value;
  }
  return Object.freeze(out);
}

/**
 * @param {unknown} list
 * @param {(item: object, index: number) => object} factory
 * @returns {readonly object[]}
 */
function mapFrozenList(list, factory) {
  if (list == null) return Object.freeze([]);
  if (!Array.isArray(list)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_INPUT,
      "Expected an array.",
      { field: "list" }
    );
  }
  return Object.freeze(list.map((item, index) => factory(item, index)));
}

/**
 * Create a canonical customer master profile.
 *
 * @param {object} input
 * @param {{ nowIso?: () => string, nextId?: (prefix: string) => string }} [deps]
 * @returns {Readonly<object>}
 */
export function createCustomerProfile(input = {}, deps = {}) {
  const scope = createCustomerScope(input);
  const nowIso = typeof deps.nowIso === "function" ? deps.nowIso : () => new Date().toISOString();
  const nextId =
    typeof deps.nextId === "function"
      ? deps.nextId
      : (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

  const customerType = String(input.customerType || CUSTOMER_TYPE.INDIVIDUAL);
  if (!isCustomerType(customerType)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_TYPE,
      "customerType must be INDIVIDUAL or ORGANIZATION.",
      { field: "customerType", customerType }
    );
  }

  const status = String(input.status || CUSTOMER_STATUS.ACTIVE);
  if (!isCustomerStatus(status)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_STATUS,
      "customer status is invalid.",
      { field: "status", status }
    );
  }

  const entropy = nextId("id");
  const customerId = input.customerId
    ? requireOpaqueId(input.customerId, "customerId")
    : mintCustomerId(entropy);
  const customerNumber = input.customerNumber
    ? requireOpaqueId(input.customerNumber, "customerNumber")
    : mintCustomerNumber(entropy);

  const contactPoints = assertPrimaryContactUniqueness(
    mapFrozenList(input.contactPoints, (item, index) =>
      createContactPoint({
        contactPointId: item.contactPointId || nextId(`cp${index}`),
        ...item,
      })
    )
  );

  const createdAt = input.createdAt ? String(input.createdAt) : nowIso();
  const updatedAt = input.updatedAt ? String(input.updatedAt) : createdAt;

  return Object.freeze({
    customerId,
    customerNumber,
    tenantId: scope.tenantId,
    venueId: scope.venueId,
    displayName: requireDisplayName(input.displayName ?? input.name, "displayName"),
    legalName: optionalTrimmed(input.legalName ?? input.fullName),
    customerType,
    status,
    contactPoints: Object.freeze([...contactPoints]),
    locale: optionalTrimmed(input.locale ?? input.language),
    accountLinkage: createAccountLinkage(input.accountLinkage ?? null),
    playerLinkage: createPlayerLinkage(input.playerLinkage ?? null),
    organizationLinkage: createOrganizationLinkage(
      input.organizationLinkage ?? null
    ),
    classification: Object.freeze(
      mapFrozenList(input.classification, createClassificationEntry)
    ),
    segmentReferences: Object.freeze(
      mapFrozenList(input.segmentReferences, createSegmentReference)
    ),
    tags: normalizeControlledTags(input.tags),
    communicationPreferences: Object.freeze(
      mapFrozenList(input.communicationPreferences, (item, index) =>
        createCommunicationPreference({
          preferenceId: item.preferenceId || nextId(`pref${index}`),
          ...item,
        })
      )
    ),
    consentReferences: Object.freeze(
      mapFrozenList(input.consentReferences, createConsentReference)
    ),
    metadata: normalizeMetadata(input.metadata),
    createdAt,
    updatedAt,
    version: Number.isInteger(input.version) && input.version > 0 ? input.version : 1,
  });
}

/**
 * @param {object} customer
 * @param {object} patch
 * @param {{ nowIso?: () => string }} [deps]
 * @returns {Readonly<object>}
 */
export function updateCustomerProfileFields(customer, patch = {}, deps = {}) {
  if (!customer || typeof customer !== "object") {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_INPUT,
      "Customer profile is required for update."
    );
  }
  if (customer.status === CUSTOMER_STATUS.ARCHIVED) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_STATUS_TRANSITION,
      "Archived customers cannot be updated.",
      { customerId: customer.customerId, status: customer.status }
    );
  }

  const nowIso = typeof deps.nowIso === "function" ? deps.nowIso : () => new Date().toISOString();
  const next = {
    ...customer,
    displayName:
      patch.displayName !== undefined || patch.name !== undefined
        ? requireDisplayName(patch.displayName ?? patch.name, "displayName")
        : customer.displayName,
    legalName:
      patch.legalName !== undefined || patch.fullName !== undefined
        ? optionalTrimmed(patch.legalName ?? patch.fullName)
        : customer.legalName,
    locale:
      patch.locale !== undefined || patch.language !== undefined
        ? optionalTrimmed(patch.locale ?? patch.language)
        : customer.locale,
    metadata:
      patch.metadata !== undefined
        ? normalizeMetadata(patch.metadata)
        : customer.metadata,
    tags: patch.tags !== undefined ? normalizeControlledTags(patch.tags) : customer.tags,
    classification:
      patch.classification !== undefined
        ? Object.freeze(mapFrozenList(patch.classification, createClassificationEntry))
        : customer.classification,
    segmentReferences:
      patch.segmentReferences !== undefined
        ? Object.freeze(mapFrozenList(patch.segmentReferences, createSegmentReference))
        : customer.segmentReferences,
    communicationPreferences:
      patch.communicationPreferences !== undefined
        ? Object.freeze(
            mapFrozenList(patch.communicationPreferences, createCommunicationPreference)
          )
        : customer.communicationPreferences,
    consentReferences:
      patch.consentReferences !== undefined
        ? Object.freeze(mapFrozenList(patch.consentReferences, createConsentReference))
        : customer.consentReferences,
    updatedAt: nowIso(),
    version: customer.version + 1,
  };

  if (patch.customerType !== undefined) {
    const customerType = String(patch.customerType);
    if (!isCustomerType(customerType)) {
      throwCustomerError(
        CUSTOMER_ERROR_CODES.INVALID_TYPE,
        "customerType must be INDIVIDUAL or ORGANIZATION.",
        { field: "customerType", customerType }
      );
    }
    next.customerType = customerType;
  }

  return Object.freeze({
    ...next,
    contactPoints: Object.freeze([...(next.contactPoints || [])]),
  });
}

/**
 * @param {object} customer
 * @param {string} nextStatus
 * @param {{ nowIso?: () => string }} [deps]
 * @returns {Readonly<object>}
 */
export function changeCustomerStatus(customer, nextStatus, deps = {}) {
  const to = String(nextStatus || "");
  if (!isCustomerStatus(to)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_STATUS,
      "Target customer status is invalid.",
      { field: "status", status: to }
    );
  }
  if (!isAllowedCustomerStatusTransition(customer.status, to)) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_STATUS_TRANSITION,
      `Invalid customer status transition ${customer.status} → ${to}.`,
      {
        customerId: customer.customerId,
        from: customer.status,
        to,
      }
    );
  }
  const nowIso = typeof deps.nowIso === "function" ? deps.nowIso : () => new Date().toISOString();
  return Object.freeze({
    ...customer,
    status: to,
    contactPoints: Object.freeze([...(customer.contactPoints || [])]),
    updatedAt: nowIso(),
    version: customer.version + 1,
  });
}

/**
 * @param {object} customer
 * @param {object} contactInput
 * @param {{ nowIso?: () => string, nextId?: (prefix: string) => string }} [deps]
 * @returns {Readonly<object>}
 */
export function addCustomerContactPoint(customer, contactInput, deps = {}) {
  const nowIso = typeof deps.nowIso === "function" ? deps.nowIso : () => new Date().toISOString();
  const nextId =
    typeof deps.nextId === "function"
      ? deps.nextId
      : (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  const contactPoint = createContactPoint({
    contactPointId: contactInput.contactPointId || nextId("cp"),
    ...contactInput,
  });
  const contactPoints = assertPrimaryContactUniqueness([
    ...(customer.contactPoints || []),
    contactPoint,
  ]);
  return Object.freeze({
    ...customer,
    contactPoints: Object.freeze(contactPoints),
    updatedAt: nowIso(),
    version: customer.version + 1,
  });
}

/**
 * @param {object} customer
 * @param {string} contactPointId
 * @param {object} patch
 * @param {{ nowIso?: () => string }} [deps]
 * @returns {Readonly<object>}
 */
export function updateCustomerContactPoint(customer, contactPointId, patch, deps = {}) {
  const id = requireOpaqueId(contactPointId, "contactPointId");
  const existing = (customer.contactPoints || []).find((c) => c.contactPointId === id);
  if (!existing) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.NOT_FOUND,
      "Contact point not found.",
      { contactPointId: id, customerId: customer.customerId }
    );
  }
  const nowIso = typeof deps.nowIso === "function" ? deps.nowIso : () => new Date().toISOString();
  const updated = createContactPoint({
    ...existing,
    ...patch,
    contactPointId: existing.contactPointId,
    type: patch.type !== undefined ? patch.type : existing.type,
  });
  const contactPoints = assertPrimaryContactUniqueness(
    (customer.contactPoints || []).map((c) =>
      c.contactPointId === id ? updated : c
    )
  );
  return Object.freeze({
    ...customer,
    contactPoints: Object.freeze(contactPoints),
    updatedAt: nowIso(),
    version: customer.version + 1,
  });
}

/**
 * @param {object} customer
 * @param {string} contactPointId
 * @param {{ nowIso?: () => string }} [deps]
 * @returns {Readonly<object>}
 */
export function removeCustomerContactPoint(customer, contactPointId, deps = {}) {
  const id = requireOpaqueId(contactPointId, "contactPointId");
  const remaining = (customer.contactPoints || []).filter((c) => c.contactPointId !== id);
  if (remaining.length === (customer.contactPoints || []).length) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.NOT_FOUND,
      "Contact point not found.",
      { contactPointId: id, customerId: customer.customerId }
    );
  }
  const nowIso = typeof deps.nowIso === "function" ? deps.nowIso : () => new Date().toISOString();
  return Object.freeze({
    ...customer,
    contactPoints: Object.freeze(remaining),
    updatedAt: nowIso(),
    version: customer.version + 1,
  });
}

/**
 * @param {object} customer
 * @param {object|null} linkage
 * @param {"account"|"player"|"organization"} kind
 * @param {{ nowIso?: () => string }} [deps]
 * @returns {Readonly<object>}
 */
export function setCustomerLinkage(customer, linkage, kind, deps = {}) {
  const nowIso = typeof deps.nowIso === "function" ? deps.nowIso : () => new Date().toISOString();
  /** @type {Record<string, unknown>} */
  const patch = {};
  if (kind === "account") {
    if (customer.accountLinkage && linkage) {
      const next = createAccountLinkage(linkage);
      if (customer.accountLinkage.userAccountId !== next.userAccountId) {
        throwCustomerError(
          CUSTOMER_ERROR_CODES.LINKAGE_CONFLICT,
          "Customer already linked to a different user account.",
          {
            customerId: customer.customerId,
            existingUserAccountId: customer.accountLinkage.userAccountId,
            requestedUserAccountId: next.userAccountId,
          }
        );
      }
      patch.accountLinkage = customer.accountLinkage;
    } else {
      patch.accountLinkage = createAccountLinkage(linkage);
    }
  } else if (kind === "player") {
    if (customer.playerLinkage && linkage) {
      const next = createPlayerLinkage(linkage);
      if (customer.playerLinkage.playerId !== next.playerId) {
        throwCustomerError(
          CUSTOMER_ERROR_CODES.LINKAGE_CONFLICT,
          "Customer already linked to a different player.",
          {
            customerId: customer.customerId,
            existingPlayerId: customer.playerLinkage.playerId,
            requestedPlayerId: next.playerId,
          }
        );
      }
      patch.playerLinkage = customer.playerLinkage;
    } else {
      patch.playerLinkage = createPlayerLinkage(linkage);
    }
  } else if (kind === "organization") {
    if (customer.organizationLinkage && linkage) {
      const next = createOrganizationLinkage(linkage);
      if (customer.organizationLinkage.organizationId !== next.organizationId) {
        throwCustomerError(
          CUSTOMER_ERROR_CODES.LINKAGE_CONFLICT,
          "Customer already linked to a different organization.",
          {
            customerId: customer.customerId,
            existingOrganizationId: customer.organizationLinkage.organizationId,
            requestedOrganizationId: next.organizationId,
          }
        );
      }
      patch.organizationLinkage = customer.organizationLinkage;
    } else {
      patch.organizationLinkage = createOrganizationLinkage(linkage);
    }
  } else {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_INPUT,
      "Unknown linkage kind.",
      { kind }
    );
  }

  return Object.freeze({
    ...customer,
    ...patch,
    contactPoints: Object.freeze([...(customer.contactPoints || [])]),
    updatedAt: nowIso(),
    version: customer.version + 1,
  });
}
