import { isNonEmptyString, REGISTRATION_ELIGIBILITY_SCHEMA_VERSION } from "./shared.js";

/**
 * RegistrationCapacitySnapshot — competition / division capacity at evaluation time.
 *
 * Phase 1A fields retained for compatibility. Phase 1D adds reservation accounting,
 * remaining capacity, optimistic stateVersion, and snapshot identity.
 *
 * @typedef {Object} RegistrationCapacitySnapshot
 * @property {string} schemaVersion
 * @property {string|null} [snapshotId]
 * @property {string} competitionId
 * @property {string|null} [divisionId]
 * @property {string|null} [divisionCategoryId]
 * @property {number|null} competitionLimit
 * @property {number} competitionRegisteredCount
 * @property {number} [competitionUsed]
 * @property {number} [competitionReserved]
 * @property {number|null} [competitionRemaining]
 * @property {number|null} divisionLimit
 * @property {number} divisionRegisteredCount
 * @property {number} [divisionUsed]
 * @property {number} [divisionReserved]
 * @property {number|null} [divisionRemaining]
 * @property {number|null} [effectiveRemaining]
 * @property {number} waitlistCount
 * @property {boolean} competitionHasCapacity
 * @property {boolean} divisionHasCapacity
 * @property {string} capturedAt
 * @property {string} [calculatedAt]
 * @property {number|null} [sourceVersion]
 * @property {number} [stateVersion]
 */

/**
 * @param {number|null} limit
 * @param {number} used
 * @param {number} reserved
 * @returns {number|null}
 */
function deriveRemaining(limit, used, reserved) {
  if (limit == null) return null;
  return Math.max(0, limit - used - reserved);
}

/**
 * @param {Partial<RegistrationCapacitySnapshot>} partial
 * @returns {RegistrationCapacitySnapshot}
 */
