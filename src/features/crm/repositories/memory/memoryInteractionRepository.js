/**
 * In-memory CrmInteractionRepository — tenant/venue isolated per instance.
 * Append-oriented: create only (no update). Defensive cloning via freeze.
 * No localStorage, Supabase, SQL, or process-global mutable store.
 */

import { createInteraction } from "../../models/interaction.js";
import { createScopedMemoryStore, resolveScope } from "./scopedMemoryStore.js";

/**
 * Deterministic timeline order:
 * 1. occurredAt desc
 * 2. createdAt desc
 * 3. interactionId asc
 *
 * @param {object} a
 * @param {object} b
 */
export function compareInteractionsTimeline(a, b) {
  const occurredCmp = String(b.occurredAt || "").localeCompare(String(a.occurredAt || ""));
  if (occurredCmp !== 0) return occurredCmp;
  const createdCmp = String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  if (createdCmp !== 0) return createdCmp;
  return String(a.interactionId || "").localeCompare(String(b.interactionId || ""));
}

function matchesInteractionFilters(row, filters = {}) {
  if (filters.contactRefId && row.contactRefId !== String(filters.contactRefId)) return false;
  if (filters.leadId && row.leadId !== String(filters.leadId)) return false;
  if (filters.opportunityId && row.opportunityId !== String(filters.opportunityId)) return false;
  const typeFilter = filters.interactionType || filters.type;
  if (typeFilter && row.interactionType !== String(typeFilter)) return false;
  if (filters.direction && row.direction !== String(filters.direction)) return false;
  if (filters.channel && row.channel !== String(filters.channel)) return false;
  if (filters.occurredFrom) {
    const from = String(filters.occurredFrom);
    if (String(row.occurredAt || "") < from) return false;
  }
  if (filters.occurredTo) {
    const to = String(filters.occurredTo);
    if (String(row.occurredAt || "") > to) return false;
  }
  return true;
}

export function createMemoryInteractionRepository() {
  const store = createScopedMemoryStore();

  function create(scopeInput, interactionInput) {
    const scope = resolveScope(scopeInput);
    const interaction = createInteraction({
      ...interactionInput,
      tenantId: scope.tenantId,
      venueId: scope.venueId,
    });
    return store.save(scope, interaction.interactionId, interaction);
  }

  return {
    create,
    /** Phase 1B alias */
    save: create,
    getById(scopeInput, interactionId) {
      const scope = resolveScope(scopeInput);
      return store.getById(scope, String(interactionId || ""));
    },
    list(scopeInput, filters = {}) {
      const scope = resolveScope(scopeInput);
      const rows = store.list(scope, (row) => matchesInteractionFilters(row, filters));
      return rows.slice().sort(compareInteractionsTimeline);
    },
  };
}
