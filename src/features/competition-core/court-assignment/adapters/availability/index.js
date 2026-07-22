/**
 * CORE-12 Phase 1D — availability adapters (pure projection + provider invoke +
 * Phase 1D-B2 Option A injected Venue bridge).
 *
 * Production-safe exports only. Test doubles live in `./testDoubles.js`
 * and must not be re-exported here.
 */

export {
  computeAvailabilityQueryFingerprint,
  computeDerivedEligibilityFingerprint,
  computeDerivedAvailabilityFingerprint,
  CORE12_AVAILABILITY_PROVIDER_CONTRACT_VERSION,
  CORE12_AVAILABILITY_PROJECTION_CONTRACT_VERSION,
} from "../../contracts/availabilityFingerprints.js";

export { invokeAvailabilitySnapshotProvider } from "./invokeAvailabilitySnapshotProvider.js";
export { projectEligibleCourtsToAvailableInputs } from "./projectEligibleCourtsToAvailableInputs.js";
export { normalizeVenueDescriptorEnvelope } from "./normalizeVenueDescriptorEnvelope.js";
export {
  createInjectedVenueCourtAvailabilityProvider,
  isInjectedVenueCourtAvailabilityProvider,
} from "./createInjectedVenueCourtAvailabilityProvider.js";
