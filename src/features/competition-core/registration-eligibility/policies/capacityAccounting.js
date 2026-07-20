import { isNonEmptyString } from "../contracts/shared.js";
import { REGISTRATION_ELIGIBILITY_ERROR_CODE } from "../errors/errorCodes.js";
import {
  registrationEligibilityError,
  registrationEligibilityFail,
  registrationEligibilityOk,
} from "../errors/registrationEligibilityError.js";

/**
 * Capacity accounting helpers — deterministic remaining / effective capacity.
 */

/**
 * @param {number|null|undefined} limit
 * @param {number} used
 * @param {number} reserved
 * @returns {{ ok: true, remaining: number|null } | { ok: false, errors: import('../errors/registrationEligibilityError.js').RegistrationEligibilityIssue[] }}
 */
export function validateCapacityCounts(limit, used, reserved) {
  const errors = [];
  if (limit != null) {
    const lim = Number(limit);
    if (!Number.isFinite(lim) || lim < 0 || !Number.isInteger(lim)) {
      errors.push(
        registrationEligibilityError(
          REGISTRATION_ELIGIBILITY_ERROR_CODE.INVALID_CAPACITY_CONFIGURATION,
          "limit",
          "Capacity limit must be a non-negative integer or null",
          { limit }
        )
      );
    }
  }
  const usedN = Number(used);
  const reservedN = Number(reserved);
  if (!Number.isFinite(usedN) || usedN < 0 || !Number.isInteger(usedN)) {
    errors.push(
      registrationEligibilityError(
        REGISTRATION_ELIGIBILITY_ERROR_CODE.INVALID_CAPACITY_CONFIGURATION,
        "used",
        "Capacity used must be a non-negative integer",
        { used }
      )
    );
  }
  if (!Number.isFinite(reservedN) || reservedN < 0 || !Number.isInteger(reservedN)) {
    errors.push(
      registrationEligibilityError(
        REGISTRATION_ELIGIBILITY_ERROR_CODE.INVALID_CAPACITY_CONFIGURATION,
        "reserved",
        "Capacity reserved must be a non-negative integer",
        { reserved }
      )
    );
  }
  if (errors.length) {
    return registrationEligibilityFail(errors);
  }
  if (limit != null && usedN + reservedN > Number(limit)) {
    return registrationEligibilityFail([
      registrationEligibilityError(
        REGISTRATION_ELIGIBILITY_ERROR_CODE.INVALID_CAPACITY_CONFIGURATION,
        "capacity",
        "used + reserved exceeds configured limit",
        { limit: Number(limit), used: usedN, reserved: reservedN }
      ),
    ]);
  }
  return registrationEligibilityOk({
    remaining: limit == null ? null : Math.max(0, Number(limit) - usedN - reservedN),
  });
}

/**
 * @param {number|null} competitionRemaining
 * @param {number|null} divisionRemaining
 * @param {{ applyDivision?: boolean }} [options]
 * @returns {number|null}
 */
export function computeEffectiveRemaining(
  competitionRemaining,
  divisionRemaining,
  options = {}
) {
  const applyDivision = options.applyDivision !== false;
  if (!applyDivision) {
    return competitionRemaining;
  }
  if (competitionRemaining == null && divisionRemaining == null) return null;
  if (competitionRemaining == null) return divisionRemaining;
  if (divisionRemaining == null) return competitionRemaining;
  return Math.min(competitionRemaining, divisionRemaining);
}

/**
 * @param {number|null} remaining
 * @returns {boolean}
 */
export function hasAvailableCapacity(remaining) {
  return remaining == null || remaining > 0;
}

/**
 * Normalize priority tiers deterministically (lower rank = higher priority).
 * @param {unknown} priorityRank
 * @returns {number}
 */
export function normalizePriorityRank(priorityRank) {
  if (priorityRank == null || priorityRank === "") return 0;
  const n = Number(priorityRank);
  if (!Number.isFinite(n)) return 0;
  return Math.trunc(n);
}

/**
 * Build a deterministic capacity scope key.
 * @param {string} competitionId
 * @param {string|null|undefined} divisionId
 * @returns {string}
 */
export function buildCapacityScopeKey(competitionId, divisionId) {
  if (!isNonEmptyString(competitionId)) {
    throw new TypeError("buildCapacityScopeKey requires competitionId");
  }
  const div =
    divisionId != null && String(divisionId).trim() !== ""
      ? String(divisionId).trim()
      : "NONE";
  return `${String(competitionId).trim()}::${div}`;
}
