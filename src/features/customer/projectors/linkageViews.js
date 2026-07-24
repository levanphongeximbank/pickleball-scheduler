/**
 * Customer linkage read projections (CUSTOMER-05).
 * Copy-safe. No credentials. No full Player/CRM objects.
 */

import { isActiveCustomerLinkageStatus } from "../constants/linkageStatuses.js";
import { CUSTOMER_LINKAGE_TYPE } from "../constants/linkageTypes.js";

/**
 * @param {object|null|undefined} linkage
 * @returns {Readonly<object>|null}
 */
export function projectCustomerLinkageView(linkage) {
  if (!linkage) return null;
  return Object.freeze({
    linkageId: linkage.linkageId,
    customerId: linkage.customerId,
    tenantId: linkage.tenantId,
    venueId: linkage.venueId,
    linkageType: linkage.linkageType,
    externalReferenceId: linkage.externalReferenceId,
    externalReferenceType: linkage.externalReferenceType,
    externalSystem: linkage.externalSystem,
    status: linkage.status,
    source: linkage.source,
    evidenceReference: linkage.evidenceReference ?? null,
    effectiveAt: linkage.effectiveAt,
    endedAt: linkage.endedAt ?? null,
    version: linkage.version,
  });
}

/**
 * @param {object|null|undefined} linkage
 * @returns {Readonly<object>|null}
 */
export function projectCustomerIdentityLinkView(linkage) {
  if (!linkage || linkage.linkageType !== CUSTOMER_LINKAGE_TYPE.IDENTITY_ACCOUNT) {
    return null;
  }
  return Object.freeze({
    customerId: linkage.customerId,
    tenantId: linkage.tenantId,
    venueId: linkage.venueId,
    accountId: linkage.externalReferenceId,
    status: linkage.status,
    scope: Object.freeze({
      tenantId: linkage.tenantId,
      venueId: linkage.venueId,
    }),
    effectiveAt: linkage.effectiveAt,
    endedAt: linkage.endedAt ?? null,
    linkageId: linkage.linkageId,
    version: linkage.version,
  });
}

/**
 * @param {object|null|undefined} linkage
 * @returns {Readonly<object>|null}
 */
export function projectCustomerPlayerLinkView(linkage) {
  if (!linkage || linkage.linkageType !== CUSTOMER_LINKAGE_TYPE.PLAYER) {
    return null;
  }
  return Object.freeze({
    customerId: linkage.customerId,
    tenantId: linkage.tenantId,
    venueId: linkage.venueId,
    playerId: linkage.externalReferenceId,
    status: linkage.status,
    scope: Object.freeze({
      tenantId: linkage.tenantId,
      venueId: linkage.venueId,
    }),
    effectiveAt: linkage.effectiveAt,
    endedAt: linkage.endedAt ?? null,
    linkageId: linkage.linkageId,
    version: linkage.version,
  });
}

/**
 * @param {object|null|undefined} linkage
 * @returns {Readonly<object>|null}
 */
export function projectCustomerCrmLinkView(linkage) {
  if (!linkage || linkage.linkageType !== CUSTOMER_LINKAGE_TYPE.CRM_CONTACT) {
    return null;
  }
  return Object.freeze({
    customerId: linkage.customerId,
    tenantId: linkage.tenantId,
    venueId: linkage.venueId,
    contactRefId: linkage.externalReferenceId,
    externalSystem: linkage.externalSystem,
    crmReferenceType: linkage.externalReferenceType,
    status: linkage.status,
    scope: Object.freeze({
      tenantId: linkage.tenantId,
      venueId: linkage.venueId,
    }),
    effectiveAt: linkage.effectiveAt,
    endedAt: linkage.endedAt ?? null,
    linkageId: linkage.linkageId,
    version: linkage.version,
  });
}

/**
 * @param {object|null|undefined} history
 * @returns {Readonly<object>|null}
 */
export function projectCustomerLinkageHistoryView(history) {
  if (!history) return null;
  return Object.freeze({
    historyId: history.historyId,
    linkageId: history.linkageId,
    customerId: history.customerId,
    linkageType: history.linkageType,
    externalReferenceId: history.externalReferenceId,
    previousStatus: history.previousStatus,
    nextStatus: history.nextStatus,
    action: history.action,
    source: history.source,
    reason: history.reason ?? null,
    evidenceReference: history.evidenceReference ?? null,
    actorReference: history.actorReference ?? null,
    effectiveAt: history.effectiveAt ?? null,
    sequence: history.sequence,
    customerVersion: history.customerVersion,
    recordedAt: history.recordedAt,
  });
}

/**
 * Minimal reverse-lookup projection (scope-safe).
 * @param {object} customer
 * @param {object|null} [linkage]
 */
export function projectCustomerLinkageLookupView(customer, linkage = null) {
  if (!customer) return null;
  return Object.freeze({
    customerId: customer.customerId,
    customerNumber: customer.customerNumber,
    tenantId: customer.tenantId,
    venueId: customer.venueId,
    status: customer.status,
    displayName: customer.displayName ?? null,
    linkage: linkage ? projectCustomerLinkageView(linkage) : null,
    active: linkage ? isActiveCustomerLinkageStatus(linkage.status) : false,
  });
}
