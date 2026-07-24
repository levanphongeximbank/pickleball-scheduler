/**
 * Player Management — public facade.
 *
 * Phase 1B–1G-A + Phase 1H-A privileged verification writer
 * + Phase 1H-B admin verification queue read API
 * + Phase 1H-C admin verification actions UI (components remain importable from path)
 * + Phase 1I-A authenticated Public Player Directory application contract.
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
export { searchPublicDirectoryPlayers } from "./services/searchPublicDirectoryPlayers.js";
export { getPublicDirectoryPlayer } from "./services/getPublicDirectoryPlayer.js";
export { DIRECTORY_ERROR_CODES } from "./constants/directory.js";
export { updatePlayerProfile } from "./services/updatePlayerProfile.js";
export { updatePlayerVerificationStatus } from "./services/updatePlayerVerificationStatus.js";
export { listPlayerVerificationQueue } from "./services/listPlayerVerificationQueue.js";
export {
  IDENTITY_VERIFICATION_STATUS,
  IDENTITY_VERIFICATION_VALUES,
} from "./constants/verification.js";
export {
  VERIFICATION_TRANSITION_MATRIX,
  validateVerificationTransition,
} from "./constants/verificationTransitions.js";
export {
  VERIFICATION_QUEUE_DEFAULT_STATUS,
  VERIFICATION_QUEUE_DEFAULT_LIMIT,
  VERIFICATION_QUEUE_MAX_LIMIT,
  VERIFICATION_QUEUE_SUPPORTED_STATUSES,
  VERIFICATION_QUEUE_ERROR_CODES,
} from "./constants/verificationQueue.js";
export { WRITE_ERROR_CODES } from "./constants/writableFields.js";

export {
  projectPublicPlayerProfile,
  buildOpaquePublicPlayerProfile,
  PUBLIC_PROFILE_HIDE_REASON,
} from "./projectors/projectPublicPlayerProfile.js";
export {
  projectAdminVerificationQueueItem,
  ADMIN_VERIFICATION_QUEUE_DTO_FIELDS,
  ADMIN_VERIFICATION_QUEUE_EXCLUDED_FIELDS,
} from "./projectors/projectAdminVerificationQueueItem.js";

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

export {
  PLAYER_PLATFORM_ADAPTER_ERROR,
  projectPlayerActor,
  projectPlayerSubject,
  projectPlayerSecurityContext,
  projectPlayerErrorDescriptor,
  projectPlayerOperationIdentity,
} from "./platform/index.js";
