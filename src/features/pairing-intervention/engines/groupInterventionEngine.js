import { buildGroupStageSchedule } from "../../../tournament/engines/scheduleEngine.js";
import { recalculateEntries } from "./entryInterventionEngine.js";

function cloneGroups(groups = []) {
  return groups.map((group) => ({
    ...group,
    entryIds: [...(group.entryIds || [])],
    entries: [...(group.entries || [])],
  }));
}

function syncGroupEntries(groups, entries) {
  const entryMap = new Map(entries.map((entry) => [String(entry.id), entry]));

  return groups.map((group) => {
    const groupEntries = (group.entryIds || [])
      .map((id) => entryMap.get(String(id)))
      .filter(Boolean);

    return {
      ...group,
      entryIds: groupEntries.map((entry) => entry.id),
      entries: groupEntries,
    };
  });
}

function findGroupIndex(groups, groupId) {
  return groups.findIndex((group) => String(group.id) === String(groupId));
}

export function moveEntryBetweenGroups(
  groups = [],
  { entryId, fromGroupId, toGroupId },
  entries = [],
  players = [],
  options = {}
) {
  if (String(fromGroupId) === String(toGroupId)) {
    return { ok: false, errors: ["Bảng nguồn và đích giống nhau."] };
  }

  const nextGroups = cloneGroups(groups);
  const fromIndex = findGroupIndex(nextGroups, fromGroupId);
  const toIndex = findGroupIndex(nextGroups, toGroupId);

  if (fromIndex < 0 || toIndex < 0) {
    return { ok: false, errors: ["Không tìm thấy bảng nguồn hoặc đích."] };
  }

  const fromIds = nextGroups[fromIndex].entryIds || [];
  if (!fromIds.some((id) => String(id) === String(entryId))) {
    return { ok: false, errors: ["Entry không thuộc bảng nguồn."] };
  }

  nextGroups[fromIndex].entryIds = fromIds.filter((id) => String(id) !== String(entryId));
  nextGroups[toIndex].entryIds = [...(nextGroups[toIndex].entryIds || []), String(entryId)];

  const nextEntries = recalculateEntries(entries, players).map((entry) =>
    String(entry.id) === String(entryId)
      ? { ...entry, groupId: nextGroups[toIndex].id }
      : entry
  );

  const syncedGroups = syncGroupEntries(nextGroups, nextEntries);
  const schedule = buildGroupStageSchedule(syncedGroups, {
    tournamentId: options.tournamentId || "",
    eventId: options.eventId || "",
    players,
  });

  return {
    ok: true,
    entries: nextEntries,
    groups: schedule.groups,
    matches: schedule.matches,
    warnings: [],
  };
}

export function swapEntriesBetweenGroups(
  groups = [],
  { entryIdA, groupIdA, entryIdB, groupIdB },
  entries = [],
  players = [],
  options = {}
) {
  const nextGroups = cloneGroups(groups);
  const indexA = findGroupIndex(nextGroups, groupIdA);
  const indexB = findGroupIndex(nextGroups, groupIdB);

  if (indexA < 0 || indexB < 0) {
    return { ok: false, errors: ["Không tìm thấy bảng cần hoán đổi."] };
  }

  const idsA = [...(nextGroups[indexA].entryIds || [])];
  const idsB = [...(nextGroups[indexB].entryIds || [])];
  const slotA = idsA.findIndex((id) => String(id) === String(entryIdA));
  const slotB = idsB.findIndex((id) => String(id) === String(entryIdB));

  if (slotA < 0 || slotB < 0) {
    return { ok: false, errors: ["Không tìm thấy đội cần hoán đổi."] };
  }

  idsA[slotA] = String(entryIdB);
  idsB[slotB] = String(entryIdA);
  nextGroups[indexA].entryIds = idsA;
  nextGroups[indexB].entryIds = idsB;

  const nextEntries = recalculateEntries(entries, players).map((entry) => {
    if (String(entry.id) === String(entryIdA)) {
      return { ...entry, groupId: nextGroups[indexB].id };
    }
    if (String(entry.id) === String(entryIdB)) {
      return { ...entry, groupId: nextGroups[indexA].id };
    }
    return entry;
  });

  const syncedGroups = syncGroupEntries(nextGroups, nextEntries);
  const schedule = buildGroupStageSchedule(syncedGroups, {
    tournamentId: options.tournamentId || "",
    eventId: options.eventId || "",
    players,
  });

  return {
    ok: true,
    entries: nextEntries,
    groups: schedule.groups,
    matches: schedule.matches,
    warnings: [],
  };
}

export function rebuildGroupSchedule(groups = [], entries = [], players = [], options = {}) {
  const syncedGroups = syncGroupEntries(groups, recalculateEntries(entries, players));
  const schedule = buildGroupStageSchedule(syncedGroups, {
    tournamentId: options.tournamentId || "",
    eventId: options.eventId || "",
    players,
  });

  return {
    ok: true,
    entries: recalculateEntries(entries, players),
    groups: schedule.groups,
    matches: schedule.matches,
    warnings: [],
  };
}
