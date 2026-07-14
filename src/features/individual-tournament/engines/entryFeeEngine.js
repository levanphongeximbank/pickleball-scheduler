/**
 * Individual tournament entry fees (S1-C).
 * Blob: tournament.settings.entryFee
 */
export const PAYMENT_STATUS = {
  UNPAID: "unpaid",
  PAID: "paid",
  REFUNDED: "refunded",
  WAIVED: "waived",
  PARTIAL: "partial",
};

export const FEE_MODE = {
  FREE: "free",
  FIXED: "fixed",
  EARLY_BIRD: "early_bird",
  LATE: "late",
};

export const DEFAULT_ENTRY_FEE = {
  enabled: false,
  mode: FEE_MODE.FREE,
  amount: 0,
  earlyBirdAmount: null,
  earlyBirdUntil: null,
  lateAmount: null,
  lateFrom: null,
  currency: "VND",
  perPlayer: false,
  requirePaidToApprove: false,
  dueDate: null,
  notes: "",
  confirmationMessage: "",
  entryPayments: {},
};

function patchTournamentSettings(tournament, patch) {
  return {
    ...tournament,
    settings: {
      ...(tournament.settings || {}),
      ...patch,
    },
  };
}

function normalizePayment(payment = {}) {
  const status = Object.values(PAYMENT_STATUS).includes(payment.status)
    ? payment.status
    : PAYMENT_STATUS.UNPAID;

  return {
    status,
    amountPaid: Math.max(0, Number(payment.amountPaid) || 0),
    paidAt: payment.paidAt || null,
    refundedAt: payment.refundedAt || null,
    note: payment.note ? String(payment.note).trim() : "",
    overriddenBy: payment.overriddenBy ? String(payment.overriddenBy).trim() : "",
  };
}

export function normalizeEntryFee(fee = {}) {
  const mode = Object.values(FEE_MODE).includes(fee.mode)
    ? fee.mode
    : fee.enabled
      ? FEE_MODE.FIXED
      : FEE_MODE.FREE;

  return {
    enabled: fee.enabled === true || (mode !== FEE_MODE.FREE && Number(fee.amount) > 0),
    mode: fee.enabled === false ? FEE_MODE.FREE : mode,
    amount: Math.max(0, Number(fee.amount) || 0),
    earlyBirdAmount:
      fee.earlyBirdAmount == null || fee.earlyBirdAmount === ""
        ? null
        : Math.max(0, Number(fee.earlyBirdAmount) || 0),
    earlyBirdUntil: fee.earlyBirdUntil ? String(fee.earlyBirdUntil).trim() : null,
    lateAmount:
      fee.lateAmount == null || fee.lateAmount === ""
        ? null
        : Math.max(0, Number(fee.lateAmount) || 0),
    lateFrom: fee.lateFrom ? String(fee.lateFrom).trim() : null,
    currency: fee.currency ? String(fee.currency).trim().toUpperCase() : "VND",
    perPlayer: fee.perPlayer === true,
    requirePaidToApprove: fee.requirePaidToApprove === true,
    dueDate: fee.dueDate ? String(fee.dueDate).trim() : null,
    notes: fee.notes ? String(fee.notes).trim() : "",
    confirmationMessage: fee.confirmationMessage
      ? String(fee.confirmationMessage).trim()
      : "",
    entryPayments:
      fee.entryPayments && typeof fee.entryPayments === "object"
        ? Object.entries(fee.entryPayments).reduce((accumulator, [entryId, payment]) => {
            accumulator[String(entryId)] = normalizePayment(payment);
            return accumulator;
          }, {})
        : {},
  };
}

export function getEntryFee(tournament) {
  return normalizeEntryFee(tournament?.settings?.entryFee || {});
}

export function setEntryFee(tournament, patch = {}) {
  const current = getEntryFee(tournament);
  const next = normalizeEntryFee({ ...current, ...patch });

  if (next.enabled && next.mode !== FEE_MODE.FREE && next.amount <= 0 && next.earlyBirdAmount == null) {
    return { ok: false, error: "Lệ phí phải lớn hơn 0 khi bật thu phí." };
  }

  return {
    ok: true,
    tournament: patchTournamentSettings(tournament, { entryFee: next }),
    entryFee: next,
  };
}

export function resolveFeeAmount(tournament, options = {}) {
  const fee = getEntryFee(tournament);
  if (!fee.enabled || fee.mode === FEE_MODE.FREE) {
    return { amount: 0, label: "Miễn phí", fee };
  }

  const now = Date.parse(options.now || new Date().toISOString());
  let amount = fee.amount;
  let label = "Phí cố định";

  if (fee.earlyBirdUntil && fee.earlyBirdAmount != null) {
    const until = Date.parse(fee.earlyBirdUntil);
    if (Number.isFinite(until) && now <= until) {
      amount = fee.earlyBirdAmount;
      label = "Early-bird";
    }
  }

  if (fee.lateFrom && fee.lateAmount != null) {
    const from = Date.parse(fee.lateFrom);
    if (Number.isFinite(from) && now >= from) {
      amount = fee.lateAmount;
      label = "Late registration";
    }
  }

  const playerCount = Math.max(1, Number(options.playerCount) || 1);
  if (fee.perPlayer) {
    amount *= playerCount;
  }

  return { amount, label, fee };
}

