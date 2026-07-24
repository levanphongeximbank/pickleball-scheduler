/**
 * Durable consent / preference repository (CUSTOMER-04).
 * Uses injectable CustomerDatabaseClientPort + transactional RPC.
 */

import { CUSTOMER_ERROR_CODES } from "../../errors/codes.js";
import { CustomerError } from "../../errors/CustomerError.js";
import { createCustomerScope, scopesMatch } from "../../domain/scope.js";
import { cloneFrozen } from "../../repositories/inMemory.js";
import { CUSTOMER_CONSENT_REPOSITORY_PORTS } from "../../repositories/consentPreferencePorts.js";
import {
  CUSTOMER_PHASE_4_RPC,
  CUSTOMER_PHASE_4_TABLES,
  requireCustomerDatabaseClientPort,
} from "../databaseClientPort.js";
import { withCustomerPersistenceErrors } from "../errorTranslation.js";
import {
  mapConsentDomainToRow,
  mapConsentHistoryDomainToRow,
  mapConsentHistoryRowToDomain,
  mapConsentRowToDomain,
  mapPreferenceDomainToRow,
  mapPreferenceHistoryDomainToRow,
  mapPreferenceHistoryRowToDomain,
  mapPreferenceRowToDomain,
} from "../mapping/consentPreferenceMapping.js";

/**
 * @param {{ db: import('../databaseClientPort.js').CustomerDatabaseClientPort }} deps
 */
