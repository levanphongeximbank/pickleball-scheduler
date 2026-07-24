/**
 * CUSTOMER-06 merge / search / dedup projectors.
 */

import { CUSTOMER_STATUS } from "../constants/customerStatuses.js";

/**
 * @param {object} customer
 * @returns {Readonly<object>}
 */
export function projectCustomerSearchResultView(customer) {
  if (!customer) return null;
  return Object.freeze({
    customerId: customer.customerId,
    customerNumber: customer.customerNumber,
    displayName: customer.displayName,
    legalName: customer.legalName ?? null,
    customerType: customer.customerType,
    status: customer.status,
    tenantId: customer.tenantId,
    venueId: customer.venueId,
    primaryEmail:
      (customer.contactPoints || []).find(
        (c) => c.type === "EMAIL" && c.primary === true
      )?.normalizedValue ||
      (customer.contactPoints || []).find((c) => c.type === "EMAIL")
        ?.normalizedValue ||
      null,
    primaryPhone:
      (customer.contactPoints || []).find(
        (c) => c.type === "PHONE" && c.primary === true
      )?.normalizedValue ||
      (customer.contactPoints || []).find((c) => c.type === "PHONE")
        ?.normalizedValue ||
      null,
    mergedIntoCustomerId: customer.mergedIntoCustomerId ?? null,
    isMerged: customer.status === CUSTOMER_STATUS.MERGED,
    version: customer.version,
  });
}

/**
 * @param {object} candidate
 * @returns {Readonly<object>|null}
 */
export function projectCustomerDuplicateCandidateView(candidate) {
  if (!candidate) return null;
  return Object.freeze({
    candidateId: candidate.candidateId,
    customerIdA: candidate.customerIdA,
    customerIdB: candidate.customerIdB,
    tenantId: candidate.tenantId,
    venueId: candidate.venueId,
    classification: candidate.classification,
    score: candidate.score,
    signals: Object.freeze([...(candidate.signals || [])]),
    conflicts: Object.freeze([...(candidate.conflicts || [])]),
    reasonCodes: Object.freeze([...(candidate.reasonCodes || [])]),
    status: candidate.status,
    detectedAt: candidate.detectedAt,
    evaluatedAt: candidate.evaluatedAt,
    evaluatedVersions: Object.freeze({ ...(candidate.evaluatedVersions || {}) }),
    version: candidate.version,
    source: candidate.source,
    reviewedAt: candidate.reviewedAt ?? null,
    reviewReference: candidate.reviewReference ?? null,
  });
}

/**
 * @param {object} proposal
 * @returns {Readonly<object>|null}
 */
export function projectCustomerMergeProposalView(proposal) {
  if (!proposal) return null;
  return Object.freeze({
    mergeProposalId: proposal.mergeProposalId,
    candidateId: proposal.candidateId ?? null,
    survivorCustomerId: proposal.survivorCustomerId,
    absorbedCustomerId:
      proposal.absorbedCustomerId || proposal.duplicateCustomerId,
    duplicateCustomerId:
      proposal.duplicateCustomerId || proposal.absorbedCustomerId,
    tenantId: proposal.tenantId,
    venueId: proposal.venueId,
    expectedSurvivorVersion: proposal.expectedSurvivorVersion,
    expectedAbsorbedVersion: proposal.expectedAbsorbedVersion,
    profileResolution: Object.freeze({ ...(proposal.profileResolution || {}) }),
    contactResolution: Object.freeze({ ...(proposal.contactResolution || {}) }),
    addressResolution: Object.freeze({ ...(proposal.addressResolution || {}) }),
    consentResolution: Object.freeze({ ...(proposal.consentResolution || {}) }),
    preferenceResolution: Object.freeze({
      ...(proposal.preferenceResolution || {}),
    }),
    linkageResolution: Object.freeze({ ...(proposal.linkageResolution || {}) }),
    conflicts: Object.freeze([...(proposal.conflicts || [])]),
    matchKinds: Object.freeze([...(proposal.matchKinds || [])]),
    approvalStatus: proposal.approvalStatus,
    approvalReference: proposal.approvalReference ?? null,
    approvedBy: proposal.approvedBy ?? null,
    approvedAt: proposal.approvedAt ?? null,
    status: proposal.status,
    createdAt: proposal.createdAt,
    updatedAt: proposal.updatedAt,
    version: proposal.version,
  });
}

/**
 * @param {object} result
 * @returns {Readonly<object>|null}
 */
export function projectCustomerMergeResultView(result) {
  if (!result) return null;
  return Object.freeze({
    survivorCustomerId: result.survivor?.customerId ?? null,
    absorbedCustomerId: result.absorbed?.customerId ?? null,
    survivorVersion: result.survivor?.version ?? null,
    absorbedStatus: result.absorbed?.status ?? null,
    mergedIntoCustomerId: result.absorbed?.mergedIntoCustomerId ?? null,
    mergedAt: result.absorbed?.mergedAt ?? null,
    mergeHistoryId: result.history?.mergeHistoryId ?? null,
    mergeProposalId: result.history?.mergeProposalId ?? null,
    approvalReference: result.history?.approvalReference ?? null,
  });
}

/**
 * @param {object} redirect
 * @returns {Readonly<object>|null}
 */
export function projectCustomerRedirectView(redirect) {
  if (!redirect) return null;
  return Object.freeze({
    requestedCustomerId: redirect.requestedCustomerId,
    canonicalCustomerId: redirect.canonicalCustomerId,
    redirectChain: Object.freeze([...(redirect.redirectChain || [])]),
    mergedAt: redirect.mergedAt ?? null,
    reason: redirect.reason ?? null,
    depth: redirect.depth ?? 0,
  });
}
