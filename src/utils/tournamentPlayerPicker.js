import { filterPlayersForEventType } from "../tournament/engines/teamPairingEngine.js";
import { filterPlayers } from "./playerHelpers.js";

export const ALL_CLUBS_FILTER = "__all__";

export function filterTournamentPickerPlayers(players = [], filters = {}) {
  const {
    clubFilter = ALL_CLUBS_FILTER,
    genderFilter = "all",
    search = "",
    eventType = null,
    excludePlayerIds = [],
  } = filters;

  const excluded = new Set((excludePlayerIds || []).map(String));
  let result = players.filter((player) => !excluded.has(String(player.id)));

  if (clubFilter && clubFilter !== ALL_CLUBS_FILTER) {
    result = result.filter((player) => String(player.sourceClubId) === String(clubFilter));
  }

  result = filterPlayers(result, {
    search,
    genderFilter,
    levelRange: [1.5, 6],
    statusFilter: "all",
  });

  if (eventType) {
    result = filterPlayersForEventType(result, eventType);
  }

  return result;
}

export function formatPlayerPickerMeta(player) {
  const gender = player?.gender || "?";
  const rating = player?.rating ?? player?.level ?? "-";
  const club = player?.clubName || "";
  return club ? `${gender} • ${rating} • ${club}` : `${gender} • ${rating}`;
}
