/**
 * Player Management — Phase 1B public facade (read-first).
 *
 * Stable public contracts only. Adapters, repositories, guards, and
 * player-id helpers remain internal modules.
 *
 * No new identity store. No migrations. No write path. No production cutover.
 */
export { RESOLUTION_OUTCOME } from "./constants/resolutionOutcomes.js";

export { normalizePlayerProfile } from "./models/playerProfile.js";

export { resolveByAuthUser } from "./services/resolveByAuthUser.js";
export { resolveCanonicalPlayerId } from "./services/resolveCanonicalPlayerId.js";
export { getPlayerProfile } from "./services/getPlayerProfile.js";
export { searchPlayers } from "./services/searchPlayers.js";
