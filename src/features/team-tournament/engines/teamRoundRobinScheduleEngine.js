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
  resolveV6PrivatePairing,
  V6_OPTIMIZATION_ACTION,
} from "../private-pairing/index.js";
import {
  COURT_GLOBAL_ALGORITHM_VERSION,
  MATCHUP_GLOBAL_ALGORITHM_VERSION,
  SCHEDULE_GLOBAL_ALGORITHM_VERSION,
  runCourtGlobalOptimizer,
  runMatchupGlobalOptimizer,
  runScheduleGlobalOptimizer,
} from "../../competition-optimizer/index.js";
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

function synthesizeCourts(courtCount, options = {}) {
  const count = Math.max(1, Number(courtCount) || 1);
  const prefix = options.courtLabelPrefix?.trim() || options.courtLabel?.trim() || "";
  return Array.from({ length: count }, (_, index) => ({
    id: `court-${index + 1}`,
    label: courtLabelForSlot(index, count, { courtLabelPrefix: prefix }),
    active: true,
    isCentral: index === 0,
    capacity: 1,
  }));
}

function resolveOptimizerBudget(options = {}, fallback = {}) {
  return {
    maxInitialCandidates: 40,
    maxEvaluations: 400,
    maxIterations: 80,
    maxDurationMs: 800,
    stagnationLimit: 40,
    ...(fallback || {}),
    ...(options.budget || {}),
  };
}

function mergeOptimizedMatchups(baseMatchups, optimizedRows) {
  const byId = new Map((optimizedRows || []).map((row) => [String(row.id), row]));
  return (baseMatchups || []).map((matchup) => {
    const optimized = byId.get(String(matchup.id));
    if (!optimized) return matchup;
    return {
      ...matchup,
      teamAId: optimized.teamAId || matchup.teamAId,
      teamBId: optimized.teamBId || matchup.teamBId,
      roundNumber: optimized.roundNumber || matchup.roundNumber,
      matchNumberInRound: optimized.matchNumberInRound || matchup.matchNumberInRound,
    };
  });
}

function applyScheduleAssignments(matchups, assignments, baseScheduledAt, roundIntervalMinutes) {
  const byId = new Map((assignments || []).map((row) => [String(row.id), row]));
  return (matchups || []).map((matchup) => {
    const row = byId.get(String(matchup.id));
    if (!row) return matchup;
    const scheduledAt =
      row.scheduledAt ||
      (baseScheduledAt
        ? addMinutes(baseScheduledAt, (Number(row.slotIndex) || 0) * roundIntervalMinutes)
        : matchup.scheduledAt);
    return {
      ...matchup,
      scheduledAt,
      roundNumber: row.roundNumber || matchup.roundNumber,
    };
  });
}

function applyCourtAssignments(matchups, assignments) {
  const byId = new Map((assignments || []).map((row) => [String(row.id), row]));
  return (matchups || []).map((matchup) => {
    const row = byId.get(String(matchup.id));
    if (!row) return matchup;
    return {
      ...matchup,
      courtLabel: row.courtLabel || matchup.courtLabel,
      courtId: row.courtId || matchup.courtId,
    };
  });
}

