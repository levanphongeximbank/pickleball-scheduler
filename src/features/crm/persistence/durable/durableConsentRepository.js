/**
 * Durable CrmConsentRepository adapter (Phase 1G).
 * Append-only: create + get + list. No update/delete on the public contract.
 */

import {
  compareConsentHistoryDesc,
  createConsentRecord,
} from "../../models/consentRecord.js";
import { createTenantVenueScope } from "../../models/scope.js";
import { CRM_ERROR_CODES, CrmError } from "../../constants/errorCodes.js";
import {
  CRM_PHASE_1G_TABLES,
  requireCrmDatabaseClientPort,
} from "../databaseClientPort.js";
import { withPersistenceErrors } from "../errorTranslation.js";
import {
  mapConsentDomainToRow,
  mapConsentRowToDomain,
} from "../mapping/consentMapping.js";

/**
 * @param {{ db: import('../databaseClientPort.js').CrmDatabaseClientPort }} deps
 */
export function createDurableConsentRepository(deps = {}) {
  const db = requireCrmDatabaseClientPort(deps.db);

  function resolveScope(scopeInput) {
    return createTenantVenueScope(scopeInput);
  }

  function scopeFilters(scope) {
    return { tenant_id: scope.tenantId, venue_id: scope.venueId };
  }

  const repo = {
    async create(scopeInput, consentInput) {
      const scope = resolveScope(scopeInput);
      const consent = createConsentRecord({
        ...consentInput,
        tenantId: scope.tenantId,
        venueId: scope.venueId,
      });
      const row = mapConsentDomainToRow(consent);
      return withPersistenceErrors(
        async () => {
          const inserted = await db.insert({
            table: CRM_PHASE_1G_TABLES.CONSENT_RECORDS,
            rows: row,
            returning: true,
          });
          return mapConsentRowToDomain(inserted[0]);
        },
        { conflictMessage: "Consent record id already exists in scope." }
      );
    },

    async getById(scopeInput, consentId) {
      const scope = resolveScope(scopeInput);
      const id = String(consentId || "").trim();
      if (!id) return null;
      return withPersistenceErrors(async () => {
        const rows = await db.select({
          table: CRM_PHASE_1G_TABLES.CONSENT_RECORDS,
          filters: { ...scopeFilters(scope), consent_id: id },
          limit: 1,
        });
        if (!rows || rows.length === 0) return null;
        return mapConsentRowToDomain(rows[0]);
      });
    },

    async list(scopeInput, filters = {}) {
      const scope = resolveScope(scopeInput);
      return withPersistenceErrors(async () => {
        const queryFilters = { ...scopeFilters(scope) };
        if (filters.contactRefId) {
          queryFilters.contact_ref_id = String(filters.contactRefId);
        }
        if (filters.channel) queryFilters.channel = String(filters.channel);
        if (filters.purpose) queryFilters.purpose = String(filters.purpose);
        if (filters.status) queryFilters.status = String(filters.status);

        const rows = await db.select({
          table: CRM_PHASE_1G_TABLES.CONSENT_RECORDS,
          filters: queryFilters,
          order: [
            { column: "effective_at", ascending: false },
            { column: "created_at", ascending: false },
            { column: "consent_id", ascending: true },
          ],
        });
        return (rows || [])
          .map(mapConsentRowToDomain)
          .sort(compareConsentHistoryDesc);
      });
    },
  };

  // Explicitly unavailable — append-only enforcement
  Object.defineProperty(repo, "update", {
    enumerable: false,
    value() {
      throw new CrmError(
        CRM_ERROR_CODES.INVALID_INPUT,
        "Consent repository is append-only; update is unavailable."
      );
    },
  });
  Object.defineProperty(repo, "delete", {
    enumerable: false,
    value() {
      throw new CrmError(
        CRM_ERROR_CODES.INVALID_INPUT,
        "Consent repository is append-only; delete is unavailable."
      );
    },
  });

  return repo;
}
