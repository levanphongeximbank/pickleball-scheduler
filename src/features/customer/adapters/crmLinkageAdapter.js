/**
 * Customer-owned CRM linkage boundary adapter (CUSTOMER-05).
 *
 * CRM may resolve Customer by contact/reference and read linkage summaries.
 * CRM must not direct-write Customer linkage tables — use Customer application.
 */

/**
 * @param {{
 *   crmContactDirectory?: object,
 *   linkageApplication: object,
 * }} deps
 */
export function createCustomerCrmLinkageAdapter(deps = {}) {
  const app = deps.linkageApplication;
  const directory = deps.crmContactDirectory ?? null;
  if (!app || typeof app.findCustomerByCrmReference !== "function") {
    throw new Error(
      "createCustomerCrmLinkageAdapter requires linkageApplication"
    );
  }

  return Object.freeze({
    async getCrmReference(scope, contactRefId, options = {}) {
      if (!directory || typeof directory.getReference !== "function") {
        return null;
      }
      const ref = await directory.getReference(scope, contactRefId, options);
      if (!ref) return null;
      return Object.freeze({
        contactRefId: ref.contactRefId,
        externalSystem: ref.externalSystem || "CRM",
        active: ref.active !== false,
        status: ref.status || "ACTIVE",
        tenantId: ref.tenantId ?? null,
        venueId: ref.venueId ?? null,
      });
    },

    async findCustomerByCrmReference(scope, contactRefId, options = {}) {
      return app.findCustomerByCrmReference(scope, contactRefId, options);
    },

    async listCrmReferences(scope, customerId, options = {}) {
      return app.listCrmReferences(scope, customerId, options);
    },

    async getLinkageSummary(scope, customerId) {
      const linkages = await app.listCustomerLinkages(scope, customerId, {
        activeOnly: true,
      });
      return Object.freeze({
        customerId,
        linkages,
      });
    },
  });
}
