/**
 * Deterministic fakes for CRM Phase 1C tests.
 *
 * Not part of the production public facade (`src/features/crm/index.js`).
 * Import from this path in tests only.
 */

import { authorizeCrm } from "../authorization/crmAuthorize.js";

/**
 * @param {string} fixedIso
 */
export function createFixedCrmClock(fixedIso) {
  let current = fixedIso;
  return {
    nowIso() {
      return current;
    },
    /** @param {string} next */
    setNow(next) {
      current = next;
    },
  };
}

/**
 * @param {string} [seed]
 */
export function createDeterministicCrmIdGenerator(seed = "test") {
  let seq = 0;
  return {
    nextId(prefix) {
      seq += 1;
      return `${prefix}_${seed}_${seq}`;
    },
  };
}

/**
 * @param {object|null} actor
 * @param {Map<string, object>} [actorsById]
 */
export function createFakeIdentityActorPort(actor, actorsById = new Map()) {
  return {
    getCurrentActor() {
      return actor;
    },
    resolveActor(scope, userId) {
      const found = actorsById.get(String(userId));
      if (!found) return null;
      if (found.tenantId && found.tenantId !== scope.tenantId) return null;
      return found;
    },
  };
}

/**
 * @param {Array<object>} customers
 */
export function createFakeVenueCustomerDirectory(customers = []) {
  const rows = customers.map((c) => Object.freeze({ ...c }));
  return {
    getById(_scope, customerId) {
      const id = String(customerId || "");
      // Return raw row even when out of scope so the application layer can fail closed.
      return rows.find((c) => c.customerId === id || c.id === id) || null;
    },
    search(scope, query = {}) {
      return rows.filter((row) => {
        if (row.tenantId !== scope.tenantId || row.venueId !== scope.venueId) return false;
        if (query.customerId && row.customerId !== query.customerId) return false;
        return true;
      });
    },
  };
}

/**
 * Scoped PlayerDirectoryPort fake — getById(scope, playerId) only.
 * Records last call for assertion. Never exposes an unscoped signature.
 *
 * @param {Array<object>} players
 */
export function createFakePlayerDirectory(players = []) {
  const rows = players.map((p) => Object.freeze({ ...p }));
  /** @type {Array<{ tenantId: string, venueId: string, playerId: string }>} */
  const calls = [];
  return {
    calls,
    getById(scope, playerId) {
      if (!scope || typeof scope !== "object") {
        throw new Error("PlayerDirectoryPort.getById requires an explicit scope object.");
      }
      const tenantId = scope.tenantId != null ? String(scope.tenantId).trim() : "";
      const venueId = scope.venueId != null ? String(scope.venueId).trim() : "";
      const id = String(playerId || "").trim();
      if (!tenantId || !venueId || !id) {
        throw new Error(
          "PlayerDirectoryPort.getById requires tenantId, venueId, and playerId."
        );
      }
      calls.push({ tenantId, venueId, playerId: id });
      // Return raw row even when out of scope so the application layer can fail closed.
      return rows.find((p) => p.playerId === id || p.id === id) || null;
    },
    search(scope, query = {}) {
      return rows.filter((row) => {
        if (row.tenantId !== scope.tenantId || row.venueId !== scope.venueId) return false;
        if (query.playerId && row.playerId !== query.playerId) return false;
        return true;
      });
    },
  };
}

export function createFakeCrmAuditPort() {
  /** @type {object[]} */
  const events = [];
  return {
    events,
    append(event) {
      events.push(event);
    },
  };
}

export function createFakeIntegrationEventCollector() {
  /** @type {object[]} */
  const events = [];
  return {
    events,
    emit(event) {
      events.push(event);
    },
    append(event) {
      events.push(event);
    },
  };
}

/**
 * Thin CrmAuthorizationPort wrapping authorizeCrm (for port wiring tests).
 */
export function createCrmAuthorizationPortAdapter() {
  return {
    authorize(actor, permission, scope) {
      return authorizeCrm(actor, permission, scope);
    },
  };
}
