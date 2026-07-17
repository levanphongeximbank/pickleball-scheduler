import { buildRoundRobinRounds } from "../../../pages/tournament.fixtures.logic.js";
import { createId } from "../../../utils/id.js";
import {
  buildMatchOptionFromSides,
  filterAndRankMatchupsByOpponentRules,
  PRIVATE_PAIRING_OPERATION,
} from "../../private-pairing-rules/runtime/index.js";
import {
  attachV6CompetitionOptimizationAudit,
  buildV6PrivatePairingResolveContext,
  V6_OPTIMIZATION_ACTION,
  V6_PRIVATE_PAIRING_ALGORITHM_VERSION,
} from "../private-pairing/index.js";
import { MATCHUP_STATUS } from "../constants.js";
import {
  createMatchupRecord,
  normalizeTeamData,
} from "../models/index.js";
import {
  assertGroupsReadyForSchedule,
  recommendGroupSizes as recommendGroupSizesFromPolicy,
} from "./teamGroupDivisionPolicy.js";
import {
  computeLineupLockAt,
  isMlpFormat,
} from "./mlpPresetEngine.js";

export {
  GROUPS_REQUIRED,
  GROUPS_REQUIRED_MESSAGE,
  listGroupDivisionOptions,
  tournamentRequiresExplicitGroups,
  assertGroupsReadyForSchedule,
  hasExplicitGroups,
  hasDependentMatchupsOrSchedule,
  buildGroupDivisionDiagnostics,
  GROUP_REDRAW_DESTRUCTIVE_MESSAGE,
  GROUPS_REQUIRED_SCHEDULE_DIALOG_MESSAGE,
  MIN_TEAMS_FOR_EXPLICIT_GROUPS,
} from "./teamGroupDivisionPolicy.js";

/** Fixed round-robin pairings by team index within a pool (matches user spec for 3/4/5). */
const ROUND_ROBIN_TEMPLATES = Object.freeze({
  3: [
    { roundNumber: 1, pairs: [[0, 1]] },
    { roundNumber: 2, pairs: [[1, 2]] },
    { roundNumber: 3, pairs: [[0, 2]] },
  ],
  4: [
    { roundNumber: 1, pairs: [[0, 1], [2, 3]] },
    { roundNumber: 2, pairs: [[0, 2], [1, 3]] },
    { roundNumber: 3, pairs: [[0, 3], [1, 2]] },
  ],
  5: [
    { roundNumber: 1, pairs: [[0, 1], [2, 3]] },
    { roundNumber: 2, pairs: [[0, 2], [1, 4]] },
    { roundNumber: 3, pairs: [[0, 3], [4, 2]] },
    { roundNumber: 4, pairs: [[1, 2], [3, 4]] },
    { roundNumber: 5, pairs: [[0, 4], [1, 3]] },
  ],
});

export function recommendGroupSizes(teamCount) {
  return recommendGroupSizesFromPolicy(teamCount);
}

export function describeGroupSplit(teamCount) {
  const sizes = recommendGroupSizes(teamCount);
  if (!sizes) {
    return "";
  }
  return sizes
    .map((size, index) => `Bảng ${String.fromCharCode(65 + index)} (${size} đội)`)
    .join(" + ");
}

export function defaultCourtCountForPool(teamCount) {
  return teamCount === 3 ? 1 : 2;
}

export function buildRoundRobinRoundsForTeamCount(teamCount) {
  const count = Number(teamCount) || 0;
  if (count < 2) {
    return [];
  }

  if (ROUND_ROBIN_TEMPLATES[count]) {
    return ROUND_ROBIN_TEMPLATES[count].map((round) => ({
      roundNumber: round.roundNumber,
      pairs: round.pairs.map(([homeIndex, awayIndex]) => [homeIndex, awayIndex]),
    }));
  }

  const placeholderTeams = Array.from({ length: count }, (_, index) => ({
    id: String(index),
    name: String(index),
    members: [],
  }));

  return buildRoundRobinRounds(placeholderTeams).map((round) => ({
    roundNumber: round.roundNumber,
    pairs: round.matches.map((match) => {
      const homeIndex = placeholderTeams.findIndex((team) => team.id === match.home?.id);
      const awayIndex = placeholderTeams.findIndex((team) => team.id === match.away?.id);
      return [homeIndex, awayIndex];
    }),
  }));
}

