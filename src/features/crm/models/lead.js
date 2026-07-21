/**
 * Lead foundation model (Phase 1B). Full lifecycle is Phase 1C+.
 */

import { CRM_ERROR_CODES, CrmError } from "../constants/errorCodes.js";
import { isLeadSource, LEAD_SOURCE } from "../constants/leadSources.js";
import { isLeadStatus, LEAD_STATUS } from "../constants/leadStatuses.js";
import { normalizeIsoTimestamp } from "../constants/timestamps.js";
import { createTenantVenueScope, requireNonEmptyId } from "./scope.js";

/**
 * @param {object} input
 * @returns {object}
 */
export function createLead(input = {}) {
  const scope = createTenantVenueScope(input);
  const leadId = requireNonEmptyId(input.leadId ?? input.id, "leadId");

  const status = input.status != null ? String(input.status) : LEAD_STATUS.NEW;
  if (!isLeadStatus(status)) {
    throw new CrmError(CRM_ERROR_CODES.INVALID_STATUS, `Invalid lead status: ${status}`);
  }

  const source = input.source != null ? String(input.source) : LEAD_SOURCE.OTHER;
  if (!isLeadSource(source)) {
    throw new CrmError(CRM_ERROR_CODES.INVALID_STATUS, `Invalid lead source: ${source}`);
  }

  const contactRefId =
    input.contactRefId != null && String(input.contactRefId).trim()
      ? String(input.contactRefId).trim()
      : null;
  const ownerUserId =
    input.ownerUserId != null && String(input.ownerUserId).trim()
      ? String(input.ownerUserId).trim()
      : null;

  return Object.freeze({
    leadId,
    tenantId: scope.tenantId,
    venueId: scope.venueId,
    contactRefId,
    status,
    source,
    ownerUserId,
    title: input.title != null ? String(input.title).trim() || null : null,
    notes: input.notes != null ? String(input.notes) : null,
    createdAt: normalizeIsoTimestamp(input.createdAt),
    updatedAt: normalizeIsoTimestamp(input.updatedAt),
  });
}
