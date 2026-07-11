import { getPlayerGenderKey } from "../../../models/player.js";
import { PLAYERS_PER_MATCH, PLAY_MODE } from "../constants/playModes.js";
import { ASSIGNMENT_STATUS, COURT_RUNTIME_STATUS } from "../constants/statuses.js";
import {
  assignmentStatusToCourtRuntime,
  collectBusyCourtIds,
  normalizeCourtId,
  patchCourtState,
} from "../services/courtStateService.js";
import { computePriorityScore } from "../services/queueService.js";
import { isRulesV2Enabled } from "../../competition-core/config/featureFlags.js";
import {
  evaluateLegacyCourtEngineCombinationScore,
} from "../../competition-core/constraints/adapters/constraintsEvaluationBridge.js";
import {
  mapCourtMatchHistoryToRepeatCounts,
  mapCourtSessionPlayersToSnapshots,
} from "../../competition-core/constraints/adapters/legacyRuleMappers.js";

function playerRating(player) {
  return Number(player?.rating ?? player?.level ?? 3.5);
}

function isCourtAvailable(court, courtStates = {}, busyCourtIds = new Set()) {
  const id = normalizeCourtId(court.id);
  if (busyCourtIds.has(id)) {
    return false;
  }
  const state = courtStates[id] || {};
  if (court.locked || state.locked) {
    return false;
  }
  if (state.status === COURT_RUNTIME_STATUS.MAINTENANCE || state.status === COURT_RUNTIME_STATUS.LOCKED) {
    return false;
  }
  return court.active !== false;
}

function getPlayersNeeded(playMode) {
  return PLAYERS_PER_MATCH[playMode] || 4;
}

function countRecentPartners(matchHistory, playerId, windowSize = 2) {
  const recent = (matchHistory || []).slice(-windowSize);
  let count = 0;
  recent.forEach((match) => {
    const teams = match.teams || [];
    teams.forEach((team) => {
      if (team.includes(String(playerId))) {
        team.forEach((mate) => {
          if (String(mate) !== String(playerId)) {
            count += 1;
          }
        });
      }
    });
  });
  return count;
}

function countRecentOpponents(matchHistory, playerId, opponentId, windowSize = 2) {
  const recent = (matchHistory || []).slice(-windowSize);
  let count = 0;
  recent.forEach((match) => {
    const teamA = match.teamA || match.teams?.[0] || [];
    const teamB = match.teamB || match.teams?.[1] || [];
    const inA = teamA.map(String).includes(String(playerId));
    const inB = teamB.map(String).includes(String(playerId));
    if (inA && teamB.map(String).includes(String(opponentId))) {
      count += 1;
    }
    if (inB && teamA.map(String).includes(String(opponentId))) {
      count += 1;
    }
  });
  return count;
}

function scoreTeamBalance(teamA, teamB, playersById, maxLevelDiff, options = {}) {
  const sumA = teamA.reduce((sum, id) => sum + playerRating(playersById.get(String(id))), 0);
  const sumB = teamB.reduce((sum, id) => sum + playerRating(playersById.get(String(id))), 0);
  const diff = Math.abs(sumA - sumB);
  const balanceScore = Math.max(0, 100 - diff * 20);
  const penalty =
    options.skipLegacyLevelPenalty || isRulesV2Enabled(options.envSource)
      ? 0
      : diff > maxLevelDiff
        ? (diff - maxLevelDiff) * 30
        : 0;
  return { balanceScore: Math.max(0, balanceScore - penalty), diff };
}

