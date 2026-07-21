/**
 * ConsentRecord foundation model (Phase 1F).
 *
 * Append-only history. Current effective consent is derived deterministically.
 */

import { CRM_ERROR_CODES, CrmError } from "../constants/errorCodes.js";
import { isConsentChannel } from "../constants/consentChannels.js";
import { isConsentPurpose } from "../constants/consentPurposes.js";
import { isConsentStatus } from "../constants/consentStatuses.js";
import { normalizeIsoTimestamp } from "../constants/timestamps.js";
import { createTenantVenueScope, requireNonEmptyId } from "./scope.js";

export const CONSENT_POLICY_VERSION_MAX_LENGTH = 64;
export const CONSENT_REASON_MAX_LENGTH = 500;
export const CONSENT_SOURCE_MAX_LENGTH = 120;

/**
 * @param {object} input
 * @returns {object}
 */
export function createConsentRecord(input = {}) {
  const scope = createTenantVenueScope(input);
  const consentId = requireNonEmptyId(input.consentId ?? input.id, "consentId");
  const contactRefId = requireNonEmptyId(input.contactRefId, "contactRefId");

  const channel = input.channel != null ? String(input.channel).trim() : "";
  if (!isConsentChannel(channel)) {
    throw new CrmError(CRM_ERROR_CODES.INVALID_STATUS, `Invalid consent channel: ${channel}`);
  }

  const purpose = input.purpose != null ? String(input.purpose).trim() : "";
  if (!isConsentPurpose(purpose)) {
    throw new CrmError(CRM_ERROR_CODES.INVALID_STATUS, `Invalid consent purpose: ${purpose}`);
  }

  const status = input.status != null ? String(input.status).trim() : "";
  if (!isConsentStatus(status)) {
    throw new CrmError(CRM_ERROR_CODES.INVALID_STATUS, `Invalid consent status: ${status}`);
  }

  const policyVersion =
    input.policyVersion != null ? String(input.policyVersion).trim() : "";
  if (!policyVersion) {
    throw new CrmError(CRM_ERROR_CODES.INVALID_INPUT, "policyVersion is required.");
  }
  if (policyVersion.length > CONSENT_POLICY_VERSION_MAX_LENGTH) {
    throw new CrmError(
      CRM_ERROR_CODES.INVALID_INPUT,
      `policyVersion must be at most ${CONSENT_POLICY_VERSION_MAX_LENGTH} characters.`
    );
  }

  const effectiveAt = normalizeIsoTimestamp(input.effectiveAt);
  if (!effectiveAt) {
    throw new CrmError(
      CRM_ERROR_CODES.INVALID_INPUT,
      "effectiveAt must be a valid ISO-8601 timestamp."
    );
  }

  const expiresAt =
    input.expiresAt != null && input.expiresAt !== ""
      ? normalizeIsoTimestamp(input.expiresAt)
      : null;
  if (input.expiresAt != null && input.expiresAt !== "" && !expiresAt) {
    throw new CrmError(
      CRM_ERROR_CODES.INVALID_INPUT,
      "expiresAt must be a valid ISO-8601 timestamp when provided."
    );
  }
  if (expiresAt && expiresAt <= effectiveAt) {
    throw new CrmError(
      CRM_ERROR_CODES.INVALID_INPUT,
      "expiresAt must be after effectiveAt when present."
    );
  }

  const revokedAt =
    input.revokedAt != null && input.revokedAt !== ""
      ? normalizeIsoTimestamp(input.revokedAt)
      : null;
  if (input.revokedAt != null && input.revokedAt !== "" && !revokedAt) {
    throw new CrmError(
      CRM_ERROR_CODES.INVALID_INPUT,
      "revokedAt must be a valid ISO-8601 timestamp when provided."
    );
  }

  const source =
    input.source != null && String(input.source).trim()
      ? String(input.source).trim().slice(0, CONSENT_SOURCE_MAX_LENGTH)
      : "CRM";

  const reason =
    input.reason != null && String(input.reason).trim()
      ? String(input.reason).trim().slice(0, CONSENT_REASON_MAX_LENGTH)
      : null;

  const recordedByActorId = requireNonEmptyId(
    input.recordedByActorId,
    "recordedByActorId"
  );

  return Object.freeze({
    consentId,
    tenantId: scope.tenantId,
    venueId: scope.venueId,
    contactRefId,
    channel,
    purpose,
    status,
    source,
    policyVersion,
    effectiveAt,
    expiresAt,
    revokedAt,
    reason,
    recordedByActorId,
    createdAt: normalizeIsoTimestamp(input.createdAt),
    updatedAt: normalizeIsoTimestamp(input.updatedAt ?? input.createdAt),
  });
}

/**
 * Deterministic consent history order: effectiveAt desc, createdAt desc, consentId asc.
 * @param {object} a
 * @param {object} b
 */
export function compareConsentHistoryDesc(a, b) {
  const effCmp = String(b.effectiveAt || "").localeCompare(String(a.effectiveAt || ""));
  if (effCmp !== 0) return effCmp;
  const createdCmp = String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  if (createdCmp !== 0) return createdCmp;
  return String(a.consentId || "").localeCompare(String(b.consentId || ""));
}

/**
 * Evaluate effective consent from append-only history at evaluationTime.
 *
 * Order:
 * 1. Filter same tenant/venue/contact/channel/purpose
 * 2. effectiveAt <= evaluation time
 * 3. expiresAt absent or greater than evaluation time
 * 4. Newest effectiveAt wins
 * 5. createdAt descending
 * 6. consentId ascending tie-break
 *
 * @param {object[]} records
 * @param {object} scope
 * @param {string} contactRefId
 * @param {string} channel
 * @param {string} purpose
 * @param {string} evaluationTimeIso
 * @returns {object|null}
 */
export function deriveEffectiveConsent(
  records,
  scope,
  contactRefId,
  channel,
  purpose,
  evaluationTimeIso
) {
  const evalTime = String(evaluationTimeIso || "");
  const candidates = records.filter((row) => {
    if (
      row.tenantId !== scope.tenantId ||
      row.venueId !== scope.venueId ||
      row.contactRefId !== contactRefId ||
      row.channel !== channel ||
      row.purpose !== purpose
    ) {
      return false;
    }
    if (String(row.effectiveAt) > evalTime) return false;
    if (row.expiresAt && String(row.expiresAt) <= evalTime) return false;
    return true;
  });

  if (candidates.length === 0) return null;

  candidates.sort(compareConsentHistoryDesc);
  return candidates[0];
}
