/**
 * Customer master profile domain model (CUSTOMER-01 + CUSTOMER-02).
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
import {
  CONTACT_POINT_STATUS,
  CONTACT_POINT_TYPE,
  CONTACT_POINT_VERIFICATION_STATE,
} from "../constants/contactPointTypes.js";
import { CUSTOMER_ADDRESS_STATUS } from "../constants/addressTypes.js";
import { CUSTOMER_ERROR_CODES } from "../errors/codes.js";
import { throwCustomerError } from "../errors/CustomerError.js";
import {
  assertContactPointInvariants,
  createContactPoint,
} from "./contactPoint.js";
import {
  assertPrimaryAddressUniqueness,
  createCustomerAddress,
} from "./address.js";
import {
  assertProfileTypeConsistency,
  createIndividualProfile,
  createOrganizationProfile,
  optionalProfileString,
  requireProfileString,
  resolveDisplayName,
} from "./profileNames.js";
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
 * @param {object} customer
 * @param {{ nowIso?: () => string, nextId?: (prefix: string) => string }} deps
 */
function contactDeps(deps) {
  return {
    nowIso: deps.nowIso,
    allowVerifiedWithoutEvidence: false,
  };
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

  const individualProfile = createIndividualProfile(
    input.individualProfile ??
      (input.givenName || input.familyName || input.preferredName
        ? {
            givenName: input.givenName,
            familyName: input.familyName,
            middleName: input.middleName,
            preferredName: input.preferredName,
          }
        : null)
  );
  const organizationProfile = createOrganizationProfile(
    input.organizationProfile ??
      (input.organizationName || input.tradingName
        ? {
            organizationName: input.organizationName,
            tradingName: input.tradingName,
          }
        : null)
  );
  assertProfileTypeConsistency(
    customerType,
    individualProfile,
    organizationProfile
  );

  const displayName = resolveDisplayName(
    input,
    customerType,
    individualProfile,
    organizationProfile
  );

  const entropy = nextId("id");
  const customerId = input.customerId
    ? requireOpaqueId(input.customerId, "customerId")
    : mintCustomerId(entropy);
  const customerNumber = input.customerNumber
    ? requireOpaqueId(input.customerNumber, "customerNumber")
    : mintCustomerNumber(entropy);

  const createdAt = input.createdAt ? String(input.createdAt) : nowIso();
  const updatedAt = input.updatedAt ? String(input.updatedAt) : createdAt;
  const cpDeps = { ...contactDeps(deps), nowIso };

  const contactPoints = assertContactPointInvariants(
    mapFrozenList(input.contactPoints, (item, index) =>
      createContactPoint(
        {
          contactPointId: item.contactPointId || nextId(`cp${index}`),
          createdAt,
          updatedAt: createdAt,
          ...item,
        },
        cpDeps
      )
    )
  );

  const addresses = assertPrimaryAddressUniqueness(
    mapFrozenList(input.addresses, (item, index) =>
      createCustomerAddress({
        addressId: item.addressId || nextId(`addr${index}`),
        createdAt,
        updatedAt: createdAt,
        ...item,
      })
    )
  );

  return Object.freeze({
    customerId,
    customerNumber,
    tenantId: scope.tenantId,
    venueId: scope.venueId,
    displayName,
    legalName: optionalProfileString(input.legalName ?? input.fullName, "legalName"),
    individualProfile,
    organizationProfile,
    customerType,
    status,
    contactPoints: Object.freeze([...contactPoints]),
    addresses: Object.freeze([...addresses]),
    locale: optionalProfileString(input.locale ?? input.language, "locale"),
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
 */
function assertMutable(customer) {
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
}

/**
 * @param {object} customer
 * @param {object} patch
 * @param {{ nowIso?: () => string }} [deps]
 * @returns {Readonly<object>}
 */
export function updateCustomerProfileFields(customer, patch = {}, deps = {}) {
  assertMutable(customer);
  const nowIso = typeof deps.nowIso === "function" ? deps.nowIso : () => new Date().toISOString();

  if (patch.customerType !== undefined) {
    const nextType = String(patch.customerType);
    if (nextType !== customer.customerType) {
      throwCustomerError(
        CUSTOMER_ERROR_CODES.PROFILE_TYPE_MISMATCH,
        "Changing customerType is not supported (fail-closed).",
        {
          customerId: customer.customerId,
          from: customer.customerType,
          to: nextType,
        }
      );
    }
  }

  let individualProfile = customer.individualProfile;
  let organizationProfile = customer.organizationProfile;

  if (patch.individualProfile !== undefined) {
    if (customer.customerType !== CUSTOMER_TYPE.INDIVIDUAL) {
      throwCustomerError(
        CUSTOMER_ERROR_CODES.PROFILE_TYPE_MISMATCH,
        "individualProfile is only valid for INDIVIDUAL customers.",
        { customerType: customer.customerType }
      );
    }
    individualProfile = createIndividualProfile(patch.individualProfile);
  } else if (
    patch.givenName !== undefined ||
    patch.familyName !== undefined ||
    patch.middleName !== undefined ||
    patch.preferredName !== undefined
  ) {
    if (customer.customerType !== CUSTOMER_TYPE.INDIVIDUAL) {
      throwCustomerError(
        CUSTOMER_ERROR_CODES.PROFILE_TYPE_MISMATCH,
        "Individual name fields are only valid for INDIVIDUAL customers.",
        { customerType: customer.customerType }
      );
    }
    individualProfile = createIndividualProfile({
      ...(customer.individualProfile || {}),
      ...(patch.givenName !== undefined ? { givenName: patch.givenName } : {}),
      ...(patch.familyName !== undefined ? { familyName: patch.familyName } : {}),
      ...(patch.middleName !== undefined ? { middleName: patch.middleName } : {}),
      ...(patch.preferredName !== undefined
        ? { preferredName: patch.preferredName }
        : {}),
    });
  }

  if (patch.organizationProfile !== undefined) {
    if (customer.customerType !== CUSTOMER_TYPE.ORGANIZATION) {
      throwCustomerError(
        CUSTOMER_ERROR_CODES.PROFILE_TYPE_MISMATCH,
        "organizationProfile is only valid for ORGANIZATION customers.",
        { customerType: customer.customerType }
      );
    }
    organizationProfile = createOrganizationProfile(patch.organizationProfile);
  } else if (
    patch.organizationName !== undefined ||
    patch.tradingName !== undefined
  ) {
    if (customer.customerType !== CUSTOMER_TYPE.ORGANIZATION) {
      throwCustomerError(
        CUSTOMER_ERROR_CODES.PROFILE_TYPE_MISMATCH,
        "Organization name fields are only valid for ORGANIZATION customers.",
        { customerType: customer.customerType }
      );
    }
    organizationProfile = createOrganizationProfile({
      ...(customer.organizationProfile || {}),
      ...(patch.organizationName !== undefined
        ? { organizationName: patch.organizationName }
        : {}),
      ...(patch.tradingName !== undefined
        ? { tradingName: patch.tradingName }
        : {}),
    });
  }

  assertProfileTypeConsistency(
    customer.customerType,
    individualProfile,
    organizationProfile
  );

  let displayName = customer.displayName;
  if (patch.displayName !== undefined || patch.name !== undefined) {
    displayName = requireProfileString(
      patch.displayName ?? patch.name,
      "displayName"
    );
  } else if (
    patch.individualProfile !== undefined ||
    patch.organizationProfile !== undefined ||
    patch.givenName !== undefined ||
    patch.familyName !== undefined ||
    patch.middleName !== undefined ||
    patch.preferredName !== undefined ||
    patch.organizationName !== undefined ||
    patch.tradingName !== undefined
  ) {
    // Keep explicit override unless caller clears via blank — blank rejected.
    // Name-field patches do not auto-rewrite an existing displayName.
    displayName = customer.displayName;
  }

  const next = {
    ...customer,
    displayName,
    legalName:
      patch.legalName !== undefined || patch.fullName !== undefined
        ? optionalProfileString(patch.legalName ?? patch.fullName, "legalName")
        : customer.legalName,
    individualProfile,
    organizationProfile,
    locale:
      patch.locale !== undefined || patch.language !== undefined
        ? optionalProfileString(patch.locale ?? patch.language, "locale")
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

  return Object.freeze({
    ...next,
    contactPoints: Object.freeze([...(next.contactPoints || [])]),
    addresses: Object.freeze([...(next.addresses || [])]),
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
    addresses: Object.freeze([...(customer.addresses || [])]),
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
  assertMutable(customer);
  const nowIso = typeof deps.nowIso === "function" ? deps.nowIso : () => new Date().toISOString();
  const nextId =
    typeof deps.nextId === "function"
      ? deps.nextId
      : (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  const stamp = nowIso();
  const contactPoint = createContactPoint(
    {
      contactPointId: contactInput.contactPointId || nextId("cp"),
      createdAt: stamp,
      updatedAt: stamp,
      ...contactInput,
    },
    contactDeps(deps)
  );
  const contactPoints = assertContactPointInvariants([
    ...(customer.contactPoints || []),
    contactPoint,
  ]);
  return Object.freeze({
    ...customer,
    contactPoints: Object.freeze(contactPoints),
    addresses: Object.freeze([...(customer.addresses || [])]),
    updatedAt: stamp,
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
  assertMutable(customer);
  const id = requireOpaqueId(contactPointId, "contactPointId");
  const existing = (customer.contactPoints || []).find((c) => c.contactPointId === id);
  if (!existing) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.CONTACT_POINT_NOT_FOUND,
      "Contact point not found.",
      { contactPointId: id, customerId: customer.customerId }
    );
  }
  const nowIso = typeof deps.nowIso === "function" ? deps.nowIso : () => new Date().toISOString();
  const stamp = nowIso();
  const valueChanging =
    (patch.value !== undefined && patch.value !== existing.value) ||
    (patch.normalizedValue !== undefined &&
      patch.normalizedValue !== existing.normalizedValue) ||
    (patch.displayValue !== undefined &&
      patch.displayValue !== existing.displayValue);
  const nextVerification =
    patch.verificationState !== undefined
      ? patch.verificationState
      : valueChanging
        ? CONTACT_POINT_VERIFICATION_STATE.UNVERIFIED
        : existing.verificationState;
  const preserveVerified =
    nextVerification === CONTACT_POINT_VERIFICATION_STATE.VERIFIED &&
    !valueChanging &&
    patch.trustedEvidence !== true;
  const updated = createContactPoint(
    {
      ...existing,
      ...patch,
      contactPointId: existing.contactPointId,
      type: patch.type !== undefined ? patch.type : existing.type,
      verificationState: nextVerification,
      createdAt: existing.createdAt,
      updatedAt: stamp,
      version: (existing.version || 1) + 1,
      trustedEvidence: patch.trustedEvidence === true || preserveVerified,
    },
    {
      ...contactDeps(deps),
      allowVerifiedWithoutEvidence: preserveVerified,
    }
  );
  const contactPoints = assertContactPointInvariants(
    (customer.contactPoints || []).map((c) =>
      c.contactPointId === id ? updated : c
    )
  );
  return Object.freeze({
    ...customer,
    contactPoints: Object.freeze(contactPoints),
    addresses: Object.freeze([...(customer.addresses || [])]),
    updatedAt: stamp,
    version: customer.version + 1,
  });
}

/**
 * Hard-remove a contact point. Does not auto-select a new primary.
 *
 * @param {object} customer
 * @param {string} contactPointId
 * @param {{ nowIso?: () => string }} [deps]
 * @returns {Readonly<object>}
 */
export function removeCustomerContactPoint(customer, contactPointId, deps = {}) {
  assertMutable(customer);
  const id = requireOpaqueId(contactPointId, "contactPointId");
  const remaining = (customer.contactPoints || []).filter((c) => c.contactPointId !== id);
  if (remaining.length === (customer.contactPoints || []).length) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.CONTACT_POINT_NOT_FOUND,
      "Contact point not found.",
      { contactPointId: id, customerId: customer.customerId }
    );
  }
  const nowIso = typeof deps.nowIso === "function" ? deps.nowIso : () => new Date().toISOString();
  return Object.freeze({
    ...customer,
    contactPoints: Object.freeze(assertContactPointInvariants(remaining)),
    addresses: Object.freeze([...(customer.addresses || [])]),
    updatedAt: nowIso(),
    version: customer.version + 1,
  });
}

/**
 * Soft-deactivate a contact point. Clears primary when deactivating a primary.
 *
 * @param {object} customer
 * @param {string} contactPointId
 * @param {{ nowIso?: () => string }} [deps]
 * @returns {Readonly<object>}
 */
export function deactivateCustomerContactPoint(customer, contactPointId, deps = {}) {
  return updateCustomerContactPoint(
    customer,
    contactPointId,
    {
      status: CONTACT_POINT_STATUS.INACTIVE,
      primary: false,
    },
    deps
  );
}

/**
 * Set the single primary ACTIVE contact of a given type. Clears other primaries of that type.
 * Does not auto-select when clearing — caller must pass an existing contactPointId.
 *
 * @param {object} customer
 * @param {string} contactPointId
 * @param {string} type
 * @param {{ nowIso?: () => string }} [deps]
 * @returns {Readonly<object>}
 */
export function setPrimaryCustomerContactPoint(customer, contactPointId, type, deps = {}) {
  assertMutable(customer);
  const id = requireOpaqueId(contactPointId, "contactPointId");
  const expectedType = String(type || "");
  if (
    expectedType !== CONTACT_POINT_TYPE.EMAIL &&
    expectedType !== CONTACT_POINT_TYPE.PHONE
  ) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_CONTACT_POINT,
      "Primary contact type must be EMAIL or PHONE.",
      { field: "type", type: expectedType }
    );
  }
  const existing = (customer.contactPoints || []).find((c) => c.contactPointId === id);
  if (!existing) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.CONTACT_POINT_NOT_FOUND,
      "Contact point not found.",
      { contactPointId: id, customerId: customer.customerId }
    );
  }
  if (existing.type !== expectedType) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.INVALID_CONTACT_POINT,
      "Contact point type does not match requested primary type.",
      {
        contactPointId: id,
        expectedType,
        actualType: existing.type,
      }
    );
  }
  if (
    (existing.status || CONTACT_POINT_STATUS.ACTIVE) !== CONTACT_POINT_STATUS.ACTIVE
  ) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.PRIMARY_CONTACT_CONFLICT,
      "Inactive contact points cannot be set as primary.",
      { contactPointId: id, status: existing.status }
    );
  }

  const nowIso = typeof deps.nowIso === "function" ? deps.nowIso : () => new Date().toISOString();
  const stamp = nowIso();
  const contactPoints = assertContactPointInvariants(
    (customer.contactPoints || []).map((c) => {
      if (c.contactPointId === id) {
        return createContactPoint(
          {
            ...c,
            primary: true,
            updatedAt: stamp,
            version: (c.version || 1) + 1,
            trustedEvidence:
              c.verificationState === CONTACT_POINT_VERIFICATION_STATE.VERIFIED,
          },
          {
            ...contactDeps(deps),
            allowVerifiedWithoutEvidence:
              c.verificationState === CONTACT_POINT_VERIFICATION_STATE.VERIFIED,
          }
        );
      }
      if (
        c.type === expectedType &&
        c.primary === true &&
        (c.status || CONTACT_POINT_STATUS.ACTIVE) === CONTACT_POINT_STATUS.ACTIVE
      ) {
        return createContactPoint(
          {
            ...c,
            primary: false,
            updatedAt: stamp,
            version: (c.version || 1) + 1,
            trustedEvidence:
              c.verificationState === CONTACT_POINT_VERIFICATION_STATE.VERIFIED,
          },
          {
            ...contactDeps(deps),
            allowVerifiedWithoutEvidence:
              c.verificationState === CONTACT_POINT_VERIFICATION_STATE.VERIFIED,
          }
        );
      }
      return c;
    })
  );

  return Object.freeze({
    ...customer,
    contactPoints: Object.freeze(contactPoints),
    addresses: Object.freeze([...(customer.addresses || [])]),
    updatedAt: stamp,
    version: customer.version + 1,
  });
}

