/**
 * Internal Tournament competition unit (IT-E2E-BROWSER-013).
 *
 * Doubles formats compete as TEAM/PAIR.
 * Singles formats compete as PLAYER.
 * Groups must contain competition-unit identities, never flattened athletes
 * copied out of confirmed pairs.
 */
import { isSingleEventType } from "../../../tournament/engines/officialTournamentEngine.js";
import { suggestEntriesFromPlayers } from "../../../tournament/engines/teamPairingEngine.js";

export const COMPETITION_UNIT = Object.freeze({
  PLAYER: "PLAYER",
  TEAM: "TEAM",
});

export const INTERNAL_TEAM_ID_FIELD = "id";
export const INTERNAL_TEAM_MEMBER_IDS_FIELD = "playerIds";
export const INTERNAL_TEAM_DISPLAY_NAME_RULE = "memberNames.join(' / ')";
export const INTERNAL_TEAM_RATING_OR_SEED_FIELD = "rating|seed";

export function resolveInternalCompetitionUnit(eventType) {
  return isSingleEventType(eventType)
    ? COMPETITION_UNIT.PLAYER
    : COMPETITION_UNIT.TEAM;
}

export function listEntryPlayerIds(entry) {
  if (Array.isArray(entry?.playerIds)) {
    return entry.playerIds.map((id) => String(id || "").trim()).filter(Boolean);
  }
  if (entry?.playerId) return [String(entry.playerId).trim()].filter(Boolean);
  return [];
}

export function isTeamCompetitionEntry(entry) {
  return listEntryPlayerIds(entry).length === 2;
}

export function isPlayerCompetitionEntry(entry) {
  return listEntryPlayerIds(entry).length === 1;
}

export function entriesMatchCompetitionUnit(entries = [], unit) {
  const list = Array.isArray(entries) ? entries.filter(Boolean) : [];
  if (!list.length) return false;
  if (unit === COMPETITION_UNIT.TEAM) return list.every(isTeamCompetitionEntry);
  if (unit === COMPETITION_UNIT.PLAYER) return list.every(isPlayerCompetitionEntry);
  return false;
}

function groupingErrorForUnit(unit) {
  return unit === COMPETITION_UNIT.TEAM
    ? "Không tạo được cặp/đội để chia bảng. Kiểm tra giới tính và số VĐV đã chọn."
    : "Không tạo được danh sách VĐV để chia bảng.";
}

/**
 * Confirmed pairs (preview) win when they already match the content-mode unit.
 * Otherwise rebuild from selected athletes using the pairing engine — never
 * snake-seed raw athlete IDs for doubles.
 */
export function resolveInternalGroupingEntries({
  eventType,
  previewEntries = [],
  selectedPlayers = [],
  pairingOptions = {},
} = {}) {
  const unit = resolveInternalCompetitionUnit(eventType);
  const preview = Array.isArray(previewEntries) ? previewEntries.filter(Boolean) : [];

  if (entriesMatchCompetitionUnit(preview, unit)) {
    return {
      ok: true,
      unit,
      entries: preview,
      source: "confirmed_preview",
      error: null,
    };
  }

  const rebuilt = suggestEntriesFromPlayers(
    selectedPlayers,
    eventType,
    pairingOptions
  );
  if (!entriesMatchCompetitionUnit(rebuilt, unit)) {
    return {
      ok: false,
      unit,
      entries: [],
      source: "rebuild_failed",
      error: groupingErrorForUnit(unit),
    };
  }

  return {
    ok: true,
    unit,
    entries: rebuilt,
    source: preview.length ? "rebuilt_unit_mismatch" : "rebuilt",
    error: null,
  };
}

export function resolveGroupCompetitionEntries(group, event = null) {
  if (Array.isArray(group?.entries) && group.entries.length > 0) {
    return group.entries.filter(Boolean);
  }
  const byId = new Map(
    (event?.entries || []).map((entry) => [String(entry?.id || ""), entry])
  );
  return (group?.entryIds || [])
    .map((id) => byId.get(String(id)))
    .filter(Boolean);
}

export function inspectInternalGroupCompetitionUnit(group, event = null) {
  const members = resolveGroupCompetitionEntries(group, event);
  const athleteIds = [];
  const seenAthletes = new Set();
  for (const entry of members) {
    for (const playerId of listEntryPlayerIds(entry)) {
      if (seenAthletes.has(playerId)) continue;
      seenAthletes.add(playerId);
      athleteIds.push(playerId);
    }
  }
  const teamShaped = members.length > 0 && members.every(isTeamCompetitionEntry);
  const playerShaped = members.length > 0 && members.every(isPlayerCompetitionEntry);
  const memberUnit = teamShaped
    ? COMPETITION_UNIT.TEAM
    : playerShaped
      ? COMPETITION_UNIT.PLAYER
      : members.length
        ? "MIXED"
        : "EMPTY";

  return {
    memberCount: members.length,
    memberUnit,
    teamCount: members.length,
    athleteCount: athleteIds.length,
    teamIds: members.map((entry) => String(entry.id || "")),
    athleteIds,
  };
}

export function inspectInternalGroupedCompetitionUnits(groups = [], event = null) {
  const inspected = (groups || []).map((group) =>
    inspectInternalGroupCompetitionUnit(group, event)
  );
  const teamIds = [];
  const athleteIds = [];
  const seenTeams = new Set();
  const seenAthletes = new Set();
  for (const item of inspected) {
    for (const teamId of item.teamIds) {
      if (!teamId || seenTeams.has(teamId)) continue;
      seenTeams.add(teamId);
      teamIds.push(teamId);
    }
    for (const athleteId of item.athleteIds) {
      if (!athleteId || seenAthletes.has(athleteId)) continue;
      seenAthletes.add(athleteId);
      athleteIds.push(athleteId);
    }
  }
  return {
    groups: inspected,
    totalUniqueTeamCount: teamIds.length,
    totalUniqueAthleteCount: athleteIds.length,
  };
}

export function formatInternalGroupUnitChip(group, eventType, event = null) {
  const inspected = inspectInternalGroupCompetitionUnit(group, event);
  return `${inspected.teamCount} đội`;
}

export function projectInternalGroupDrawCard(group, eventType, event = null) {
  const unit = resolveInternalCompetitionUnit(eventType);
  const inspected = inspectInternalGroupCompetitionUnit(group, event);
  const members = resolveGroupCompetitionEntries(group, event);
  return {
    unit,
    teamCount: inspected.teamCount,
    athleteCount: inspected.athleteCount,
    chipLabel: formatInternalGroupUnitChip(group, eventType, event),
    athleteCountLabel:
      unit === COMPETITION_UNIT.TEAM && inspected.athleteCount > 0
        ? `${inspected.athleteCount} VĐV`
        : "",
    teamLabels: members.map((entry) => String(entry?.name || entry?.id || "").trim()).filter(Boolean),
  };
}