function runRoundRobinGlobalOptimizers(matchups, input = {}) {
  const randomSeed = input.randomSeed ?? 1;
  const budget = resolveOptimizerBudget(input);
  const pairingResolve = resolveV6PrivatePairing({
    privatePairingRules: input.privatePairingRules,
    pairingConstraints: input.pairingConstraints,
    clubId: input.clubId,
    tournamentId: input.tournamentId,
    eventId: input.eventId,
    competitionClass: input.competitionClass,
    envSource: input.envSource,
    operation: PRIVATE_PAIRING_OPERATION.MATCHUP_PAIRING,
    contextTime: input.contextTime,
  });

  if (!pairingResolve.ok) {
    return {
      ok: false,
      privatePairingError: {
        code: pairingResolve.code,
        message: pairingResolve.message,
      },
    };
  }

  const groups = input.groups || [];
  let optimizedMatchups = [...matchups];
  let matchupResult = null;

  if (groups.length > 0) {
    const merged = [];
    for (const group of groups) {
      const groupMatchups = optimizedMatchups.filter(
        (matchup) => String(matchup.groupId) === String(group.groupId)
      );
      matchupResult = runMatchupGlobalOptimizer({
        matchups: groupMatchups,
        teamIds: (group.teamRecords || []).map((team) => team.id),
        teams: input.teams,
        groupId: group.groupId,
        privatePairingRules: input.privatePairingRules,
        pairingConstraints: input.pairingConstraints,
        resolved: pairingResolve.resolved,
        history: input.pairingHistory,
        randomSeed,
        budget,
        clubId: input.clubId,
        tournamentId: input.tournamentId,
        context: pairingResolve.context,
      });
      if (!matchupResult.ok) {
        return {
          ok: false,
          privatePairingError: {
            code: "MATCHUP_OPTIMIZER_FAILED",
            message: "Không tìm được lịch đối đầu hợp lệ.",
            rejectionCodes: matchupResult.rejectionCodes,
          },
          matchupResult,
        };
      }
      merged.push(...mergeOptimizedMatchups(groupMatchups, matchupResult.matchups));
    }
    optimizedMatchups = merged;
  } else {
    matchupResult = runMatchupGlobalOptimizer({
      matchups: optimizedMatchups,
      teams: input.teams,
      privatePairingRules: input.privatePairingRules,
      pairingConstraints: input.pairingConstraints,
      resolved: pairingResolve.resolved,
      history: input.pairingHistory,
      randomSeed,
      budget,
      clubId: input.clubId,
      tournamentId: input.tournamentId,
      context: pairingResolve.context,
    });
    if (!matchupResult.ok) {
      return {
        ok: false,
        privatePairingError: {
          code: "MATCHUP_OPTIMIZER_FAILED",
          message: "Không tìm được lịch đối đầu hợp lệ.",
          rejectionCodes: matchupResult.rejectionCodes,
        },
        matchupResult,
      };
    }
    optimizedMatchups = mergeOptimizedMatchups(optimizedMatchups, matchupResult.matchups);
  }

  const roundNumbers = [
    ...new Set(optimizedMatchups.map((matchup) => Number(matchup.roundNumber) || 0)),
  ].filter((value) => value > 0);
  const slotCount = Math.max(1, roundNumbers.length);

  const scheduleResolve = resolveV6PrivatePairing({
    ...input,
    operation: PRIVATE_PAIRING_OPERATION.SCHEDULE_ASSIGNMENT,
  });

  const scheduleResult = runScheduleGlobalOptimizer({
    matchups: optimizedMatchups,
    slotCount,
    baseScheduledAt: input.baseScheduledAt,
    roundIntervalMinutes: input.roundIntervalMinutes,
    privatePairingRules: input.privatePairingRules,
    pairingConstraints: input.pairingConstraints,
    resolved: scheduleResolve.resolved,
    history: input.pairingHistory,
    randomSeed,
    budget,
    context: scheduleResolve.context,
  });

  if (!scheduleResult.ok) {
    return {
      ok: false,
      privatePairingError: {
        code: "SCHEDULE_OPTIMIZER_FAILED",
        message: "Không tìm được lịch thi đấu hợp lệ.",
        rejectionCodes: scheduleResult.rejectionCodes,
      },
      matchupResult,
      scheduleResult,
    };
  }

  optimizedMatchups = applyScheduleAssignments(
    optimizedMatchups,
    scheduleResult.assignments,
    input.baseScheduledAt,
    input.roundIntervalMinutes
  );

  const slotConcurrency = new Map();
  for (const matchup of optimizedMatchups) {
    const key = Number(matchup.roundNumber) || 0;
    slotConcurrency.set(key, (slotConcurrency.get(key) || 0) + 1);
  }
  const maxCourtCount = Math.max(1, Number(input.courtCount) || 1);
  const requiredCourts = Math.max(
    1,
    maxCourtCount,
    ...slotConcurrency.values()
  );

  const courts =
    input.courts?.length > 0
      ? input.courts
      : synthesizeCourts(requiredCourts, {
          courtLabelPrefix: input.courtLabelPrefix,
          courtLabel: input.courtLabel,
        });

  const courtResolve = resolveV6PrivatePairing({
    ...input,
    operation: PRIVATE_PAIRING_OPERATION.COURT_ASSIGNMENT,
  });

  const courtResult = runCourtGlobalOptimizer({
    matchups: optimizedMatchups,
    scheduleAssignments: scheduleResult.assignments,
    courts,
    privatePairingRules: input.privatePairingRules,
    pairingConstraints: input.pairingConstraints,
    resolved: courtResolve.resolved,
    history: input.pairingHistory,
    randomSeed,
    budget,
    context: courtResolve.context,
    preferCentralForHighStakes: input.preferCentralForHighStakes === true,
  });

  if (!courtResult.ok) {
    return {
      ok: false,
      privatePairingError: {
        code: "COURT_OPTIMIZER_FAILED",
        message: "Không gán được sân hợp lệ.",
        rejectionCodes: courtResult.rejectionCodes,
      },
      matchupResult,
      scheduleResult,
      courtResult,
    };
  }

  optimizedMatchups = applyCourtAssignments(optimizedMatchups, courtResult.assignments);

  return {
    ok: true,
    matchups: optimizedMatchups,
    matchupResult,
    scheduleResult,
    courtResult,
  };
}

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

  const randomSeed = options.randomSeed ?? 1;
  const useGlobalOptimizer = options.useGlobalOptimizer !== false;
  let finalMatchups = ranked.matchups;
  let matchupResult = null;
  let scheduleResult = null;
  let courtResult = null;

  if (useGlobalOptimizer) {
    const maxCourtCount = Math.max(
      1,
      ...groups.map((group) =>
        Math.min(
          Math.max(
            1,
            Number(options.courtCount) || defaultCourtCountForPool(group.teamRecords.length)
          ),
          2
        )
      )
    );

    const optimized = runRoundRobinGlobalOptimizers(ranked.matchups, {
      groups,
      teams: prepared.teams,
      privatePairingRules: options.privatePairingRules || [],
      pairingConstraints: options.pairingConstraints || [],
      clubId: options.clubId || null,
      tournamentId: options.tournamentId || null,
      eventId: options.eventId || null,
      competitionClass: options.competitionClass,
      envSource: options.envSource,
      contextTime: options.contextTime,
      pairingHistory: options.pairingHistory || {},
      randomSeed,
      budget: options.budget,
      baseScheduledAt,
      roundIntervalMinutes,
      courtCount: maxCourtCount,
      courtLabelPrefix,
      courts: options.courts,
      preferCentralForHighStakes: options.preferCentralForHighStakes,
    });

    if (!optimized.ok) {
      const errorData = normalizeTeamData({
        ...prepared,
        matchups: [],
      });
      errorData.ok = false;
      errorData.privatePairingError = optimized.privatePairingError;
      return errorData;
    }

    finalMatchups = optimized.matchups;
    matchupResult = optimized.matchupResult;
    scheduleResult = optimized.scheduleResult;
    courtResult = optimized.courtResult;

    // Re-apply lineup lock times after schedule optimization
    finalMatchups = finalMatchups.map((matchup) => {
      if (!baseScheduledAt || !leadMinutes) {
        return matchup;
      }
      return {
        ...matchup,
        lineupLockAt: computeLineupLockAt(matchup.scheduledAt, leadMinutes),
      };
    });
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
    matchups: finalMatchups,
  });

  next = attachV6CompetitionOptimizationAudit(next, {
    operation: PRIVATE_PAIRING_OPERATION.MATCHUP_PAIRING,
    context: {
      ...scheduleContext,
      operation: PRIVATE_PAIRING_OPERATION.MATCHUP_PAIRING,
    },
    algorithmVersion: useGlobalOptimizer
      ? MATCHUP_GLOBAL_ALGORITHM_VERSION
      : matchupResult?.algorithmVersion || MATCHUP_GLOBAL_ALGORITHM_VERSION,
    randomSeed: String(randomSeed),
    scoreBreakdown: matchupResult?.scoreBreakdown || null,
    diagnostics: matchupResult?.diagnostics || {
      matchupCount: finalMatchups?.length || 0,
      removedCount: ranked.removed?.length || 0,
    },
    resultSnapshot: (finalMatchups || []).map((m) => ({
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
    algorithmVersion: useGlobalOptimizer
      ? SCHEDULE_GLOBAL_ALGORITHM_VERSION
      : scheduleResult?.algorithmVersion || SCHEDULE_GLOBAL_ALGORITHM_VERSION,
    randomSeed: String(randomSeed),
    scoreBreakdown: scheduleResult?.scoreBreakdown || null,
    diagnostics: scheduleResult?.diagnostics || null,
    resultSnapshot: (finalMatchups || []).map((m) => ({
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
    algorithmVersion: useGlobalOptimizer
      ? COURT_GLOBAL_ALGORITHM_VERSION
      : courtResult?.algorithmVersion || COURT_GLOBAL_ALGORITHM_VERSION,
    randomSeed: String(randomSeed),
    scoreBreakdown: courtResult?.scoreBreakdown || null,
    diagnostics: courtResult?.diagnostics || null,
    resultSnapshot: (finalMatchups || []).map((m) => ({
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
