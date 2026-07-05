import { findTeam, normalizeTeamData } from "../models/index.js";

export const PAYMENT_STATUS = {
  UNPAID: "unpaid",
  PARTIAL: "partial",
  PAID: "paid",
  WAIVED: "waived",
};

export const DEFAULT_ENTRY_FEE = {
  enabled: false,
  amount: 0,
  currency: "VND",
  perPlayer: false,
  dueDate: null,
  notes: "",
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

function normalizeTeamPayment(payment = {}) {
  const status = Object.values(PAYMENT_STATUS).includes(payment.status)
    ? payment.status
    : PAYMENT_STATUS.UNPAID;

  return {
    status,
    amountPaid: Math.max(0, Number(payment.amountPaid) || 0),
    paidAt: payment.paidAt || null,
    note: payment.note ? String(payment.note).trim() : "",
  };
}

export function normalizeEntryFee(fee = {}) {
  return {
    enabled: fee.enabled === true,
    amount: Math.max(0, Number(fee.amount) || 0),
    currency: fee.currency ? String(fee.currency).trim().toUpperCase() : "VND",
    perPlayer: fee.perPlayer === true,
    dueDate: fee.dueDate ? String(fee.dueDate).trim() : null,
    notes: fee.notes ? String(fee.notes).trim() : "",
    teamPayments:
      fee.teamPayments && typeof fee.teamPayments === "object"
        ? Object.entries(fee.teamPayments).reduce((accumulator, [teamId, payment]) => {
            accumulator[String(teamId)] = normalizeTeamPayment(payment);
            return accumulator;
          }, {})
        : {},
  };
}

export function getEntryFee(teamData) {
  return normalizeEntryFee(teamData?.settings?.entryFee || {});
}

export function setEntryFee(teamData, patch = {}) {
  const current = getEntryFee(teamData);
  const next = normalizeEntryFee({ ...current, ...patch });

  if (next.enabled && next.amount <= 0) {
    return { ok: false, error: "Lệ phí phải lớn hơn 0 khi bật thu phí." };
  }

  return {
    ok: true,
    teamData: patchSettings(teamData, { entryFee: next }),
    entryFee: next,
  };
}

export function getTeamFeeAmount(teamData, team) {
  const fee = getEntryFee(teamData);
  if (!fee.enabled) {
    return 0;
  }
  if (fee.perPlayer) {
    return fee.amount * (team?.playerIds?.length || 0);
  }
  return fee.amount;
}

export function getTeamPayment(teamData, teamId) {
  const fee = getEntryFee(teamData);
  return normalizeTeamPayment(fee.teamPayments[String(teamId)] || {});
}

export function isTeamFeePaid(teamData, teamId) {
  const fee = getEntryFee(teamData);
  if (!fee.enabled) {
    return true;
  }

  const payment = getTeamPayment(teamData, teamId);
  return payment.status === PAYMENT_STATUS.PAID || payment.status === PAYMENT_STATUS.WAIVED;
}

export function recordTeamPayment(teamData, teamId, payload = {}) {
  const team = findTeam(teamData, teamId);
  if (!team) {
    return { ok: false, error: "Không tìm thấy đội." };
  }

  const fee = getEntryFee(teamData);
  if (!fee.enabled) {
    return { ok: false, error: "Giải chưa bật lệ phí tham gia." };
  }

  const status = payload.status || PAYMENT_STATUS.PAID;
  if (!Object.values(PAYMENT_STATUS).includes(status)) {
    return { ok: false, error: "Trạng thái thanh toán không hợp lệ." };
  }

  const expected = getTeamFeeAmount(teamData, team);
  const amountPaid = Math.max(0, Number(payload.amountPaid ?? expected) || 0);
  const payment = normalizeTeamPayment({
    status,
    amountPaid,
    paidAt: payload.paidAt || new Date().toISOString(),
    note: payload.note || "",
  });

  const nextFee = normalizeEntryFee({
    ...fee,
    teamPayments: {
      ...fee.teamPayments,
      [String(teamId)]: payment,
    },
  });

  return {
    ok: true,
    teamData: patchSettings(teamData, { entryFee: nextFee }),
    teamId: String(teamId),
    payment,
    expectedAmount: expected,
  };
}

export function getEntryFeeSummary(teamData) {
  const fee = getEntryFee(teamData);
  const teams = teamData?.teams || [];

  const rows = teams.map((team) => {
    const expectedAmount = getTeamFeeAmount(teamData, team);
    const payment = getTeamPayment(teamData, team.id);
    return {
      teamId: team.id,
      teamName: team.name,
      expectedAmount,
      payment,
      paid: isTeamFeePaid(teamData, team.id),
    };
  });

  const totalExpected = rows.reduce((sum, row) => sum + row.expectedAmount, 0);
  const totalCollected = rows.reduce((sum, row) => sum + row.payment.amountPaid, 0);
  const unpaidCount = rows.filter((row) => !row.paid).length;

  return {
    fee,
    rows,
    totalExpected,
    totalCollected,
    unpaidCount,
    allPaid: fee.enabled ? unpaidCount === 0 : true,
  };
}
