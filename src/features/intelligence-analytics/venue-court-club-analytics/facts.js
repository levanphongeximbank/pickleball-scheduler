/**
 * Explicit Venue / Court / Club analytical fact contracts (I&A-07).
 * Facts are immutable, module-neutral, and carry explicit tenant + entity
 * identity + provenance. No mutation methods, callbacks, DB table identities,
 * React state, or business-rule recalculation.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { createAnalyticsMetricProvenance } from "../contracts/source.js";
import {
  deepFreeze,
  isFiniteNumber,
  isNonEmptyString,
  isPlainObject,
  isValidIsoTimestamp,
} from "../contracts/shared.js";

/**
 * @param {unknown} input
 * @param {string} field
 * @returns {import("../contracts/result.js").Result}
 */
function requireTenant(input, field) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_FACT_INVALID,
        `${field} must be a plain object`,
        field
      )
    );
  }
  if (!isNonEmptyString(input.tenantId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.TENANT_CONTEXT_REQUIRED,
        `${field}.tenantId is required`,
        `${field}.tenantId`
      )
    );
  }
  return ok(null);
}

/**
 * @param {unknown} input
 * @param {string} field
 * @returns {import("../contracts/result.js").Result}
 */
function optionalProvenance(input, field) {
  if (input === undefined) return ok(undefined);
  const result = createAnalyticsMetricProvenance(input);
  if (!result.ok) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_FACT_INVALID,
        result.error.message,
        `${field}.provenance`,
        result.error.details
      )
    );
  }
  return ok(result.value);
}

/**
 * @param {unknown} input
 * @param {string} field
 * @returns {import("../contracts/result.js").Result}
 */
function optionalIso(input, field) {
  if (input === undefined) return ok(undefined);
  if (!isValidIsoTimestamp(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_TIMESTAMP_INVALID,
        `${field} must be a valid ISO timestamp`,
        field
      )
    );
  }
  return ok(String(input).trim());
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {import("../contracts/result.js").Result}
 */
function optionalNonNegativeMinutes(value, field) {
  if (value === undefined) return ok(undefined);
  if (!isFiniteNumber(value) || value < 0) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_DURATION_INVALID,
        `${field} must be a finite non-negative number`,
        field
      )
    );
  }
  return ok(value);
}

/**
 * @param {Record<string, unknown>} base
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
function attachCommonOptional(base, input) {
  if (input.canonicalSourceRef !== undefined) {
    if (!isNonEmptyString(input.canonicalSourceRef)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_FACT_INVALID,
          "canonicalSourceRef must be a non-empty string when provided",
          "canonicalSourceRef"
        )
      );
    }
    base.canonicalSourceRef = String(input.canonicalSourceRef).trim();
  }
  if (input.sourceTimestamp !== undefined) {
    const ts = optionalIso(input.sourceTimestamp, "sourceTimestamp");
    if (!ts.ok) return ts;
    base.sourceTimestamp = ts.value;
  }
  const provenance = optionalProvenance(input.provenance, "fact");
  if (!provenance.ok) return provenance;
  if (provenance.value !== undefined) base.provenance = provenance.value;
  return ok(base);
}

/**
 * @param {Record<string, unknown>} base
 * @param {unknown} input
 * @param {string[]} keys
 * @returns {import("../contracts/result.js").Result}
 */