export function getRestingTeamIndices(teamCount, round) {
  const playing = new Set();
  (round.pairs || []).forEach(([homeIndex, awayIndex]) => {
    playing.add(homeIndex);
    playing.add(awayIndex);
  });

  return Array.from({ length: teamCount }, (_, index) => index).filter(
    (index) => !playing.has(index)
  );
}

function addMinutes(isoString, minutes) {
  if (!isoString) {
    return null;
  }
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Date(date.getTime() + minutes * 60 * 1000).toISOString();
}

function courtLabelForSlot(slotIndex, courtCount, options = {}) {
  const prefix = options.courtLabelPrefix?.trim() || "";
  const label = `Sân ${slotIndex + 1}`;
  return prefix ? `${prefix} ${label}` : label;
}

function resolveGroupsForSchedule(teamData) {
  const teams = teamData.teams || [];
  const existingGroups = (teamData.groups || []).filter((group) => group.teamIds?.length >= 2);

  if (existingGroups.length > 0) {
    return existingGroups.map((group) => ({
      groupId: group.id,
      groupName: group.name || "Bảng",
      teamRecords: group.teamIds
        .map((teamId) => teams.find((team) => team.id === teamId))
        .filter(Boolean),
    }));
  }

  if (teams.length >= 2) {
    return [
      {
        groupId: "",
        groupName: "Vòng tròn",
        teamRecords: [...teams],
      },
    ];
  }

  return [];
}

function findMatchupForPair(matchups, teamAId, teamBId, groupId) {
  return (matchups || []).find((matchup) => {
    if (groupId && matchup.groupId && matchup.groupId !== groupId) {
      return false;
    }
    const { teamAId: a, teamBId: b } = matchup;
    return (
      (a === teamAId && b === teamBId) ||
      (a === teamBId && b === teamAId)
    );
  });
}

export function assignTeamsToGroupsBySizes(teamData, sizes = []) {
  const teams = teamData.teams || [];
  const normalizedSizes = sizes.map((size) => Math.max(0, Number(size) || 0));
  const expectedTotal = normalizedSizes.reduce((sum, size) => sum + size, 0);

  if (expectedTotal !== teams.length || normalizedSizes.length < 1) {
    return teamData;
  }

  const groups = normalizedSizes.map((size, index) => ({
    id: createId("grp"),
    name: `Bảng ${String.fromCharCode(65 + index)}`,
    teamIds: [],
    capacity: size,
  }));

  let teamIndex = 0;
  let round = 0;

  while (teamIndex < teams.length) {
    const forward = round % 2 === 0;
    const order = forward
      ? groups.map((_, index) => index)
      : groups.map((_, index) => groups.length - 1 - index);

    for (const groupIndex of order) {
      const group = groups[groupIndex];
      if (group.teamIds.length < group.capacity && teamIndex < teams.length) {
        group.teamIds.push(teams[teamIndex].id);
        teamIndex += 1;
      }
    }
    round += 1;
  }

  return normalizeTeamData({
    ...teamData,
    groups: groups.map(({ id, name, teamIds }) => ({ id, name, teamIds })),
  });
}

/**
 * @deprecated Do not call from schedule / matchup / publish paths.
 * Explicit Owner/BTC group division is required — never auto-create groups.
 * Kept only for legacy tests that assert the pure size-assignment helper.
 */
export function ensureGroupsForTeamCount(teamData) {
  const gate = assertGroupsReadyForSchedule(teamData);
  if (!gate.ok) {
    return teamData;
  }
  return teamData;
}

export function describeSchedulePreview(teamData, options = {}) {
  const gate = assertGroupsReadyForSchedule(teamData);
  if (!gate.ok) {
    return gate.error;
  }

  const groups = resolveGroupsForSchedule(teamData);
  if (!groups.length) {
    return "Chưa đủ đội để tạo lịch.";
  }

  const parts = groups.map((group) => {
    const rounds = buildRoundRobinRoundsForTeamCount(group.teamRecords.length);
    const courtCount = options.courtCount || defaultCourtCountForPool(group.teamRecords.length);
    return `${group.groupName}: ${rounds.length} vòng × ${courtCount} sân`;
  });

  return parts.join(" · ");
}