export function createDurableConsentPreferenceRepository(deps = {}) {
  const db = requireCustomerDatabaseClientPort(deps.db);

  function scopeFilters(scope) {
    return { tenant_id: scope.tenantId, venue_id: scope.venueId };
  }

  function assertExpectedVersion(existing, expectedVersion, entityId) {
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

    async getConsent(scopeInput, customerId, purpose, channel = null) {
      const scope = createCustomerScope(scopeInput);
      return withCustomerPersistenceErrors(async () => {
        const filters = {
          ...scopeFilters(scope),
          customer_id: String(customerId),
          purpose: String(purpose),
        };
        if (channel == null || channel === "") {
          filters.channel = null;
        } else {
          filters.channel = String(channel);
        }
        const rows = await db.select({
          table: CUSTOMER_PHASE_4_TABLES.CONSENTS,
          filters,
          limit: 1,
        });
        if (!rows || rows.length === 0) return null;
        const domain = mapConsentRowToDomain(rows[0]);
        if (!scopesMatch(scope, domain)) return null;
        return cloneFrozen(domain);
      });
    },

    async listConsents(scopeInput, customerId) {
      const scope = createCustomerScope(scopeInput);
      return withCustomerPersistenceErrors(async () => {
        const rows = await db.select({
          table: CUSTOMER_PHASE_4_TABLES.CONSENTS,
          filters: {
            ...scopeFilters(scope),
            customer_id: String(customerId),
          },
          order: [{ column: "consent_id", ascending: true }],
        });
        return (rows || [])
          .map(mapConsentRowToDomain)
          .filter((r) => scopesMatch(scope, r))
          .map((r) => cloneFrozen(r));
      });
    },

    async saveConsentWithHistory(consent, history, options = {}) {
      return withCustomerPersistenceErrors(async () => {
        const scope = createCustomerScope(consent);
        const existingRows = await db.select({
          table: CUSTOMER_PHASE_4_TABLES.CONSENTS,
          filters: {
            ...scopeFilters(scope),
            customer_id: consent.customerId,
            purpose: consent.purpose,
            channel: consent.channel,
          },
          limit: 1,
        });
        const existing = existingRows?.[0]
          ? mapConsentRowToDomain(existingRows[0])
          : null;
        assertExpectedVersion(existing, options.expectedVersion, consent.consentId);

        const saved = await db.rpc({
          fn: CUSTOMER_PHASE_4_RPC.SAVE_CONSENT,
          args: {
            p_consent: mapConsentDomainToRow(consent),
            p_history: mapConsentHistoryDomainToRow(history),
            p_expected_version:
              options.expectedVersion == null
                ? null
                : Number(options.expectedVersion),
          },
        });
        return cloneFrozen(mapConsentRowToDomain(saved));
      });
    },

    async listConsentHistory(scopeInput, consentId) {
      const scope = createCustomerScope(scopeInput);
      return withCustomerPersistenceErrors(async () => {
        const rows = await db.select({
          table: CUSTOMER_PHASE_4_TABLES.CONSENT_HISTORY,
          filters: {
            ...scopeFilters(scope),
            consent_id: String(consentId),
          },
          order: [{ column: "sequence", ascending: true }],
        });
        return (rows || [])
          .map(mapConsentHistoryRowToDomain)
          .filter((r) => scopesMatch(scope, r))
          .map((r) => cloneFrozen(r));
      });
    },

    async getPreference(scopeInput, customerId, purpose, channel) {
      const scope = createCustomerScope(scopeInput);
      return withCustomerPersistenceErrors(async () => {
        const rows = await db.select({
          table: CUSTOMER_PHASE_4_TABLES.PREFERENCES,
          filters: {
            ...scopeFilters(scope),
            customer_id: String(customerId),
            purpose: String(purpose),
            channel: String(channel),
          },
          limit: 1,
        });
        if (!rows || rows.length === 0) return null;
        const domain = mapPreferenceRowToDomain(rows[0]);
        if (!scopesMatch(scope, domain)) return null;
        return cloneFrozen(domain);
      });
    },

    async listPreferences(scopeInput, customerId) {
      const scope = createCustomerScope(scopeInput);
      return withCustomerPersistenceErrors(async () => {
        const rows = await db.select({
          table: CUSTOMER_PHASE_4_TABLES.PREFERENCES,
          filters: {
            ...scopeFilters(scope),
            customer_id: String(customerId),
          },
          order: [{ column: "preference_id", ascending: true }],
        });
        return (rows || [])
          .map(mapPreferenceRowToDomain)
          .filter((r) => scopesMatch(scope, r))
          .map((r) => cloneFrozen(r));
      });
    },

    async savePreferenceWithHistory(preference, history, options = {}) {
      return withCustomerPersistenceErrors(async () => {
        const scope = createCustomerScope(preference);
        const existingRows = await db.select({
          table: CUSTOMER_PHASE_4_TABLES.PREFERENCES,
          filters: {
            ...scopeFilters(scope),
            customer_id: preference.customerId,
            purpose: preference.purpose,
            channel: preference.channel,
          },
          limit: 1,
        });
        const existing = existingRows?.[0]
          ? mapPreferenceRowToDomain(existingRows[0])
          : null;
        assertExpectedVersion(
          existing,
          options.expectedVersion,
          preference.preferenceId
        );

        const saved = await db.rpc({
          fn: CUSTOMER_PHASE_4_RPC.SAVE_PREFERENCE,
          args: {
            p_preference: mapPreferenceDomainToRow(preference),
            p_history: mapPreferenceHistoryDomainToRow(history),
            p_expected_version:
              options.expectedVersion == null
                ? null
                : Number(options.expectedVersion),
          },
        });
        return cloneFrozen(mapPreferenceRowToDomain(saved));
      });
    },

    async listPreferenceHistory(scopeInput, preferenceId) {
      const scope = createCustomerScope(scopeInput);
      return withCustomerPersistenceErrors(async () => {
        const rows = await db.select({
          table: CUSTOMER_PHASE_4_TABLES.PREFERENCE_HISTORY,
          filters: {
            ...scopeFilters(scope),
            preference_id: String(preferenceId),
          },
          order: [{ column: "sequence", ascending: true }],
        });
        return (rows || [])
          .map(mapPreferenceHistoryRowToDomain)
          .filter((r) => scopesMatch(scope, r))
          .map((r) => cloneFrozen(r));
      });
    },
  };
}
