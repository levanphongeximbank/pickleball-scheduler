import { createGroupRecord } from "../../models/tournament/group.js";
import { PAIR_TYPE, PLAYER_TYPE } from "../../models/tournament/constants.js";
import { summarizeGroupBalance } from "./seededGroupEngine.js";

function shuffleArray(items, randomFn = Math.random) {
  const array = [...items];

  for (let index = array.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(randomFn() * (index + 1));
    const temp = array[index];
    array[index] = array[swapIndex];
    array[swapIndex] = temp;
  }

  return array;
}

function getGroupLabel(index) {
  if (index >= 0 && index < 26) {
    return String.fromCharCode(65 + index);
  }

  return `G${index + 1}`;
}

function computeTargetSizes(entryCount, groupCount) {
  const safeCount = Math.max(0, Number(entryCount) || 0);
  const safeGroups = Math.max(1, Number(groupCount) || 1);
  const base = Math.floor(safeCount / safeGroups);
  const remainder = safeCount % safeGroups;

  return Array.from({ length: safeGroups }, (_, index) => base + (index < remainder ? 1 : 0));
}

function normalizePlayersById(playersById = new Map()) {
  if (playersById instanceof Map) {
    return playersById;
  }

  return new Map((playersById || []).map((player) => [String(player.id), player]));
}

export function getEntryClub(entry, playersById = new Map()) {
  if (entry?.clubName) {
    return String(entry.clubName).trim();
  }

  if (entry?.representativeClubName) {
    return String(entry.representativeClubName).trim();
  }

  const firstPlayer = (entry?.playerIds || [])
    .map((id) => playersById.get(String(id)))
    .find(Boolean);

  return String(firstPlayer?.clubName || "Khong ro CLB").trim();
}

export function getEntryUnit(entry, playersById = new Map()) {
  if (entry?.unitName) {
    return String(entry.unitName).trim();
  }

  const firstPlayer = (entry?.playerIds || [])
    .map((id) => playersById.get(String(id)))
    .find(Boolean);

  return String(firstPlayer?.unitName || "").trim();
}

export function isHostEntry(entry, hostClubName = "", playersById = new Map()) {
  const host = String(hostClubName || "").trim();
  if (!host) {
    return false;
  }

  return getEntryClub(entry, playersById) === host;
}

export function isVisitorEntry(entry, playersById = new Map()) {
  if (entry?.pairType === PAIR_TYPE.VISITOR_PAIR) {
    return true;
  }

  return (entry?.playerIds || []).some((playerId) => {
    const player = playersById.get(String(playerId));
    const type = String(player?.playerType || "").toLowerCase();
    return (
      type === PLAYER_TYPE.GUEST ||
      type === PLAYER_TYPE.VISITOR ||
      type === PLAYER_TYPE.EXTERNAL
    );
  });
}

function createMutableGroups(groupCount, targetSizes) {
  return Array.from({ length: groupCount }, (_, index) => ({
    label: getGroupLabel(index),
    entries: [],
    targetSize: targetSizes[index] || 0,
  }));
}

function calculatePlacementPenalty(entry, group, options = {}) {
  const playersById = options.playersById || new Map();
  const splitUnits = options.splitUnits !== false;
  let penalty = 0;

  const club = getEntryClub(entry, playersById);
  const unit = getEntryUnit(entry, playersById);
  const host = isHostEntry(entry, options.hostClubName, playersById);
  const visitor = isVisitorEntry(entry, playersById);

  group.entries.forEach((existing) => {
    if (getEntryClub(existing, playersById) === club) {
      penalty += 12;
    }

    if (splitUnits && unit && getEntryUnit(existing, playersById) === unit) {
      penalty += 8;
    }

    if (host && isHostEntry(existing, options.hostClubName, playersById)) {
      penalty += 6;
    }

    if (visitor && isVisitorEntry(existing, playersById)) {
      penalty += 4;
    }
  });

  penalty += Math.max(0, group.entries.length - group.targetSize) * 20;
  return penalty;
}

function tryAssignEntries(shuffledEntries, groupCount, targetSizes, options = {}) {
  const groups = createMutableGroups(groupCount, targetSizes);
  let score = 0;

  shuffledEntries.forEach((entry) => {
    let bestIndex = -1;
    let bestPenalty = Infinity;

    groups.forEach((group, index) => {
      if (group.entries.length >= group.targetSize) {
        return;
      }

      const penalty = calculatePlacementPenalty(entry, group, options);
      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        bestIndex = index;
      }
    });

    if (bestIndex < 0) {
      bestIndex = groups.reduce((smallest, group, index) => {
        if (groups[smallest].entries.length > group.entries.length) {
          return index;
        }
        return smallest;
      }, 0);
      score += 1000;
      bestPenalty = calculatePlacementPenalty(entry, groups[bestIndex], options);
    }

    groups[bestIndex].entries.push(entry);
    score += bestPenalty;
  });

  return { groups, score };
}