function scoreCombination(group, playersById, matchHistory, config, queueEntries, session, options = {}) {
  const ids = group.map((item) => String(item.playerId));
  const playMode = config.playMode || PLAY_MODE.DOUBLES;
  const maxLevelDiff = Number(config.maxLevelDiff ?? 0.5);
  const useCanonical = isRulesV2Enabled(options.envSource);
  const repeatCounts = mapCourtMatchHistoryToRepeatCounts(matchHistory);
  const canonicalPlayersById = mapCourtSessionPlayersToSnapshots(
    session,
    [...playersById.values()]
  );

  let waitingScore = 0;
  ids.forEach((playerId) => {
    const entry = queueEntries.find((item) => String(item.playerId) === playerId);
    const checkIn = (session.checkIns || []).find((item) => String(item.playerId) === playerId);
    waitingScore += computePriorityScore(entry, checkIn);
  });
  waitingScore = Math.min(100, waitingScore / Math.max(1, ids.length));

  if (config.avoidPartnerRepeat !== false && playMode !== PLAY_MODE.SINGLES) {
    const [a, b, c, d] = ids;
    const splits = [
      { teamA: [a, b], teamB: [c, d] },
      { teamA: [a, c], teamB: [b, d] },
      { teamA: [a, d], teamB: [b, c] },
    ];

    let bestSplit = null;
    let bestSplitScore = -Infinity;
    let decisionTrace = null;

    splits.forEach((split) => {
      const { balanceScore, diff } = scoreTeamBalance(
        split.teamA,
        split.teamB,
        playersById,
        maxLevelDiff,
        options
      );
      let penalty = 0;
      let canonicalSoftDelta = 0;
      let hardRejected = false;

      if (useCanonical) {
        const bridge = evaluateLegacyCourtEngineCombinationScore(
          split,
          config,
          {
            playersById: canonicalPlayersById,
            partnerRepeatCounts: repeatCounts.partnerRepeatCounts,
            opponentRepeatCounts: repeatCounts.opponentRepeatCounts,
          },
          options
        );
        if (bridge.usedCanonical) {
          decisionTrace = bridge.trace;
          hardRejected = bridge.result.hardRejected === true;
          canonicalSoftDelta = Number(bridge.result.softScoreDelta ?? 0);
        }
      } else {
        if (config.avoidPartnerRepeat !== false) {
          penalty += countRecentPartners(matchHistory, split.teamA[0], 2) * 15;
          penalty += countRecentPartners(matchHistory, split.teamA[1], 2) * 15;
        }
        if (config.avoidOpponentRepeat !== false) {
          split.teamA.forEach((p) => {
            split.teamB.forEach((o) => {
              penalty += countRecentOpponents(matchHistory, p, o, 2) * 10;
            });
          });
        }
      }

      const total = hardRejected
        ? -Infinity
        : waitingScore * 0.4 +
          balanceScore * 0.4 -
          (useCanonical ? -canonicalSoftDelta * 0.2 : penalty * 0.2);

      if (total > bestSplitScore) {
        bestSplitScore = total;
        bestSplit = {
          ...split,
          balanceScore,
          diff,
          penalty: useCanonical ? -canonicalSoftDelta : penalty,
          hardRejected,
        };
      }
    });

    if (bestSplit?.hardRejected) {
      return {
        teamA: bestSplit.teamA,
        teamB: bestSplit.teamB,
        waitingScore,
        balanceScore: 0,
        repeatPenalty: 0,
        courtAvailabilityScore: 0,
        refereeScore: 0,
        totalScore: -Infinity,
        hardRejected: true,
        decisionTrace,
        reasons: ["Rules V2 rejected combination"],
      };
    }

    const repeatPenalty = bestSplit?.penalty || 0;
    const balanceScore = bestSplit?.balanceScore || 0;

    return {
      teamA: bestSplit?.teamA || [ids[0], ids[1]],
      teamB: bestSplit?.teamB || [ids[2], ids[3]],
      waitingScore,
      balanceScore,
      repeatPenalty,
      courtAvailabilityScore: 0,
      refereeScore: 0,
      totalScore: waitingScore * 0.4 + balanceScore * 0.4 - Math.max(0, repeatPenalty) * 0.2,
      decisionTrace,
      reasons: buildReasons(ids, bestSplit, waitingScore, balanceScore, Math.max(0, repeatPenalty)),
    };
  }

  const teamA = [ids[0]];
  const teamB = [ids[1]];
  const { balanceScore } = scoreTeamBalance(teamA, teamB, playersById, maxLevelDiff, options);

  return {
    teamA,
    teamB,
    waitingScore,
    balanceScore,
    repeatPenalty: 0,
    courtAvailabilityScore: 0,
    refereeScore: 0,
    totalScore: waitingScore * 0.5 + balanceScore * 0.5,
    reasons: [`2 người có thời gian chờ cao`, `Trình độ cân bằng`],
  };
}

function buildReasons(ids, split, waitingScore, balanceScore, repeatPenalty) {
  const reasons = [];
  if (waitingScore >= 50) {
    reasons.push(`${ids.length} người có thời gian chờ lâu nhất`);
  }
  if (balanceScore >= 70) {
    reasons.push("Trình độ cân bằng");
  } else if (balanceScore >= 40) {
    reasons.push("Trình độ gần cân bằng (chưa tối ưu)");
  }
  if (repeatPenalty === 0) {
    reasons.push("Không trùng đồng đội trong 2 lượt gần nhất");
  } else if (repeatPenalty > 0) {
    reasons.push("Có trùng cặp gần đây — phương án gần đúng");
  }
  if (split?.diff != null && split.diff <= 0.5) {
    reasons.push(`Chênh lệch trình độ ${split.diff.toFixed(1)}`);
  }
  return reasons.length ? reasons : ["Phương án khả dụng"];
}

