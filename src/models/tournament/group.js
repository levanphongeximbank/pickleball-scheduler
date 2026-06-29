import { normalizeEntries } from "./entry.js";
import { normalizeMatches } from "./match.js";
import { DEFAULT_GROUP_POINTS } from "./constants.js";

export function normalizeGroup(group, index = 0) {
  if (!group || group.id === undefined || group.id === null) {
    return null;
  }

  const label =
    group.label || group.name || String.fromCharCode(65 + index);

  return {
    ...group,
    id: String(group.id).trim(),
    tournamentId: group.tournamentId ? String(group.tournamentId).trim() : "",
    eventId: group.eventId ? String(group.eventId).trim() : "",
    label: String(label).trim(),
    name: String(group.name || label).trim(),
    entryIds: Array.isArray(group.entryIds)
      ? group.entryIds.map((id) => String(id).trim()).filter(Boolean)
      : [],
    entries: normalizeEntries(group.entries || []),
    matches: normalizeMatches(group.matches || []),
    standings: Array.isArray(group.standings) ? group.standings : [],
    pointsConfig: {
      win: Number(group.pointsConfig?.win ?? DEFAULT_GROUP_POINTS.win),
      loss: Number(group.pointsConfig?.loss ?? DEFAULT_GROUP_POINTS.loss),
      forfeit: Number(group.pointsConfig?.forfeit ?? DEFAULT_GROUP_POINTS.forfeit),
    },
    warnings: Array.isArray(group.warnings) ? group.warnings : [],
    locked: group.locked === true,
  };
}

export function normalizeGroups(groups = []) {
  if (!Array.isArray(groups)) {
    return [];
  }

  return groups
    .map((group, index) => normalizeGroup(group, index))
    .filter(Boolean);
}

export function createGroupRecord(options = {}) {
  const label = options.label || options.name || "A";
  return normalizeGroup({
    id: options.id || `group-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    tournamentId: options.tournamentId || "",
    eventId: options.eventId || "",
    label,
    name: options.name || `Bảng ${label}`,
    entryIds: options.entryIds || [],
    entries: options.entries || [],
    matches: options.matches || [],
    standings: options.standings || [],
    pointsConfig: options.pointsConfig || DEFAULT_GROUP_POINTS,
    warnings: options.warnings || [],
    locked: options.locked === true,
  });
}
