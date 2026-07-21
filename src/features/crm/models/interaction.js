/**
 * Interaction foundation model (Phase 1B). Timeline application services in 1E+.
 */

import { CRM_ERROR_CODES, CrmError } from "../constants/errorCodes.js";
import { isInteractionType, INTERACTION_TYPE } from "../constants/interactionTypes.js";
import { normalizeIsoTimestamp } from "../constants/timestamps.js";
import { createTenantVenueScope, requireNonEmptyId } from "./scope.js";

/**
 * @param {object} input
 * @returns {object}
 */
export function createInteraction(input = {}) {
  const scope = createTenantVenueScope(input);
  const interactionId = requireNonEmptyId(input.interactionId ?? input.id, "interactionId");

  const type = input.type != null ? String(input.type) : INTERACTION_TYPE.NOTE;
  if (!isInteractionType(type)) {
    throw new CrmError(CRM_ERROR_CODES.INVALID_STATUS, `Invalid interaction type: ${type}`);
  }

  const contactRefId =
    input.contactRefId != null && String(input.contactRefId).trim()
      ? String(input.contactRefId).trim()
      : null;
  const actorUserId =
    input.actorUserId != null && String(input.actorUserId).trim()
      ? String(input.actorUserId).trim()
      : null;

  const occurredAt = normalizeIsoTimestamp(input.occurredAt);
  if (input.occurredAt != null && input.occurredAt !== "" && !occurredAt) {
    throw new CrmError(CRM_ERROR_CODES.INVALID_INPUT, "occurredAt must be a valid ISO-8601 timestamp.");
  }

  return Object.freeze({
    interactionId,
    tenantId: scope.tenantId,
    venueId: scope.venueId,
    contactRefId,
    type,
    body: input.body != null ? String(input.body) : null,
    actorUserId,
    occurredAt,
    createdAt: normalizeIsoTimestamp(input.createdAt),
  });
}
