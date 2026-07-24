/**
 * Customer read-model projectors (CUSTOMER-01 + CUSTOMER-02).
 * Projections are copy-safe / frozen. Never expose credentials.
 */

import { CONTACT_POINT_STATUS, CONTACT_POINT_TYPE } from "../constants/contactPointTypes.js";
import { CUSTOMER_ADDRESS_STATUS } from "../constants/addressTypes.js";
import { cloneFrozen } from "../repositories/inMemory.js";

/**
 * @param {readonly object[]|undefined} contactPoints
 * @param {string} type
 * @returns {object|null}
 */
function primaryActiveOfType(contactPoints, type) {
  return (
    (contactPoints || []).find(
      (c) =>
        c.type === type &&
        c.primary === true &&
        (c.status || CONTACT_POINT_STATUS.ACTIVE) === CONTACT_POINT_STATUS.ACTIVE
    ) || null
  );
}

/**
 * @param {object} contact
 * @returns {Readonly<object>}
 */
export function projectCustomerContactView(contact) {
  if (!contact || typeof contact !== "object") {
    return Object.freeze({});
  }
  return cloneFrozen({
    contactPointId: contact.contactPointId,
    type: contact.type,
    displayValue: contact.displayValue || contact.value,
    normalizedValue: contact.normalizedValue || contact.value,
    purpose: contact.purpose || contact.label || null,
    primary: Boolean(contact.primary),
    verificationState: contact.verificationState,
    status: contact.status || CONTACT_POINT_STATUS.ACTIVE,
    updatedAt: contact.updatedAt || null,
    version: contact.version || 1,
  });
}

/**
 * @param {object} address
 * @returns {Readonly<object>|null}
 */
export function projectCustomerAddressSummary(address) {
  if (!address || typeof address !== "object") return null;
  return cloneFrozen({
    addressId: address.addressId,
    addressType: address.addressType,
    addressLine1: address.addressLine1,
    locality: address.locality,
    adminArea: address.adminArea,
    postalCode: address.postalCode,
    countryCode: address.countryCode,
    primary: Boolean(address.primary),
    status: address.status,
  });
}

/**
 * CustomerProfileView — profile-oriented read model.
 *
 * @param {object} customer
 * @returns {Readonly<object>}
 */
export function projectCustomerProfileView(customer) {
  if (!customer || typeof customer !== "object") {
    return Object.freeze({});
  }
  const primaryEmail = primaryActiveOfType(
    customer.contactPoints,
    CONTACT_POINT_TYPE.EMAIL
  );
  const primaryPhone = primaryActiveOfType(
    customer.contactPoints,
    CONTACT_POINT_TYPE.PHONE
  );
  const primaryAddress =
    (customer.addresses || []).find(
      (a) =>
        a.primary === true &&
        (a.status || CUSTOMER_ADDRESS_STATUS.ACTIVE) ===
          CUSTOMER_ADDRESS_STATUS.ACTIVE
    ) || null;

  return cloneFrozen({
    customerId: customer.customerId,
    customerNumber: customer.customerNumber,
    tenantId: customer.tenantId,
    venueId: customer.venueId,
    customerType: customer.customerType,
    displayName: customer.displayName,
    legalName: customer.legalName ?? null,
    individualProfile: customer.individualProfile ?? null,
    organizationProfile: customer.organizationProfile ?? null,
    status: customer.status,
    primaryEmail: primaryEmail
      ? {
          contactPointId: primaryEmail.contactPointId,
          displayValue: primaryEmail.displayValue || primaryEmail.value,
          normalizedValue: primaryEmail.normalizedValue || primaryEmail.value,
          verificationState: primaryEmail.verificationState,
        }
      : null,
    primaryPhone: primaryPhone
      ? {
          contactPointId: primaryPhone.contactPointId,
          displayValue: primaryPhone.displayValue || primaryPhone.value,
          normalizedValue: primaryPhone.normalizedValue || primaryPhone.value,
          verificationState: primaryPhone.verificationState,
        }
      : null,
    primaryAddress: projectCustomerAddressSummary(primaryAddress),
    version: customer.version,
    updatedAt: customer.updatedAt,
  });
}

/**
 * @param {object} customer
 * @returns {Readonly<object>}
 */
export function projectCustomerSummary(customer) {
  if (!customer || typeof customer !== "object") {
    return Object.freeze({});
  }
  const primaryEmail = primaryActiveOfType(
    customer.contactPoints,
    CONTACT_POINT_TYPE.EMAIL
  );
  const primaryPhone = primaryActiveOfType(
    customer.contactPoints,
    CONTACT_POINT_TYPE.PHONE
  );
  const primary =
    primaryEmail ||
    primaryPhone ||
    (customer.contactPoints || []).find(
      (c) =>
        (c.status || CONTACT_POINT_STATUS.ACTIVE) === CONTACT_POINT_STATUS.ACTIVE
    ) ||
    null;
  return cloneFrozen({
    customerId: customer.customerId,
    customerNumber: customer.customerNumber,
    tenantId: customer.tenantId,
    venueId: customer.venueId,
    displayName: customer.displayName,
    customerType: customer.customerType,
    status: customer.status,
    primaryContact: primary
      ? {
          type: primary.type,
          value: primary.normalizedValue || primary.value,
          displayValue: primary.displayValue || primary.value,
        }
      : null,
    accountLinked: Boolean(customer.accountLinkage?.userAccountId),
    playerLinked: Boolean(customer.playerLinkage?.playerId),
    updatedAt: customer.updatedAt,
    version: customer.version,
  });
}

/**
 * @param {object} customer
 * @returns {Readonly<object>}
 */
export function projectCustomerDetails(customer) {
  if (!customer || typeof customer !== "object") {
    return Object.freeze({});
  }
  return cloneFrozen({
    customerId: customer.customerId,
    customerNumber: customer.customerNumber,
    tenantId: customer.tenantId,
    venueId: customer.venueId,
    displayName: customer.displayName,
    legalName: customer.legalName,
    individualProfile: customer.individualProfile ?? null,
    organizationProfile: customer.organizationProfile ?? null,
    customerType: customer.customerType,
    status: customer.status,
    contactPoints: customer.contactPoints || [],
    addresses: customer.addresses || [],
    locale: customer.locale,
    accountLinkage: customer.accountLinkage,
    playerLinkage: customer.playerLinkage,
    organizationLinkage: customer.organizationLinkage,
    classification: customer.classification || [],
    segmentReferences: customer.segmentReferences || [],
    tags: customer.tags || [],
    communicationPreferences: customer.communicationPreferences || [],
    consentReferences: customer.consentReferences || [],
    metadata: customer.metadata || {},
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
    version: customer.version,
  });
}
