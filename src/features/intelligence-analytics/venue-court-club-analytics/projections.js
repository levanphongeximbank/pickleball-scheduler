/**
 * Deterministic Venue / Court / Club Analytics projections (I&A-07).
 * Descriptive counts/rates only — no availability recalculation, booking
 * conflict, authorization, revenue, or business-rule ownership.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { createAnalyticsWarning } from "../contracts/analyticsResult.js";
import { ANALYTICS_FRESHNESS_STATE } from "../contracts/enums.js";
import {
  clonePlain,
  deepFreeze,
  isFiniteNumber,
  isPlainObject,
} from "../contracts/shared.js";
import {
  BOOKING_CANCELLATION_POLICY,
  COURT_AVAILABILITY_BUCKET,
  DOWNTIME_INCLUSION_POLICY,
  ENTITY_LIFECYCLE_BUCKET,
  VENUE_COURT_CLUB_ANALYTICS_COMPLETENESS,
  VENUE_COURT_CLUB_ANALYTICS_METHOD_VERSION,
} from "./enums.js";

/**
 * Normalize explicit lifecycle/status to analytical bucket (label mapping only).
 * @param {string} status
 * @returns {string}
 */
export function mapEntityLifecycleBucket(status) {
  const normalized = String(status || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const aliases = {
    active: ENTITY_LIFECYCLE_BUCKET.ACTIVE,
    operational: ENTITY_LIFECYCLE_BUCKET.ACTIVE,
    open: ENTITY_LIFECYCLE_BUCKET.ACTIVE,
    inactive: ENTITY_LIFECYCLE_BUCKET.INACTIVE,
    closed: ENTITY_LIFECYCLE_BUCKET.INACTIVE,
    locked: ENTITY_LIFECYCLE_BUCKET.INACTIVE,
    deactivated: ENTITY_LIFECYCLE_BUCKET.INACTIVE,
    maintenance: ENTITY_LIFECYCLE_BUCKET.MAINTENANCE,
    under_maintenance: ENTITY_LIFECYCLE_BUCKET.MAINTENANCE,
  };
  return aliases[normalized] || ENTITY_LIFECYCLE_BUCKET.UNKNOWN;
}

/**
 * Map explicit availability status — does not recalculate availability.
 * @param {string} status
 * @returns {string}
 */
export function mapAvailabilityBucket(status) {
  const normalized = String(status || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const aliases = {
    available: COURT_AVAILABILITY_BUCKET.AVAILABLE,
    free: COURT_AVAILABILITY_BUCKET.AVAILABLE,
    open: COURT_AVAILABILITY_BUCKET.AVAILABLE,
    unavailable: COURT_AVAILABILITY_BUCKET.UNAVAILABLE,
    busy: COURT_AVAILABILITY_BUCKET.UNAVAILABLE,
    blocked: COURT_AVAILABILITY_BUCKET.UNAVAILABLE,
    maintenance: COURT_AVAILABILITY_BUCKET.UNAVAILABLE,
    closed: COURT_AVAILABILITY_BUCKET.UNAVAILABLE,
  };
  return aliases[normalized] || COURT_AVAILABILITY_BUCKET.UNKNOWN;
}

/**
 * @param {string} status
 * @returns {boolean}
 */
function isCancelledBookingStatus(status) {
  const normalized = String(status || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return (
    normalized === "cancelled" ||
    normalized === "canceled" ||
    normalized === "void"
  );
}

/**
 * @param {unknown[]} items
 * @param {(item: *) => string | undefined} keyFn
 * @returns {Readonly<Record<string, number>>}
 */
function countBy(items, keyFn) {
  /** @type {Record<string, number>} */
  const counts = {};
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.freeze({ ...counts });
}

/**
 * @param {number | null | undefined} numerator
 * @param {number | null | undefined} denominator
 * @returns {number | null}
 */
function safeRate(numerator, denominator) {
  if (!isFiniteNumber(numerator) || !isFiniteNumber(denominator)) return null;
  if (denominator === 0) return null;
  return numerator / denominator;
}

/**
 * @param {unknown} snapshot
 * @returns {import("../contracts/result.js").Result}
 */
export function projectVenueSummary(snapshot) {
  if (!isPlainObject(snapshot)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_SNAPSHOT_INVALID,
        "projectVenueSummary requires a snapshot",
        "snapshot"
      )
    );
  }

  const venues = Array.isArray(snapshot.venues) ? snapshot.venues : [];
  const lifecycle = countBy(venues, (v) =>
    mapEntityLifecycleBucket(v.lifecycleStatus || v.status)
  );

  return ok(
    deepFreeze({
      venueCount: venues.length,
      activeVenueCount: lifecycle[ENTITY_LIFECYCLE_BUCKET.ACTIVE] || 0,
      inactiveVenueCount: lifecycle[ENTITY_LIFECYCLE_BUCKET.INACTIVE] || 0,
      venueLifecycleDistribution: lifecycle,
      analyticalMethodVersion: VENUE_COURT_CLUB_ANALYTICS_METHOD_VERSION.DISTRIBUTION,
    })
  );
}

/**
 * @param {unknown} snapshot
 * @returns {import("../contracts/result.js").Result}
 */
export function projectCourtInventory(snapshot) {
  if (!isPlainObject(snapshot)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_SNAPSHOT_INVALID,
        "projectCourtInventory requires a snapshot",
        "snapshot"
      )
    );
  }

  const courts = Array.isArray(snapshot.courts) ? snapshot.courts : [];
  const statusFacts = Array.isArray(snapshot.courtStatuses)
    ? snapshot.courtStatuses
    : [];

  const statusFromCourts = countBy(courts, (c) =>
    c.status || c.lifecycleStatus
      ? mapEntityLifecycleBucket(c.status || c.lifecycleStatus)
      : undefined
  );
  const statusFromFacts = countBy(statusFacts, (s) =>
    s.status ? mapEntityLifecycleBucket(s.status) : undefined
  );

  /** Prefer explicit courtStatuses when present; else court.fact status. */
  const statusDistribution =
    statusFacts.length > 0 ? statusFromFacts : statusFromCourts;

  const courtCountByVenue = countBy(courts, (c) =>
    c.venueId ? String(c.venueId) : undefined
  );
  const courtTypeDistribution = countBy(courts, (c) =>
    c.courtType ? String(c.courtType) : undefined
  );

  return ok(
    deepFreeze({
      courtCount: courts.length,
      activeCourtCount: statusDistribution[ENTITY_LIFECYCLE_BUCKET.ACTIVE] || 0,
      inactiveCourtCount:
        statusDistribution[ENTITY_LIFECYCLE_BUCKET.INACTIVE] || 0,
      courtStatusDistribution: statusDistribution,
      courtCountByVenue,
      courtTypeDistribution,
      analyticalMethodVersion: VENUE_COURT_CLUB_ANALYTICS_METHOD_VERSION.DISTRIBUTION,
    })
  );
}

