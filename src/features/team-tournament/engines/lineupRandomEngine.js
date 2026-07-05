import { LINEUP_SOURCE, LINEUP_STATUS, GENDER_REQUIREMENT } from "../constants.js";
import { getPlayerGenderKey } from "../../../models/player.js";
import {
  findTeam,
  lineupKey,
  normalizeLineup,
  normalizeTeamData,
} from "../models/index.js";
import { validateDisciplineSelection } from "./lineupValidationEngine.js";

function shuffle(array = []) {
  const copy = [...array];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function sortByAppearanceCount(playerIds, appearanceCounts) {
  return [...playerIds].sort((left, right) => {
    const leftCount = appearanceCounts.get(String(left)) || 0;
    const rightCount = appearanceCounts.get(String(right)) || 0;
    if (leftCount !== rightCount) {
      return leftCount - rightCount;
    }
    return String(left).localeCompare(String(right));
  });
}

function matchesGenderRequirement(player, requirement) {
  const gender = getPlayerGenderKey(player.gender);

  if (requirement === GENDER_REQUIREMENT.MALE) {
    return gender === "male";
  }

  if (requirement === GENDER_REQUIREMENT.FEMALE) {
    return gender === "female";
  }

  return true;
}

function eligiblePlayersForDiscipline(team, discipline, players, usedPlayerIds, allowReuse) {
  const playersById = new Map(players.map((player) => [String(player.id), player]));

  return team.playerIds.filter((playerId) => {
    if (!allowReuse && usedPlayerIds.has(String(playerId))) {
      return false;
    }

    if (team.absentPlayerIds?.includes(String(playerId)) ||
      team.lockedPlayerIds?.includes(String(playerId))) {
      return false;
    }

    const player = playersById.get(String(playerId));
    if (!player) {
      return false;
    }

    if (!matchesGenderRequirement(player, discipline.genderRequirement)) {
      return false;
    }

    if (discipline.playerCount === 1) {
      return validateDisciplineSelection({
        team,
        discipline,
        playerIds: [playerId],
        players,
        usedPlayerIds,
        allowReuse: true,
      }).ok;
    }

    return true;
  });
}

function combinations(values, size) {
  if (size <= 0) {
    return [[]];
  }

  if (values.length < size) {
    return [];
  }

  if (size === 1) {
    return values.map((value) => [value]);
  }

  const results = [];
  values.forEach((head, index) => {
    const tailCombos = combinations(values.slice(index + 1), size - 1);
    tailCombos.forEach((combo) => {
      results.push([head, ...combo]);
    });
  });
  return results;
}

function pickPlayersForDiscipline({
  team,
  discipline,
  players,
  usedPlayerIds,
  appearanceCounts,
  allowReuse,
}) {
  const candidates = eligiblePlayersForDiscipline(
    team,
    discipline,
    players,
    usedPlayerIds,
    allowReuse
  );

  const ranked = sortByAppearanceCount(shuffle(candidates), appearanceCounts);
  const combos = combinations(ranked, discipline.playerCount);

  for (const combo of combos) {
    const validation = validateDisciplineSelection({
      team,
      discipline,
      playerIds: combo,
      players,
      usedPlayerIds,
      allowReuse,
    });

    if (validation.ok) {
      return { ok: true, playerIds: validation.playerIds };
    }
  }

  return {
    ok: false,
    error: `${discipline.name}: không đủ VĐV hợp lệ để random.`,
  };
}

export function randomizeMissingLineups(teamData, { matchupId, teamId, players = [], now = new Date() }) {
  const team = findTeam(teamData, teamId);
  if (!team) {
    return { ok: false, error: "Không tìm thấy đội." };
  }

  const allowReuse = teamData.settings?.allowPlayerReusePerMatchup === true;
  const usedPlayerIds = new Set();
  const appearanceCounts = new Map();
  const selections = {};
  const errors = [];

  team.playerIds.forEach((playerId) => {
    appearanceCounts.set(String(playerId), 0);
  });

  for (const discipline of teamData.disciplines) {
    const result = pickPlayersForDiscipline({
      team,
      discipline,
      players,
      usedPlayerIds,
      appearanceCounts,
      allowReuse,
    });

    if (!result.ok) {
      errors.push(result.error);
      continue;
    }

    result.playerIds.forEach((playerId) => {
      usedPlayerIds.add(String(playerId));
      appearanceCounts.set(
        String(playerId),
        (appearanceCounts.get(String(playerId)) || 0) + 1
      );
    });
    selections[discipline.id] = result.playerIds;
  }

  if (errors.length > 0) {
    return { ok: false, error: errors.join(" ") };
  }

  const lockTime = new Date(now).toISOString();
  const timeLabel = new Date(now).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const auditNote = `Đội ${team.name} không nộp đội hình trước hạn. Hệ thống đã tự động chọn đội hình lúc ${timeLabel}.`;

  const lineup = normalizeLineup({
    matchupId,
    teamId,
    status: LINEUP_STATUS.LOCKED,
    selections,
    lockedAt: lockTime,
    source: LINEUP_SOURCE.RANDOM,
    auditNote,
  });

  const key = lineupKey(matchupId, teamId);

  return {
    ok: true,
    teamData: normalizeTeamData({
      ...teamData,
      lineups: {
        ...teamData.lineups,
        [key]: lineup,
      },
    }),
    lineup,
    auditNote,
  };
}

export function countPlayerAppearances(teamData, teamId) {
  const counts = new Map();

  Object.values(teamData.lineups || {}).forEach((lineup) => {
    if (lineup.teamId !== String(teamId)) {
      return;
    }

    Object.values(lineup.selections || {}).forEach((playerIds) => {
      playerIds.forEach((playerId) => {
        const key = String(playerId);
        counts.set(key, (counts.get(key) || 0) + 1);
      });
    });
  });

  return counts;
}
