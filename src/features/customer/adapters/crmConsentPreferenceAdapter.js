/**
 * Customer-owned CRM boundary adapter (CUSTOMER-04).
 *
 * CRM may read consent/preference/eligibility facts.
 * CRM must not own or mutate canonical Customer consent records.
 */

import {
  projectCustomerConsentPreferenceSummary,
  projectCommunicationEligibilityView,
} from "../projectors/consentPreferenceViews.js";

/**
 * @param {{ consentPreferenceApplication: object }} deps
 */
export function createCustomerCrmConsentPreferenceAdapter(deps = {}) {
  const app = deps.consentPreferenceApplication;
  if (
    !app ||
    typeof app.listConsents !== "function" ||
    typeof app.listPreferences !== "function"
  ) {
    throw new Error(
      "createCustomerCrmConsentPreferenceAdapter requires consentPreferenceApplication"
    );
  }

  return Object.freeze({
    /**
     * @param {object} scope
     * @param {string} customerId
     */
    async getConsentPreferenceSummary(scope, customerId) {
      const [consents, preferences] = await Promise.all([
        app.listConsents(scope, customerId),
        app.listPreferences(scope, customerId),
      ]);
      return projectCustomerConsentPreferenceSummary({
        customerId,
        consents,
        preferences,
      });
    },

    /**
     * @param {object} scope
     * @param {string} customerId
     * @param {{ purpose: string, channel: string, governancePolicyResolved?: boolean }} query
     */
    async getCommunicationEligibility(scope, customerId, query = {}) {
      const view = await app.evaluateCommunicationEligibility(
        scope,
        customerId,
        query
      );
      return projectCommunicationEligibilityView(view);
    },
  });
}