/**
 * @param {object} customer
 * @param {object} addressInput
 * @param {{ nowIso?: () => string, nextId?: (prefix: string) => string }} [deps]
 * @returns {Readonly<object>}
 */
export function addCustomerAddress(customer, addressInput, deps = {}) {
  assertMutable(customer);
  const nowIso = typeof deps.nowIso === "function" ? deps.nowIso : () => new Date().toISOString();
  const nextId =
    typeof deps.nextId === "function"
      ? deps.nextId
      : (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  const stamp = nowIso();
  const address = createCustomerAddress({
    addressId: addressInput.addressId || nextId("addr"),
    createdAt: stamp,
    updatedAt: stamp,
    ...addressInput,
  });
  const addresses = assertPrimaryAddressUniqueness([
    ...(customer.addresses || []),
    address,
  ]);
  return Object.freeze({
    ...customer,
    contactPoints: Object.freeze([...(customer.contactPoints || [])]),
    addresses: Object.freeze(addresses),
    updatedAt: stamp,
    version: customer.version + 1,
  });
}

/**
 * @param {object} customer
 * @param {string} addressId
 * @param {object} patch
 * @param {{ nowIso?: () => string }} [deps]
 * @returns {Readonly<object>}
 */
export function updateCustomerAddress(customer, addressId, patch, deps = {}) {
  assertMutable(customer);
  const id = requireOpaqueId(addressId, "addressId");
  const existing = (customer.addresses || []).find((a) => a.addressId === id);
  if (!existing) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.NOT_FOUND,
      "Address not found.",
      { addressId: id, customerId: customer.customerId }
    );
  }
  const nowIso = typeof deps.nowIso === "function" ? deps.nowIso : () => new Date().toISOString();
  const stamp = nowIso();
  const updated = createCustomerAddress({
    ...existing,
    ...patch,
    addressId: existing.addressId,
    createdAt: existing.createdAt,
    updatedAt: stamp,
    version: (existing.version || 1) + 1,
  });
  const addresses = assertPrimaryAddressUniqueness(
    (customer.addresses || []).map((a) => (a.addressId === id ? updated : a))
  );
  return Object.freeze({
    ...customer,
    contactPoints: Object.freeze([...(customer.contactPoints || [])]),
    addresses: Object.freeze(addresses),
    updatedAt: stamp,
    version: customer.version + 1,
  });
}