/**
 * Build round-robin matchups. Never silently creates groups.
 * When explicit groups are required but missing, returns ok:false + GROUPS_REQUIRED.
 */
export function buildStructuredRoundRobinMatchups(teamData, options = {}) {
  const gate = assertGroupsReadyForSchedule(teamData);
  if (!gate.ok) {
    const errorData = normalizeTeamData({
      ...teamData,
      matchups: teamData?.matchups || [],
      groups: teamData?.groups || [],
    });
    errorData.ok = false;
    errorData.code = gate.code;
    errorData.error = gate.error;
    errorData.privatePairingError = { code: gate.code, message: gate.error };
    return errorData;
  }

  const prepared = normalizeTeamData(teamData);
  const groups = resolveGroupsForSchedule(prepared);
  const leadMinutes = isMlpFormat(prepared)
    ? prepared.settings?.lineupLockLeadMinutes || 15
    : null;

  const baseScheduledAt = options.scheduledAt || null;
  const baseLineupLockAt = options.lineupLockAt || null;
  const roundIntervalMinutes = Number(options.roundIntervalMinutes) || 90;
  const courtLabelPrefix = options.courtLabel || "";

  const matchups = [];

  groups.forEach((group) => {
    const teamRecords = group.teamRecords;
    const rounds = buildRoundRobinRoundsForTeamCount(teamRecords.length);
    const courtCount = Math.min(
      Math.max(1, Number(options.courtCount) || defaultCourtCountForPool(teamRecords.length)),
      2
    );

    rounds.forEach((round) => {
      const roundScheduledAt = addMinutes(
        baseScheduledAt,
        (round.roundNumber - 1) * roundIntervalMinutes
      );
      const roundLineupLockAt =
        baseLineupLockAt && baseScheduledAt
          ? addMinutes(baseLineupLockAt, (round.roundNumber - 1) * roundIntervalMinutes)
          : roundScheduledAt && leadMinutes
            ? computeLineupLockAt(roundScheduledAt, leadMinutes)
            : baseLineupLockAt;

      round.pairs.forEach(([homeIndex, awayIndex], matchIndex) => {
        const homeTeam = teamRecords[homeIndex];
        const awayTeam = teamRecords[awayIndex];
        if (!homeTeam || !awayTeam) {
          return;
        }

        const courtSlot = matchIndex % courtCount;

        matchups.push(
          createMatchupRecord(homeTeam.id, awayTeam.id, {
            disciplines: prepared.disciplines,
            groupId: group.groupId,
            roundNumber: round.roundNumber,
            matchNumberInRound: matchIndex + 1,
            scheduledAt: roundScheduledAt,
            lineupLockAt: roundLineupLockAt,
            courtLabel: courtLabelForSlot(courtSlot, courtCount, { courtLabelPrefix }),
            status: MATCHUP_STATUS.LINEUP_OPEN,
          })
        );
      });
    });
  });

  const ranked = filterAndRankMatchupsByOpponentRules(
    matchups,
    (matchup) => {
      const teamA = (prepared.teams || []).find(
        (team) => String(team.id) === String(matchup.teamAId)
      );
      const teamB = (prepared.teams || []).find(
        (team) => String(team.id) === String(matchup.teamBId)
      );
      if (!teamA || !teamB) {
        return null;
      }
      const sideA = (teamA.playerIds || []).map((id) => ({ id }));
      const sideB = (teamB.playerIds || []).map((id) => ({ id }));
      return buildMatchOptionFromSides(sideA, sideB);
    },
    {
      privatePairingRules: options.privatePairingRules || [],
      pairingConstraints: options.pairingConstraints || [],
      clubId: options.clubId || null,
      tournamentId: options.tournamentId || null,
      eventId: options.eventId || null,
      competitionClass: options.competitionClass,
      envSource: options.envSource,
      allowedByPublishedRules: options.allowedByPublishedRules === true,
      contextTime: options.contextTime,
      history: options.pairingHistory || {},
      requireCompleteSet: options.requireCompleteSet !== false,
      operation: PRIVATE_PAIRING_OPERATION.MATCHUP_PAIRING,
    }
  );

  if (ranked.ok === false) {
    const errorData = normalizeTeamData({
      ...prepared,
      matchups: [],
    });
    errorData.ok = false;
    errorData.privatePairingError = ranked.privatePairingError;
    return errorData;
  }

  const scheduleContext = buildV6PrivatePairingResolveContext({
    clubId: options.clubId || null,
    tournamentId: options.tournamentId || null,
    eventId: options.eventId || null,
    competitionClass: options.competitionClass,
    operation: PRIVATE_PAIRING_OPERATION.SCHEDULE_ASSIGNMENT,
    contextTime: options.contextTime,
  });

  let next = normalizeTeamData({
    ...prepared,
    matchups: ranked.matchups,
  });

  next = attachV6CompetitionOptimizationAudit(next, {
    operation: PRIVATE_PAIRING_OPERATION.MATCHUP_PAIRING,
    context: {
      ...scheduleContext,
      operation: PRIVATE_PAIRING_OPERATION.MATCHUP_PAIRING,
    },
    algorithmVersion: V6_PRIVATE_PAIRING_ALGORITHM_VERSION,
    randomSeed: options.randomSeed != null ? String(options.randomSeed) : null,
    diagnostics: {
      matchupCount: ranked.matchups?.length || 0,
      removedCount: ranked.removed?.length || 0,
    },
    resultSnapshot: (ranked.matchups || []).map((m) => ({
      id: m.id,
      teamAId: m.teamAId,
      teamBId: m.teamBId,
      roundNumber: m.roundNumber,
      courtLabel: m.courtLabel,
      scheduledAt: m.scheduledAt,
    })),
    action: V6_OPTIMIZATION_ACTION.INITIAL_GENERATE,
  });

  next = attachV6CompetitionOptimizationAudit(next, {
    operation: PRIVATE_PAIRING_OPERATION.SCHEDULE_ASSIGNMENT,
    context: scheduleContext,
    algorithmVersion: V6_PRIVATE_PAIRING_ALGORITHM_VERSION,
    randomSeed: options.randomSeed != null ? String(options.randomSeed) : null,
    resultSnapshot: (ranked.matchups || []).map((m) => ({
      id: m.id,
      scheduledAt: m.scheduledAt,
      roundNumber: m.roundNumber,
    })),
    action: V6_OPTIMIZATION_ACTION.INITIAL_GENERATE,
  });

  next = attachV6CompetitionOptimizationAudit(next, {
    operation: PRIVATE_PAIRING_OPERATION.COURT_ASSIGNMENT,
    context: {
      ...scheduleContext,
      operation: PRIVATE_PAIRING_OPERATION.COURT_ASSIGNMENT,
    },
    algorithmVersion: V6_PRIVATE_PAIRING_ALGORITHM_VERSION,
    resultSnapshot: (ranked.matchups || []).map((m) => ({
      id: m.id,
      courtLabel: m.courtLabel,
    })),
    action: V6_OPTIMIZATION_ACTION.INITIAL_GENERATE,
  });

  return next;
}

