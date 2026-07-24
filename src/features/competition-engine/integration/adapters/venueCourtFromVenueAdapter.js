/**
 * INT-02 / BG-04 — Venue & Court → CORE-12 provider adapters.
 *
 * Wraps Venue public CAA + descriptor facades. No first-venue/first-club fallback.
 * Does not perform scheduling or court assignment.
 */

import { getCompetitionCourtAvailability } from "../../../venue-court/adapters/competitionCourtAvailabilityAdapter.js";
import { listCanonicalCourtDescriptors } from "../../../venue-court/adapters/competitionCourtDescriptorAdapter.js";
import { INTEGRATION_ERROR_CODE } from "../constants.js";
import {
  optionalNonEmptyString,
  requireClubId,
  requireTenantId,
  requireVenueId,
} from "../context/requireIntegrationContext.js";
import { normalizeAdapterError, throwIntegrationError } from "../errors.js";

/**
 * @param {unknown} request
 */
function requireVenueCourtScope(request) {
  const scope = request && typeof request === "object" ? request : {};
  const tenantId = requireTenantId(scope);
  const clubId = requireClubId(scope);
  const venueId = requireVenueId(scope);
  return { tenantId, clubId, venueId, raw: scope };
}

/**
 * VenueEligibilityProvider wrapping getCompetitionCourtAvailability.
 *
 * @param {{
 *   getCompetitionCourtAvailability?: typeof getCompetitionCourtAvailability,
 * }} [deps]
 * @returns {{ resolveEligibility: (request: object) => object }}
 */
export function createVenueEligibilityFromCaaAdapter(deps = {}) {
  const getAvailability =
    typeof deps.getCompetitionCourtAvailability === "function"
      ? deps.getCompetitionCourtAvailability
      : getCompetitionCourtAvailability;

  return {
    resolveEligibility(request) {
      try {
        const { tenantId, clubId, venueId, raw } = requireVenueCourtScope(request);

        const date =
          optionalNonEmptyString(raw.civilDate) ||
          optionalNonEmptyString(raw.date);
        const startTime =
          optionalNonEmptyString(raw.civilStartTime) ||
          optionalNonEmptyString(raw.startTime);
        const endTime =
          optionalNonEmptyString(raw.civilEndTime) ||
          optionalNonEmptyString(raw.endTime);

        if (!date || !startTime || !endTime) {
          throwIntegrationError(
            INTEGRATION_ERROR_CODE.INVALID_REQUEST,
            "Venue availability requires civil date/startTime/endTime",
            {
              failClosed: true,
              details: { date, startTime, endTime },
            }
          );
        }

        const result = getAvailability({
          clubId,
          venueId,
          date,
          startTime,
          endTime,
          courtIds: Array.isArray(raw.courtIds) ? raw.courtIds : undefined,
          clusterId: optionalNonEmptyString(raw.clusterId) || undefined,
          includeUnavailable: true,
          context: raw.context,
        });

        // Echo tenant/club/venue for CORE-12 scope match (no ID rewrite).
        return Object.freeze({
          tenantId,
          clubId: result.clubId,
          venueId: result.venueId ?? venueId,
          date: result.date,
          startTime: result.startTime,
          endTime: result.endTime,
          availableCourtIds: Object.freeze([...(result.availableCourtIds || [])]),
          unavailableCourts: Object.freeze(
            (result.unavailableCourts || []).map((row) =>
              Object.freeze({ ...row })
            )
          ),
          sourceContractVersion: "VENUE_COURT_COMPETITION_AVAILABILITY_V1",
        });
      } catch (err) {
        throw normalizeAdapterError(
          err,
          INTEGRATION_ERROR_CODE.VENUE_RESOLUTION_FAILED,
          "Venue eligibility resolution failed"
        );
      }
    },
  };
}

/**
 * CanonicalCourtDescriptorProvider wrapping listCanonicalCourtDescriptors.
 *
 * @param {{
 *   listCanonicalCourtDescriptors?: typeof listCanonicalCourtDescriptors,
 * }} [deps]
 * @returns {{ resolveDescriptors: (request: object) => object }}
 */
export function createCanonicalDescriptorFromVenueAdapter(deps = {}) {
  const listDescriptors =
    typeof deps.listCanonicalCourtDescriptors === "function"
      ? deps.listCanonicalCourtDescriptors
      : listCanonicalCourtDescriptors;

  return {
    resolveDescriptors(request) {
      try {
        const { tenantId, clubId, venueId, raw } = requireVenueCourtScope(request);

        const envelope = listDescriptors({
          tenantId,
          clubId,
          venueId,
          courtIds: Array.isArray(raw.courtIds) ? raw.courtIds : undefined,
          clusterId: optionalNonEmptyString(raw.clusterId) || undefined,
          includeInactive: raw.includeInactive === true,
          includeLocked: raw.includeLocked !== false,
        });

        // Return Venue envelope as-is (frozen shallow copy) — no mutation.
        return Object.freeze({
          ...envelope,
          courts: Object.freeze(
            (envelope.courts || []).map((c) => Object.freeze({ ...c }))
          ),
          diagnostics: Object.freeze({
            ...(envelope.diagnostics || {}),
            excludedCourts: Object.freeze([
              ...((envelope.diagnostics && envelope.diagnostics.excludedCourts) ||
                []),
            ]),
          }),
        });
      } catch (err) {
        throw normalizeAdapterError(
          err,
          INTEGRATION_ERROR_CODE.VENUE_RESOLUTION_FAILED,
          "Canonical court descriptor resolution failed"
        );
      }
    },
  };
}
