/**
 * In-memory consent / preference repository (CUSTOMER-04).
 * Transactional current-state + history within a single factory instance.
 */

import { CUSTOMER_ERROR_CODES } from "../errors/codes.js";
import { CustomerError } from "../errors/CustomerError.js";
import { createCustomerScope, scopesMatch } from "../domain/scope.js";
import { cloneFrozen } from "./inMemory.js";
import { CUSTOMER_CONSENT_REPOSITORY_PORTS } from "./consentPreferencePorts.js";

/**
 * @returns {import("./consentPreferencePorts.js").CustomerConsentPreferenceRepository & {
 *   port: string,
 *   resetAllForTests: () => void,
 * }}
 */
export function createInMemoryConsentPreferenceRepository() {
  /** @type {Map<string, object>} */
  const consents = new Map();
  /** @type {Map<string, object[]>} */
  const consentHistory = new Map();
  /** @type {Map<string, object>} */
  const preferences = new Map();
  /** @type {Map<string, object[]>} */
  const preferenceHistory = new Map();

  function consentKey(scope, customerId, purpose, channel) {
    return `${scope.tenantId}\u0000${scope.venueId}\u0000${customerId}\u0000${purpose}\u0000${channel ?? ""}`;
  }

  function preferenceKey(scope, customerId, purpose, channel) {
    return `${scope.tenantId}\u0000${scope.venueId}\u0000${customerId}\u0000${purpose}\u0000${channel}`;
  }

  function assertVersion(existing, expectedVersion, entityId) {
    if (expectedVersion == null) return;
    const expected = Number(expectedVersion);
    if (!existing) {
      if (expected !== 0) {
        throw new CustomerError(
          CUSTOMER_ERROR_CODES.VERSION_CONFLICT,
          "Consent/preference version conflict on create.",
          { entityId, expectedVersion: expected, actualVersion: 0 }
        );
      }
      return;
    }
    if (!Number.isInteger(expected) || expected !== existing.version) {
      throw new CustomerError(
        CUSTOMER_ERROR_CODES.VERSION_CONFLICT,
        "Consent/preference version conflict.",
        {
          entityId,
          expectedVersion: expected,
          actualVersion: existing.version,
        }
      );
    }
  }

  return {
    port: CUSTOMER_CONSENT_REPOSITORY_PORTS.CustomerConsentPreferenceRepository,

    resetAllForTests() {
      consents.clear();
      consentHistory.clear();
      preferences.clear();
      preferenceHistory.clear();
    },

    async getConsent(scopeInput, customerId, purpose, channel = null) {
      const scope = createCustomerScope(scopeInput);
      const key = consentKey(scope, customerId, purpose, channel);
      const row = consents.get(key);
      if (!row || !scopesMatch(scope, row)) return null;
      return cloneFrozen(row);
    },

    async listConsents(scopeInput, customerId) {
      const scope = createCustomerScope(scopeInput);
      const out = [];
      for (const row of consents.values()) {
        if (
          scopesMatch(scope, row) &&
          row.customerId === customerId
        ) {
          out.push(cloneFrozen(row));
        }
      }
      return out;
    },

    async saveConsentWithHistory(consent, history, options = {}) {
      const scope = createCustomerScope(consent);
      const key = consentKey(
        scope,
        consent.customerId,
        consent.purpose,
        consent.channel
      );
      const existing = consents.get(key) || null;
      assertVersion(existing, options.expectedVersion, consent.consentId);

      // Simulate transaction: write history first then current; rollback both on failure.
      const historyKey = consent.consentId;
      const prevHistory = consentHistory.get(historyKey)
        ? [...consentHistory.get(historyKey)]
        : [];
      const prevConsent = existing ? cloneFrozen(existing) : null;

      try {
        const nextHistory = [...prevHistory, cloneFrozen(history)];
        consentHistory.set(historyKey, nextHistory);
        consents.set(key, cloneFrozen(consent));
        return cloneFrozen(consent);
      } catch (err) {
        if (prevConsent) consents.set(key, prevConsent);
        else consents.delete(key);
        if (prevHistory.length) consentHistory.set(historyKey, prevHistory);
        else consentHistory.delete(historyKey);
        throw err;
      }
    },

    async listConsentHistory(scopeInput, consentId) {
      const scope = createCustomerScope(scopeInput);
      const rows = consentHistory.get(consentId) || [];
      return rows
        .filter((r) => scopesMatch(scope, r))
        .map((r) => cloneFrozen(r))
        .sort((a, b) => a.sequence - b.sequence);
    },

    async getPreference(scopeInput, customerId, purpose, channel) {
      const scope = createCustomerScope(scopeInput);
      const key = preferenceKey(scope, customerId, purpose, channel);
      const row = preferences.get(key);
      if (!row || !scopesMatch(scope, row)) return null;
      return cloneFrozen(row);
    },

    async listPreferences(scopeInput, customerId) {
      const scope = createCustomerScope(scopeInput);
      const out = [];
      for (const row of preferences.values()) {
        if (scopesMatch(scope, row) && row.customerId === customerId) {
          out.push(cloneFrozen(row));
        }
      }
      return out;
    },

    async savePreferenceWithHistory(preference, history, options = {}) {
      const scope = createCustomerScope(preference);
      const key = preferenceKey(
        scope,
        preference.customerId,
        preference.purpose,
        preference.channel
      );
      const existing = preferences.get(key) || null;
      assertVersion(existing, options.expectedVersion, preference.preferenceId);

      // Enforce uniqueness: one active preference per customer+purpose+channel
      if (
        existing &&
        existing.preferenceId !== preference.preferenceId
      ) {
        throw new CustomerError(
          CUSTOMER_ERROR_CODES.PREFERENCE_CONFLICT,
          "Active preference already exists for customer+purpose+channel.",
          {
            preferenceId: existing.preferenceId,
            customerId: preference.customerId,
            purpose: preference.purpose,
            channel: preference.channel,
          }
        );
      }

      const historyKey = preference.preferenceId;
      const prevHistory = preferenceHistory.get(historyKey)
        ? [...preferenceHistory.get(historyKey)]
        : [];
      const prevPref = existing ? cloneFrozen(existing) : null;

      try {
        preferenceHistory.set(historyKey, [
          ...prevHistory,
          cloneFrozen(history),
        ]);
        preferences.set(key, cloneFrozen(preference));
        return cloneFrozen(preference);
      } catch (err) {
        if (prevPref) preferences.set(key, prevPref);
        else preferences.delete(key);
        if (prevHistory.length) preferenceHistory.set(historyKey, prevHistory);
        else preferenceHistory.delete(historyKey);
        throw err;
      }
    },

    async listPreferenceHistory(scopeInput, preferenceId) {
      const scope = createCustomerScope(scopeInput);
      const rows = preferenceHistory.get(preferenceId) || [];
      return rows
        .filter((r) => scopesMatch(scope, r))
        .map((r) => cloneFrozen(r))
        .sort((a, b) => a.sequence - b.sequence);
    },
  };
}