export function createRegistrationCapacitySnapshot(partial = {}) {
  if (!isNonEmptyString(partial.competitionId)) {
    throw new TypeError("RegistrationCapacitySnapshot requires competitionId");
  }
  const capturedAtRaw = partial.capturedAt ?? partial.calculatedAt;
  if (!isNonEmptyString(capturedAtRaw)) {
    throw new TypeError("RegistrationCapacitySnapshot requires capturedAt from ClockPort");
  }

  const competitionLimit =
    partial.competitionLimit == null ? null : Number(partial.competitionLimit);
  const divisionLimit = partial.divisionLimit == null ? null : Number(partial.divisionLimit);

  const competitionUsed = Number(
    partial.competitionUsed ?? partial.competitionRegisteredCount ?? 0
  );
  const divisionUsed = Number(partial.divisionUsed ?? partial.divisionRegisteredCount ?? 0);
  const competitionReserved = Number(partial.competitionReserved ?? 0);
  const divisionReserved = Number(partial.divisionReserved ?? 0);
  const waitlistCount = Number(partial.waitlistCount ?? 0);
  const stateVersion = Number(partial.stateVersion ?? 0);
  const sourceVersion =
    partial.sourceVersion == null ? null : Number(partial.sourceVersion);

  if (
    (competitionLimit != null && (!Number.isFinite(competitionLimit) || competitionLimit < 0)) ||
    (divisionLimit != null && (!Number.isFinite(divisionLimit) || divisionLimit < 0))
  ) {
    throw new TypeError("RegistrationCapacitySnapshot limits must be null or non-negative");
  }
  if (
    !Number.isFinite(competitionUsed) ||
    competitionUsed < 0 ||
    !Number.isFinite(divisionUsed) ||
    divisionUsed < 0 ||
    !Number.isFinite(competitionReserved) ||
    competitionReserved < 0 ||
    !Number.isFinite(divisionReserved) ||
    divisionReserved < 0
  ) {
    throw new TypeError("RegistrationCapacitySnapshot usage/reserved must be non-negative");
  }
  if (
    competitionLimit != null &&
    competitionUsed + competitionReserved > competitionLimit
  ) {
    throw new TypeError("competition used+reserved exceeds competitionLimit");
  }
  if (divisionLimit != null && divisionUsed + divisionReserved > divisionLimit) {
    throw new TypeError("division used+reserved exceeds divisionLimit");
  }
  if (!Number.isInteger(stateVersion) || stateVersion < 0) {
    throw new TypeError("RegistrationCapacitySnapshot.stateVersion must be integer >= 0");
  }

  const competitionRemaining =
    partial.competitionRemaining !== undefined
      ? partial.competitionRemaining == null
        ? null
        : Number(partial.competitionRemaining)
      : deriveRemaining(
          Number.isFinite(competitionLimit) ? competitionLimit : null,
          competitionUsed,
          competitionReserved
        );

  const divisionRemaining =
    partial.divisionRemaining !== undefined
      ? partial.divisionRemaining == null
        ? null
        : Number(partial.divisionRemaining)
      : deriveRemaining(
          Number.isFinite(divisionLimit) ? divisionLimit : null,
          divisionUsed,
          divisionReserved
        );

  let effectiveRemaining;
  if (partial.effectiveRemaining !== undefined) {
    effectiveRemaining =
      partial.effectiveRemaining == null ? null : Number(partial.effectiveRemaining);
  } else if (competitionRemaining == null && divisionRemaining == null) {
    effectiveRemaining = null;
  } else if (competitionRemaining == null) {
    effectiveRemaining = divisionRemaining;
  } else if (divisionRemaining == null) {
    effectiveRemaining = competitionRemaining;
  } else {
    effectiveRemaining = Math.min(competitionRemaining, divisionRemaining);
  }

  const competitionHasCapacity =
    typeof partial.competitionHasCapacity === "boolean"
      ? partial.competitionHasCapacity
      : competitionLimit == null ||
        (Number.isFinite(competitionLimit) &&
          competitionUsed + competitionReserved < competitionLimit);

  const divisionHasCapacity =
    typeof partial.divisionHasCapacity === "boolean"
      ? partial.divisionHasCapacity
      : divisionLimit == null ||
        (Number.isFinite(divisionLimit) && divisionUsed + divisionReserved < divisionLimit);

  const capturedAt = String(capturedAtRaw).trim();

  return Object.freeze({
    schemaVersion: String(partial.schemaVersion ?? REGISTRATION_ELIGIBILITY_SCHEMA_VERSION),
    snapshotId:
      partial.snapshotId != null && String(partial.snapshotId).trim() !== ""
        ? String(partial.snapshotId).trim()
        : null,
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
    competitionRegisteredCount: competitionUsed,
    competitionUsed,
    competitionReserved,
    competitionRemaining,
    divisionLimit: Number.isFinite(divisionLimit) ? divisionLimit : null,
    divisionRegisteredCount: divisionUsed,
    divisionUsed,
    divisionReserved,
    divisionRemaining,
    effectiveRemaining,
    waitlistCount: Number.isFinite(waitlistCount) ? waitlistCount : 0,
    competitionHasCapacity,
    divisionHasCapacity,
    capturedAt,
    calculatedAt: capturedAt,
    sourceVersion: sourceVersion != null && Number.isFinite(sourceVersion) ? sourceVersion : null,
    stateVersion,
  });
}

