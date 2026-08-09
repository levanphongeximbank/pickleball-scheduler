import { filterPlayersForEventType } from "../tournament/engines/teamPairingEngine.js";
import { athleteGenderDisplayLabel, getPlayerSkillLevel } from "../models/player.js";
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
    levelRange: [1.0, 8.0],
    statusFilter: "all",
  });

  if (eventType) {
    result = filterPlayersForEventType(result, eventType);
  }

  return result;
}

export function formatPlayerPickerMeta(player, showSkillLevel = false) {
  const gender = athleteGenderDisplayLabel(player);
  const club = player?.clubName || "";

  if (!showSkillLevel) {
    return club ? `${gender} • ${club}` : gender;
  }

  const rating = Number(getPlayerSkillLevel(player)).toFixed(1);
  return club ? `${gender} • ${rating} • ${club}` : `${gender} • ${rating}`;
}

/**
 * Official Open doubles pair-pick: single state authority for VĐV1 / VĐV2.
 * Click toggles off if already selected; otherwise fills A then B; never both same id.
 */
export function applyOfficialPairPlayerPick({
  pairPlayerAId = "",
  pairPlayerBId = "",
  playerId = "",
} = {}) {
  const id = String(playerId || "").trim();
  const a = String(pairPlayerAId || "").trim();
  const b = String(pairPlayerBId || "").trim();

  if (!id) {
    return { pairPlayerAId: a, pairPlayerBId: b };
  }

  if (id === a) {
    return { pairPlayerAId: "", pairPlayerBId: b };
  }

  if (id === b) {
    return { pairPlayerAId: a, pairPlayerBId: "" };
  }

  if (!a) {
    return { pairPlayerAId: id, pairPlayerBId: b === id ? "" : b };
  }

  if (!b) {
    return { pairPlayerAId: a, pairPlayerBId: id };
  }

  // Both filled: replace B (never allow A === B).
  return { pairPlayerAId: a, pairPlayerBId: id };
}

/** Exclude one athlete id from Select/list options (VĐV1 vs VĐV2). */
export function excludePlayerIdFromOptions(players = [], excludePlayerId = "") {
  const exclude = String(excludePlayerId || "").trim();
  if (!exclude) return Array.isArray(players) ? players : [];
  return (players || []).filter((player) => String(player?.id) !== exclude);
}

export function buildOfficialPickerCountCaption({
  filteredCount = 0,
  totalCount = 0,
  showPlayerList = true,
} = {}) {
  const filtered = Number(filteredCount) || 0;
  const total = Number(totalCount) || 0;
  if (showPlayerList) {
    return `${filtered}/${total} VĐV hiển thị`;
  }
  return `${filtered}/${total} VĐV phù hợp`;
}
