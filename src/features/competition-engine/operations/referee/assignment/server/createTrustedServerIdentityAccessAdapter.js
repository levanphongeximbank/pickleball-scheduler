/**
 * Trusted-server Contract #01 Identity Access Adapter B factory.
 * Injects Identity-owned subject lookup. Does not import private persistence.
 */

import { createIdentityAccessBinding } from "../../../../integration/contracts/identityAccessBinding.js";
import { createIdentitySubjectPointLoader } from "../../../../../identity/services/subjectIdentityLookupService.js";

/**
 * @param {{
 *   tenantId?: string,
 *   getAuthClient?: () => { from: Function }|null,
 *   loadIdentitySubjectById?: (subjectId: string) => Promise<object|null>|object|null,
 * }} [options]
 */
export function createTrustedServerIdentityAccessAdapter(options = {}) {
  const boundTenantId = String(options.tenantId || "").trim() || null;
  const loadIdentitySubjectById =
    typeof options.loadIdentitySubjectById === "function"
      ? options.loadIdentitySubjectById
      : createIdentitySubjectPointLoader({
          getAuthClient: options.getAuthClient,
        });
  return createIdentityAccessBinding({
    boundTenantId,
    loadIdentitySubjectById,
  });
}