function buildGroupDiagramFromRounds(groupName, groupId, teamRecords, matchups) {
  const teamNameById = (teamId) =>
    teamRecords.find((team) => team.id === teamId)?.name || teamId;

  const rounds = buildRoundRobinRoundsForTeamCount(teamRecords.length);

  return {
    groupId,
    groupName,
    rounds: rounds.map((round) => {
      const restingIndices = getRestingTeamIndices(teamRecords.length, round);
      const restingTeamNames = restingIndices.map(
        (index) => teamRecords[index]?.name || String(index)
      );

      return {
        roundNumber: round.roundNumber,
        restingTeamNames,
        matches: round.pairs.map(([homeIndex, awayIndex], matchIndex) => {
          const homeTeam = teamRecords[homeIndex];
          const awayTeam = teamRecords[awayIndex];
          const matchup = findMatchupForPair(
            matchups,
            homeTeam?.id,
            awayTeam?.id,
            groupId
          );

          return {
            teamAId: homeTeam?.id || "",
            teamBId: awayTeam?.id || "",
            teamAName: teamNameById(homeTeam?.id),
            teamBName: teamNameById(awayTeam?.id),
            matchupId: matchup?.id || "",
            status: matchup?.status || "",
            scheduledAt: matchup?.scheduledAt || null,
            courtLabel: matchup?.courtLabel || `Sân ${matchIndex + 1}`,
            result: matchup?.result || null,
          };
        }),
      };
    }),
  };
}

