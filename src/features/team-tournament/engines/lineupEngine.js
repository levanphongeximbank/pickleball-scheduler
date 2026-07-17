import {
  LINEUP_SOURCE,
  LINEUP_STATUS,
  MATCHUP_STATUS,
  MISSING_LINEUP_POLICY,
} from "../constants.js";
import {
  findMatchup,
  findTeam,
  getLineup,
  lineupKey,
  normalizeLineup,
  normalizeTeamData,
} from "../models/index.js";
import { validateLineupSelections } from "./lineupValidationEngine.js";
import { randomizeMissingLineups } from "./lineupRandomEngine.js";
import {
  LINEUP_ACTION,
  LINEUP_ACTOR_ROLE,
  assertLineupTransitionAllowed,
  canCaptainEditLineupStatus,
  evaluateLineupDeadline,
} from "./lineupStateMachine.js";
import {
  PRIVATE_PAIRING_OPERATION,
  evaluateV6PrivatePairingCandidate,
} from "../private-pairing/index.js";

function isBeforeLock(matchup, now = new Date()) {
  const check = evaluateLineupDeadline({
    action: LINEUP_ACTION.SUBMIT,
    matchup,
    serverNow: now,
  });
  return !check.isPastDeadline;
}

function canEditLineup(lineup) {
  if (!lineup) {
    return true;
  }
  return canCaptainEditLineupStatus(lineup.status);
}

function guardCaptainMutation({ action, lineup, matchup, now }) {
  return assertLineupTransitionAllowed({
    action,
    fromStatus: lineup?.status || LINEUP_STATUS.NOT_SUBMITTED,
    actorRole: LINEUP_ACTOR_ROLE.CAPTAIN,
    matchup,
    serverNow: now,
    lineup,
  });
}

export function saveLineupDraft(teamData, { matchupId, teamId, selections, players = [], now = new Date() }) {
  const matchup = findMatchup(teamData, matchupId);
  if (!matchup) {
    return { ok: false, error: "Không tìm thấy lượt đối đầu." };
  }

  if (!isBeforeLock(matchup, now)) {
    return { ok: false, error: "Đã quá giờ khóa đội hình." };
  }

  const key = lineupKey(matchupId, teamId);
  const existing = getLineup(teamData, matchupId, teamId);
  const transition = guardCaptainMutation({
    action: LINEUP_ACTION.SAVE_DRAFT,
    lineup: existing,
    matchup,
    now,
  });
  if (!transition.ok) {
    return { ok: false, error: transition.error, code: transition.code };
  }
  if (existing && !canEditLineup(existing)) {
    return { ok: false, error: "Đội hình đã khóa, không thể sửa." };
  }

  const validation = validateLineupSelections({
    teamData,
    teamId,
    selections,
    players,
    partial: true,
  });

  if (!validation.ok) {
    return { ok: false, error: validation.errors.join(" ") };
  }

  const hasSelections = Object.values(validation.selections).some(
    (playerIds) => playerIds.length > 0
  );

  const lineup = normalizeLineup({
    matchupId,
    teamId,
    status: hasSelections ? LINEUP_STATUS.DRAFT : LINEUP_STATUS.NOT_SUBMITTED,
    selections: validation.selections,
    source: LINEUP_SOURCE.CAPTAIN,
  });

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
  };
}

