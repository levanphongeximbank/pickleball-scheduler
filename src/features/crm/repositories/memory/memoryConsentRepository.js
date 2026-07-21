/**
 * In-memory CrmConsentRepository — append-only per instance.
 */

import {
  compareConsentHistoryDesc,
  createConsentRecord,
} from "../../models/consentRecord.js";
import { createScopedMemoryStore, resolveScope } from "./scopedMemoryStore.js";

export function createMemoryConsentRepository() {
  const store = createScopedMemoryStore();

  return {
    create(scopeInput, consentInput) {
      const scope = resolveScope(scopeInput);
      const consent = createConsentRecord({
        ...consentInput,
        tenantId: scope.tenantId,
        venueId: scope.venueId,
      });
      return store.save(scope, consent.consentId, consent);
    },
    getById(scopeInput, consentId) {
      const scope = resolveScope(scopeInput);
      return store.getById(scope, String(consentId || ""));
    },
    list(scopeInput, filters = {}) {
      const scope = resolveScope(scopeInput);
      const rows = store.list(scope, (row) => {
        if (filters.contactRefId && row.contactRefId !== String(filters.contactRefId)) {
          return false;
        }
        if (filters.channel && row.channel !== String(filters.channel)) return false;
        if (filters.purpose && row.purpose !== String(filters.purpose)) return false;
        if (filters.status && row.status !== String(filters.status)) return false;
        return true;
      });
      return rows.slice().sort(compareConsentHistoryDesc);
    },
  };
}