function attachOptionalStrings(base, input, keys) {
  for (const key of keys) {
    if (input[key] !== undefined) {
      if (!isNonEmptyString(input[key])) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_FACT_INVALID,
            `${key} must be a non-empty string when provided`,
            key
          )
        );
      }
      base[key] = String(input[key]).trim();
    }
  }
  return ok(base);
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createVenueAnalyticalFact(input) {
  const identity = requireTenant(input, "VenueAnalyticalFact");
  if (!identity.ok) return identity;
  if (!isNonEmptyString(input.venueId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_FACT_INVALID,
        "venueId is required",
        "venueId"
      )
    );
  }
  /** @type {Record<string, unknown>} */
  const fact = {
    tenantId: String(input.tenantId).trim(),
    venueId: String(input.venueId).trim(),
  };
  const strings = attachOptionalStrings(fact, input, ["status", "lifecycleStatus", "label"]);
  if (!strings.ok) return strings;
  if (input.capacity !== undefined) {
    if (!isFiniteNumber(input.capacity) || input.capacity < 0) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_FACT_INVALID,
          "capacity must be a finite non-negative number when provided",
          "capacity"
        )
      );
    }
    fact.capacity = input.capacity;
  }
  const attached = attachCommonOptional(fact, input);
  if (!attached.ok) return attached;
  return ok(deepFreeze(attached.value));
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createVenueOperatingHoursFact(input) {
  const identity = requireTenant(input, "VenueOperatingHoursFact");
  if (!identity.ok) return identity;
  if (!isNonEmptyString(input.venueId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_FACT_INVALID,
        "venueId is required",
        "venueId"
      )
    );
  }
  /** @type {Record<string, unknown>} */
  const fact = {
    tenantId: String(input.tenantId).trim(),
    venueId: String(input.venueId).trim(),
  };
  const minutes = optionalNonNegativeMinutes(
    input.configuredMinutes,
    "configuredMinutes"
  );
  if (!minutes.ok) return minutes;
  if (minutes.value !== undefined) fact.configuredMinutes = minutes.value;
  if (input.configured === true) fact.configured = true;
  if (input.configured === false) fact.configured = false;
  const strings = attachOptionalStrings(fact, input, ["dayKey", "timezone"]);
  if (!strings.ok) return strings;
  const attached = attachCommonOptional(fact, input);
  if (!attached.ok) return attached;
  return ok(deepFreeze(attached.value));
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createVenueCapacityFact(input) {
  const identity = requireTenant(input, "VenueCapacityFact");
  if (!identity.ok) return identity;
  if (!isNonEmptyString(input.venueId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_FACT_INVALID,
        "venueId is required",
        "venueId"
      )
    );
  }
  /** @type {Record<string, unknown>} */
  const fact = {
    tenantId: String(input.tenantId).trim(),
    venueId: String(input.venueId).trim(),
  };
  if (input.capacity !== undefined) {
    if (!isFiniteNumber(input.capacity) || input.capacity < 0) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_FACT_INVALID,
          "capacity must be a finite non-negative number when provided",
          "capacity"
        )
      );
    }
    fact.capacity = input.capacity;
  }
  if (input.courtCount !== undefined) {
    if (!isFiniteNumber(input.courtCount) || input.courtCount < 0) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_FACT_INVALID,
          "courtCount must be a finite non-negative number when provided",
          "courtCount"
        )
      );
    }
    fact.courtCount = input.courtCount;
  }
  const attached = attachCommonOptional(fact, input);
  if (!attached.ok) return attached;
  return ok(deepFreeze(attached.value));
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createCourtAnalyticalFact(input) {
  const identity = requireTenant(input, "CourtAnalyticalFact");
  if (!identity.ok) return identity;
  if (!isNonEmptyString(input.courtId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_FACT_INVALID,
        "courtId is required",
        "courtId"
      )
    );
  }
  if (!isNonEmptyString(input.venueId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_FACT_INVALID,
        "venueId is required",
        "venueId"
      )
    );
  }
  /** @type {Record<string, unknown>} */
  const fact = {
    tenantId: String(input.tenantId).trim(),
    courtId: String(input.courtId).trim(),
    venueId: String(input.venueId).trim(),
  };
  const strings = attachOptionalStrings(fact, input, [
    "status",
    "lifecycleStatus",
    "courtType",
    "label",
    "clubId",
  ]);
  if (!strings.ok) return strings;
  const attached = attachCommonOptional(fact, input);
  if (!attached.ok) return attached;
  return ok(deepFreeze(attached.value));
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createCourtStatusFact(input) {
  const identity = requireTenant(input, "CourtStatusFact");
  if (!identity.ok) return identity;
  if (!isNonEmptyString(input.courtId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_FACT_INVALID,
        "courtId is required",
        "courtId"
      )
    );
  }
  if (!isNonEmptyString(input.status)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_FACT_INVALID,
        "status is required",
        "status"
      )
    );
  }
  /** @type {Record<string, unknown>} */
  const fact = {
    tenantId: String(input.tenantId).trim(),
    courtId: String(input.courtId).trim(),
    status: String(input.status).trim(),
  };
  const strings = attachOptionalStrings(fact, input, ["venueId", "clubId"]);
  if (!strings.ok) return strings;
  const attached = attachCommonOptional(fact, input);
  if (!attached.ok) return attached;
  return ok(deepFreeze(attached.value));
}

