/**
 * Player Management — public facade.
 *
 * Phase 1B–1F + Phase 1G-A self foundation edit helpers.
 * Adapters, repositories, validators, bootstrap remain internal.
 */
export { RESOLUTION_OUTCOME } from "./constants/resolutionOutcomes.js";
export {
  DEFAULT_PRIVACY_SETTINGS,
  normalizePrivacySettings,
  validatePrivacySettings,
} from "./constants/privacy.js";
export {
  PLAYER_PROFILE_VIEWER_MODE,
  PLAYER_PROFILE_VIEWER_MODES,
  VIEWER_MODE_ERROR,
  resolvePlayerProfileViewerMode,
} from "./constants/viewerModes.js";

export { normalizePlayerProfile } from "./models/playerProfile.js";

export { resolveByAuthUser } from "./services/resolveByAuthUser.js";
export { resolveCanonicalPlayerId } from "./services/resolveCanonicalPlayerId.js";
export { getPlayerProfile } from "./services/getPlayerProfile.js";
export { getPlayerProfileByAuthUser } from "./services/getPlayerProfile.js";
export {
  getAuthenticatedSelfPlayerProfile,
  SELF_PLAYER_PROFILE_READ_STATUS,
} from "./services/getAuthenticatedSelfPlayerProfile.js";
export {
  searchPlayers,
  searchPublicPlayers,
  searchDirectoryPlayers,
  searchInternalPlayers,
} from "./services/searchPlayers.js";
export { updatePlayerProfile } from "./services/updatePlayerProfile.js";

export {
  projectPublicPlayerProfile,
  buildOpaquePublicPlayerProfile,
  PUBLIC_PROFILE_HIDE_REASON,
} from "./projectors/projectPublicPlayerProfile.js";

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

export {
  buildSelfFoundationFormState,
  buildSelfFoundationUpdatePatch,
  applyBirthDateChange,
  stripVerificationFromSelfPatch,
  SELF_FOUNDATION_PRIVACY_KEYS,
  SELF_FOUNDATION_PRIVACY_LABELS,
  SELF_FOUNDATION_HANDEDNESS_OPTIONS,
} from "./utils/selfFoundationForm.js";
