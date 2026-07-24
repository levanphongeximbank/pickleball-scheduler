/**
 * Customer read-model projectors (CUSTOMER-01).
 * Projections are copy-safe / frozen.
 */

import { cloneFrozen } from "../repositories/inMemory.js";

/**
 * @param {object} customer
 * @returns {Readonly<object>}
 */
export function projectCustomerSummary(customer) {
  if (!customer || typeof customer !== "object") {
    return Object.freeze({});
  }
  const primary =
    (customer.contactPoints || []).find((c) => c.primary) ||
    (customer.contactPoints || [])[0] ||
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
      ? { type: primary.type, value: primary.value }
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
    customerType: customer.customerType,
    status: customer.status,
    contactPoints: customer.contactPoints || [],
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
