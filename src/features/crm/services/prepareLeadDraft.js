/**
 * Phase 1B foundation services — pure helpers only.
 * Do not wire into existing CRM pages in this phase.
 * Do not call localStorage / Supabase / browser globals.
 */

import { authorizeCrm } from "../authorization/crmAuthorize.js";
import { CRM_PERMISSIONS } from "../constants/permissions.js";
import { createLead } from "../models/lead.js";
import { createTenantVenueScope } from "../models/scope.js";

/**
 * Validate + authorize a lead draft without persisting.
 * Full createLead application flow belongs to Phase 1C.
 *
 * @param {object|null|undefined} actor
 * @param {object} input
 * @returns {{ ok: true, lead: object, scope: object } | { ok: false, code: string, error: string }}
 */
export function prepareLeadDraft(actor, input = {}) {
  const auth = authorizeCrm(actor, CRM_PERMISSIONS.LEAD_CREATE, input);
  if (!auth.ok) return auth;

  try {
    const scope = createTenantVenueScope(input);
    const lead = createLead({
      ...input,
      tenantId: scope.tenantId,
      venueId: scope.venueId,
    });
    return { ok: true, lead, scope };
  } catch (err) {
    return {
      ok: false,
      code: err?.code || "CRM_INVALID_INPUT",
      error: err?.message || "Invalid lead draft.",
    };
  }
}