/**
 * Explicit availability observation from source — never recalculated here.
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createCourtAvailabilityFact(input) {
  const identity = requireTenant(input, "CourtAvailabilityFact");
  if (!identity.ok) return identity;
  if (!isNonEmptyString(input.courtId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_FACT_INVALID,
        "courtId is required",
        "courtId"
      )
    );
  }
  if (!isNonEmptyString(input.availabilityStatus)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_FACT_INVALID,
        "availabilityStatus is required (explicit source value)",
        "availabilityStatus"
      )
    );
  }
  /** @type {Record<string, unknown>} */
  const fact = {
    tenantId: String(input.tenantId).trim(),
    courtId: String(input.courtId).trim(),
    availabilityStatus: String(input.availabilityStatus).trim(),
  };
  const strings = attachOptionalStrings(fact, input, [
    "venueId",
    "clubId",
    "unavailableReason",
  ]);
  if (!strings.ok) return strings;
  const eligible = optionalNonNegativeMinutes(
    input.eligibleMinutes,
    "eligibleMinutes"
  );
  if (!eligible.ok) return eligible;
  if (eligible.value !== undefined) fact.eligibleMinutes = eligible.value;
  const attached = attachCommonOptional(fact, input);
  if (!attached.ok) return attached;
  return ok(deepFreeze(attached.value));
}

/**
 * Descriptive booking fact — no conflict/revenue calculation.
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createCourtBookingFact(input) {
  const identity = requireTenant(input, "CourtBookingFact");
  if (!identity.ok) return identity;
  if (!isNonEmptyString(input.bookingId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_FACT_INVALID,
        "bookingId is required",
        "bookingId"
      )
    );
  }
  if (!isNonEmptyString(input.courtId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_FACT_INVALID,
        "courtId is required",
        "courtId"
      )
    );
  }
  /** @type {Record<string, unknown>} */
  const fact = {
    tenantId: String(input.tenantId).trim(),
    bookingId: String(input.bookingId).trim(),
    courtId: String(input.courtId).trim(),
  };
  const strings = attachOptionalStrings(fact, input, [
    "venueId",
    "clubId",
    "status",
  ]);
  if (!strings.ok) return strings;
  const booked = optionalNonNegativeMinutes(input.bookedMinutes, "bookedMinutes");
  if (!booked.ok) return booked;
  if (booked.value !== undefined) fact.bookedMinutes = booked.value;
  for (const key of ["startsAt", "endsAt", "createdAt"]) {
    if (input[key] !== undefined) {
      const ts = optionalIso(input[key], key);
      if (!ts.ok) return ts;
      fact[key] = ts.value;
    }
  }
  const attached = attachCommonOptional(fact, input);
  if (!attached.ok) return attached;
  return ok(deepFreeze(attached.value));
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createCourtMaintenanceFact(input) {
  const identity = requireTenant(input, "CourtMaintenanceFact");
  if (!identity.ok) return identity;
  if (!isNonEmptyString(input.maintenanceId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_FACT_INVALID,
        "maintenanceId is required",
        "maintenanceId"
      )
    );
  }
  if (!isNonEmptyString(input.courtId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_FACT_INVALID,
        "courtId is required",
        "courtId"
      )
    );
  }
  /** @type {Record<string, unknown>} */
  const fact = {
    tenantId: String(input.tenantId).trim(),
    maintenanceId: String(input.maintenanceId).trim(),
    courtId: String(input.courtId).trim(),
  };
  const strings = attachOptionalStrings(fact, input, [
    "venueId",
    "clubId",
    "category",
    "reason",
  ]);
  if (!strings.ok) return strings;
  const attached = attachCommonOptional(fact, input);
  if (!attached.ok) return attached;
  return ok(deepFreeze(attached.value));
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createCourtDowntimeFact(input) {
  const identity = requireTenant(input, "CourtDowntimeFact");
  if (!identity.ok) return identity;
  if (!isNonEmptyString(input.downtimeId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_FACT_INVALID,
        "downtimeId is required",
        "downtimeId"
      )
    );
  }
  if (!isNonEmptyString(input.courtId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_FACT_INVALID,
        "courtId is required",
        "courtId"
      )
    );
  }
  /** @type {Record<string, unknown>} */
  const fact = {
    tenantId: String(input.tenantId).trim(),
    downtimeId: String(input.downtimeId).trim(),
    courtId: String(input.courtId).trim(),
  };
  const strings = attachOptionalStrings(fact, input, [
    "venueId",
    "clubId",
    "category",
    "reason",
  ]);
  if (!strings.ok) return strings;
  const downtime = optionalNonNegativeMinutes(
    input.downtimeMinutes,
    "downtimeMinutes"
  );
  if (!downtime.ok) return downtime;
  if (downtime.value !== undefined) fact.downtimeMinutes = downtime.value;
  const attached = attachCommonOptional(fact, input);
  if (!attached.ok) return attached;
  return ok(deepFreeze(attached.value));
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createClubAnalyticalFact(input) {
  const identity = requireTenant(input, "ClubAnalyticalFact");
  if (!identity.ok) return identity;
  if (!isNonEmptyString(input.clubId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_FACT_INVALID,
        "clubId is required",
        "clubId"
      )
    );
  }
  /** @type {Record<string, unknown>} */
  const fact = {
    tenantId: String(input.tenantId).trim(),
    clubId: String(input.clubId).trim(),
  };
  const strings = attachOptionalStrings(fact, input, [
    "venueId",
    "status",
    "lifecycleStatus",
    "label",
  ]);
  if (!strings.ok) return strings;
  const attached = attachCommonOptional(fact, input);
  if (!attached.ok) return attached;
  return ok(deepFreeze(attached.value));
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createClubMembershipFact(input) {
  const identity = requireTenant(input, "ClubMembershipFact");
  if (!identity.ok) return identity;
  if (!isNonEmptyString(input.membershipId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_FACT_INVALID,
        "membershipId is required",
        "membershipId"
      )
    );
  }
  if (!isNonEmptyString(input.clubId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_FACT_INVALID,
        "clubId is required",
        "clubId"
      )
    );
  }
  /** @type {Record<string, unknown>} */
  const fact = {
    tenantId: String(input.tenantId).trim(),
    membershipId: String(input.membershipId).trim(),
    clubId: String(input.clubId).trim(),
  };
  const strings = attachOptionalStrings(fact, input, [
    "memberId",
    "status",
    "venueId",
  ]);
  if (!strings.ok) return strings;
  const attached = attachCommonOptional(fact, input);
  if (!attached.ok) return attached;
  return ok(deepFreeze(attached.value));
}

