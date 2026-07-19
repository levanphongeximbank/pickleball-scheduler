import { isNonEmptyString, REGISTRATION_ELIGIBILITY_SCHEMA_VERSION } from "./shared.js";

/**
 * RegistrationCapacitySnapshot — competition / division capacity at evaluation time.
 *
 * @typedef {Object} RegistrationCapacitySnapshot
 * @property {string} schemaVersion
 * @property {string} competitionId
 * @property {string|null} [divisionId]
 * @property {string|null} [divisionCategoryId]
 * @property {number|null} competitionLimit
 * @property {number} competitionRegisteredCount
 * @property {number|null} divisionLimit
 * @property {number} divisionRegisteredCount
 * @property {number} waitlistCount
 * @property {boolean} competitionHasCapacity
 * @property {boolean} divisionHasCapacity
 * @property {string} capturedAt
 */

/**
 * @param {Partial<RegistrationCapacitySnapshot>} partial
 * @returns {RegistrationCapacitySnapshot}
 */
export function createRegistrationCapacitySnapshot(partial = {}) {
  if (!isNonEmptyString(partial.competitionId)) {
    throw new TypeError("RegistrationCapacitySnapshot requires competitionId");
  }
  if (!isNonEmptyString(partial.capturedAt)) {
    throw new TypeError("RegistrationCapacitySnapshot requires capturedAt from ClockPort");
  }

  const competitionLimit =
    partial.competitionLimit == null ? null : Number(partial.competitionLimit);
  const divisionLimit = partial.divisionLimit == null ? null : Number(partial.divisionLimit);
  const competitionRegisteredCount = Number(partial.competitionRegisteredCount ?? 0);
  const divisionRegisteredCount = Number(partial.divisionRegisteredCount ?? 0);
  const waitlistCount = Number(partial.waitlistCount ?? 0);

  const competitionHasCapacity =
    typeof partial.competitionHasCapacity === "boolean"
      ? partial.competitionHasCapacity
      : competitionLimit == null ||
        (Number.isFinite(competitionLimit) && competitionRegisteredCount < competitionLimit);

  const divisionHasCapacity =
    typeof partial.divisionHasCapacity === "boolean"
      ? partial.divisionHasCapacity
      : divisionLimit == null ||
        (Number.isFinite(divisionLimit) && divisionRegisteredCount < divisionLimit);

  return Object.freeze({
    schemaVersion: String(partial.schemaVersion ?? REGISTRATION_ELIGIBILITY_SCHEMA_VERSION),
    competitionId: String(partial.competitionId).trim(),
    divisionId:
      partial.divisionId != null && String(partial.divisionId).trim() !== ""
        ? String(partial.divisionId).trim()
        : null,
    divisionCategoryId:
      partial.divisionCategoryId != null && String(partial.divisionCategoryId).trim() !== ""
        ? String(partial.divisionCategoryId).trim()
        : null,
    competitionLimit: Number.isFinite(competitionLimit) ? competitionLimit : null,
    competitionRegisteredCount: Number.isFinite(competitionRegisteredCount)
      ? competitionRegisteredCount
      : 0,
    divisionLimit: Number.isFinite(divisionLimit) ? divisionLimit : null,
    divisionRegisteredCount: Number.isFinite(divisionRegisteredCount)
      ? divisionRegisteredCount
      : 0,
    waitlistCount: Number.isFinite(waitlistCount) ? waitlistCount : 0,
    competitionHasCapacity,
    divisionHasCapacity,
    capturedAt: String(partial.capturedAt).trim(),
  });
}

/**
 * RegistrationWaitlistPosition — waitlist policy contract (ordering only).
 *
 * @typedef {Object} RegistrationWaitlistPosition
 * @property {string} schemaVersion
 * @property {string} registrationId
 * @property {string} competitionId
 * @property {string|null} [divisionId]
 * @property {number} position
 * @property {string|null} [queuedAt]
 * @property {string|null} [policyRef]
 * @property {Record<string, unknown>|null} [metadata]
 */

/**
 * @param {Partial<RegistrationWaitlistPosition>} partial
 * @returns {RegistrationWaitlistPosition}
 */
export function createRegistrationWaitlistPosition(partial = {}) {
  if (!isNonEmptyString(partial.registrationId)) {
    throw new TypeError("RegistrationWaitlistPosition requires registrationId");
  }
  if (!isNonEmptyString(partial.competitionId)) {
    throw new TypeError("RegistrationWaitlistPosition requires competitionId");
  }
  const position = Number(partial.position);
  if (!Number.isInteger(position) || position < 1) {
    throw new TypeError("RegistrationWaitlistPosition.position must be integer >= 1");
  }

  return Object.freeze({
    schemaVersion: String(partial.schemaVersion ?? REGISTRATION_ELIGIBILITY_SCHEMA_VERSION),
    registrationId: String(partial.registrationId).trim(),
    competitionId: String(partial.competitionId).trim(),
    divisionId:
      partial.divisionId != null && String(partial.divisionId).trim() !== ""
        ? String(partial.divisionId).trim()
        : null,
    position,
    queuedAt:
      partial.queuedAt != null && String(partial.queuedAt).trim() !== ""
        ? String(partial.queuedAt).trim()
        : null,
    policyRef:
      partial.policyRef != null && String(partial.policyRef).trim() !== ""
        ? String(partial.policyRef).trim()
        : null,
    metadata:
      partial.metadata && typeof partial.metadata === "object" && !Array.isArray(partial.metadata)
        ? { ...partial.metadata }
        : null,
  });
}
