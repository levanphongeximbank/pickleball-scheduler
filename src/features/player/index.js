/**
 * Player Management — public facade.
 *
 * Phase 1B read contracts + Phase 1C single write export + Phase 1F-A self read.
 * Adapters, repositories, validators, bootstrap remain internal.
 */
export { RESOLUTION_OUTCOME } from "./constants/resolutionOutcomes.js";

export { normalizePlayerProfile } from "./models/playerProfile.js";

export { resolveByAuthUser } from "./services/resolveByAuthUser.js";
export { resolveCanonicalPlayerId } from "./services/resolveCanonicalPlayerId.js";
export { getPlayerProfile } from "./services/getPlayerProfile.js";
export { getPlayerProfileByAuthUser } from "./services/getPlayerProfile.js";
export {
  getAuthenticatedSelfPlayerProfile,
  SELF_PLAYER_PROFILE_READ_STATUS,
} from "./services/getAuthenticatedSelfPlayerProfile.js";
export { searchPlayers } from "./services/searchPlayers.js";
export { updatePlayerProfile } from "./services/updatePlayerProfile.js";

export {
  buildSelfFoundationFieldView,
  formatBirthDateDisplay,
  formatBirthYearDisplay,
  formatHandednessDisplay,
  formatActivityRegionDisplay,
  formatVerificationStatusDisplay,
  formatPrivacySettingsDisplay,
  UNKNOWN_LABEL,
} from "./selectors/selfProfileDisplay.js";
