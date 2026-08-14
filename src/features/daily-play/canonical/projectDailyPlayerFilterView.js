/**
 * Daily Play visible check-in pool follows Loại trận only.
 * Switching match type is presentation/selection context — it must not
 * mutate check-in, matches, leases, or revision.
 *
 * Deferred to final Daily Play closure (not in PR #422):
 * men_single, women_single, open_double.
 */

import { getPlayerGenderKey } from "../../../models/player.js";
import {
  DAILY_GENDER_FILTER,
  DAILY_MATCH_TYPE,
  filterPlayersByGender,
} from "../../../tournament/engines/dailyPlayEngine.js";

export const DAILY_PLAY_DEFERRED_MATCH_TYPES = Object.freeze({
  MEN_SINGLE: "men_single",
  WOMEN_SINGLE: "women_single",
  OPEN_DOUBLE: "open_double",
});

export function resolveDailyVisibleGenderScope(matchType) {
  if (matchType === DAILY_MATCH_TYPE.MEN_DOUBLE) {
    return DAILY_GENDER_FILTER.MALE;
  }
  if (matchType === DAILY_MATCH_TYPE.WOMEN_DOUBLE) {
    return DAILY_GENDER_FILTER.FEMALE;
  }
  return "binary";
}

export function filterPlayersForDailyMatchType(players = [], matchType) {
  const scope = resolveDailyVisibleGenderScope(matchType);
  if (scope === DAILY_GENDER_FILTER.MALE || scope === DAILY_GENDER_FILTER.FEMALE) {
    return filterPlayersByGender(players, scope);
  }
  return players.filter((player) => {
    const key = getPlayerGenderKey(player.gender);
    return key === "male" || key === "female";
  });
}

export function projectDailyPlayerFilterView({
  players = [],
  checkedInPlayerIds = [],
  matchType = DAILY_MATCH_TYPE.MIXED_DOUBLE,
} = {}) {
  const visiblePlayers = filterPlayersForDailyMatchType(players, matchType);
  const checkedSet = new Set((checkedInPlayerIds || []).map(String));
  const visibleCheckedPlayerIds = visiblePlayers
    .map((player) => String(player.id))
    .filter((id) => checkedSet.has(id));

  return {
    matchType,
    visiblePlayers,
    visibleCheckedPlayerIds,
    visibleCheckedCount: visibleCheckedPlayerIds.length,
    visiblePlayerCount: visiblePlayers.length,
  };
}

export function countVisiblePresentedChecked(view, presentedCheckedSet) {
  const presented = presentedCheckedSet instanceof Set
    ? presentedCheckedSet
    : new Set([...(presentedCheckedSet || [])].map(String));
  return (view?.visiblePlayers || []).filter((player) =>
    presented.has(String(player.id))
  ).length;
}

export function listVisibleBulkCheckInTargets(view, checkedInPlayerIds) {
  const checkedSet = new Set(
    (checkedInPlayerIds || view?.visibleCheckedPlayerIds || []).map(String)
  );
  return (view?.visiblePlayers || [])
    .map((player) => String(player.id))
    .filter((id) => !checkedSet.has(id));
}

export function listVisibleBulkCheckOutTargets(view) {
  return [...(view?.visibleCheckedPlayerIds || [])];
}