/**
 * Availability from explicit facts only — never recalculated.
 * @param {unknown} snapshot
 * @returns {import("../contracts/result.js").Result}
 */
export function projectCourtAvailability(snapshot) {
  if (!isPlainObject(snapshot)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_SNAPSHOT_INVALID,
        "projectCourtAvailability requires a snapshot",
        "snapshot"
      )
    );
  }

  const facts = Array.isArray(snapshot.courtAvailabilities)
    ? snapshot.courtAvailabilities
    : [];

  /** @type {unknown[]} */
  const warnings = [];
  let available = 0;
  let unavailable = 0;
  let unknown = 0;
  let eligibleMinutesSum = 0;
  let eligibleMinutesPresent = false;
  let missingEligible = 0;

  const reasonDistribution = countBy(facts, (f) =>
    f.unavailableReason ? String(f.unavailableReason) : undefined
  );

  for (const fact of facts) {
    const bucket = mapAvailabilityBucket(fact.availabilityStatus);
    if (bucket === COURT_AVAILABILITY_BUCKET.AVAILABLE) available += 1;
    else if (bucket === COURT_AVAILABILITY_BUCKET.UNAVAILABLE) unavailable += 1;
    else unknown += 1;

    if (isFiniteNumber(fact.eligibleMinutes)) {
      eligibleMinutesSum += fact.eligibleMinutes;
      eligibleMinutesPresent = true;
    } else {
      missingEligible += 1;
    }
  }

  const hasAvailabilityFacts = facts.length > 0;
  const availabilityRate = hasAvailabilityFacts
    ? safeRate(available, available + unavailable)
    : null;

  if (!hasAvailabilityFacts) {
    const warning = createAnalyticsWarning({
      code: "ANALYTICS_VENUE_COURT_CLUB_MISSING_AVAILABILITY",
      message:
        "No explicit availability facts present; available/unavailable counts are indeterminate (not coerced to zero success metrics)",
      field: "courtAvailabilities",
    });
    if (warning.ok) warnings.push(warning.value);
  }

  if (missingEligible > 0 && hasAvailabilityFacts) {
    const warning = createAnalyticsWarning({
      code: "ANALYTICS_VENUE_COURT_CLUB_MISSING_ELIGIBLE_MINUTES",
      message: `Availability facts missing eligibleMinutes (${missingEligible})`,
      field: "courtAvailabilities.eligibleMinutes",
    });
    if (warning.ok) warnings.push(warning.value);
  }

  return ok(
    deepFreeze({
      hasAvailabilityFacts,
      availableCount: hasAvailabilityFacts ? available : null,
      unavailableCount: hasAvailabilityFacts ? unavailable : null,
      unknownAvailabilityCount: hasAvailabilityFacts ? unknown : null,
      availabilityRate,
      unavailableReasonDistribution: reasonDistribution,
      eligibleMinutes: eligibleMinutesPresent ? eligibleMinutesSum : null,
      missingEligibleMinutesCount: missingEligible,
      warnings: Object.freeze(warnings),
      analyticalMethodVersion: VENUE_COURT_CLUB_ANALYTICS_METHOD_VERSION.AVAILABILITY,
      availabilityRecalculated: false,
    })
  );
}

