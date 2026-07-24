/**
 * Consent / preference read projectors (CUSTOMER-04).
 * Copy-safe. No raw evidence payloads.
 */

/**
 * @param {object} consent
 * @returns {Readonly<object>}
 */
export function projectCustomerConsentView(consent) {
  if (!consent) return null;
  return Object.freeze({
    consentId: consent.consentId,
    customerId: consent.customerId,
    purpose: consent.purpose,
    channel: consent.channel ?? null,
    status: consent.status,
    effectiveAt: consent.effectiveAt ?? null,
    expiresAt: consent.expiresAt ?? null,
    revokedAt: consent.revokedAt ?? null,
    source: consent.source ?? null,
    evidenceReference: consent.evidenceReference ?? null,
    actorReference: consent.actorReference ?? null,
    version: consent.version,
    capturedAt: consent.capturedAt ?? null,
    updatedAt: consent.updatedAt ?? null,
  });
}

/**
 * @param {object} preference
 * @returns {Readonly<object>}
 */
export function projectCustomerCommunicationPreferenceView(preference) {
  if (!preference) return null;
  return Object.freeze({
    preferenceId: preference.preferenceId,
    customerId: preference.customerId,
    purpose: preference.purpose,
    channel: preference.channel,
    status: preference.status,
    effectiveAt: preference.effectiveAt ?? null,
    source: preference.source ?? null,
    version: preference.version,
    updatedAt: preference.updatedAt ?? null,
  });
}

/**
 * @param {object} eligibility
 * @returns {Readonly<object>}
 */
export function projectCommunicationEligibilityView(eligibility) {
  if (!eligibility) return null;
  return Object.freeze({
    customerId: eligibility.customerId ?? null,
    purpose: eligibility.purpose,
    channel: eligibility.channel,
    eligibility: eligibility.eligibility,
    reasonCodes: Object.freeze([...(eligibility.reasonCodes || [])]),
    evaluatedAt: eligibility.evaluatedAt,
    requiredPolicyReference: eligibility.requiredPolicyReference ?? null,
  });
}

/**
 * CRM-facing summary (read-only facts).
 * @param {{ consents?: object[], preferences?: object[] }} input
 */
export function projectCustomerConsentPreferenceSummary(input = {}) {
  const consents = (input.consents || []).map(projectCustomerConsentView).filter(Boolean);
  const preferences = (input.preferences || [])
    .map(projectCustomerCommunicationPreferenceView)
    .filter(Boolean);
  return Object.freeze({
    customerId: input.customerId ?? null,
    consents: Object.freeze(consents),
    preferences: Object.freeze(preferences),
  });
}
