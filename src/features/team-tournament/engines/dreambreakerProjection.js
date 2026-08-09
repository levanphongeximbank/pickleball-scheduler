/**
 * Presentation-only Dreambreaker projection.
 * Never creates durable activation state — that belongs to cloud RPCs.
 */

import { normalizeDreambreakerState, normalizeTeamData } from "../models/index.js";

/**
 * Merge top-level get_setup `teamData.dreambreaker[matchupId]` onto each matchup.
 * Existing matchup.dreambreaker wins field-by-field only when already present;
 * persisted map fills gaps.
 *
 * @param {object} teamData
 * @returns {object}
 */
export function attachPersistedDreambreakerProjection(teamData) {
  if (!teamData || typeof teamData !== "object") {
    return teamData;
  }

  const persistedMap =
    teamData.dreambreaker && typeof teamData.dreambreaker === "object"
      ? teamData.dreambreaker
      : {};

  const matchups = (teamData.matchups || []).map((matchup) => {
    const matchupId = String(matchup?.id || "").trim();
    const fromMap = matchupId ? persistedMap[matchupId] : null;
    if (!fromMap && !matchup?.dreambreaker) {
      return matchup;
    }

    const merged = normalizeDreambreakerState({
      ...(fromMap && typeof fromMap === "object" ? fromMap : {}),
      ...(matchup.dreambreaker && typeof matchup.dreambreaker === "object"
        ? matchup.dreambreaker
        : {}),
      matchupId: matchupId || fromMap?.matchupId || "",
    });

    if (!merged) {
      return matchup;
    }

    return {
      ...matchup,
      dreambreaker: merged,
    };
  });

  return normalizeTeamData({
    ...teamData,
    matchups,
    dreambreaker: persistedMap,
  });
}
