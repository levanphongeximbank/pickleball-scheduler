/**
 * Explicit ConsentRecord ↔ crm_consent_records row mapping (Phase 1G).
 */

import { createConsentRecord } from "../../models/consentRecord.js";
import {
  mapOptionalString,
  mapOptionalTimestamp,
  requireMappedScope,
  requireMappedString,
  requireMappedTimestamp,
} from "./mappingHelpers.js";

/**
 * @param {object} consent
 * @returns {object}
 */
export function mapConsentDomainToRow(consent) {
  const scope = requireMappedScope(consent);
  return {
    consent_id: requireMappedString(consent.consentId, "consentId"),
    tenant_id: scope.tenantId,
    venue_id: scope.venueId,
    contact_ref_id: requireMappedString(consent.contactRefId, "contactRefId"),
    channel: requireMappedString(consent.channel, "channel"),
    purpose: requireMappedString(consent.purpose, "purpose"),
    status: requireMappedString(consent.status, "status"),
    source: requireMappedString(consent.source || "CRM", "source"),
    policy_version: requireMappedString(consent.policyVersion, "policyVersion"),
    effective_at: requireMappedTimestamp(consent.effectiveAt, "effectiveAt"),
    expires_at: mapOptionalTimestamp(consent.expiresAt),
    revoked_at: mapOptionalTimestamp(consent.revokedAt),
    reason: mapOptionalString(consent.reason),
    recorded_by_actor_id: requireMappedString(
      consent.recordedByActorId,
      "recordedByActorId"
    ),
    created_at: requireMappedTimestamp(consent.createdAt, "createdAt"),
    updated_at: requireMappedTimestamp(consent.updatedAt ?? consent.createdAt, "updatedAt"),
  };
}

/**
 * @param {object} row
 * @returns {object}
 */
export function mapConsentRowToDomain(row) {
  if (!row || typeof row !== "object") {
    throw new Error("crm_consent_records row is required.");
  }
  return createConsentRecord({
    consentId: requireMappedString(row.consent_id, "consent_id"),
    tenantId: requireMappedString(row.tenant_id, "tenant_id"),
    venueId: requireMappedString(row.venue_id, "venue_id"),
    contactRefId: requireMappedString(row.contact_ref_id, "contact_ref_id"),
    channel: requireMappedString(row.channel, "channel"),
    purpose: requireMappedString(row.purpose, "purpose"),
    status: requireMappedString(row.status, "status"),
    source: mapOptionalString(row.source) || "CRM",
    policyVersion: requireMappedString(row.policy_version, "policy_version"),
    effectiveAt: requireMappedTimestamp(row.effective_at, "effective_at"),
    expiresAt: mapOptionalTimestamp(row.expires_at),
    revokedAt: mapOptionalTimestamp(row.revoked_at),
    reason: mapOptionalString(row.reason),
    recordedByActorId: requireMappedString(
      row.recorded_by_actor_id,
      "recorded_by_actor_id"
    ),
    createdAt: requireMappedTimestamp(row.created_at, "created_at"),
    updatedAt: requireMappedTimestamp(row.updated_at, "updated_at"),
  });
}