function selectPlayerGroup(queueEntries, count, playersById, lockedIds) {
  const eligible = queueEntries.filter(
    (entry) => !entry.locked && !lockedIds.has(String(entry.playerId))
  );

  if (eligible.length < count) {
    return { group: null, error: `Không đủ ${count} người hợp lệ trong queue (có ${eligible.length}).` };
  }

  return { group: eligible.slice(0, count) };
}

function buildMatchHistoryFromAssignments(assignments = []) {
  return assignments
    .filter((item) => item.status === ASSIGNMENT_STATUS.COMPLETED || item.status === ASSIGNMENT_STATUS.PLAYING)
    .map((item) => ({
      teamA: item.teamA || item.teams?.[0]?.playerIds || [],
      teamB: item.teamB || item.teams?.[1]?.playerIds || [],
      teams: item.teams?.map((team) => team.playerIds) || [item.teamA, item.teamB],
    }));
}

function suggestReferee(refereeList = [], courtId, activeRefereeAssignments = []) {
  const busyIds = new Set(
    activeRefereeAssignments
      .filter((item) => item.status === "assigned" || item.status === "busy")
      .map((item) => String(item.refereeId))
  );

  const available = (refereeList || []).filter(
    (ref) => ref.status !== "offline" && !busyIds.has(String(ref.id))
  );

  if (!available.length) {
    return { refereeId: null, refereeScore: 0, reason: "Không có trọng tài rảnh" };
  }

  const sorted = [...available].sort(
    (a, b) => Number(a.matchCount || 0) - Number(b.matchCount || 0)
  );

  return {
    refereeId: sorted[0].id,
    refereeScore: 100,
    reason: `Trọng tài ${sorted[0].name || sorted[0].id} ít trận nhất`,
  };
}

/**
 * @param {Object} input
 * @returns {{ assignments, unassignedPlayers, warnings, reasons, scoreBreakdown }}
 */
