/**
 * Customer-owned Identity boundary adapter (CUSTOMER-05).
 * Verifies account references and exposes Customer reverse lookup.
 * Does not mutate Identity accounts or credentials.
 */

/**
 * @param {{
 *   identityAccountDirectory: object,
 *   linkageApplication: object,
 * }} deps
 */
export function createCustomerIdentityLinkageAdapter(deps = {}) {
  const directory = deps.identityAccountDirectory;
  const app = deps.linkageApplication;
  if (!directory || typeof directory.getReference !== "function") {
    throw new Error(
      "createCustomerIdentityLinkageAdapter requires identityAccountDirectory"
    );
  }
  if (!app || typeof app.findCustomerByIdentityAccount !== "function") {
    throw new Error(
      "createCustomerIdentityLinkageAdapter requires linkageApplication"
    );
  }

  return Object.freeze({
    async getAccountReference(scope, accountId) {
      const ref = await directory.getReference(scope, accountId);
      if (!ref) return null;
      return Object.freeze({
        accountId: ref.accountId,
        active: ref.active !== false,
        status: ref.status || "ACTIVE",
        tenantId: ref.tenantId ?? null,
        venueId: ref.venueId ?? null,
      });
    },

    async findCustomerByAccount(scope, accountId) {
      return app.findCustomerByIdentityAccount(scope, accountId);
    },

    async getIdentityLink(scope, customerId) {
      return app.getIdentityLink(scope, customerId);
    },
  });
}
