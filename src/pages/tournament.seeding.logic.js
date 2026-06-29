function toFiniteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeMode(mode) {
  return mode === "skill_controlled" ? "skill_controlled" : "open";
}

function shuffleArray(items, randomFn = Math.random) {
  const array = [...items];

  for (let i = array.length - 1; i > 0; i -= 1) {
    const randomIndex = Math.floor(randomFn() * (i + 1));
    const temp = array[i];
    array[i] = array[randomIndex];
    array[randomIndex] = temp;
  }

  return array;
}

function buildTeamName(members = []) {
  const names = members
    .map((member) => String(member?.name || "").trim())
    .filter(Boolean);

  if (names.length === 0) {
    return "Đội chưa đặt tên";
  }

  return names.join(" / ");
}

function createTeam(members = [], index = 0) {
  const memberIds = members
    .map((member) => String(member?.id || "").trim())
    .filter(Boolean)
    .sort();

  const avgLevel = members.length
    ? members.reduce((sum, member) => sum + toFiniteNumber(member?.level, 3.5), 0) / members.length
    : 0;

  return {
    id: memberIds.length ? memberIds.join("|") : `team-${index + 1}`,
    name: buildTeamName(members),
    members,
    avgLevel: Math.round(avgLevel * 100) / 100,
  };
}

export function createTeamsFromPlayers(players = [], options = {}) {
  const mode = normalizeMode(options.mode);
  const randomFn = typeof options.randomFn === "function" ? options.randomFn : Math.random;
  const teamSize = Math.max(1, Number(options.teamSize) || 2);
  const normalizedPlayers = (players || []).filter(Boolean);

  if (normalizedPlayers.length < teamSize) {
    return [];
  }

  if (mode === "open") {
    const shuffledPlayers = shuffleArray(normalizedPlayers, randomFn);
    const teamCount = Math.floor(shuffledPlayers.length / teamSize);

    return Array.from({ length: teamCount }, (_, index) => {
      const start = index * teamSize;
      return createTeam(shuffledPlayers.slice(start, start + teamSize), index);
    });
  }

  if (teamSize !== 2) {
    const sortedPlayers = [...normalizedPlayers].sort(
      (a, b) => toFiniteNumber(b?.level, 3.5) - toFiniteNumber(a?.level, 3.5)
    );
    const teamCount = Math.floor(sortedPlayers.length / teamSize);

    return Array.from({ length: teamCount }, (_, index) => {
      const start = index * teamSize;
      return createTeam(sortedPlayers.slice(start, start + teamSize), index);
    });
  }

  const sortedPlayers = [...normalizedPlayers].sort(
    (a, b) => toFiniteNumber(b?.level, 3.5) - toFiniteNumber(a?.level, 3.5)
  );

  const teams = [];
  let left = 0;
  let right = sortedPlayers.length - 1;

  while (left < right) {
    teams.push(createTeam([sortedPlayers[left], sortedPlayers[right]], teams.length));
    left += 1;
    right -= 1;
  }

  return teams;
}

function getGroupLabel(index) {
  if (index >= 0 && index < 26) {
    return String.fromCharCode(65 + index);
  }

  return `G${index + 1}`;
}

function getSnakeGroupIndex(step, groupCount) {
  if (groupCount <= 1) {
    return 0;
  }

  const round = Math.floor(step / groupCount);
  const positionInRound = step % groupCount;

  if (round % 2 === 0) {
    return positionInRound;
  }

  return groupCount - 1 - positionInRound;
}

export function seedTeamsIntoGroups(teams = [], groupCount = 4, options = {}) {
  const mode = normalizeMode(options.mode);
  const randomFn = typeof options.randomFn === "function" ? options.randomFn : Math.random;
  const safeGroupCount = Math.max(1, Number(groupCount) || 1);

  const groups = Array.from({ length: safeGroupCount }, (_, index) => ({
    group: getGroupLabel(index),
    teams: [],
  }));

  if (!Array.isArray(teams) || teams.length === 0) {
    return groups;
  }

  if (mode === "open") {
    const shuffledTeams = shuffleArray(teams, randomFn);

    shuffledTeams.forEach((team, index) => {
      groups[index % safeGroupCount].teams.push(team);
    });

    return groups;
  }

  const sortedTeams = [...teams].sort(
    (a, b) => toFiniteNumber(b?.avgLevel, 0) - toFiniteNumber(a?.avgLevel, 0)
  );

  sortedTeams.forEach((team, index) => {
    const groupIndex = getSnakeGroupIndex(index, safeGroupCount);
    groups[groupIndex].teams.push(team);
  });

  return groups;
}

export function buildSeededGroups(players = [], options = {}) {
  const mode = normalizeMode(options.mode);
  const groupCount = Math.max(1, Number(options.groupCount) || 4);
  const teamSize = Math.max(1, Number(options.teamSize) || 2);
  const randomFn = typeof options.randomFn === "function" ? options.randomFn : Math.random;

  const teams = createTeamsFromPlayers(players, {
    mode,
    randomFn,
    teamSize,
  });

  const groups = seedTeamsIntoGroups(teams, groupCount, {
    mode,
    randomFn,
  });

  return {
    mode,
    groupCount,
    teamSize,
    teams,
    groups,
  };
}
