/**
 * Linkage row ↔ domain mapping (CUSTOMER-05).
 */

/**
 * @param {object} linkage
 */
export function mapLinkageDomainToRow(linkage) {
  return Object.freeze({
    linkage_id: linkage.linkageId,
    customer_id: linkage.customerId,
    tenant_id: linkage.tenantId,
    venue_id: linkage.venueId,
    linkage_type: linkage.linkageType,
    external_reference_id: linkage.externalReferenceId,
    external_reference_type: linkage.externalReferenceType,
    external_system: linkage.externalSystem,
    status: linkage.status,
    source: linkage.source,
    evidence_reference: linkage.evidenceReference ?? null,
    actor_reference: linkage.actorReference ?? null,
    effective_at: linkage.effectiveAt,
    ended_at: linkage.endedAt ?? null,
    version: linkage.version,
    created_at: linkage.createdAt,
    updated_at: linkage.updatedAt,
  });
}

/**
 * @param {object} row
 */
export function mapLinkageRowToDomain(row) {
  return Object.freeze({
    linkageId: row.linkage_id,
    customerId: row.customer_id,
    tenantId: row.tenant_id,
    venueId: row.venue_id,
    linkageType: row.linkage_type,
    externalReferenceId: row.external_reference_id,
    externalReferenceType: row.external_reference_type,
    externalSystem: row.external_system,
    status: row.status,
    source: row.source,
    evidenceReference: row.evidence_reference ?? null,
    actorReference: row.actor_reference ?? null,
    effectiveAt: row.effective_at,
    endedAt: row.ended_at ?? null,
    version: Number(row.version),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

/**
 * @param {object} history
 */
export function mapLinkageHistoryDomainToRow(history) {
  return Object.freeze({
    history_id: history.historyId,
    linkage_id: history.linkageId,
    customer_id: history.customerId,
    tenant_id: history.tenantId,
    venue_id: history.venueId,
    linkage_type: history.linkageType,
    external_reference_id: history.externalReferenceId,
    previous_status: history.previousStatus,
    next_status: history.nextStatus,
    action: history.action,
    source: history.source,
    reason: history.reason ?? null,
    evidence_reference: history.evidenceReference ?? null,
    actor_reference: history.actorReference ?? null,
    effective_at: history.effectiveAt ?? null,
    sequence: history.sequence,
    customer_version: history.customerVersion,
    recorded_at: history.recordedAt,
  });
}

/**
 * @param {object} row
 */
export function mapLinkageHistoryRowToDomain(row) {
  return Object.freeze({
    historyId: row.history_id,
    linkageId: row.linkage_id,
    customerId: row.customer_id,
    tenantId: row.tenant_id,
    venueId: row.venue_id,
    linkageType: row.linkage_type,
    externalReferenceId: row.external_reference_id,
    previousStatus: row.previous_status ?? null,
    nextStatus: row.next_status,
    action: row.action,
    source: row.source ?? null,
    reason: row.reason ?? null,
    evidenceReference: row.evidence_reference ?? null,
    actorReference: row.actor_reference ?? null,
    effectiveAt: row.effective_at ?? null,
    sequence: Number(row.sequence),
    customerVersion: Number(row.customer_version),
    recordedAt: row.recorded_at,
  });
}
