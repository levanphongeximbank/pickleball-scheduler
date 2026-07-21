/**
 * CrmContactReference — references external identities; does not own them.
 *
 * External IDs (customerId, playerId, authUserId) are optional references only.
 * displaySnapshot is non-authoritative (audit/history only).
 */

import { CRM_ERROR_CODES, CrmError } from "../constants/errorCodes.js";
import { normalizeIsoTimestamp } from "../constants/timestamps.js";
import { createTenantVenueScope, requireNonEmptyId } from "./scope.js";

/**
 * @param {object} [raw]
 * @returns {object|null}
 */
function normalizeDisplaySnapshot(raw) {
  if (raw == null) return null;
  if (typeof raw !== "object") {
    throw new CrmError(
      CRM_ERROR_CODES.INVALID_INPUT,
      "displaySnapshot must be an object when provided."
    );
  }
  return Object.freeze({
    /** @deprecated non-authoritative — never treat as customer/player SoT */
    authoritative: false,
    displayName: raw.displayName != null ? String(raw.displayName).trim() || null : null,
    phone: raw.phone != null ? String(raw.phone).trim() || null : null,
    capturedAt: normalizeIsoTimestamp(raw.capturedAt) || null,
  });
}

/**
 * @param {object} input
 * @returns {object}
 */
export function createContactReference(input = {}) {
  const scope = createTenantVenueScope(input);
  const contactRefId = requireNonEmptyId(input.contactRefId ?? input.id, "contactRefId");

  const customerId =
    input.customerId != null && String(input.customerId).trim()
      ? String(input.customerId).trim()
      : null;
  const playerId =
    input.playerId != null && String(input.playerId).trim()
      ? String(input.playerId).trim()
      : null;
  const authUserId =
    input.authUserId != null && String(input.authUserId).trim()
      ? String(input.authUserId).trim()
      : null;

  return Object.freeze({
    contactRefId,
    tenantId: scope.tenantId,
    venueId: scope.venueId,
    customerId,
    playerId,
    authUserId,
    displaySnapshot: normalizeDisplaySnapshot(input.displaySnapshot),
    createdAt: normalizeIsoTimestamp(input.createdAt),
    updatedAt: normalizeIsoTimestamp(input.updatedAt),
  });
}