/**
 * Operating-hours from explicit configured facts — missing ≠ 24/7.
 * @param {unknown} snapshot
 * @returns {import("../contracts/result.js").Result}
 */
export function projectOperatingHours(snapshot) {
  if (!isPlainObject(snapshot)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_SNAPSHOT_INVALID,
        "projectOperatingHours requires a snapshot",
        "snapshot"
      )
    );
  }

  const venues = Array.isArray(snapshot.venues) ? snapshot.venues : [];
  const hours = Array.isArray(snapshot.venueOperatingHours)
    ? snapshot.venueOperatingHours
    : [];

  let totalConfiguredMinutes = 0;
  let configuredFactCount = 0;
  let missingConfigCount = 0;
  /** @type {Set<string>} */
  const configuredVenues = new Set();

  for (const fact of hours) {
    if (fact.configured === false) {
      missingConfigCount += 1;
      continue;
    }
    if (isFiniteNumber(fact.configuredMinutes)) {
      totalConfiguredMinutes += fact.configuredMinutes;
      configuredFactCount += 1;
      if (fact.venueId) configuredVenues.add(String(fact.venueId));
    } else if (fact.configured === true) {
      missingConfigCount += 1;
    } else {
      missingConfigCount += 1;
    }
  }

  const venueCount = venues.length;
  const coverageRate = safeRate(configuredVenues.size, venueCount);

  return ok(
    deepFreeze({
      totalConfiguredMinutes,
      configuredFactCount,
      missingConfigurationCount: missingConfigCount,
      configuredVenueCount: configuredVenues.size,
      venueCount,
      coverageRate,
      assumedTwentyFourSeven: false,
      analyticalMethodVersion:
        VENUE_COURT_CLUB_ANALYTICS_METHOD_VERSION.OPERATING_HOURS,
    })
  );
}