export function getEntryPayment(tournament, entryId) {
  const fee = getEntryFee(tournament);
  return normalizePayment(fee.entryPayments[String(entryId)] || {});
}

export function isEntryFeeSatisfied(tournament, entryId) {
  const fee = getEntryFee(tournament);
  if (!fee.enabled || fee.mode === FEE_MODE.FREE) {
    return true;
  }
  if (!fee.requirePaidToApprove) {
    return true;
  }
  const payment = getEntryPayment(tournament, entryId);
  return (
    payment.status === PAYMENT_STATUS.PAID ||
    payment.status === PAYMENT_STATUS.WAIVED
  );
}

export function canApproveWithFee(tournament, entryId) {
  if (isEntryFeeSatisfied(tournament, entryId)) {
    return { ok: true };
  }
  return {
    ok: false,
    error: "Chưa thanh toán lệ phí — không thể duyệt.",
    code: "FEE_UNPAID",
    payment: getEntryPayment(tournament, entryId),
  };
}

export function recordEntryPayment(tournament, entryId, payload = {}) {
  const fee = getEntryFee(tournament);
  if (!fee.enabled || fee.mode === FEE_MODE.FREE) {
    return { ok: false, error: "Giải chưa bật lệ phí tham gia." };
  }

  const status = payload.status || PAYMENT_STATUS.PAID;
  if (!Object.values(PAYMENT_STATUS).includes(status)) {
    return { ok: false, error: "Trạng thái thanh toán không hợp lệ." };
  }

  const expected = resolveFeeAmount(tournament, {
    playerCount: payload.playerCount,
    now: payload.now,
  }).amount;

  const payment = normalizePayment({
    status,
    amountPaid: Math.max(0, Number(payload.amountPaid ?? expected) || 0),
    paidAt:
      status === PAYMENT_STATUS.PAID || status === PAYMENT_STATUS.WAIVED
        ? payload.paidAt || new Date().toISOString()
        : payload.paidAt || null,
    refundedAt: status === PAYMENT_STATUS.REFUNDED ? payload.refundedAt || new Date().toISOString() : null,
    note: payload.note || "",
    overriddenBy: payload.overriddenBy || payload.userId || "",
  });

  const nextFee = normalizeEntryFee({
    ...fee,
    entryPayments: {
      ...fee.entryPayments,
      [String(entryId)]: payment,
    },
  });

  return {
    ok: true,
    tournament: patchTournamentSettings(tournament, { entryFee: nextFee }),
    entryId: String(entryId),
    payment,
    expectedAmount: expected,
  };
}

export function organizerOverridePayment(tournament, entryId, status, options = {}) {
  return recordEntryPayment(tournament, entryId, {
    status,
    amountPaid: options.amountPaid,
    note: options.note || "organizer_override",
    overriddenBy: options.userId || options.actor?.id || "organizer",
    playerCount: options.playerCount,
    now: options.now,
  });
}

export function getEntryFeeSummary(tournament) {
  const fee = getEntryFee(tournament);
  const entries = (tournament?.events || []).flatMap((event) =>
    (event.entries || []).map((entry) => ({ entry, event }))
  );

  const rows = entries.map(({ entry, event }) => {
    const expectedAmount = resolveFeeAmount(tournament, {
      playerCount: entry.playerIds?.length || 1,
    }).amount;
    const payment = getEntryPayment(tournament, entry.id);
    return {
      entryId: entry.id,
      entryName: entry.name,
      eventId: event.id,
      eventName: event.name,
      expectedAmount,
      payment,
      paid: isEntryFeeSatisfied(tournament, entry.id) || payment.status === PAYMENT_STATUS.PAID,
    };
  });

  const totalExpected = rows.reduce((sum, row) => sum + row.expectedAmount, 0);
  const totalCollected = rows.reduce((sum, row) => sum + row.payment.amountPaid, 0);
  const unpaidCount = rows.filter(
    (row) =>
      fee.enabled &&
      row.payment.status !== PAYMENT_STATUS.PAID &&
      row.payment.status !== PAYMENT_STATUS.WAIVED
  ).length;

  return {
    fee,
    rows,
    totalExpected,
    totalCollected,
    unpaidCount,
    allPaid: !fee.enabled || unpaidCount === 0,
  };
}