/**
 * @param {object} customer
 * @param {string} addressId
 * @param {{ nowIso?: () => string }} [deps]
 * @returns {Readonly<object>}
 */
export function removeCustomerAddress(customer, addressId, deps = {}) {
  assertMutable(customer);
  const id = requireOpaqueId(addressId, "addressId");
  const remaining = (customer.addresses || []).filter((a) => a.addressId !== id);
  if (remaining.length === (customer.addresses || []).length) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.NOT_FOUND,
      "Address not found.",
      { addressId: id, customerId: customer.customerId }
    );
  }
  const nowIso = typeof deps.nowIso === "function" ? deps.nowIso : () => new Date().toISOString();
  return Object.freeze({
    ...customer,
    contactPoints: Object.freeze([...(customer.contactPoints || [])]),
    addresses: Object.freeze(assertPrimaryAddressUniqueness(remaining)),
    updatedAt: nowIso(),
    version: customer.version + 1,
  });
}

/**
 * @param {object} customer
 * @param {string} addressId
 * @param {{ nowIso?: () => string }} [deps]
 * @returns {Readonly<object>}
 */
export function setPrimaryCustomerAddress(customer, addressId, deps = {}) {
  assertMutable(customer);
  const id = requireOpaqueId(addressId, "addressId");
  const existing = (customer.addresses || []).find((a) => a.addressId === id);
  if (!existing) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.NOT_FOUND,
      "Address not found.",
      { addressId: id, customerId: customer.customerId }
    );
  }
  if (existing.status !== CUSTOMER_ADDRESS_STATUS.ACTIVE) {
    throwCustomerError(
      CUSTOMER_ERROR_CODES.PRIMARY_CONTACT_CONFLICT,
      "Inactive addresses cannot be set as primary.",
      { addressId: id, status: existing.status }
    );
  }
  const nowIso = typeof deps.nowIso === "function" ? deps.nowIso : () => new Date().toISOString();
  const stamp = nowIso();
  const addresses = assertPrimaryAddressUniqueness(
    (customer.addresses || []).map((a) =>
      createCustomerAddress({
        ...a,
        primary: a.addressId === id,
        updatedAt: stamp,
        version: (a.version || 1) + 1,
      })
    )
  );
  return Object.freeze({
    ...customer,
    contactPoints: Object.freeze([...(customer.contactPoints || [])]),
    addresses: Object.freeze(addresses),
    updatedAt: stamp,
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
  assertMutable(customer);
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
    addresses: Object.freeze([...(customer.addresses || [])]),
    updatedAt: nowIso(),
    version: customer.version + 1,
  });
}
