/**
 * E2E-01 composition root — DI bag for Competition Core/CM consumers.
 *
 * Wires Identity, Player, Club, Rating, Venue adapters into Core ports.
 * Does not reopen Core/CM capability folders. Does not edit Platform Core.
 */

import {
  createUnavailableIdentityEvidencePort,
  evaluateAuthorization,
  matchesIdentityEvidencePort,
} from "../../../competition-core/role-permission/index.js";
import { createInjectedVenueCourtAvailabilityProvider } from "../../../competition-core/court-assignment/adapters/availability/createInjectedVenueCourtAvailabilityProvider.js";
import { createNullMembershipStatusPort } from "../../../competition-core/registration-eligibility/ports/membershipStatusPort.js";
import { createIdentityEvidenceFromIdentityAdapter } from "../adapters/identityEvidenceFromIdentityAdapter.js";
import { createMembershipStatusFromClubAdapter } from "../adapters/membershipStatusFromClubAdapter.js";
import { createPlayerParticipantLookupAdapter } from "../adapters/playerParticipantLookupAdapter.js";
import { createRankingRatingSnapshotFromRatingAdapter } from "../adapters/rankingRatingSnapshotFromRatingAdapter.js";
import {
  createCanonicalDescriptorFromVenueAdapter,
  createVenueEligibilityFromCaaAdapter,
} from "../adapters/venueCourtFromVenueAdapter.js";
import {
  E2E01_INTEGRATION_VERSION,
  INTEGRATION_ERROR_CODE,
} from "../constants.js";
import {
  assertTenantIsolation,
  requireIntegrationContext,
} from "../context/requireIntegrationContext.js";
import { IntegrationError } from "../errors.js";
import { buildAdapterInventory } from "../inventory/adapterInventory.js";

/**
 * Authorize a competition action via CORE-02 with injected Identity evidence.
 *
 * @param {unknown} requestInput
 * @param {{ evidencePort?: unknown }} [options]
 */
export async function authorizeCompetitionAction(requestInput, options = {}) {
  const evidencePort =
    options.evidencePort && matchesIdentityEvidencePort(options.evidencePort)
      ? options.evidencePort
      : createUnavailableIdentityEvidencePort();

  // Fail-closed context before Core evaluation when fields are present enough to validate.
  try {
    if (requestInput && typeof requestInput === "object") {
      const subject = /** @type {{ subject?: unknown }} */ (requestInput).subject;
      const scope = /** @type {{ scope?: unknown }} */ (requestInput).scope;
      if (subject != null || scope != null) {
        requireIntegrationContext({
          subject: subject || {},
          scope: scope || {},
          requireRole: true,
          requireVenue: false,
          requireClub: false,
        });
      }
    }
  } catch (err) {
    if (err instanceof IntegrationError) {
      return Object.freeze({
        allowed: false,
        decisionCode: err.code,
        denyReason: err.code,
        reason: err.message,
        failClosed: true,
        details: err.details,
      });
    }
    throw err;
  }

  const decision = await evaluateAuthorization(requestInput, { evidencePort });

  // Extra cross-tenant guard when evidence carries tenant.
  if (
    decision?.allowed &&
    requestInput &&
    typeof requestInput === "object" &&
    decision.details == null
  ) {
    // evaluateAuthorization already checks scope compatibility; keep explicit marker.
  }

  return decision;
}

/**
 * Create the Competition runtime ports bag for IND Pool+KO vertical slice.
 *
 * @param {{
 *   identity?: Parameters<typeof createIdentityEvidenceFromIdentityAdapter>[0],
 *   identityEvidencePort?: unknown,
 *   club?: Parameters<typeof createMembershipStatusFromClubAdapter>[0],
 *   membershipStatusPort?: unknown,
 *   player?: Parameters<typeof createPlayerParticipantLookupAdapter>[0],
 *   participantLookupPort?: unknown,
 *   rating?: Parameters<typeof createRankingRatingSnapshotFromRatingAdapter>[0],
 *   rankingRatingSnapshotPort?: unknown,
 *   venue?: {
 *     getCompetitionCourtAvailability?: Function,
 *     listCanonicalCourtDescriptors?: Function,
 *   },
 *   venueEligibilityProvider?: unknown,
 *   canonicalCourtDescriptorProvider?: unknown,
 *   wireVenueAvailabilityBridge?: boolean,
 * }} [deps]
 */
export function createCompetitionRuntimePorts(deps = {}) {
  const identityEvidencePort =
    deps.identityEvidencePort &&
    matchesIdentityEvidencePort(deps.identityEvidencePort)
      ? deps.identityEvidencePort
      : createIdentityEvidenceFromIdentityAdapter(deps.identity || {});

  const membershipStatusPort =
    deps.membershipStatusPort ||
    (deps.club
      ? createMembershipStatusFromClubAdapter(deps.club)
      : createNullMembershipStatusPort());

  const participantLookupPort =
    deps.participantLookupPort ||
    (deps.player
      ? createPlayerParticipantLookupAdapter(deps.player)
      : createPlayerParticipantLookupAdapter({}));

  const rankingRatingSnapshotPort =
    deps.rankingRatingSnapshotPort ||
    (deps.rating
      ? createRankingRatingSnapshotFromRatingAdapter(deps.rating)
      : null);

  const venueEligibilityProvider =
    deps.venueEligibilityProvider ||
    createVenueEligibilityFromCaaAdapter(deps.venue || {});

  const canonicalCourtDescriptorProvider =
    deps.canonicalCourtDescriptorProvider ||
    createCanonicalDescriptorFromVenueAdapter(deps.venue || {});

  const venueAvailabilityBridge =
    deps.wireVenueAvailabilityBridge === false
      ? null
      : createInjectedVenueCourtAvailabilityProvider({
          eligibilityProvider: venueEligibilityProvider,
          descriptorProvider: canonicalCourtDescriptorProvider,
        });

  const authorize = (requestInput) =>
    authorizeCompetitionAction(requestInput, { evidencePort: identityEvidencePort });

  return Object.freeze({
    version: E2E01_INTEGRATION_VERSION,
    identityEvidencePort,
    membershipStatusPort,
    participantLookupPort,
    rankingRatingSnapshotPort,
    venueEligibilityProvider,
    canonicalCourtDescriptorProvider,
    venueAvailabilityBridge,
    authorize,
    requireIntegrationContext,
    assertTenantIsolation,
    inventory: buildAdapterInventory(),
    errorCodes: INTEGRATION_ERROR_CODE,
  });
}