/**
 * RegistrationWaitlistPosition — waitlist policy contract (ordering + position).
 *
 * Phase 1A fields retained. Phase 1D adds ordering metadata and counts.
 *
 * @typedef {Object} RegistrationWaitlistPosition
 * @property {string} schemaVersion
 * @property {string|null} [waitlistEntryId]
 * @property {string} registrationId
 * @property {string} competitionId
 * @property {string|null} [divisionId]
 * @property {number} position
 * @property {number} [priorityRank]
 * @property {string|null} [submittedAt]
 * @property {string|null} [waitlistedAt]
 * @property {string|null} [queuedAt]
 * @property {string|null} [calculatedAt]
 * @property {number} [waitlistVersion]
 * @property {number} [aheadCount]
 * @property {number} [totalCount]
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

  const priorityRank = Number(partial.priorityRank ?? 0);
  const waitlistVersion = Number(partial.waitlistVersion ?? 0);
  const totalCount = Number(partial.totalCount ?? position);
  const aheadCount =
    partial.aheadCount !== undefined ? Number(partial.aheadCount) : Math.max(0, position - 1);

  return Object.freeze({
    schemaVersion: String(partial.schemaVersion ?? REGISTRATION_ELIGIBILITY_SCHEMA_VERSION),
    waitlistEntryId:
      partial.waitlistEntryId != null && String(partial.waitlistEntryId).trim() !== ""
        ? String(partial.waitlistEntryId).trim()
        : null,
    registrationId: String(partial.registrationId).trim(),
    competitionId: String(partial.competitionId).trim(),
    divisionId:
      partial.divisionId != null && String(partial.divisionId).trim() !== ""
        ? String(partial.divisionId).trim()
        : null,
    position,
    priorityRank: Number.isFinite(priorityRank) ? priorityRank : 0,
    submittedAt:
      partial.submittedAt != null && String(partial.submittedAt).trim() !== ""
        ? String(partial.submittedAt).trim()
        : null,
    waitlistedAt:
      partial.waitlistedAt != null && String(partial.waitlistedAt).trim() !== ""
        ? String(partial.waitlistedAt).trim()
        : partial.queuedAt != null && String(partial.queuedAt).trim() !== ""
          ? String(partial.queuedAt).trim()
          : null,
    queuedAt:
      partial.queuedAt != null && String(partial.queuedAt).trim() !== ""
        ? String(partial.queuedAt).trim()
        : partial.waitlistedAt != null && String(partial.waitlistedAt).trim() !== ""
          ? String(partial.waitlistedAt).trim()
          : null,
    calculatedAt:
      partial.calculatedAt != null && String(partial.calculatedAt).trim() !== ""
        ? String(partial.calculatedAt).trim()
        : null,
    waitlistVersion: Number.isInteger(waitlistVersion) && waitlistVersion >= 0 ? waitlistVersion : 0,
    aheadCount: Number.isFinite(aheadCount) ? aheadCount : Math.max(0, position - 1),
    totalCount: Number.isFinite(totalCount) ? totalCount : position,
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

/**
 * CapacityReservation — active hold on competition/division capacity.
 *
 * @typedef {Object} CapacityReservation
 * @property {string} schemaVersion
 * @property {string} reservationId
 * @property {string} registrationId
 * @property {string} competitionId
 * @property {string|null} divisionId
 * @property {'ACTIVE'|'RELEASED'} status
 * @property {string} reservedAt
 * @property {string|null} releasedAt
 * @property {string|null} releaseReason
 * @property {string|null} actorId
 * @property {number} stateVersion
 * @property {string|null} requestId
 */

/**
 * @param {Partial<CapacityReservation>} partial
 * @returns {CapacityReservation}
 */
export function createCapacityReservation(partial = {}) {
  if (!isNonEmptyString(partial.reservationId)) {
    throw new TypeError("CapacityReservation requires reservationId");
  }
  if (!isNonEmptyString(partial.registrationId)) {
    throw new TypeError("CapacityReservation requires registrationId");
  }
  if (!isNonEmptyString(partial.competitionId)) {
    throw new TypeError("CapacityReservation requires competitionId");
  }
  if (!isNonEmptyString(partial.reservedAt)) {
    throw new TypeError("CapacityReservation requires reservedAt from ClockPort");
  }
  const status = String(partial.status || "ACTIVE").trim();
  if (status !== "ACTIVE" && status !== "RELEASED") {
    throw new TypeError("CapacityReservation.status must be ACTIVE or RELEASED");
  }
  const stateVersion = Number(partial.stateVersion ?? 0);
  if (!Number.isInteger(stateVersion) || stateVersion < 0) {
    throw new TypeError("CapacityReservation.stateVersion must be integer >= 0");
  }

  return Object.freeze({
    schemaVersion: String(partial.schemaVersion ?? REGISTRATION_ELIGIBILITY_SCHEMA_VERSION),
    reservationId: String(partial.reservationId).trim(),
    registrationId: String(partial.registrationId).trim(),
    competitionId: String(partial.competitionId).trim(),
    divisionId:
      partial.divisionId != null && String(partial.divisionId).trim() !== ""
        ? String(partial.divisionId).trim()
        : null,
    status,
    reservedAt: String(partial.reservedAt).trim(),
    releasedAt:
      partial.releasedAt != null && String(partial.releasedAt).trim() !== ""
        ? String(partial.releasedAt).trim()
        : null,
    releaseReason:
      partial.releaseReason != null && String(partial.releaseReason).trim() !== ""
        ? String(partial.releaseReason).trim()
        : null,
    actorId:
      partial.actorId != null && String(partial.actorId).trim() !== ""
        ? String(partial.actorId).trim()
        : null,
    stateVersion,
    requestId:
      partial.requestId != null && String(partial.requestId).trim() !== ""
        ? String(partial.requestId).trim()
        : null,
  });
}

