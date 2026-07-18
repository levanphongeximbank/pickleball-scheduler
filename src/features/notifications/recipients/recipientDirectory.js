/**
 * Recipient directory port — inject cloud/identity lookup in later phases.
 * Production runtime must not hard-code fake users; tests may inject memory dirs.
 */

/**
 * @typedef {object} RecipientUser
 * @property {string} userId
 * @property {string} tenantId
 * @property {string} [venueId]
 * @property {string} [clubId]
 * @property {string} [role]
 */

/**
 * @typedef {object} RecipientDirectory
 * @property {(input: { tenantId: string, userIds: string[] }) => RecipientUser[]} listUsersByIds
 * @property {(input: { tenantId: string, venueId?: string|null, clubId?: string|null, roles: string[] }) => RecipientUser[]} listUsersByRoles
 * @property {(input: { tenantId: string, competitionId?: string|null, entryIds: string[] }) => RecipientUser[]} listUsersByEntryIds
 */

/** @type {RecipientDirectory|null} */
let activeDirectory = null;

export function createMemoryRecipientDirectory(seedUsers = []) {
  const users = seedUsers.map((u) => ({
    userId: String(u.userId),
    tenantId: String(u.tenantId),
    venueId: u.venueId ? String(u.venueId) : null,
    clubId: u.clubId ? String(u.clubId) : null,
    role: u.role ? String(u.role) : null,
  }));

  return {
    listUsersByIds({ tenantId, userIds }) {
      const wanted = new Set((userIds || []).map(String));
      return users.filter((u) => u.tenantId === tenantId && wanted.has(u.userId));
    },
    listUsersByRoles({ tenantId, venueId = null, clubId = null, roles }) {
      const roleSet = new Set((roles || []).map(String));
      return users.filter((u) => {
        if (u.tenantId !== tenantId) return false;
        if (!u.role || !roleSet.has(u.role)) return false;
        if (venueId && u.venueId && u.venueId !== String(venueId)) return false;
        if (clubId && u.clubId && u.clubId !== String(clubId)) return false;
        return true;
      });
    },
    listUsersByEntryIds({ tenantId, competitionId = null, entryIds }) {
      // Memory directory expects seed users to carry entryId on the object when used in tests.
      const wanted = new Set((entryIds || []).map(String));
      return users.filter((u) => {
        if (u.tenantId !== tenantId) return false;
        if (competitionId && u.competitionId && u.competitionId !== String(competitionId)) {
          return false;
        }
        return u.entryId && wanted.has(String(u.entryId));
      });
    },
  };
}

/**
 * Empty directory — Production default until identity lookup is wired.
 * Role/entry resolution returns []. Explicit userIds still pass through after tenant check
 * only when a directory is registered; without directory, explicit userIds are accepted
 * as opaque ids scoped to the event tenant (caller-validated hints).
 */
export function createEmptyRecipientDirectory() {
  return {
    listUsersByIds({ tenantId, userIds }) {
      return (userIds || [])
        .map(String)
        .filter(Boolean)
        .map((userId) => ({
          userId,
          tenantId: String(tenantId),
          venueId: null,
          clubId: null,
          role: null,
        }));
    },
    listUsersByRoles() {
      return [];
    },
    listUsersByEntryIds() {
      return [];
    },
  };
}

export function setRecipientDirectory(directory) {
  activeDirectory = directory || null;
}

/** @type {import("./recipientDirectory.js").RecipientDirectory|null} */
let defaultIdentityDirectory = null;

/**
 * Phase 1.3 default: identity/membership directory when no override is set.
 * Lazy-loaded to avoid circular imports at module init.
 */
export function getRecipientDirectory() {
  if (activeDirectory) return activeDirectory;
  if (!defaultIdentityDirectory) {
    // Dynamic import pattern avoided — factory injected via ensureDefaultIdentityDirectory.
    defaultIdentityDirectory = createEmptyRecipientDirectory();
  }
  return defaultIdentityDirectory;
}

export function setDefaultRecipientDirectory(directory) {
  defaultIdentityDirectory = directory || null;
}

export function resetRecipientDirectory() {
  activeDirectory = null;
  defaultIdentityDirectory = null;
}
