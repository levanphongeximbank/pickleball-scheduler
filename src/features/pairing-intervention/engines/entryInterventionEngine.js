import { getPlayerGenderKey } from "../../../models/player.js";
import { EVENT_TYPE } from "../../../models/tournament/constants.js";
import { createEntryRecord, normalizeEntries } from "../../../models/tournament/entry.js";
import {
  calculateEntryRating,
  filterPlayersForEventType,
} from "../../../tournament/engines/teamPairingEngine.js";

function playerMapFrom(players = []) {
  return new Map(players.map((player) => [String(player.id), player]));
}

function buildEntryName(entry, playersById) {
  const names = (entry.playerIds || [])
    .map((id) => playersById.get(String(id))?.name)
    .filter(Boolean);
  return names.join(" / ") || entry.name || "Đội chưa đặt tên";
}

function buildEntryId(playerIds = []) {
  const ids = playerIds.map(String).filter(Boolean).sort();
  return ids.length ? ids.join("|") : "";
}

export function recalculateEntry(entry, players = []) {
  const playersById = playerMapFrom(players);
  const playerIds = (entry.playerIds || []).map(String).filter(Boolean);
  const rating = Math.round(calculateEntryRating({ ...entry, playerIds }, players) * 100) / 100;

  return {
    ...entry,
    playerIds,
    name: buildEntryName({ ...entry, playerIds }, playersById),
    rating,
    id: buildEntryId(playerIds) || entry.id,
  };
}

export function recalculateEntries(entries = [], players = []) {
  return normalizeEntries(entries.map((entry) => recalculateEntry(entry, players)));
}

function isSingleEventType(eventType) {
  return eventType === EVENT_TYPE.MEN_SINGLE || eventType === EVENT_TYPE.WOMEN_SINGLE;
}

function expectedTeamSize(eventType) {
  return isSingleEventType(eventType) ? 1 : 2;
}

export function validateEntryForEventType(entry, players = [], eventType) {
  const playersById = playerMapFrom(players);
  const members = (entry.playerIds || [])
    .map((id) => playersById.get(String(id)))
    .filter(Boolean);
  const errors = [];
  const teamSize = expectedTeamSize(eventType);

  if (members.length !== teamSize) {
    errors.push(`Cặp/đội cần ${teamSize} VĐV, hiện có ${members.length}.`);
  }

  if (eventType === EVENT_TYPE.MEN_DOUBLE || eventType === EVENT_TYPE.MEN_SINGLE) {
    if (members.some((player) => getPlayerGenderKey(player.gender) !== "male")) {
      errors.push("Nội dung đơn/đôi nam chỉ được có VĐV nam.");
    }
  }

  if (eventType === EVENT_TYPE.WOMEN_DOUBLE || eventType === EVENT_TYPE.WOMEN_SINGLE) {
    if (members.some((player) => getPlayerGenderKey(player.gender) !== "female")) {
      errors.push("Nội dung đơn/đôi nữ chỉ được có VĐV nữ.");
    }
  }

  if (eventType === EVENT_TYPE.MIXED_DOUBLE) {
    const genders = members.map((player) => getPlayerGenderKey(player.gender));
    const maleCount = genders.filter((gender) => gender === "male").length;
    const femaleCount = genders.filter((gender) => gender === "female").length;
    if (maleCount !== 1 || femaleCount !== 1) {
      errors.push("Đôi hỗn hợp cần đúng 1 nam và 1 nữ.");
    }
  }

  const allowed = filterPlayersForEventType(members, eventType);
  if (allowed.length !== members.length) {
    errors.push("Có VĐV không phù hợp với nội dung thi đấu.");
  }

  return { ok: errors.length === 0, errors };
}

export function validateAllEntries(entries = [], players = [], eventType) {
  const errors = [];
  const seen = new Set();

  entries.forEach((entry, index) => {
    const result = validateEntryForEventType(entry, players, eventType);
    if (!result.ok) {
      errors.push(`Đội ${index + 1} (${entry.name}): ${result.errors.join(" ")}`);
    }

    (entry.playerIds || []).forEach((playerId) => {
      const key = String(playerId);
      if (seen.has(key)) {
        errors.push(`VĐV ${key} xuất hiện ở nhiều cặp/đội.`);
      }
      seen.add(key);
    });
  });

  return { ok: errors.length === 0, errors };
}