/**
 * Booking-volume descriptive projection.
 * @param {unknown} snapshot
 * @param {{ cancellationPolicy?: string }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function projectBookingVolume(snapshot, options = {}) {
  if (!isPlainObject(snapshot)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_SNAPSHOT_INVALID,
        "projectBookingVolume requires a snapshot",
        "snapshot"
      )
    );
  }

  const cancellationPolicy =
    options.cancellationPolicy || BOOKING_CANCELLATION_POLICY.EXCLUDE_CANCELLED;

  const bookings = Array.isArray(snapshot.courtBookings)
    ? snapshot.courtBookings
    : [];

  const statusDistribution = countBy(bookings, (b) =>
    b.status ? String(b.status) : undefined
  );

  let bookedMinutes = 0;
  let bookedMinutesPresent = false;
  let cancelledCount = 0;
  let includedCount = 0;
  let missingMinutesCount = 0;

  for (const booking of bookings) {
    const cancelled = isCancelledBookingStatus(booking.status);
    if (cancelled) cancelledCount += 1;
    const include =
      cancellationPolicy === BOOKING_CANCELLATION_POLICY.INCLUDE_CANCELLED ||
      !cancelled;
    if (!include) continue;
    includedCount += 1;
    if (isFiniteNumber(booking.bookedMinutes)) {
      bookedMinutes += booking.bookedMinutes;
      bookedMinutesPresent = true;
    } else {
      missingMinutesCount += 1;
    }
  }

  return ok(
    deepFreeze({
      bookingCount: bookings.length,
      includedBookingCount: includedCount,
      cancelledBookingCount: cancelledCount,
      bookingStatusDistribution: statusDistribution,
      bookedMinutes: bookedMinutesPresent ? bookedMinutes : null,
      missingBookedMinutesCount: missingMinutesCount,
      cancellationPolicy,
      bookingConflictRecalculated: false,
      revenueCalculated: false,
      analyticalMethodVersion:
        VENUE_COURT_CLUB_ANALYTICS_METHOD_VERSION.BOOKING_VOLUME,
    })
  );
}

/**
 * Utilization: occupied eligible minutes / available eligible minutes.
 * @param {unknown} snapshot
 * @param {{
 *   cancellationPolicy?: string,
 *   downtimeInclusionPolicy?: string,
 * }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function projectCourtUtilization(snapshot, options = {}) {
  if (!isPlainObject(snapshot)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_SNAPSHOT_INVALID,
        "projectCourtUtilization requires a snapshot",
        "snapshot"
      )
    );
  }

  const cancellationPolicy =
    options.cancellationPolicy || BOOKING_CANCELLATION_POLICY.EXCLUDE_CANCELLED;
  const downtimeInclusionPolicy =
    options.downtimeInclusionPolicy ||
    DOWNTIME_INCLUSION_POLICY.EXCLUDE_FROM_ELIGIBLE;

  const bookingResult = projectBookingVolume(snapshot, { cancellationPolicy });
  if (!bookingResult.ok) return bookingResult;
  const availabilityResult = projectCourtAvailability(snapshot);
  if (!availabilityResult.ok) return availabilityResult;
  const downtimeResult = projectCourtDowntime(snapshot, {
    downtimeInclusionPolicy,
  });
  if (!downtimeResult.ok) return downtimeResult;

  const occupiedMinutes = bookingResult.value.bookedMinutes;
  let eligibleMinutes = availabilityResult.value.eligibleMinutes;

  /** @type {unknown[]} */
  const warnings = [...(availabilityResult.value.warnings || [])];

  if (
    downtimeInclusionPolicy === DOWNTIME_INCLUSION_POLICY.EXCLUDE_FROM_ELIGIBLE &&
    isFiniteNumber(eligibleMinutes) &&
    isFiniteNumber(downtimeResult.value.downtimeMinutes)
  ) {
    eligibleMinutes = Math.max(
      0,
      eligibleMinutes - downtimeResult.value.downtimeMinutes
    );
  }

  const utilizationRate = safeRate(occupiedMinutes, eligibleMinutes);
  const indeterminateDenominator =
    eligibleMinutes === null || eligibleMinutes === undefined;

  if (indeterminateDenominator) {
    const warning = createAnalyticsWarning({
      code: "ANALYTICS_VENUE_COURT_CLUB_UTILIZATION_INDETERMINATE",
      message:
        "Utilization denominator (eligible/available minutes) is missing; rate is null (not coerced to zero or Infinity)",
      field: "courtAvailabilities.eligibleMinutes",
    });
    if (warning.ok) warnings.push(warning.value);
  }

  if (isFiniteNumber(eligibleMinutes) && eligibleMinutes === 0) {
    const warning = createAnalyticsWarning({
      code: "ANALYTICS_VENUE_COURT_CLUB_UTILIZATION_ZERO_DENOMINATOR",
      message:
        "Utilization denominator is zero; rate is null (Infinity forbidden)",
      field: "eligibleMinutes",
    });
    if (warning.ok) warnings.push(warning.value);
  }

  return ok(
    deepFreeze({
      occupiedMinutes,
      eligibleMinutes: indeterminateDenominator ? null : eligibleMinutes,
      utilizationRate,
      cancellationPolicy,
      downtimeInclusionPolicy,
      analyticalMethodVersion: VENUE_COURT_CLUB_ANALYTICS_METHOD_VERSION.UTILIZATION,
      warnings: Object.freeze(warnings),
      availabilityRecalculated: false,
      bookingConflictRecalculated: false,
      revenueCalculated: false,
    })
  );
}