/**
 * WaitlistEntry — ordered waitlist membership for a registration.
 *
 * @typedef {Object} WaitlistEntry
 * @property {string} schemaVersion
 * @property {string} waitlistEntryId
 * @property {string} registrationId
 * @property {string} competitionId
 * @property {string|null} divisionId
 * @property {'ACTIVE'|'WITHDRAWN'|'PROMOTED'} status
 * @property {number} priorityRank
 * @property {string|null} submittedAt
 * @property {string} waitlistedAt
 * @property {string|null} withdrawnAt
 * @property {string|null} promotedAt
 * @property {number} waitlistVersion
 * @property {string|null} actorId
 * @property {string|null} requestId
 * @property {Record<string, unknown>|null} [metadata]
 */

/**
 * @param {Partial<WaitlistEntry>} partial
 * @returns {WaitlistEntry}
 */
export function createWaitlistEntry(partial = {}) {
  if (!isNonEmptyString(partial.waitlistEntryId)) {
    throw new TypeError("WaitlistEntry requires waitlistEntryId");
  }
  if (!isNonEmptyString(partial.registrationId)) {
    throw new TypeError("WaitlistEntry requires registrationId");
  }
  if (!isNonEmptyString(partial.competitionId)) {
    throw new TypeError("WaitlistEntry requires competitionId");
  }
  if (!isNonEmptyString(partial.waitlistedAt)) {
    throw new TypeError("WaitlistEntry requires waitlistedAt from ClockPort");
  }
  const status = String(partial.status || "ACTIVE").trim();
  if (status !== "ACTIVE" && status !== "WITHDRAWN" && status !== "PROMOTED") {
    throw new TypeError("WaitlistEntry.status must be ACTIVE, WITHDRAWN, or PROMOTED");
  }
  const priorityRank = Number(partial.priorityRank ?? 0);
  const waitlistVersion = Number(partial.waitlistVersion ?? 0);
  if (!Number.isFinite(priorityRank)) {
    throw new TypeError("WaitlistEntry.priorityRank must be finite");
  }
  if (!Number.isInteger(waitlistVersion) || waitlistVersion < 0) {
    throw new TypeError("WaitlistEntry.waitlistVersion must be integer >= 0");
  }

  return Object.freeze({
    schemaVersion: String(partial.schemaVersion ?? REGISTRATION_ELIGIBILITY_SCHEMA_VERSION),
    waitlistEntryId: String(partial.waitlistEntryId).trim(),
    registrationId: String(partial.registrationId).trim(),
    competitionId: String(partial.competitionId).trim(),
    divisionId:
      partial.divisionId != null && String(partial.divisionId).trim() !== ""
        ? String(partial.divisionId).trim()
        : null,
    status,
    priorityRank,
    submittedAt:
      partial.submittedAt != null && String(partial.submittedAt).trim() !== ""
        ? String(partial.submittedAt).trim()
        : null,
    waitlistedAt: String(partial.waitlistedAt).trim(),
    withdrawnAt:
      partial.withdrawnAt != null && String(partial.withdrawnAt).trim() !== ""
        ? String(partial.withdrawnAt).trim()
        : null,
    promotedAt:
      partial.promotedAt != null && String(partial.promotedAt).trim() !== ""
        ? String(partial.promotedAt).trim()
        : null,
    waitlistVersion,
    actorId:
      partial.actorId != null && String(partial.actorId).trim() !== ""
        ? String(partial.actorId).trim()
        : null,
    requestId:
      partial.requestId != null && String(partial.requestId).trim() !== ""
        ? String(partial.requestId).trim()
        : null,
    metadata:
      partial.metadata && typeof partial.metadata === "object" && !Array.isArray(partial.metadata)
        ? { ...partial.metadata }
        : null,
  });
}
