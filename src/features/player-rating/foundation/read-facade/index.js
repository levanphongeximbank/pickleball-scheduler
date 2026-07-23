/**
 * Player Rating Foundation — Phase 1H read-only facade.
 * Composes Phases 1C–1D read surfaces. Not wired to Production runtime.
 */

export {
  PLAYER_RATING_READ_FACADE_AVAILABILITY_STATUS,
  isPlayerRatingReadFacadeAvailabilityStatus,
} from "./readFacadeStatus.js";

export {
  PLAYER_RATING_READ_FACADE_REUSED_ERROR_CODE,
  failReadFacade,
  isPlayerRatingReadFacadeErrorCode,
} from "./readFacadeErrors.js";

export {
  buildPlayerRatingOverview,
  deriveAvailabilityStatus,
} from "./buildPlayerRatingOverview.js";

export { createPlayerRatingReadFacade } from "./createPlayerRatingReadFacade.js";

export const PLAYER_RATING_READ_FACADE_PHASE = Object.freeze({
  id: "1H",
  name: "read-only-player-rating-facade",
  wiredToProductionRuntime: false,
  selectsRuntimeSsot: false,
  convertsScales: false,
  selectsPreferredCandidate: false,
  calculatesDisplayRating: false,
  exposesWriteApi: false,
  generatesIdsOrTimestamps: false,
});
