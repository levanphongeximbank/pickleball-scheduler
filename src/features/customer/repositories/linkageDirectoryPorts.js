/**
 * Customer-owned external directory ports (CUSTOMER-05).
 *
 * Read-only validation only. No credentials. No sports profile mutation.
 * No CRM workflow mutation. Fail-closed when unavailable.
 */

export const CUSTOMER_LINKAGE_DIRECTORY_PORTS = Object.freeze({
  IdentityAccountDirectoryPort: "IdentityAccountDirectoryPort",
  PlayerDirectoryPort: "PlayerDirectoryPort",
  CrmContactDirectoryPort: "CrmContactDirectoryPort",
});

/**
 * @typedef {object} IdentityAccountReference
 * @property {string} accountId
 * @property {string} [tenantId]
 * @property {string} [venueId]
 * @property {boolean} [active]
 * @property {string} [status]
 */

/**
 * @typedef {object} IdentityAccountDirectoryPort
 * @property {(scope: object, accountId: string) => boolean|Promise<boolean>} [exists]
 * @property {(scope: object, accountId: string) => IdentityAccountReference|null|Promise<IdentityAccountReference|null>} getReference
 */

/**
 * @typedef {object} PlayerDirectoryReference
 * @property {string} playerId
 * @property {string} [tenantId]
 * @property {string} [venueId]
 * @property {boolean} [active]
 * @property {string} [status]
 * @property {string} [lifecycleStatus]
 */

/**
 * @typedef {object} PlayerDirectoryPort
 * @property {(scope: object, playerId: string) => boolean|Promise<boolean>} [exists]
 * @property {(scope: object, playerId: string) => PlayerDirectoryReference|null|Promise<PlayerDirectoryReference|null>} getReference
 */

/**
 * @typedef {object} CrmContactDirectoryReference
 * @property {string} contactRefId
 * @property {string} [externalSystem]
 * @property {string} [tenantId]
 * @property {string} [venueId]
 * @property {boolean} [active]
 * @property {string} [status]
 * @property {string} [customerId]
 */

/**
 * @typedef {object} CrmContactDirectoryPort
 * @property {(scope: object, contactRefId: string, options?: { externalSystem?: string }) => boolean|Promise<boolean>} [exists]
 * @property {(scope: object, contactRefId: string, options?: { externalSystem?: string }) => CrmContactDirectoryReference|null|Promise<CrmContactDirectoryReference|null>} getReference
 */

/**
 * In-memory Identity account directory for tests / local composition.
 * @param {Iterable<object>|Map<string, object>} [seed]
 */
export function createInMemoryIdentityAccountDirectory(seed = []) {
  /** @type {Map<string, object>} */
  const byId = new Map();
  for (const row of seed instanceof Map ? seed.values() : seed) {
    const id = String(row.accountId || row.userAccountId || row.authUserId || "").trim();
    if (id) {
      byId.set(id, Object.freeze({
        accountId: id,
        tenantId: row.tenantId ?? null,
        venueId: row.venueId ?? null,
        active: row.active !== false,
        status: row.status || (row.active === false ? "INACTIVE" : "ACTIVE"),
      }));
    }
  }
  return Object.freeze({
    port: CUSTOMER_LINKAGE_DIRECTORY_PORTS.IdentityAccountDirectoryPort,
    async exists(_scope, accountId) {
      return byId.has(String(accountId || "").trim());
    },
    async getReference(_scope, accountId) {
      const row = byId.get(String(accountId || "").trim());
      return row ? Object.freeze({ ...row }) : null;
    },
    seed(row) {
      const id = String(row.accountId || row.userAccountId || row.authUserId || "").trim();
      if (!id) return;
      byId.set(id, Object.freeze({
        accountId: id,
        tenantId: row.tenantId ?? null,
        venueId: row.venueId ?? null,
        active: row.active !== false,
        status: row.status || (row.active === false ? "INACTIVE" : "ACTIVE"),
      }));
    },
  });
}

/**
 * @param {Iterable<object>|Map<string, object>} [seed]
 */
export function createInMemoryPlayerDirectory(seed = []) {
  /** @type {Map<string, object>} */
  const byId = new Map();
  for (const row of seed instanceof Map ? seed.values() : seed) {
    const id = String(row.playerId || "").trim();
    if (id) {
      byId.set(id, Object.freeze({
        playerId: id,
        tenantId: row.tenantId ?? null,
        venueId: row.venueId ?? null,
        active: row.active !== false,
        status: row.status || row.lifecycleStatus || "ACTIVE",
        lifecycleStatus: row.lifecycleStatus || row.status || "ACTIVE",
      }));
    }
  }
  return Object.freeze({
    port: CUSTOMER_LINKAGE_DIRECTORY_PORTS.PlayerDirectoryPort,
    async exists(_scope, playerId) {
      return byId.has(String(playerId || "").trim());
    },
    async getReference(_scope, playerId) {
      const row = byId.get(String(playerId || "").trim());
      return row ? Object.freeze({ ...row }) : null;
    },
    seed(row) {
      const id = String(row.playerId || "").trim();
      if (!id) return;
      byId.set(id, Object.freeze({
        playerId: id,
        tenantId: row.tenantId ?? null,
        venueId: row.venueId ?? null,
        active: row.active !== false,
        status: row.status || row.lifecycleStatus || "ACTIVE",
        lifecycleStatus: row.lifecycleStatus || row.status || "ACTIVE",
      }));
    },
  });
}

/**
 * @param {Iterable<object>|Map<string, object>} [seed]
 */
export function createInMemoryCrmContactDirectory(seed = []) {
  /** @type {Map<string, object>} */
  const byKey = new Map();
  function key(externalSystem, contactRefId) {
    return `${externalSystem || "CRM"}\u0000${contactRefId}`;
  }
  for (const row of seed instanceof Map ? seed.values() : seed) {
    const id = String(row.contactRefId || row.externalReferenceId || "").trim();
    if (!id) continue;
    const system = String(row.externalSystem || "CRM").trim();
    byKey.set(key(system, id), Object.freeze({
      contactRefId: id,
      externalSystem: system,
      tenantId: row.tenantId ?? null,
      venueId: row.venueId ?? null,
      active: row.active !== false,
      status: row.status || (row.active === false ? "INACTIVE" : "ACTIVE"),
      customerId: row.customerId ?? null,
    }));
  }
  return Object.freeze({
    port: CUSTOMER_LINKAGE_DIRECTORY_PORTS.CrmContactDirectoryPort,
    async exists(_scope, contactRefId, options = {}) {
      const system = String(options.externalSystem || "CRM").trim();
      return byKey.has(key(system, String(contactRefId || "").trim()));
    },
    async getReference(_scope, contactRefId, options = {}) {
      const system = String(options.externalSystem || "CRM").trim();
      const row = byKey.get(key(system, String(contactRefId || "").trim()));
      return row ? Object.freeze({ ...row }) : null;
    },
    seed(row) {
      const id = String(row.contactRefId || row.externalReferenceId || "").trim();
      if (!id) return;
      const system = String(row.externalSystem || "CRM").trim();
      byKey.set(key(system, id), Object.freeze({
        contactRefId: id,
        externalSystem: system,
        tenantId: row.tenantId ?? null,
        venueId: row.venueId ?? null,
        active: row.active !== false,
        status: row.status || (row.active === false ? "INACTIVE" : "ACTIVE"),
        customerId: row.customerId ?? null,
      }));
    },
  });
}
