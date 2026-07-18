/**
 * Phase 3C — map legacy ENTRY_STATUS → COMPETITION_REGISTRATION_STATUS.
 * Unknown statuses fail with typed error (never silent coerce to APPROVED).
 */

import { COMPETITION_REGISTRATION_STATUS } from "../../participants/enums/statuses.js";
import { REGISTRATION_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { RegistrationRuntimeError } from "../errors/RegistrationRuntimeError.js";

const LEGACY_TO_CANONICAL = Object.freeze({
  draft: COMPETITION_REGISTRATION_STATUS.DRAFT,
  submitted: COMPETITION_REGISTRATION_STATUS.SUBMITTED,
  pending: COMPETITION_REGISTRATION_STATUS.PENDING,
  waitlisted: COMPETITION_REGISTRATION_STATUS.WAITLISTED,
  approved: COMPETITION_REGISTRATION_STATUS.APPROVED,
  /** Owner: Legacy ACTIVE → APPROVED */
  active: COMPETITION_REGISTRATION_STATUS.APPROVED,
  rejected: COMPETITION_REGISTRATION_STATUS.REJECTED,
  withdrawn: COMPETITION_REGISTRATION_STATUS.WITHDRAWN,
  cancelled: COMPETITION_REGISTRATION_STATUS.CANCELLED,
});

/**
 * @param {unknown} status
 * @param {{ sourceId?: string }} [meta]
 * @returns {string}
 */
export function mapLegacyRegistrationStatus(status, meta = {}) {
  const raw = String(status || "").trim().toLowerCase();
  if (!raw) {
    return COMPETITION_REGISTRATION_STATUS.DRAFT;
  }
  if (Object.prototype.hasOwnProperty.call(LEGACY_TO_CANONICAL, raw)) {
    return LEGACY_TO_CANONICAL[raw];
  }
  throw new RegistrationRuntimeError(
    REGISTRATION_RUNTIME_ERROR_CODE.UNSUPPORTED_REGISTRATION_STATUS,
    `Unsupported registration status: ${raw}`,
    { status: raw, sourceId: meta.sourceId || null }
  );
}

export { LEGACY_TO_CANONICAL as LEGACY_REGISTRATION_STATUS_MAP };
