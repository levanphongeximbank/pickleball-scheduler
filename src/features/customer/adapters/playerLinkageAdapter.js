/**
 * Customer-owned Player boundary adapter (CUSTOMER-05).
 * Verifies player references and exposes Customer reverse lookup.
 * Does not mutate Player sports profiles or participant mappings.
 */

/**
 * @param {{
 *   playerDirectory: object,
 *   linkageApplication: object,
 * }} deps
 */
export function createCustomerPlayerLinkageAdapter(deps = {}) {
  const directory = deps.playerDirectory;
  const app = deps.linkageApplication;
  if (!directory || typeof directory.getReference !== "function") {
    throw new Error(
      "createCustomerPlayerLinkageAdapter requires playerDirectory"
    );
  }
  if (!app || typeof app.findCustomerByPlayerId !== "function") {
    throw new Error(
      "createCustomerPlayerLinkageAdapter requires linkageApplication"
    );
  }

  return Object.freeze({
    async getPlayerReference(scope, playerId) {
      const ref = await directory.getReference(scope, playerId);
      if (!ref) return null;
      return Object.freeze({
        playerId: ref.playerId,
        active: ref.active !== false,
        status: ref.status || ref.lifecycleStatus || "ACTIVE",
        tenantId: ref.tenantId ?? null,
        venueId: ref.venueId ?? null,
      });
    },

    async findCustomerByPlayerId(scope, playerId) {
      return app.findCustomerByPlayerId(scope, playerId);
    },

    async getPlayerLink(scope, customerId) {
      return app.getPlayerLink(scope, customerId);
    },
  });
}