/**
 * @param {unknown} snapshot
 * @param {{ downtimeInclusionPolicy?: string }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function projectCourtDowntime(snapshot, options = {}) {
  if (!isPlainObject(snapshot)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_SNAPSHOT_INVALID,
        "projectCourtDowntime requires a snapshot",
        "snapshot"
      )
    );
  }

  const maintenances = Array.isArray(snapshot.courtMaintenances)
    ? snapshot.courtMaintenances
    : [];
  const downtimes = Array.isArray(snapshot.courtDowntimes)
    ? snapshot.courtDowntimes
    : [];
  const availability = Array.isArray(snapshot.courtAvailabilities)
    ? snapshot.courtAvailabilities
    : [];

  let downtimeMinutes = 0;
  let downtimeMinutesPresent = false;
  for (const fact of downtimes) {
    if (isFiniteNumber(fact.downtimeMinutes)) {
      downtimeMinutes += fact.downtimeMinutes;
      downtimeMinutesPresent = true;
    } else if (fact.downtimeMinutes !== undefined) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_DURATION_INVALID,
          "downtimeMinutes must be a finite non-negative number",
          "courtDowntimes.downtimeMinutes"
        )
      );
    }
  }

  let eligibleMinutes = null;
  let eligiblePresent = false;
  let eligibleSum = 0;
  for (const fact of availability) {
    if (isFiniteNumber(fact.eligibleMinutes)) {
      eligibleSum += fact.eligibleMinutes;
      eligiblePresent = true;
    }
  }
  if (eligiblePresent) eligibleMinutes = eligibleSum;

  const downtimeRate = safeRate(
    downtimeMinutesPresent ? downtimeMinutes : null,
    eligibleMinutes
  );

  const categoryDistribution = countBy(downtimes, (d) =>
    d.category ? String(d.category) : undefined
  );
  const affectedCourts = Object.freeze([
    ...new Set(
      [...maintenances, ...downtimes]
        .map((f) => (f.courtId ? String(f.courtId) : null))
        .filter(Boolean)
    ),
  ]);

  return ok(
    deepFreeze({
      maintenanceCount: maintenances.length,
      downtimeEventCount: downtimes.length,
      downtimeMinutes: downtimeMinutesPresent ? downtimeMinutes : null,
      downtimeRate,
      downtimeCategoryDistribution: categoryDistribution,
      affectedCourts,
      downtimeInclusionPolicy:
        options.downtimeInclusionPolicy ||
        DOWNTIME_INCLUSION_POLICY.EXCLUDE_FROM_ELIGIBLE,
      analyticalMethodVersion: VENUE_COURT_CLUB_ANALYTICS_METHOD_VERSION.DOWNTIME,
    })
  );
}

/**
 * @param {unknown} snapshot
 * @returns {import("../contracts/result.js").Result}
 */
export function projectClubSummary(snapshot) {
  if (!isPlainObject(snapshot)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_SNAPSHOT_INVALID,
        "projectClubSummary requires a snapshot",
        "snapshot"
      )
    );
  }

  const clubs = Array.isArray(snapshot.clubs) ? snapshot.clubs : [];
  const memberships = Array.isArray(snapshot.clubMemberships)
    ? snapshot.clubMemberships
    : [];
  const roles = Array.isArray(snapshot.clubRoles) ? snapshot.clubRoles : [];
  const activities = Array.isArray(snapshot.clubActivities)
    ? snapshot.clubActivities
    : [];

  const lifecycle = countBy(clubs, (c) =>
    mapEntityLifecycleBucket(c.lifecycleStatus || c.status)
  );
  const membershipStatusDistribution = countBy(memberships, (m) =>
    m.status ? String(m.status) : undefined
  );
  const roleDistribution = countBy(roles, (r) =>
    r.roleId ? String(r.roleId) : undefined
  );

  return ok(
    deepFreeze({
      clubCount: clubs.length,
      activeClubCount: lifecycle[ENTITY_LIFECYCLE_BUCKET.ACTIVE] || 0,
      inactiveClubCount: lifecycle[ENTITY_LIFECYCLE_BUCKET.INACTIVE] || 0,
      clubLifecycleDistribution: lifecycle,
      membershipCount: memberships.length,
      membershipStatusDistribution,
      roleAssignmentCount: roles.length,
      roleDistribution,
      activityCount: activities.length,
      clubPermissionCalculated: false,
      analyticalMethodVersion: VENUE_COURT_CLUB_ANALYTICS_METHOD_VERSION.DISTRIBUTION,
    })
  );
}

