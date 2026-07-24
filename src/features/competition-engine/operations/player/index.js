/**
 * E2E-04 Player Competition Operations — public barrel.
 */

export {
  E2E04_PLAYER_OPERATIONS_VERSION,
  E2E04_PLAYER_OPERATIONS_PHASE,
  PLAYER_ACTION,
  PLAYER_ACTION_VALUES,
  PLAYER_CHECKIN_MARK,
  PLAYER_BLOCKER_CODE,
  PLAYER_ERROR_CODE,
  PLAYER_ERROR_CODE_VALUES,
} from "./constants.js";

export {
  PlayerOperationsError,
  isPlayerOperationsError,
  isPlayerErrorCode,
  failPlayer,
  normalizePlayerError,
} from "./errors.js";

export {
  PLAYER_CAPABILITY,
  PLAYER_ACTION_PERMISSION_MAP,
  resolvePlayerActionPermissions,
  isKnownPlayerAction,
} from "./permissions/playerActionMap.js";

export {
  authorizePlayerCommand,
  rejectClientGrantedPermissions,
} from "./context/authorizePlayerCommand.js";

export { resolvePlayerEntryOwnership } from "./context/resolvePlayerEntryOwnership.js";

export {
  summarizePlayerCheckIn,
  assertPlayerCheckInAllowed,
  applyPlayerCheckInMark,
} from "./checkin/playerCheckInBoundary.js";

export { buildPlayerOperationsProjection } from "./projections/buildPlayerOperationsProjection.js";

export {
  createPlayerCompetitionOperationsFacade,
  getPlayerCompetitionState,
} from "./createPlayerCompetitionOperationsFacade.js";

export const COMPETITION_ENGINE_PLAYER_OPERATIONS = Object.freeze({
  id: "competition-engine-player-operations",
  phase: "E2E-04",
  version: "e2e-04-player-operations-v1",
  wiredToProductionRuntime: false,
  ownsEngines: false,
});
