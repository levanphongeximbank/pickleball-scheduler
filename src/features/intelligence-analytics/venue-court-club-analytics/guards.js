/**
 * Tenant / venue / court / club isolation guards (I&A-07).
 * Fail closed — never silently filter contamination into success.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { isNonEmptyString, isPlainObject } from "../contracts/shared.js";

const FACT_LIST_KEYS = Object.freeze([
  "venues",
  "venueOperatingHours",
  "venueCapacities",
  "courts",
  "courtStatuses",
  "courtAvailabilities",
  "courtBookings",
  "courtMaintenances",
  "courtDowntimes",
  "clubs",
  "clubMemberships",
  "clubRoles",
  "clubActivities",
]);

/**
 * @param {unknown} context
 * @param {unknown} snapshot
 * @returns {import("../contracts/result.js").Result}
 */
export function guardVenueCourtClubAnalyticsSnapshot(context, snapshot) {
  if (!isPlainObject(context)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_CONTEXT_INVALID,
        "guard requires VenueCourtClubAnalyticsContext",
        "context"
      )
    );
  }
  if (!isPlainObject(snapshot)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_SNAPSHOT_INVALID,
        "guard requires VenueCourtClubAnalyticsSnapshot",
        "snapshot"
      )
    );
  }

  const expectedTenantId = context.tenantScope?.tenantId;
  const expectedVenueId = context.venueId;
  const expectedCourtId = context.courtId;
  const expectedClubId = context.clubId;

  if (!isNonEmptyString(expectedTenantId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.TENANT_CONTEXT_REQUIRED,
        "Expected tenantId missing from context",
        "context.tenantScope.tenantId"
      )
    );
  }

  const snapshotContext = snapshot.context;
  if (isPlainObject(snapshotContext)) {
    const snapTenant = snapshotContext.tenantScope?.tenantId;
    if (snapTenant && snapTenant !== expectedTenantId) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_TENANT_MISMATCH,
          "Snapshot tenant does not match requested context",
          "snapshot.context.tenantScope.tenantId",
          { expectedTenantId, actualTenantId: snapTenant }
        )
      );
    }
    if (
      expectedVenueId &&
      snapshotContext.venueId &&
      snapshotContext.venueId !== expectedVenueId
    ) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_VENUE_MISMATCH,
          "Snapshot venue does not match requested context",
          "snapshot.context.venueId",
          {
            expectedVenueId,
            actualVenueId: snapshotContext.venueId,
          }
        )
      );
    }
    if (
      expectedCourtId &&
      snapshotContext.courtId &&
      snapshotContext.courtId !== expectedCourtId
    ) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_COURT_MISMATCH,
          "Snapshot court does not match requested context",
          "snapshot.context.courtId",
          {
            expectedCourtId,
            actualCourtId: snapshotContext.courtId,
          }
        )
      );
    }
    if (
      expectedClubId &&
      snapshotContext.clubId &&
      snapshotContext.clubId !== expectedClubId
    ) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_CLUB_MISMATCH,
          "Snapshot club does not match requested context",
          "snapshot.context.clubId",
          {
            expectedClubId,
            actualClubId: snapshotContext.clubId,
          }
        )
      );
    }
  }

  /** @type {Set<string>} */
  const tenantIds = new Set();
  /** @type {Set<string>} */
  const venueIds = new Set();
  /** @type {Set<string>} */
  const courtIds = new Set();
  /** @type {Set<string>} */
  const clubIds = new Set();
  /** @type {Map<string, string>} */
  const courtToVenue = new Map();

  for (const key of FACT_LIST_KEYS) {
    const list = snapshot[key];
    if (!Array.isArray(list)) continue;
    for (let i = 0; i < list.length; i += 1) {
      const fact = list[i];
      if (!isPlainObject(fact)) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_FACT_INVALID,
            `Invalid fact in ${key}[${i}]`,
            `${key}[${i}]`
          )
        );
      }
      if (fact.tenantId !== expectedTenantId) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_TENANT_MISMATCH,
            "Fact tenant does not match requested context",
            `${key}[${i}].tenantId`,
            { expectedTenantId, actualTenantId: fact.tenantId }
          )
        );
      }
      tenantIds.add(String(fact.tenantId));

      if (isNonEmptyString(fact.venueId)) {
        venueIds.add(String(fact.venueId));
        if (expectedVenueId && fact.venueId !== expectedVenueId) {
          return fail(
            analyticsError(
              ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_VENUE_MISMATCH,
              "Fact venue does not match requested context",
              `${key}[${i}].venueId`,
              { expectedVenueId, actualVenueId: fact.venueId }
            )
          );
        }
      }

      if (isNonEmptyString(fact.courtId)) {
        courtIds.add(String(fact.courtId));
        if (expectedCourtId && fact.courtId !== expectedCourtId) {
          return fail(
            analyticsError(
              ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_COURT_MISMATCH,
              "Fact court does not match requested context",
              `${key}[${i}].courtId`,
              { expectedCourtId, actualCourtId: fact.courtId }
            )
          );
        }
        if (isNonEmptyString(fact.venueId)) {
          const prior = courtToVenue.get(String(fact.courtId));
          if (prior && prior !== fact.venueId) {
            return fail(
              analyticsError(
                ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_COURT_VENUE_MISMATCH,
                "Court is associated with conflicting venues across facts",
                `${key}[${i}].venueId`,
                {
                  courtId: fact.courtId,
                  venues: [prior, fact.venueId],
                }
              )
            );
          }
          courtToVenue.set(String(fact.courtId), String(fact.venueId));
        }
      }

      if (isNonEmptyString(fact.clubId)) {
        clubIds.add(String(fact.clubId));
        if (expectedClubId && fact.clubId !== expectedClubId) {
          return fail(
            analyticsError(
              ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_CLUB_MISMATCH,
              "Fact club does not match requested context",
              `${key}[${i}].clubId`,
              { expectedClubId, actualClubId: fact.clubId }
            )
          );
        }
      }
    }
  }

  if (tenantIds.size > 1) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_ISOLATION_VIOLATION,
        "Mixed-tenant facts are not allowed",
        "snapshot",
        { tenantIds: [...tenantIds] }
      )
    );
  }

  if (expectedVenueId && expectedCourtId) {
    const mappedVenue = courtToVenue.get(expectedCourtId);
    if (mappedVenue && mappedVenue !== expectedVenueId) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_COURT_VENUE_MISMATCH,
          "Requested court does not belong to requested venue",
          "context.courtId",
          {
            expectedVenueId,
            courtId: expectedCourtId,
            actualVenueId: mappedVenue,
          }
        )
      );
    }
  }

  // When venue is scoped, any court with explicit venue relation must match.
  if (expectedVenueId) {
    for (const [courtId, venueId] of courtToVenue.entries()) {
      if (venueId !== expectedVenueId) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_COURT_VENUE_MISMATCH,
            "Court-to-venue relation does not match requested venue scope",
            "courts",
            { courtId, expectedVenueId, actualVenueId: venueId }
          )
        );
      }
    }
  }

  return ok(
    Object.freeze({
      tenantId: expectedTenantId,
      ...(expectedVenueId ? { venueId: expectedVenueId } : {}),
      ...(expectedCourtId ? { courtId: expectedCourtId } : {}),
      ...(expectedClubId ? { clubId: expectedClubId } : {}),
      factTenantCount: tenantIds.size,
      factVenueCount: venueIds.size,
      factCourtCount: courtIds.size,
      factClubCount: clubIds.size,
    })
  );
}
