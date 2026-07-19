/**
 * Player Management — public facade.
 *
 * Phase 1B read contracts + Phase 1C single write export.
 * Adapters, repositories, validators, bootstrap remain internal.
 */
export { RESOLUTION_OUTCOME } from "./constants/resolutionOutcomes.js";

export { normalizePlayerProfile } from "./models/playerProfile.js";

export { resolveByAuthUser } from "./services/resolveByAuthUser.js";
export { resolveCanonicalPlayerId } from "./services/resolveCanonicalPlayerId.js";
export { getPlayerProfile } from "./services/getPlayerProfile.js";
export { searchPlayers } from "./services/searchPlayers.js";
export { updatePlayerProfile } from "./services/updatePlayerProfile.js";
