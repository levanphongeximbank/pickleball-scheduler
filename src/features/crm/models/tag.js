/**
 * CrmTag foundation model (Phase 1B).
 */

import { normalizeIsoTimestamp } from "../constants/timestamps.js";
import { createTenantVenueScope, requireNonEmptyId } from "./scope.js";

/**
 * @param {object} input
 * @returns {object}
 */
export function createCrmTag(input = {}) {
  const scope = createTenantVenueScope(input);
  const tagId = requireNonEmptyId(input.tagId ?? input.id, "tagId");
  const name = requireNonEmptyId(input.name, "name");

  return Object.freeze({
    tagId,
    tenantId: scope.tenantId,
    venueId: scope.venueId,
    name,
    createdAt: normalizeIsoTimestamp(input.createdAt),
  });
}

/**
 * @param {object} input
 * @returns {object}
 */
export function createContactTagLink(input = {}) {
  const scope = createTenantVenueScope(input);
  const tagId = requireNonEmptyId(input.tagId, "tagId");
  const contactRefId = requireNonEmptyId(input.contactRefId, "contactRefId");

  return Object.freeze({
    tenantId: scope.tenantId,
    venueId: scope.venueId,
    tagId,
    contactRefId,
    createdAt: normalizeIsoTimestamp(input.createdAt),
  });
}