/**
 * Explicit role assignment — no permission evaluation.
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createClubRoleFact(input) {
  const identity = requireTenant(input, "ClubRoleFact");
  if (!identity.ok) return identity;
  if (!isNonEmptyString(input.assignmentId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_FACT_INVALID,
        "assignmentId is required",
        "assignmentId"
      )
    );
  }
  if (!isNonEmptyString(input.clubId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_FACT_INVALID,
        "clubId is required",
        "clubId"
      )
    );
  }
  if (!isNonEmptyString(input.roleId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_FACT_INVALID,
        "roleId is required",
        "roleId"
      )
    );
  }
  /** @type {Record<string, unknown>} */
  const fact = {
    tenantId: String(input.tenantId).trim(),
    assignmentId: String(input.assignmentId).trim(),
    clubId: String(input.clubId).trim(),
    roleId: String(input.roleId).trim(),
  };
  const strings = attachOptionalStrings(fact, input, ["memberId", "venueId"]);
  if (!strings.ok) return strings;
  const attached = attachCommonOptional(fact, input);
  if (!attached.ok) return attached;
  return ok(deepFreeze(attached.value));
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createClubActivityFact(input) {
  const identity = requireTenant(input, "ClubActivityFact");
  if (!identity.ok) return identity;
  if (!isNonEmptyString(input.activityId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_FACT_INVALID,
        "activityId is required",
        "activityId"
      )
    );
  }
  if (!isNonEmptyString(input.clubId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_FACT_INVALID,
        "clubId is required",
        "clubId"
      )
    );
  }
  /** @type {Record<string, unknown>} */
  const fact = {
    tenantId: String(input.tenantId).trim(),
    activityId: String(input.activityId).trim(),
    clubId: String(input.clubId).trim(),
  };
  const strings = attachOptionalStrings(fact, input, [
    "activityKind",
    "status",
    "venueId",
  ]);
  if (!strings.ok) return strings;
  if (input.occurredAt !== undefined) {
    const ts = optionalIso(input.occurredAt, "occurredAt");
    if (!ts.ok) return ts;
    fact.occurredAt = ts.value;
  }
  const attached = attachCommonOptional(fact, input);
  if (!attached.ok) return attached;
  return ok(deepFreeze(attached.value));
}
