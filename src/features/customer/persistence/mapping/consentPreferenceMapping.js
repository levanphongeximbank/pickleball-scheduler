/**
 * Mapping helpers for Customer consent / preference durable rows (CUSTOMER-04).
 */

/**
 * @param {object} consent
 */
export function mapConsentDomainToRow(consent) {
  return {
    consent_id: consent.consentId,
    customer_id: consent.customerId,
    tenant_id: consent.tenantId,
    venue_id: consent.venueId,
    purpose: consent.purpose,
    channel: consent.channel,
    status: consent.status,
    effective_at: consent.effectiveAt,
    expires_at: consent.expiresAt,
    revoked_at: consent.revokedAt,
    source: consent.source,
    evidence_reference: consent.evidenceReference,
    actor_reference: consent.actorReference,
    captured_at: consent.capturedAt,
    version: consent.version,
    created_at: consent.createdAt,
    updated_at: consent.updatedAt,
  };
}

/**
 * @param {object} row
 */
export function mapConsentRowToDomain(row) {
  if (!row) return null;
  return Object.freeze({
    consentId: row.consent_id,
    customerId: row.customer_id,
    tenantId: row.tenant_id,
    venueId: row.venue_id,
    purpose: row.purpose,
    channel: row.channel ?? null,
    status: row.status,
    effectiveAt: row.effective_at ?? null,
    expiresAt: row.expires_at ?? null,
    revokedAt: row.revoked_at ?? null,
    source: row.source ?? null,
    evidenceReference: row.evidence_reference ?? null,
    actorReference: row.actor_reference ?? null,
    capturedAt: row.captured_at ?? null,
    version: Number(row.version),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

/**
 * @param {object} history
 */
export function mapConsentHistoryDomainToRow(history) {
  return {
    history_id: history.historyId,
    consent_id: history.consentId,
    customer_id: history.customerId,
    tenant_id: history.tenantId,
    venue_id: history.venueId,
    sequence: history.sequence,
    previous_status: history.previousStatus,
    next_status: history.nextStatus,
    purpose: history.purpose,
    channel: history.channel,
    effective_at: history.effectiveAt,
    source: history.source,
    evidence_reference: history.evidenceReference,
    actor_reference: history.actorReference,
    reason: history.reason,
    aggregate_version: history.aggregateVersion,
    recorded_at: history.recordedAt,
  };
}

/**
 * @param {object} row
 */
export function mapConsentHistoryRowToDomain(row) {
  if (!row) return null;
  return Object.freeze({
    historyId: row.history_id,
    consentId: row.consent_id,
    customerId: row.customer_id,
    tenantId: row.tenant_id,
    venueId: row.venue_id,
    sequence: Number(row.sequence),
    previousStatus: row.previous_status,
    nextStatus: row.next_status,
    purpose: row.purpose,
    channel: row.channel ?? null,
    effectiveAt: row.effective_at ?? null,
    source: row.source ?? null,
    evidenceReference: row.evidence_reference ?? null,
    actorReference: row.actor_reference ?? null,
    reason: row.reason ?? null,
    aggregateVersion: Number(row.aggregate_version),
    recordedAt: row.recorded_at,
  });
}

/**
 * @param {object} preference
 */
export function mapPreferenceDomainToRow(preference) {
  return {
    preference_id: preference.preferenceId,
    customer_id: preference.customerId,
    tenant_id: preference.tenantId,
    venue_id: preference.venueId,
    purpose: preference.purpose,
    channel: preference.channel,
    status: preference.status,
    effective_at: preference.effectiveAt,
    source: preference.source,
    actor_reference: preference.actorReference,
    version: preference.version,
    created_at: preference.createdAt,
    updated_at: preference.updatedAt,
  };
}

/**
 * @param {object} row
 */
export function mapPreferenceRowToDomain(row) {
  if (!row) return null;
  return Object.freeze({
    preferenceId: row.preference_id,
    customerId: row.customer_id,
    tenantId: row.tenant_id,
    venueId: row.venue_id,
    purpose: row.purpose,
    channel: row.channel,
    status: row.status,
    effectiveAt: row.effective_at ?? null,
    source: row.source ?? null,
    actorReference: row.actor_reference ?? null,
    version: Number(row.version),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

/**
 * @param {object} history
 */
export function mapPreferenceHistoryDomainToRow(history) {
  return {
    history_id: history.historyId,
    preference_id: history.preferenceId,
    customer_id: history.customerId,
    tenant_id: history.tenantId,
    venue_id: history.venueId,
    sequence: history.sequence,
    previous_status: history.previousStatus,
    next_status: history.nextStatus,
    purpose: history.purpose,
    channel: history.channel,
    effective_at: history.effectiveAt,
    source: history.source,
    actor_reference: history.actorReference,
    reason: history.reason,
    aggregate_version: history.aggregateVersion,
    recorded_at: history.recordedAt,
  };
}

/**
 * @param {object} row
 */
export function mapPreferenceHistoryRowToDomain(row) {
  if (!row) return null;
  return Object.freeze({
    historyId: row.history_id,
    preferenceId: row.preference_id,
    customerId: row.customer_id,
    tenantId: row.tenant_id,
    venueId: row.venue_id,
    sequence: Number(row.sequence),
    previousStatus: row.previous_status,
    nextStatus: row.next_status,
    purpose: row.purpose,
    channel: row.channel,
    effectiveAt: row.effective_at ?? null,
    source: row.source ?? null,
    actorReference: row.actor_reference ?? null,
    reason: row.reason ?? null,
    aggregateVersion: Number(row.aggregate_version),
    recordedAt: row.recorded_at,
  });
}