function findEntryIndex(entries, entryId) {
  return entries.findIndex((entry) => String(entry.id) === String(entryId));
}

export function swapPlayersBetweenEntries(
  entries = [],
  { entryIdA, playerIdA, entryIdB, playerIdB },
  players = [],
  eventType
) {
  const next = entries.map((entry) => ({
    ...entry,
    playerIds: [...(entry.playerIds || [])],
  }));
  const indexA = findEntryIndex(next, entryIdA);
  const indexB = findEntryIndex(next, entryIdB);

  if (indexA < 0 || indexB < 0) {
    return { ok: false, errors: ["Không tìm thấy cặp/đội cần đổi."] };
  }

  const slotA = next[indexA].playerIds.findIndex((id) => String(id) === String(playerIdA));
  const slotB = next[indexB].playerIds.findIndex((id) => String(id) === String(playerIdB));

  if (slotA < 0 || slotB < 0) {
    return { ok: false, errors: ["Không tìm thấy VĐV trong cặp/đội."] };
  }

  const temp = next[indexA].playerIds[slotA];
  next[indexA].playerIds[slotA] = next[indexB].playerIds[slotB];
  next[indexB].playerIds[slotB] = temp;

  const recalculated = recalculateEntries(next, players);
  const validation = validateAllEntries(recalculated, players, eventType);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors };
  }

  return { ok: true, entries: recalculated, warnings: [] };
}

export function movePlayerToEntry(
  entries = [],
  { playerId, fromEntryId, toEntryId },
  players = [],
  eventType
) {
  const next = entries.map((entry) => ({
    ...entry,
    playerIds: [...(entry.playerIds || [])],
  }));
  const fromIndex = findEntryIndex(next, fromEntryId);
  const toIndex = findEntryIndex(next, toEntryId);

  if (fromIndex < 0 || toIndex < 0) {
    return { ok: false, errors: ["Không tìm thấy cặp/đội nguồn hoặc đích."] };
  }

  const fromSlot = next[fromIndex].playerIds.findIndex((id) => String(id) === String(playerId));
  if (fromSlot < 0) {
    return { ok: false, errors: ["Không tìm thấy VĐV trong cặp/đội nguồn."] };
  }

  const teamSize = expectedTeamSize(eventType);
  if (next[toIndex].playerIds.length >= teamSize) {
    return { ok: false, errors: ["Cặp/đội đích đã đủ số VĐV."] };
  }

  next[fromIndex].playerIds.splice(fromSlot, 1);
  next[toIndex].playerIds.push(String(playerId));

  let filtered = next.filter((entry) => (entry.playerIds || []).length > 0);
  const recalculated = recalculateEntries(filtered, players);
  const validation = validateAllEntries(recalculated, players, eventType);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors };
  }

  return { ok: true, entries: recalculated, warnings: [] };
}

export function dissolveEntry(entries = [], entryId, players = [], eventType, options = {}) {
  const next = entries
    .map((entry) => ({
      ...entry,
      playerIds: [...(entry.playerIds || [])],
    }))
    .filter((entry) => String(entry.id) !== String(entryId));

  const dissolved = entries.find((entry) => String(entry.id) === String(entryId));
  if (!dissolved) {
    return { ok: false, errors: ["Không tìm thấy cặp/đội cần giải tán."] };
  }

  const unpairedPlayerIds = [...(dissolved.playerIds || [])];
  const recalculated = recalculateEntries(next, players);

  return {
    ok: true,
    entries: recalculated,
    unpairedPlayerIds,
    warnings: unpairedPlayerIds.length
      ? [`${unpairedPlayerIds.length} VĐV chưa được ghép lại.`]
      : [],
    tournamentId: options.tournamentId || dissolved.tournamentId || "",
    eventId: options.eventId || dissolved.eventId || "",
  };
}

export function createEntryFromPlayer(player, options = {}) {
  return createEntryRecord({
    id: `entry-${player.id}`,
    tournamentId: options.tournamentId || "",
    eventId: options.eventId || "",
    name: player.name,
    playerIds: [String(player.id)],
    rating: Number(player.rating ?? player.level ?? 3.5),
    seed: null,
    status: "active",
  });
}