export function submitLineup(
  teamData,
  {
    matchupId,
    teamId,
    selections,
    players = [],
    now = new Date(),
    privatePairingRules = [],
    clubId = null,
    tournamentId = null,
    eventId = null,
    competitionClass = null,
    envSource,
  } = {}
) {
  const matchup = findMatchup(teamData, matchupId);
  if (!matchup) {
    return { ok: false, error: "Không tìm thấy lượt đối đầu." };
  }

  if (!isBeforeLock(matchup, now)) {
    return { ok: false, error: "Đã quá giờ khóa đội hình." };
  }

  const key = lineupKey(matchupId, teamId);
  const existing = getLineup(teamData, matchupId, teamId);
  const transition = guardCaptainMutation({
    action: LINEUP_ACTION.SUBMIT,
    lineup: existing,
    matchup,
    now,
  });
  if (!transition.ok) {
    return { ok: false, error: transition.error, code: transition.code };
  }
  if (existing && !canEditLineup(existing)) {
    return { ok: false, error: "Đội hình đã khóa, không thể nộp." };
  }

  const validation = validateLineupSelections({
    teamData,
    teamId,
    selections,
    players,
  });

  if (!validation.ok) {
    return { ok: false, error: validation.errors.join(" ") };
  }

  // Private pairing hard rules on partner selections (LINEUP_FORMATION).
  if ((privatePairingRules || []).length > 0) {
    if (!tournamentId && !clubId) {
      return {
        ok: false,
        error: "Thiếu context giải/CLB khi kiểm tra quy tắc ưu tiên đội hình.",
        code: "PRIVATE_PAIRING_CONTEXT_REQUIRED",
      };
    }

    const playersById = Object.fromEntries(
      (players || []).map((player) => [String(player.id), player])
    );
    for (const [disciplineId, playerIds] of Object.entries(validation.selections || {})) {
      if (!Array.isArray(playerIds) || playerIds.length < 2) {
        continue;
      }
      const members = playerIds
        .map((id) => playersById[String(id)])
        .filter(Boolean);
      const scored = evaluateV6PrivatePairingCandidate(
        {
          id: `submit-lineup-${disciplineId}`,
          teams: [{ playerIds: playerIds.map(String), members }],
        },
        {
          operation: PRIVATE_PAIRING_OPERATION.LINEUP_FORMATION,
          privatePairingRules,
          clubId,
          tournamentId,
          eventId,
          teamId,
          matchupId,
          competitionClass,
          envSource,
          playersById,
        }
      );
      if (scored.feasible === false) {
        return {
          ok: false,
          error: "Đội hình vi phạm điều kiện bắt buộc của quy tắc ưu tiên.",
          code: scored.rejectionCodes?.[0] || "LINEUP_PRIVATE_PAIRING_HARD",
          rejectionCodes: scored.rejectionCodes,
        };
      }
    }
  }

  const lineup = normalizeLineup({
    matchupId,
    teamId,
    status: LINEUP_STATUS.SUBMITTED,
    selections: validation.selections,
    submittedAt: new Date(now).toISOString(),
    source: LINEUP_SOURCE.CAPTAIN,
  });

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
  };
}

export function lockMatchupLineups(
  teamData,
  {
    matchupId,
    players = [],
    now = new Date(),
    privatePairingRules = [],
    clubId = null,
    tournamentId = null,
    eventId = null,
    competitionClass = null,
    envSource,
    randomSeed = null,
    actorId = null,
  } = {}
) {
  const matchup = findMatchup(teamData, matchupId);
  if (!matchup) {
    return { ok: false, error: "Không tìm thấy lượt đối đầu." };
  }

  let nextData = normalizeTeamData({ ...teamData });
  const logs = [];
  const lockTime = new Date(now).toISOString();

  for (const teamId of [matchup.teamAId, matchup.teamBId]) {
    const lineup = getLineup(nextData, matchupId, teamId);
    const team = findTeam(nextData, teamId);
    const current = getLineup(nextData, matchupId, teamId);

    if (
      !lineup ||
      lineup.status === LINEUP_STATUS.NOT_SUBMITTED ||
      lineup.status === LINEUP_STATUS.DRAFT
    ) {
      const policy = nextData.settings?.missingLineupPolicy || MISSING_LINEUP_POLICY.RANDOM;

      if (policy === MISSING_LINEUP_POLICY.RANDOM) {
        const randomResult = randomizeMissingLineups(nextData, {
          matchupId,
          teamId,
          players,
          now,
          privatePairingRules,
          clubId,
          tournamentId,
          eventId,
          competitionClass,
          envSource,
          randomSeed,
          actorId,
        });

        if (!randomResult.ok) {
          return randomResult;
        }

        nextData = randomResult.teamData;
        logs.push(
          randomResult.auditNote ||
            `Đội ${team?.name || teamId} không nộp đội hình trước hạn. Hệ thống đã tự động chọn đội hình lúc ${new Date(now).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}.`
        );
        continue;
      }

      if (
        policy === MISSING_LINEUP_POLICY.FORFEIT ||
        policy === MISSING_LINEUP_POLICY.FORFEIT_PENDING
      ) {
        nextData.lineups[lineupKey(matchupId, teamId)] = normalizeLineup({
          ...(current || { matchupId, teamId, selections: {} }),
          status: LINEUP_STATUS.NOT_SUBMITTED,
          auditNote: "tt2d:forfeit_pending",
        });
        logs.push(`Đội ${team?.name || teamId} thiếu lineup — đánh dấu forfeit_pending (TT-4).`);
        continue;
      }

      if (policy === MISSING_LINEUP_POLICY.MANUAL_PENDING) {
        return { ok: false, error: `Đội ${team?.name || teamId} thiếu lineup — cần xử lý thủ công.` };
      }
    }

    const lockedLineup = getLineup(nextData, matchupId, teamId);
    if (!lockedLineup) {
      continue;
    }

    const key = lineupKey(matchupId, teamId);
    nextData.lineups[key] = normalizeLineup({
      ...lockedLineup,
      status: LINEUP_STATUS.LOCKED,
      lockedAt: lockTime,
    });
    logs.push(`Hệ thống khóa đội hình đội ${team?.name || teamId}.`);
  }

  nextData.matchups = nextData.matchups.map((item) =>
    item.id === matchupId
      ? { ...item, status: MATCHUP_STATUS.LOCKED }
      : item
  );

  return { ok: true, teamData: nextData, logs };
}

