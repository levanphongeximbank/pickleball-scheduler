/**
 * Competition Engine — Integration Foundation (E2E-01)
 *
 * Composition-root adapters for Identity, Player, Club, Rating, Venue/Court.
 * Consumes Competition Core / Management / Identity / Club / Player / Venue
 * public surfaces. Does not reopen CLOSED Core/CM workstreams.
 * Does not edit Platform Core.
 */

export {
  E2E01_INTEGRATION_VERSION,
  INTEGRATION_ERROR_CODE,
  INTEGRATION_ERROR_CODE_VALUES,
  ADAPTER_STATUS,
  RATING_COMPLETENESS,
  INTEGRATION_SOURCE,
} from "./constants.js";

export {
  IntegrationError,
  isIntegrationError,
  isIntegrationErrorCode,
  throwIntegrationError,
  normalizeAdapterError,
} from "./errors.js";

export {
  optionalNonEmptyString,
  requireNonEmptyString,
  readScopeIds,
  readSubjectIds,
  requireActorIdentity,
  requireTenantId,
  requireVenueId,
  requireClubId,
  assertTenantIsolation,
  requireIntegrationContext,
} from "./context/requireIntegrationContext.js";

export {
  createIdentityPermissionResolver,
  createIdentityEvidenceFromIdentityAdapter,
  isIdentityEvidenceFromIdentityAdapter,
} from "./adapters/identityEvidenceFromIdentityAdapter.js";

export { createMembershipStatusFromClubAdapter } from "./adapters/membershipStatusFromClubAdapter.js";

export { createPlayerParticipantLookupAdapter } from "./adapters/playerParticipantLookupAdapter.js";

export {
  createRankingRatingSnapshotFromRatingAdapter,
  isRankingRatingSnapshotFromRatingAdapter,
} from "./adapters/rankingRatingSnapshotFromRatingAdapter.js";

export {
  createVenueEligibilityFromCaaAdapter,
  createCanonicalDescriptorFromVenueAdapter,
} from "./adapters/venueCourtFromVenueAdapter.js";

export {
  createCompetitionRuntimePorts,
  authorizeCompetitionAction,
} from "./composition/createCompetitionRuntimePorts.js";

export {
  buildAdapterInventory,
  getAdapterInventoryEntry,
} from "./inventory/adapterInventory.js";

export const COMPETITION_ENGINE_INTEGRATION = Object.freeze({
  id: "competition-engine-integration",
  phase: "E2E-01",
  version: "e2e-01-integration-foundation-v1",
  wiredToProductionRuntime: true,
  ownsEngines: false,
});