export function analyzeOpenDrawWarnings(groups = [], entries = [], options = {}) {
  const warnings = [];
  const playersById = normalizePlayersById(options.playersById);
  const groupCount = groups.length || 1;
  const clubCounts = {};

  entries.forEach((entry) => {
    const club = getEntryClub(entry, playersById);
    clubCounts[club] = (clubCounts[club] || 0) + 1;
  });

  Object.entries(clubCounts).forEach(([club, count]) => {
    if (count > groupCount * 2) {
      warnings.push(
        `Khong the tach deu ${club} vi so luong cap cua CLB nay qua nhieu so voi so bang. App da phan bo deu nhat co the.`
      );
      return;
    }

    const idealPerGroup = Math.ceil(count / groupCount);
    const overloadedGroups = groups.filter((group) => {
      const sameClubCount = (group.entries || []).filter(
        (entry) => getEntryClub(entry, playersById) === club
      ).length;
      return sameClubCount > idealPerGroup;
    });

    if (overloadedGroups.length > 0) {
      warnings.push(
        `Khong the tach deu ${club} vi so luong cap cua CLB nay qua nhieu so voi so bang. App da phan bo deu nhat co the.`
      );
    }
  });

  if (options.splitUnits !== false) {
    const unitCounts = {};
    entries.forEach((entry) => {
      const unit = getEntryUnit(entry, playersById);
      if (!unit) {
        return;
      }
      unitCounts[unit] = (unitCounts[unit] || 0) + 1;
    });

    Object.entries(unitCounts).forEach(([unit, count]) => {
      if (count <= groupCount) {
        return;
      }

      const idealPerGroup = Math.ceil(count / groupCount);
      const overloaded = groups.some((group) => {
        const sameUnitCount = (group.entries || []).filter(
          (entry) => getEntryUnit(entry, playersById) === unit
        ).length;
        return sameUnitCount > idealPerGroup;
      });

      if (overloaded) {
        warnings.push(
          `Khong the tach deu don vi ${unit} tren tat ca cac bang. App da phan bo deu nhat co the.`
        );
      }
    });
  }

  return [...new Set(warnings)];
}

function toGroupRecords(mutableGroups, options = {}) {
  return mutableGroups.map((group, index) =>
    createGroupRecord({
      id: `group-${group.label}-${Date.now()}-${index}`,
      label: group.label,
      name: `Bang ${group.label}`,
      entryIds: group.entries.map((entry) => entry.id),
      entries: group.entries,
      matches: [],
      standings: [],
      pointsConfig: options.pointsConfig || {
        win: 2,
        loss: 1,
        forfeit: 0,
      },
    })
  );
}

export function assignEntriesOpenConditional(entries = [], groupCount = 4, options = {}) {
  const safeEntries = Array.isArray(entries) ? entries.filter(Boolean) : [];
  const safeGroupCount = Math.max(1, Number(groupCount) || 1);
  const randomFn = typeof options.randomFn === "function" ? options.randomFn : Math.random;
  const playersById = normalizePlayersById(options.playersById);
  const attempts = Math.max(1, Number(options.attempts) || 48);
  const targetSizes = computeTargetSizes(safeEntries.length, safeGroupCount);

  if (safeEntries.length < 2) {
    return {
      ok: false,
      errors: ["Can it nhat 2 doi/VDV de chia bang open."],
      warnings: [],
    };
  }

  if (safeGroupCount > safeEntries.length) {
    return {
      ok: false,
      errors: ["So bang khong duoc lon hon so doi/VDV."],
      warnings: [],
    };
  }

  const drawOptions = {
    ...options,
    playersById,
  };

  let bestGroups = null;
  let bestScore = Infinity;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const shuffled = shuffleArray(safeEntries, randomFn);
    const result = tryAssignEntries(shuffled, safeGroupCount, targetSizes, drawOptions);

    if (result.score < bestScore) {
      bestScore = result.score;
      bestGroups = result.groups;
    }
  }

  const groups = toGroupRecords(bestGroups, options);
  const balance = summarizeGroupBalance(groups);
  const warnings = analyzeOpenDrawWarnings(bestGroups, safeEntries, drawOptions);

  return {
    ok: true,
    groups,
    warnings,
    balance,
    score: bestScore,
    targetSizes,
  };
}
