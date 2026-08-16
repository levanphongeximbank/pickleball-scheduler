/**
 * Canonical mode Adapter B factories + registry wiring.
 *
 * Phase 2B: production/default composition attaches this registry and sets
 * usesAdapterB=true. Adapters remain translator-only (no authority ownership).
 */

import {
  COMPETITION_REFEREE_MODE,
  REFEREE_ADAPTER_ERROR_CODE,
} from "../constants.js";
import { failRefereeAdapter } from "../errors.js";
import { createCompetitionRefereeAdapterRegistry } from "../registry.js";
import { createDailyPlayRefereeAdapter } from "./DailyPlayRefereeAdapter.js";
import { createInternalTournamentRefereeAdapter } from "./InternalTournamentRefereeAdapter.js";
import { createOfficialTournamentRefereeAdapter } from "./OfficialTournamentRefereeAdapter.js";
import { createTeamTournamentRefereeAdapter } from "./TeamTournamentRefereeAdapter.js";

/**
 * @param {{
 *   dailyPlay?: object,
 *   internal?: object,
 *   official?: object,
 *   team?: object,
 * }} [options]
 */
export function createCompetitionRefereeModeAdapters(options = {}) {
  return Object.freeze({
    [COMPETITION_REFEREE_MODE.DAILY_PLAY]: createDailyPlayRefereeAdapter(
      options.dailyPlay || {}
    ),
    [COMPETITION_REFEREE_MODE.INTERNAL]: createInternalTournamentRefereeAdapter(
      options.internal || {}
    ),
    [COMPETITION_REFEREE_MODE.OFFICIAL]: createOfficialTournamentRefereeAdapter(
      options.official || {}
    ),
    [COMPETITION_REFEREE_MODE.TEAM]: createTeamTournamentRefereeAdapter(
      options.team || {}
    ),
  });
}

/**
 * Wire all four mode adapters into the existing End A registry.
 *
 * @param {{
 *   dailyPlay?: object,
 *   internal?: object,
 *   official?: object,
 *   team?: object,
 *   adapters?: unknown[],
 * }} [options]
 */
export function createCompetitionRefereeModeAdapterRegistry(options = {}) {
  if (Array.isArray(options.adapters) && options.adapters.length > 0) {
    return createCompetitionRefereeAdapterRegistry({
      adapters: options.adapters,
    });
  }

  const byMode = createCompetitionRefereeModeAdapters(options);
  const adapters = [
    byMode[COMPETITION_REFEREE_MODE.DAILY_PLAY],
    byMode[COMPETITION_REFEREE_MODE.INTERNAL],
    byMode[COMPETITION_REFEREE_MODE.OFFICIAL],
    byMode[COMPETITION_REFEREE_MODE.TEAM],
  ];

  const registry = createCompetitionRefereeAdapterRegistry({ adapters });

  if (registry.size() !== 4) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.MALFORMED_ADAPTER,
      "Expected exactly four mode Adapter B registrations",
      { size: registry.size() }
    );
  }

  return registry;
}

export {
  createDailyPlayRefereeAdapter,
  DailyPlayRefereeAdapter,
} from "./DailyPlayRefereeAdapter.js";
export {
  createInternalTournamentRefereeAdapter,
  InternalTournamentRefereeAdapter,
} from "./InternalTournamentRefereeAdapter.js";
export {
  createOfficialTournamentRefereeAdapter,
  OfficialTournamentRefereeAdapter,
} from "./OfficialTournamentRefereeAdapter.js";
export {
  createTeamTournamentRefereeAdapter,
  TeamTournamentRefereeAdapter,
} from "./TeamTournamentRefereeAdapter.js";