/**
 * Compose full Venue / Court / Club analytics summary.
 * @param {unknown} snapshot
 * @param {{
 *   cancellationPolicy?: string,
 *   downtimeInclusionPolicy?: string,
 *   generatedAt?: string,
 * }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function projectVenueCourtClubSummary(snapshot, options = {}) {
  if (!isPlainObject(snapshot)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_SNAPSHOT_INVALID,
        "projectVenueCourtClubSummary requires a snapshot",
        "snapshot"
      )
    );
  }

  const venue = projectVenueSummary(snapshot);
  if (!venue.ok) return venue;
  const courtInventory = projectCourtInventory(snapshot);
  if (!courtInventory.ok) return courtInventory;
  const availability = projectCourtAvailability(snapshot);
  if (!availability.ok) return availability;
  const operatingHours = projectOperatingHours(snapshot);
  if (!operatingHours.ok) return operatingHours;
  const bookingVolume = projectBookingVolume(snapshot, {
    cancellationPolicy: options.cancellationPolicy,
  });
  if (!bookingVolume.ok) return bookingVolume;
  const utilization = projectCourtUtilization(snapshot, {
    cancellationPolicy: options.cancellationPolicy,
    downtimeInclusionPolicy: options.downtimeInclusionPolicy,
  });
  if (!utilization.ok) return utilization;
  const downtime = projectCourtDowntime(snapshot, {
    downtimeInclusionPolicy: options.downtimeInclusionPolicy,
  });
  if (!downtime.ok) return downtime;
  const club = projectClubSummary(snapshot);
  if (!club.ok) return club;

  /** @type {unknown[]} */
  const warnings = [];
  for (const list of [
    snapshot.warnings,
    availability.value.warnings,
    utilization.value.warnings,
  ]) {
    if (Array.isArray(list)) {
      for (const w of list) warnings.push(w);
    }
  }

  if (snapshot.freshness === ANALYTICS_FRESHNESS_STATE.STALE) {
    const warning = createAnalyticsWarning({
      code: "ANALYTICS_VENUE_COURT_CLUB_STALE_SOURCE",
      message: "Source snapshot freshness is STALE",
      field: "freshness",
    });
    if (warning.ok) warnings.push(warning.value);
  }

  const incompleteSnapshot =
    snapshot.completeness === VENUE_COURT_CLUB_ANALYTICS_COMPLETENESS.PARTIAL ||
    snapshot.completeness === VENUE_COURT_CLUB_ANALYTICS_COMPLETENESS.UNKNOWN;

  const context = isPlainObject(snapshot.context) ? snapshot.context : {};

  return ok(
    deepFreeze(
      clonePlain({
        tenantId: context.tenantScope?.tenantId,
        venueId: context.venueId,
        courtId: context.courtId,
        clubId: context.clubId,
        ...venue.value,
        ...courtInventory.value,
        availability: availability.value,
        operatingHours: operatingHours.value,
        bookingVolume: bookingVolume.value,
        utilization: utilization.value,
        downtime: downtime.value,
        ...club.value,
        availableCount: availability.value.availableCount,
        unavailableCount: availability.value.unavailableCount,
        availabilityRate: availability.value.availabilityRate,
        bookedMinutes: bookingVolume.value.bookedMinutes,
        bookingCount: bookingVolume.value.bookingCount,
        bookingStatusDistribution:
          bookingVolume.value.bookingStatusDistribution,
        utilizationRate: utilization.value.utilizationRate,
        maintenanceCount: downtime.value.maintenanceCount,
        downtimeMinutes: downtime.value.downtimeMinutes,
        downtimeRate: downtime.value.downtimeRate,
        totalConfiguredOperatingMinutes:
          operatingHours.value.totalConfiguredMinutes,
        operatingHoursCoverageRate: operatingHours.value.coverageRate,
        provenance: snapshot.provenance,
        freshness: snapshot.freshness,
        completeness: snapshot.completeness,
        incompleteSnapshot,
        sourceTimestamp: snapshot.sourceTimestamp,
        canonicalSourceRef: snapshot.canonicalSourceRef,
        generatedAt: options.generatedAt,
        warnings: Object.freeze(warnings),
        analyticalMethodVersion: VENUE_COURT_CLUB_ANALYTICS_METHOD_VERSION.SUMMARY,
        isCanonicalVenueCourtClubState: false,
        isCanonicalModuleState: false,
        availabilityRecalculated: false,
        bookingConflictRecalculated: false,
        revenueCalculated: false,
        clubPermissionCalculated: false,
      })
    )
  );
}
