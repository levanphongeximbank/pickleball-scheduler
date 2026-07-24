/**
 * Consent & communication preference repository ports (CUSTOMER-04).
 */

export const CUSTOMER_CONSENT_REPOSITORY_PORTS = Object.freeze({
  CustomerConsentPreferenceRepository: "CustomerConsentPreferenceRepository",
});

/**
 * @typedef {object} CustomerConsentPreferenceRepository
 * @property {(scope: object, customerId: string, purpose: string, channel?: string|null) => object|null|Promise<object|null>} getConsent
 * @property {(scope: object, customerId: string) => object[]|Promise<object[]>} listConsents
 * @property {(consent: object, history: object, options?: { expectedVersion?: number|null }) => object|Promise<object>} saveConsentWithHistory
 * @property {(scope: object, consentId: string) => object[]|Promise<object[]>} listConsentHistory
 * @property {(scope: object, customerId: string, purpose: string, channel: string) => object|null|Promise<object|null>} getPreference
 * @property {(scope: object, customerId: string) => object[]|Promise<object[]>} listPreferences
 * @property {(preference: object, history: object, options?: { expectedVersion?: number|null }) => object|Promise<object>} savePreferenceWithHistory
 * @property {(scope: object, preferenceId: string) => object[]|Promise<object[]>} listPreferenceHistory
 */
