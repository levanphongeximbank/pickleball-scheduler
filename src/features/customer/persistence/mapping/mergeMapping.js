/**
 * Merge / candidate / history domain ↔ row mapping (CUSTOMER-06).
 */

/**
 * @param {unknown} value
 * @returns {unknown}
 */
function cloneJson(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

/**
 * @param {object} candidate
 * @returns {object}
 */
export function mapCandidateDomainToRow(candidate) {
  return {
    candidate_id: candidate.candidateId,
    customer_id_a: candidate.customerIdA,
    customer_id_b: candidate.customerIdB,
    tenant_id: candidate.tenantId,
    venue_id: candidate.venueId,
    classification: candidate.classification,
    score: candidate.score,
    signals: cloneJson(candidate.signals || []),
    conflicts: cloneJson(candidate.conflicts || []),
    reason_codes: cloneJson(candidate.reasonCodes || []),
    status: candidate.status,
    detected_at: candidate.detectedAt,
    evaluated_at: candidate.evaluatedAt,
    evaluated_versions: cloneJson(candidate.evaluatedVersions || {}),
    version: candidate.version,
    source: candidate.source,
    reviewed_at: candidate.reviewedAt ?? null,
    review_reference: candidate.reviewReference ?? null,
    updated_at: candidate.updatedAt,
  };
}

/**
 * @param {object} row
 * @returns {object}
 */
export function mapCandidateRowToDomain(row) {
  return Object.freeze({
    candidateId: row.candidate_id,
    customerIdA: row.customer_id_a,
    customerIdB: row.customer_id_b,
    tenantId: row.tenant_id,
    venueId: row.venue_id,
    classification: row.classification,
    score: row.score ?? null,
    signals: Object.freeze(cloneJson(row.signals || [])),
    conflicts: Object.freeze(cloneJson(row.conflicts || [])),
    reasonCodes: Object.freeze(cloneJson(row.reason_codes || [])),
    status: row.status,
    detectedAt: row.detected_at,
    evaluatedAt: row.evaluated_at,
    evaluatedVersions: Object.freeze(cloneJson(row.evaluated_versions || {})),
    evaluatedSurvivorVersion:
      row.evaluated_versions?.[row.customer_id_a] ?? null,
    evaluatedAbsorbedVersion:
      row.evaluated_versions?.[row.customer_id_b] ?? null,
    version: row.version,
    source: row.source,
    reviewedAt: row.reviewed_at ?? null,
    reviewReference: row.review_reference ?? null,
    updatedAt: row.updated_at,
  });
}

/**
 * @param {object} proposal
 * @returns {object}
 */
export function mapProposalDomainToRow(proposal) {
  return {
    merge_proposal_id: proposal.mergeProposalId,
    candidate_id: proposal.candidateId ?? null,
    survivor_customer_id: proposal.survivorCustomerId,
    absorbed_customer_id:
      proposal.absorbedCustomerId || proposal.duplicateCustomerId,
    tenant_id: proposal.tenantId,
    venue_id: proposal.venueId,
    expected_survivor_version: proposal.expectedSurvivorVersion,
    expected_absorbed_version: proposal.expectedAbsorbedVersion,
    profile_resolution: cloneJson(proposal.profileResolution || {}),
    contact_resolution: cloneJson(proposal.contactResolution || {}),
    address_resolution: cloneJson(proposal.addressResolution || {}),
    consent_resolution: cloneJson(proposal.consentResolution || {}),
    preference_resolution: cloneJson(proposal.preferenceResolution || {}),
    linkage_resolution: cloneJson(proposal.linkageResolution || {}),
    conflicts: cloneJson(proposal.conflicts || []),
    match_kinds: cloneJson(proposal.matchKinds || []),
    approval_status: proposal.approvalStatus,
    approval_reference: proposal.approvalReference ?? null,
    approved_by: proposal.approvedBy ?? null,
    approved_at: proposal.approvedAt ?? null,
    status: proposal.status,
    created_at: proposal.createdAt,
    updated_at: proposal.updatedAt,
    version: proposal.version,
  };
}

/**
 * @param {object} row
 * @returns {object}
 */
export function mapProposalRowToDomain(row) {
  return Object.freeze({
    mergeProposalId: row.merge_proposal_id,
    candidateId: row.candidate_id ?? null,
    survivorCustomerId: row.survivor_customer_id,
    absorbedCustomerId: row.absorbed_customer_id,
    duplicateCustomerId: row.absorbed_customer_id,
    tenantId: row.tenant_id,
    venueId: row.venue_id,
    expectedSurvivorVersion: row.expected_survivor_version,
    expectedAbsorbedVersion: row.expected_absorbed_version,
    profileResolution: Object.freeze(cloneJson(row.profile_resolution || {})),
    contactResolution: Object.freeze(cloneJson(row.contact_resolution || {})),
    addressResolution: Object.freeze(cloneJson(row.address_resolution || {})),
    consentResolution: Object.freeze(cloneJson(row.consent_resolution || {})),
    preferenceResolution: Object.freeze(
      cloneJson(row.preference_resolution || {})
    ),
    linkageResolution: Object.freeze(cloneJson(row.linkage_resolution || {})),
    conflicts: Object.freeze(cloneJson(row.conflicts || [])),
    matchKinds: Object.freeze(cloneJson(row.match_kinds || [])),
    approvalStatus: row.approval_status,
    approvalReference: row.approval_reference ?? null,
    approvedBy: row.approved_by ?? null,
    approvedAt: row.approved_at ?? null,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
  });
}

/**
 * @param {object} history
 * @returns {object}
 */
export function mapMergeHistoryDomainToRow(history) {
  return {
    merge_history_id: history.mergeHistoryId,
    merge_proposal_id: history.mergeProposalId ?? null,
    candidate_id: history.candidateId ?? null,
    survivor_customer_id: history.survivorCustomerId,
    absorbed_customer_id: history.absorbedCustomerId,
    tenant_id: history.tenantId,
    venue_id: history.venueId,
    approval_reference: history.approvalReference ?? null,
    actor_reference: history.actorReference ?? null,
    survivor_version_after: history.survivorVersionAfter,
    absorbed_version_at_merge: history.absorbedVersionAtMerge,
    resolution_summary: cloneJson(history.resolutionSummary || {}),
    reason_codes: cloneJson(history.reasonCodes || []),
    recorded_at: history.recordedAt,
  };
}

/**
 * @param {object} row
 * @returns {object}
 */
export function mapMergeHistoryRowToDomain(row) {
  return Object.freeze({
    mergeHistoryId: row.merge_history_id,
    mergeProposalId: row.merge_proposal_id ?? null,
    candidateId: row.candidate_id ?? null,
    survivorCustomerId: row.survivor_customer_id,
    absorbedCustomerId: row.absorbed_customer_id,
    tenantId: row.tenant_id,
    venueId: row.venue_id,
    approvalReference: row.approval_reference ?? null,
    actorReference: row.actor_reference ?? null,
    survivorVersionAfter: row.survivor_version_after,
    absorbedVersionAtMerge: row.absorbed_version_at_merge,
    resolutionSummary: Object.freeze(cloneJson(row.resolution_summary || {})),
    reasonCodes: Object.freeze(cloneJson(row.reason_codes || [])),
    recordedAt: row.recorded_at,
  });
}