/**
 * Build schedule diagram grouped by pool (bảng) and round (vòng).
 */
export function buildTeamTournamentScheduleDiagram(teamData) {
  const teams = teamData?.teams || [];
  const matchups = teamData?.matchups || [];
  const groups = resolveGroupsForSchedule(teamData);

  if (teams.length < 2) {
    return [];
  }

  const diagram = groups
    .filter((group) => group.teamRecords.length >= 2)
    .map((group) =>
      buildGroupDiagramFromRounds(
        group.groupName,
        group.groupId,
        group.teamRecords,
        matchups
      )
    );

  return annotateMatchNumbers(diagram);
}

export function annotateMatchNumbers(groups = []) {
  let globalMatchNumber = 0;

  return groups.map((group) => ({
    ...group,
    rounds: (group.rounds || []).map((round) => ({
      ...round,
      matches: (round.matches || []).map((match, index) => {
        globalMatchNumber += 1;
        return {
          ...match,
          matchNumberInRound: match.matchNumberInRound || index + 1,
          matchNumber: globalMatchNumber,
        };
      }),
    })),
  }));
}

function formatSlotLabel(scheduledAt, roundNumber) {
  if (scheduledAt) {
    const date = new Date(scheduledAt);
    if (!Number.isNaN(date.getTime())) {
      const time = date.toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      });
      return `Vòng ${roundNumber} · ${time}`;
    }
  }
  return `Vòng ${roundNumber}`;
}

/**
 * Merge all pools into timeline slots keyed by scheduledAt.
 */
export function buildUnifiedScheduleDiagram(teamData) {
  const groups = buildTeamTournamentScheduleDiagram(teamData);
  const slotMap = new Map();

  groups.forEach((group) => {
    group.rounds.forEach((round) => {
      round.matches.forEach((match) => {
        const slotKey = match.scheduledAt || `${group.groupId}-r${round.roundNumber}`;
        if (!slotMap.has(slotKey)) {
          slotMap.set(slotKey, {
            slotKey,
            scheduledAt: match.scheduledAt || null,
            roundNumber: round.roundNumber,
            label: formatSlotLabel(match.scheduledAt, round.roundNumber),
            matches: [],
            restingTeams: [],
          });
        }

        const slot = slotMap.get(slotKey);
        slot.matches.push({
          ...match,
          groupName: group.groupName,
          groupId: group.groupId,
          roundNumber: round.roundNumber,
        });

        if (round.restingTeamNames?.length) {
          const existing = slot.restingTeams.find(
            (entry) => entry.groupName === group.groupName
          );
          if (!existing) {
            slot.restingTeams.push({
              groupName: group.groupName,
              teamNames: round.restingTeamNames,
            });
          }
        }
      });
    });
  });

  return [...slotMap.values()].sort((left, right) => {
    if (left.scheduledAt && right.scheduledAt) {
      return new Date(left.scheduledAt).getTime() - new Date(right.scheduledAt).getTime();
    }
    return (left.roundNumber || 0) - (right.roundNumber || 0);
  });
}

export function isLineupPhaseOpen(teamData) {
  const matchups = teamData?.matchups || [];
  if (!matchups.length) {
    return false;
  }
  return matchups.some(
    (matchup) =>
      matchup.status === MATCHUP_STATUS.LINEUP_OPEN ||
      matchup.status === MATCHUP_STATUS.SCHEDULED
  );
}