export function generateCourtAssignments(input = {}) {
  const {
    courts = [],
    waitingPlayers = [],
    queueEntries = [],
    players = [],
    activeAssignments = [],
    matchHistory = [],
    refereeList = [],
    activeRefereeAssignments = [],
    courtStates = {},
    config = {},
    lockedPlayerIds = [],
  } = input;

  const warnings = [];
  const assignments = [];
  const unassignedPlayers = [];
  const playMode = config.playMode || PLAY_MODE.DOUBLES;
  const playersNeeded = getPlayersNeeded(playMode);
  const playersById = new Map((players || []).map((player) => [String(player.id), player]));
  const lockedIds = new Set((lockedPlayerIds || []).map(String));

  const busyCourtIds = collectBusyCourtIds(courtStates, activeAssignments);
  const availableCourts = (courts || []).filter((court) =>
    isCourtAvailable(court, courtStates, busyCourtIds)
  );

  if (!availableCourts.length) {
    warnings.push("Không có sân trống.");
    return {
      assignments: [],
      unassignedPlayers: waitingPlayers.map((p) => p.id || p.playerId),
      warnings,
      reasons: [],
      scoreBreakdown: [],
    };
  }

  const eligibleQueue = (queueEntries || []).filter(
    (entry) => !entry.locked && !entry.hidden && !lockedIds.has(String(entry.playerId))
  );

  if (eligibleQueue.length < playersNeeded) {
    warnings.push(
      `Không đủ ${playersNeeded} người đang chờ để ghép ${playMode === PLAY_MODE.SINGLES ? "singles" : "doubles"}.`
    );
    if (availableCourts.length > 0 && eligibleQueue.length > 0) {
      warnings.push(
        `Có ${availableCourts.length} sân trống nhưng chỉ có ${eligibleQueue.length} người hợp lệ trong queue.`
      );
    }
    lockedIds.forEach((id) => {
      if (queueEntries.some((entry) => String(entry.playerId) === id && entry.locked)) {
        warnings.push(`Người chơi ${id} đang bị khóa khỏi auto assignment.`);
      }
    });

    return {
      assignments: [],
      unassignedPlayers: eligibleQueue.map((entry) => entry.playerId),
      warnings,
      reasons: [],
      scoreBreakdown: [],
    };
  }

  const history = matchHistory.length
    ? matchHistory
    : buildMatchHistoryFromAssignments(activeAssignments);

  let remainingQueue = [...eligibleQueue].sort(
    (a, b) => computePriorityScore(b, null) - computePriorityScore(a, null)
  );

  availableCourts.forEach((court) => {
    const groupResult = selectPlayerGroup(remainingQueue, playersNeeded, playersById, lockedIds);
    if (!groupResult.group) {
      warnings.push(groupResult.error);
      return;
    }

    const sessionStub = {
      checkIns: input.checkIns || input.session?.checkIns || [],
      queue: queueEntries,
    };
    const scored = scoreCombination(
      groupResult.group,
      playersById,
      history,
      config,
      queueEntries,
      sessionStub,
      { envSource: input.envSource }
    );

    const refereeSuggestion = config.useReferees !== false
      ? suggestReferee(refereeList, court.id, activeRefereeAssignments)
      : { refereeId: null, refereeScore: 0, reason: "Không dùng trọng tài" };

    const now = new Date().toISOString();
    const estimatedMinutes = Number(config.defaultMatchMinutes || 20);

    const assignment = {
      id: `prop-${court.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sessionId: input.sessionId || null,
      courtId: normalizeCourtId(court.id),
      courtName: court.name || `Sân ${court.id}`,
      assignmentType: "auto",
      status: ASSIGNMENT_STATUS.PROPOSED,
      teamA: scored.teamA,
      teamB: scored.teamB,
      teams: [
        {
          playerIds: scored.teamA,
          label: scored.teamA.map((id) => playersById.get(String(id))?.name || id).join(" / "),
        },
        {
          playerIds: scored.teamB,
          label: scored.teamB.map((id) => playersById.get(String(id))?.name || id).join(" / "),
        },
      ],
      players: [...scored.teamA, ...scored.teamB],
      refereeId: refereeSuggestion.refereeId,
      startedAt: null,
      estimatedDurationMinutes: estimatedMinutes,
      estimatedEndAt: new Date(Date.now() + estimatedMinutes * 60000).toISOString(),
      reasons: [
        ...scored.reasons,
        `Sân ${court.name || court.id} đang trống và không bị khóa`,
        refereeSuggestion.reason,
      ].filter(Boolean),
      scoreBreakdown: {
        waitingScore: scored.waitingScore,
        balanceScore: scored.balanceScore,
        repeatPenalty: scored.repeatPenalty,
        courtAvailabilityScore: 100,
        refereeScore: refereeSuggestion.refereeScore,
        totalScore: scored.totalScore + refereeSuggestion.refereeScore * 0.1,
      },
      createdAt: now,
    };

    assignments.push(assignment);

    const usedIds = new Set(groupResult.group.map((item) => String(item.playerId)));
    remainingQueue = remainingQueue.filter((entry) => !usedIds.has(String(entry.playerId)));
  });

  unassignedPlayers.push(...remainingQueue.map((entry) => entry.playerId));

  if (playMode === PLAY_MODE.MIXED_DOUBLES) {
    assignments.forEach((assignment) => {
      const genders = assignment.players.map((id) =>
        getPlayerGenderKey(playersById.get(String(id))?.gender)
      );
      const hasMale = genders.includes("male");
      const hasFemale = genders.includes("female");
      if (!hasMale || !hasFemale) {
        warnings.push(`Trận sân ${assignment.courtName}: chưa đủ mixed doubles (Nam/Nữ).`);
      }
    });
  }

  return {
    assignments,
    unassignedPlayers,
    warnings,
    reasons: assignments.flatMap((item) => item.reasons),
    scoreBreakdown: assignments.map((item) => item.scoreBreakdown),
  };
}

export function confirmAssignments(session, proposedAssignments = [], options = {}) {
  const now = new Date().toISOString();
  const assignments = [...(session.assignments || [])];
  let courtStates = { ...(session.courtStates || {}) };

  proposedAssignments.forEach((proposal) => {
    const confirmed = {
      ...proposal,
      status: ASSIGNMENT_STATUS.ASSIGNED,
      assignmentType: proposal.assignmentType || "auto",
      confirmedAt: now,
      confirmedBy: options.actor || null,
    };
    assignments.push(confirmed);
    courtStates = patchCourtState(courtStates, confirmed.courtId, {
      status: assignmentStatusToCourtRuntime(ASSIGNMENT_STATUS.ASSIGNED),
      currentMatchId: confirmed.id,
      locked: courtStates[normalizeCourtId(confirmed.courtId)]?.locked || false,
    });
  });

  const playerIds = proposedAssignments.flatMap((item) => item.players || []);
  const queue = (session.queue || []).filter(
    (entry) => !playerIds.includes(String(entry.playerId))
  );

  const checkIns = (session.checkIns || []).map((item) =>
    playerIds.includes(String(item.playerId))
      ? { ...item, status: "playing", updatedAt: now }
      : item
  );

  return {
    ok: true,
    session: {
      ...session,
      assignments,
      queue,
      checkIns,
      courtStates,
      updatedAt: now,
    },
    playerIds,
  };
}
