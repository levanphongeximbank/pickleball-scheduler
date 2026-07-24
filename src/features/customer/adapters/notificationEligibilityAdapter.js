/**
 * Customer-owned Notification boundary adapter (CUSTOMER-04).
 *
 * Notification may consume communication eligibility but must not mutate
 * Customer consent state directly.
 *
 * Read-only. Does not touch Notification queue/worker/provider.
 */

import { projectCommunicationEligibilityView } from "../projectors/consentPreferenceViews.js";

/**
 * @param {{ consentPreferenceApplication: object }} deps
 */
export function createCustomerNotificationEligibilityAdapter(deps = {}) {
  const app = deps.consentPreferenceApplication;
  if (!app || typeof app.evaluateCommunicationEligibility !== "function") {
    throw new Error(
      "createCustomerNotificationEligibilityAdapter requires consentPreferenceApplication"
    );
  }

  return Object.freeze({
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

    /**
     * @param {object} scope
     * @param {string} customerId
     * @param {string} purpose
     * @param {object} [options]
     */
    async listChannelEligibility(scope, customerId, purpose, options = {}) {
      const rows = await app.listEligibleChannels(
        scope,
        customerId,
        purpose,
        options
      );
      return Object.freeze(
        rows.map((row) => projectCommunicationEligibilityView(row))
      );
    },
  });
}