export function publishMatchupLineups(teamData, { matchupId, actorRole = LINEUP_ACTOR_ROLE.BTC }) {
  const matchup = findMatchup(teamData, matchupId);
  if (!matchup) {
    return { ok: false, error: "Không tìm thấy lượt đối đầu." };
  }

  const publishTime = new Date().toISOString();
  const nextLineups = { ...teamData.lineups };

  for (const teamId of [matchup.teamAId, matchup.teamBId]) {
    const key = lineupKey(matchupId, teamId);
    const lineup = nextLineups[key];
    if (!lineup) {
      return { ok: false, error: `Đội ${teamId} chưa có đội hình để công bố.` };
    }

    const transition = assertLineupTransitionAllowed({
      action: LINEUP_ACTION.PUBLISH,
      fromStatus: lineup.status,
      actorRole,
      matchup,
      serverNow: publishTime,
      lineup,
    });
    if (!transition.ok) {
      return { ok: false, error: transition.error, code: transition.code };
    }

    nextLineups[key] = normalizeLineup({
      ...lineup,
      status: LINEUP_STATUS.PUBLISHED,
      publishedAt: publishTime,
    });
  }

  const nextData = normalizeTeamData({
    ...teamData,
    lineups: nextLineups,
    matchups: teamData.matchups.map((item) =>
      item.id === matchupId
        ? { ...item, status: MATCHUP_STATUS.PUBLISHED }
        : item
    ),
  });

  return { ok: true, teamData: nextData };
}

export function getVisibleLineup(teamData, { matchupId, viewerTeamId, isOrganizer = false }) {
  const matchup = findMatchup(teamData, matchupId);
  if (!matchup) {
    return { ok: false, error: "Không tìm thấy lượt đối đầu." };
  }

  const ownLineup = getLineup(teamData, matchupId, viewerTeamId);
  const opponentTeamId =
    viewerTeamId === matchup.teamAId ? matchup.teamBId : matchup.teamAId;
  const opponentLineup = getLineup(teamData, matchupId, opponentTeamId);

  const canSeeOpponent =
    isOrganizer ||
    matchup.status === MATCHUP_STATUS.PUBLISHED ||
    matchup.status === MATCHUP_STATUS.IN_PROGRESS ||
    matchup.status === MATCHUP_STATUS.COMPLETED;

  return {
    ok: true,
    ownLineup,
    opponentLineup: canSeeOpponent ? opponentLineup : null,
    submissionStatus: {
      teamA: getLineup(teamData, matchupId, matchup.teamAId)?.status || LINEUP_STATUS.NOT_SUBMITTED,
      teamB: getLineup(teamData, matchupId, matchup.teamBId)?.status || LINEUP_STATUS.NOT_SUBMITTED,
    },
  };
}

export function buildOfficialPairings(teamData, matchupId) {
  const matchup = findMatchup(teamData, matchupId);
  if (!matchup) {
    return { ok: false, error: "Không tìm thấy lượt đối đầu." };
  }

  if (matchup.status !== MATCHUP_STATUS.PUBLISHED) {
    return { ok: false, error: "Lượt đối đầu chưa được công bố." };
  }

  const pairings = matchup.subMatches.map((subMatch) => {
    const discipline = teamData.disciplines.find((item) => item.id === subMatch.disciplineId);
    const lineupA = getLineup(teamData, matchupId, matchup.teamAId);
    const lineupB = getLineup(teamData, matchupId, matchup.teamBId);

    return {
      subMatchId: subMatch.id,
      disciplineId: subMatch.disciplineId,
      disciplineName: discipline?.name || subMatch.disciplineId,
      teamAPlayerIds: lineupA?.selections?.[subMatch.disciplineId] || [],
      teamBPlayerIds: lineupB?.selections?.[subMatch.disciplineId] || [],
      status: subMatch.status,
      score: subMatch.score,
    };
  });

  return { ok: true, pairings };
}
