/**
 * Cross-module CRM ports (Phase 1B).
 *
 * Read-only unless a later phase explicitly authorizes commands.
 * NotificationEmitPort delegates to Notifications — CRM does not own delivery.
 * No Supabase client imports in this module.
 */

/**
 * @typedef {{ tenantId: string, venueId: string }} TenantVenueScope
 */

/**
 * @typedef {object} CrmActor
 * @property {string} userId
 * @property {string} tenantId
 * @property {string[]} [venueIds]
 * @property {string[]} [permissions]
 * @property {boolean} [authenticated]
 */

/**
 * VenueCustomerDirectoryPort — resolve venue customers by id (read-only).
 * Does not create/update customers.
 *
 * @typedef {object} VenueCustomerDirectoryPort
 * @property {(scope: TenantVenueScope, customerId: string) => object|null|Promise<object|null>} getById
 * @property {(scope: TenantVenueScope, query: object) => object[]|Promise<object[]>} search
 */

/**
 * PlayerDirectoryPort — resolve players by id (read-only).
 *
 * @typedef {object} PlayerDirectoryPort
 * @property {(playerId: string) => object|null|Promise<object|null>} getById
 */

/**
 * IdentityActorPort — resolve authenticated actor for authorization.
 *
 * @typedef {object} IdentityActorPort
 * @property {() => CrmActor|null|Promise<CrmActor|null>} getCurrentActor
 */

/**
 * CrmAuthorizationPort — permission checks (fail-closed).
 *
 * @typedef {object} CrmAuthorizationPort
 * @property {(actor: CrmActor|null|undefined, permission: string, scope: TenantVenueScope) => { ok: boolean, code?: string, error?: string }} authorize
 */

/**
 * CrmAuditPort — append CRM audit events.
 *
 * @typedef {object} CrmAuditPort
 * @property {(event: object) => void|Promise<void>} append
 */

/**
 * CrmClock — injectable clock (no Date.now in domain models by default).
 *
 * @typedef {object} CrmClock
 * @property {() => string} nowIso
 */

/**
 * CrmIdGenerator — deterministic/injectable ids for tests.
 *
 * @typedef {object} CrmIdGenerator
 * @property {(prefix: string) => string} nextId
 */

/**
 * NotificationEmitPort — request delivery via Notifications module.
 * Must not write CRM localStorage messages as delivery SoT.
 *
 * @typedef {object} NotificationEmitPort
 * @property {(envelope: object) => { ok: boolean, code?: string, error?: string }|Promise<{ ok: boolean, code?: string, error?: string }>} emit
 */

export const CRM_PORT_NAMES = Object.freeze([
  "VenueCustomerDirectoryPort",
  "PlayerDirectoryPort",
  "IdentityActorPort",
  "CrmAuthorizationPort",
  "CrmAuditPort",
  "CrmClock",
  "CrmIdGenerator",
  "NotificationEmitPort",
]);

/**
 * Default in-process clock (ISO UTC). Prefer injection in services.
 * @returns {import('./ports.js').CrmClock}
 */
export function createSystemCrmClock() {
  return {
    nowIso() {
      return new Date().toISOString();
    },
  };
}

/**
 * Simple id generator for memory/tests. Not for production uniqueness guarantees.
 * @param {() => string} [entropy]
 * @returns {import('./ports.js').CrmIdGenerator}
 */
export function createSequentialCrmIdGenerator(entropy = () => String(Date.now())) {
  let seq = 0;
  return {
    nextId(prefix) {
      seq += 1;
      return `${prefix}_${entropy()}_${seq}`;
    },
  };
}
