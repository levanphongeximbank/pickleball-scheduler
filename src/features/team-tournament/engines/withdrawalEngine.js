import { createId } from "../../../utils/id.js";
import { MATCHUP_STATUS } from "../constants.js";
import { findTeam, normalizeTeamData } from "../models/index.js";

export const WITHDRAWAL_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
};

export const WITHDRAWAL_TYPE = {
  WITHDRAW: "withdraw",
  FORFEIT: "forfeit",
};

function patchSettings(teamData, patch) {
  return normalizeTeamData({
    ...teamData,
    settings: {
      ...teamData.settings,
      ...patch,
    },
  });
}

function normalizeWithdrawal(record = {}) {
  if (!record?.id || !record?.teamId) {
    return null;
  }

  const status = Object.values(WITHDRAWAL_STATUS).includes(record.status)
    ? record.status
    : WITHDRAWAL_STATUS.PENDING;

  const type = Object.values(WITHDRAWAL_TYPE).includes(record.type)
    ? record.type
    : WITHDRAWAL_TYPE.WITHDRAW;

  return {
    id: String(record.id).trim(),
    teamId: String(record.teamId).trim(),
    type,
    reason: record.reason ? String(record.reason).trim() : "",
    status,
    requestedAt: record.requestedAt || null,
    processedAt: record.processedAt || null,
    processedBy: record.processedBy ? String(record.processedBy).trim() : "",
    rejectReason: record.rejectReason ? String(record.rejectReason).trim() : "",
  };
}

function listWithdrawals(teamData) {
  const raw = teamData?.settings?.withdrawals;
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.map(normalizeWithdrawal).filter(Boolean);
}

export function isTeamWithdrawn(teamData, teamId) {
  const normalizedTeamId = String(teamId);
  return listWithdrawals(teamData).some(
    (item) => item.teamId === normalizedTeamId && item.status === WITHDRAWAL_STATUS.APPROVED
  );
}

export function listPendingWithdrawals(teamData) {
  return listWithdrawals(teamData).filter(
    (item) => item.status === WITHDRAWAL_STATUS.PENDING
  );
}

export function requestWithdrawal(teamData, payload = {}) {
  const team = findTeam(teamData, payload.teamId);
  if (!team) {
    return { ok: false, error: "Không tìm thấy đội." };
  }

  if (isTeamWithdrawn(teamData, team.id)) {
    return { ok: false, error: "Đội đã rút lui." };
  }

  const pending = listPendingWithdrawals(teamData).find((item) => item.teamId === team.id);
  if (pending) {
    return { ok: false, error: "Đội đã có yêu cầu rút lui đang chờ duyệt." };
  }

  const type = payload.type || WITHDRAWAL_TYPE.WITHDRAW;
  if (!Object.values(WITHDRAWAL_TYPE).includes(type)) {
    return { ok: false, error: "Loại rút lui không hợp lệ." };
  }

  const record = normalizeWithdrawal({
    id: createId("wd"),
    teamId: team.id,
    type,
    reason: payload.reason || "",
    status: WITHDRAWAL_STATUS.PENDING,
    requestedAt: payload.requestedAt || new Date().toISOString(),
  });

  return {
    ok: true,
    teamData: patchSettings(teamData, {
      withdrawals: [...listWithdrawals(teamData), record],
    }),
    withdrawal: record,
  };
}

function applyWithdrawalEffects(teamData, teamId) {
  const normalizedTeamId = String(teamId);
  const teams = (teamData.teams || []).map((team) =>
    team.id === normalizedTeamId
      ? { ...team, withdrawn: true, withdrawnAt: new Date().toISOString() }
      : team
  );

  const matchups = (teamData.matchups || []).map((matchup) => {
    if (matchup.teamAId !== normalizedTeamId && matchup.teamBId !== normalizedTeamId) {
      return matchup;
    }

    if (matchup.status === MATCHUP_STATUS.COMPLETED) {
      return matchup;
    }

    return {
      ...matchup,
      status: MATCHUP_STATUS.COMPLETED,
      result: {
        teamAWins: matchup.teamAId === normalizedTeamId ? 0 : matchup.subMatches.length,
        teamBWins: matchup.teamBId === normalizedTeamId ? 0 : matchup.subMatches.length,
        teamAPoints: 0,
        teamBPoints: 0,
        winnerTeamId:
          matchup.teamAId === normalizedTeamId ? matchup.teamBId : matchup.teamAId,
      },
    };
  });

  return normalizeTeamData({
    ...teamData,
    teams,
    matchups,
  });
}

export function approveWithdrawal(teamData, withdrawalId, options = {}) {
  const withdrawals = listWithdrawals(teamData);
  const target = withdrawals.find((item) => item.id === String(withdrawalId));
  if (!target) {
    return { ok: false, error: "Không tìm thấy yêu cầu rút lui." };
  }

  if (target.status !== WITHDRAWAL_STATUS.PENDING) {
    return { ok: false, error: "Yêu cầu đã được xử lý." };
  }

  const processedAt = options.processedAt || new Date().toISOString();
  const nextWithdrawals = withdrawals.map((item) =>
    item.id === target.id
      ? {
          ...item,
          status: WITHDRAWAL_STATUS.APPROVED,
          processedAt,
          processedBy: options.processedBy || options.userId || "",
        }
      : item
  );

  let nextData = patchSettings(teamData, { withdrawals: nextWithdrawals });
  nextData = applyWithdrawalEffects(nextData, target.teamId);

  return {
    ok: true,
    teamData: nextData,
    withdrawal: nextWithdrawals.find((item) => item.id === target.id),
  };
}

export function rejectWithdrawal(teamData, withdrawalId, options = {}) {
  const withdrawals = listWithdrawals(teamData);
  const target = withdrawals.find((item) => item.id === String(withdrawalId));
  if (!target) {
    return { ok: false, error: "Không tìm thấy yêu cầu rút lui." };
  }

  if (target.status !== WITHDRAWAL_STATUS.PENDING) {
    return { ok: false, error: "Yêu cầu đã được xử lý." };
  }

  const nextWithdrawals = withdrawals.map((item) =>
    item.id === target.id
      ? {
          ...item,
          status: WITHDRAWAL_STATUS.REJECTED,
          processedAt: options.processedAt || new Date().toISOString(),
          processedBy: options.processedBy || options.userId || "",
          rejectReason: options.reason || options.rejectReason || "",
        }
      : item
  );

  return {
    ok: true,
    teamData: patchSettings(teamData, { withdrawals: nextWithdrawals }),
    withdrawal: nextWithdrawals.find((item) => item.id === target.id),
  };
}

export function listWithdrawalHistory(teamData) {
  return listWithdrawals(teamData);
}
