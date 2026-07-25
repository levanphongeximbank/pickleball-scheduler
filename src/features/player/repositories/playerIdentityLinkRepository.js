/**
 * PM-ID-01 — Repository port for principal→player mapping resolution.
 *
 * Implementations must resolve using the authenticated principal from the
 * trusted session/adapter — never from caller-supplied principalId.
 */

/**
 * @typedef {object} PlayerIdentityLinkRecord
 * @property {string} linkId
 * @property {string} tenantId
 * @property {string} clubId
 * @property {string} principalId
 * @property {string} playerId
 * @property {"ACTIVE"|"REVOKED"} status
 * @property {number} version
 */

/**
 * @typedef {object} PlayerIdentityResolveQuery
 * @property {string} tenantId
 * @property {string} clubId
 * @property {string} principalId — filled by service from session only
 */

/**
 * @typedef {object} PlayerIdentityLinkRepository
 * @property {(query: PlayerIdentityResolveQuery) => Promise<{
 *   links: PlayerIdentityLinkRecord[],
 *   clubBelongsToTenant: boolean,
 *   membershipActive: boolean,
 * }>} resolveScope
 */

/**
 * In-memory repository for unit tests / local certification.
 * @param {object} [seed]
 * @returns {PlayerIdentityLinkRepository}
 */
export function createMemoryPlayerIdentityLinkRepository(seed = {}) {
  const links = Array.isArray(seed.links) ? [...seed.links] : [];
  const clubs = seed.clubs && typeof seed.clubs === "object" ? seed.clubs : {};
  const memberships = Array.isArray(seed.memberships) ? [...seed.memberships] : [];

  return {
    async resolveScope({ tenantId, clubId, principalId }) {
      const clubTenant = clubs[clubId];
      const clubBelongsToTenant = clubTenant != null && String(clubTenant) === String(tenantId);
      const membershipActive = memberships.some(
        (m) =>
          String(m.tenantId) === String(tenantId) &&
          String(m.clubId) === String(clubId) &&
          String(m.userId) === String(principalId) &&
          String(m.status).toLowerCase() === "active"
      );
      const scoped = links.filter(
        (l) =>
          String(l.tenantId) === String(tenantId) &&
          String(l.clubId) === String(clubId) &&
          String(l.principalId) === String(principalId)
      );
      return {
        links: scoped.map((l) => ({ ...l })),
        clubBelongsToTenant,
        membershipActive,
      };
    },
  };
}
