/**
 * Daily Play "Lọc VĐV" is a presentation / bulk-selection scope.
 * It must not mutate check-in, matches, leases, or revision.
 * Fair Match composition stays on matchType + checked-in presence.
 */

import {
  DAILY_GENDER_FILTER,
  filterPlayersByGender,
} from "../../../tournament/engines/dailyPlayEngine.js";

export function projectDailyPlayerFilterView({
  players = [],
  checkedInPlayerIds = [],
  genderFilter = DAILY_GENDER_FILTER.ALL,
} = {}) {
  const visiblePlayers = filterPlayersByGender(players, genderFilter);
  const checkedSet = new Set((checkedInPlayerIds || []).map(String));
  const visibleCheckedPlayerIds = visiblePlayers
    .map((player) => String(player.id))
    .filter((id) => checkedSet.has(id));

  return {
    genderFilter,
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
