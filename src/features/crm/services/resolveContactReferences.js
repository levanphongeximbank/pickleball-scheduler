/**
 * Resolve optional external references for CrmContactReference (Phase 1C).
 * Read-only ports only. Fail closed. No profile copying.
 *
 * PlayerDirectoryPort and VenueCustomerDirectoryPort both require explicit scope.
 */

import { CRM_ERROR_CODES, crmFailure } from "../constants/errorCodes.js";
import { scopesEqual } from "../models/scope.js";

/**
 * Limited non-authoritative display fields from a directory record.
 * @param {object|null|undefined} record
 * @param {string} capturedAt
 * @returns {object|null}
 */
export function buildDisplaySnapshot(record, capturedAt) {
  if (!record || typeof record !== "object") return null;
  const displayName =
    record.displayName ?? record.name ?? record.fullName ?? record.customerName ?? null;
  const phone = record.phone ?? record.phoneNumber ?? null;
  return {
    authoritative: false,
    displayName: displayName != null ? String(displayName).trim() || null : null,
    phone: phone != null ? String(phone).trim() || null : null,
    capturedAt,
  };
}

/**
 * @param {object} scope
 * @param {object|null|undefined} record
 * @param {string} label
 */
function assertResolvedScope(scope, record, label) {
  if (!record || typeof record !== "object") {
    return crmFailure(
      CRM_ERROR_CODES.CONTACT_UNRESOLVED,
      `${label} was not found in the directory.`
    );
  }
  const recordScope = {
    tenantId: record.tenantId != null ? String(record.tenantId).trim() : "",
    venueId: record.venueId != null ? String(record.venueId).trim() : "",
  };
  if (!recordScope.tenantId || !recordScope.venueId) {
    return crmFailure(
      CRM_ERROR_CODES.CONTACT_UNRESOLVED,
      `${label} directory record is missing tenant/venue scope.`
    );
  }
  if (!scopesEqual(scope, recordScope)) {
    return crmFailure(
      CRM_ERROR_CODES.FORBIDDEN_SCOPE,
      `${label} belongs to a different tenant or venue.`
    );
  }
  return { ok: true, record };
}

/**
 * Resolve customer + player refs. Does not persist.
 *
 * @param {object} scope
 * @param {{ customerId?: string|null, playerId?: string|null, authUserId?: string|null }} refs
 * @param {object} ports
 * @param {string} capturedAt
 * @returns {Promise<{ ok: true, customerId: string|null, playerId: string|null, authUserId: string|null, displaySnapshot: object|null } | { ok: false, code: string, error: string }>}
 */
export async function resolveExternalContactRefs(scope, refs, ports, capturedAt) {
  if (!scope?.tenantId || !scope?.venueId) {
    return crmFailure(
      CRM_ERROR_CODES.MISSING_SCOPE,
      "tenantId and venueId are required to resolve contact references."
    );
  }

  const customerId =
    refs.customerId != null && String(refs.customerId).trim()
      ? String(refs.customerId).trim()
      : null;
  const playerId =
    refs.playerId != null && String(refs.playerId).trim()
      ? String(refs.playerId).trim()
      : null;
  const authUserId =
    refs.authUserId != null && String(refs.authUserId).trim()
      ? String(refs.authUserId).trim()
      : null;

  if (!customerId && !playerId && !authUserId) {
    return crmFailure(
      CRM_ERROR_CODES.INVALID_INPUT,
      "ContactReference requires at least one of customerId, playerId, or authUserId."
    );
  }

  let displaySnapshot = null;

  if (customerId) {
    if (!ports.venueCustomerDirectory?.getById) {
      return crmFailure(
        CRM_ERROR_CODES.CONTACT_UNRESOLVED,
        "VenueCustomerDirectoryPort is required to resolve customerId."
      );
    }
    const customer = await ports.venueCustomerDirectory.getById(scope, customerId);
    const checked = assertResolvedScope(scope, customer, "Venue customer");
    if (!checked.ok) return checked;
    displaySnapshot = buildDisplaySnapshot(checked.record, capturedAt);
  }

  if (playerId) {
    if (!ports.playerDirectory?.getById) {
      return crmFailure(
        CRM_ERROR_CODES.CONTACT_UNRESOLVED,
        "PlayerDirectoryPort is required to resolve playerId."
      );
    }
    // Scoped signature only — never call getById(playerId).
    const player = await ports.playerDirectory.getById(scope, playerId);
    const checked = assertResolvedScope(scope, player, "Player");
    if (!checked.ok) return checked;
    if (!displaySnapshot) {
      displaySnapshot = buildDisplaySnapshot(checked.record, capturedAt);
    }
  }

  // authUserId is an approved Phase 1B reference field; Identity resolution of
  // profile content is out of scope — ID is stored as a reference only.
  return {
    ok: true,
    customerId,
    playerId,
    authUserId,
    displaySnapshot,
  };
}
