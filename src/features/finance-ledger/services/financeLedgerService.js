const STORAGE_PREFIX = "pickleball-finance-ledger-v1::";

function storageKey(clubId) {
  return `${STORAGE_PREFIX}${clubId}`;
}

function emptyLedger() {
  return { debts: [], receipts: [], refunds: [] };
}

function readLedger(clubId) {
  try {
    const raw = localStorage.getItem(storageKey(clubId));
    if (!raw) return emptyLedger();
    const parsed = JSON.parse(raw);
    return {
      debts: Array.isArray(parsed.debts) ? parsed.debts : [],
      receipts: Array.isArray(parsed.receipts) ? parsed.receipts : [],
      refunds: Array.isArray(parsed.refunds) ? parsed.refunds : [],
    };
  } catch {
    return emptyLedger();
  }
}

function writeLedger(clubId, ledger) {
  localStorage.setItem(storageKey(clubId), JSON.stringify(ledger));
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function daysBetween(fromIso, toDate = new Date()) {
  const from = new Date(fromIso);
  const to = toDate instanceof Date ? toDate : new Date(toDate);
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function debtBalance(debt) {
  const amount = Number(debt.amount) || 0;
  const paid = Number(debt.paidAmount) || 0;
  return Math.max(0, amount - paid);
}

function normalizeDebtStatus(debt) {
  const balance = debtBalance(debt);
  if (balance <= 0) return "paid";
  if ((Number(debt.paidAmount) || 0) > 0) return "partial";
  return "open";
}

// --- Debts ---

export function listDebts(clubId, { status } = {}) {
  const ledger = readLedger(clubId);
  let debts = ledger.debts.map((debt) => ({
    ...debt,
    balance: debtBalance(debt),
    status: normalizeDebtStatus(debt),
  }));

  if (status) {
    debts = debts.filter((debt) => debt.status === status);
  }

  return debts.sort((a, b) => String(b.dueDate).localeCompare(String(a.dueDate)));
}

export function createDebt(clubId, payload = {}) {
  const ledger = readLedger(clubId);
  const amount = Number(payload.amount) || 0;
  const debt = {
    id: makeId("debt"),
    customerId: String(payload.customerId || "").trim(),
    customerName: String(payload.customerName || "").trim() || "Khách",
    amount,
    paidAmount: 0,
    dueDate: payload.dueDate || new Date().toISOString().slice(0, 10),
    note: String(payload.note || "").trim(),
    createdAt: new Date().toISOString(),
    status: "open",
  };
  ledger.debts.push(debt);
  writeLedger(clubId, ledger);
  return { ...debt, balance: amount, status: "open" };
}

export function updateDebt(clubId, debtId, patch = {}) {
  const ledger = readLedger(clubId);
  const index = ledger.debts.findIndex((row) => row.id === debtId);
  if (index < 0) return null;

  const current = ledger.debts[index];
  const next = {
    ...current,
    ...patch,
    amount: patch.amount !== undefined ? Number(patch.amount) || 0 : current.amount,
    paidAmount:
      patch.paidAmount !== undefined ? Number(patch.paidAmount) || 0 : current.paidAmount,
    updatedAt: new Date().toISOString(),
  };
  next.status = normalizeDebtStatus(next);
  ledger.debts[index] = next;
  writeLedger(clubId, ledger);
  return { ...next, balance: debtBalance(next) };
}

export function recordDebtPayment(clubId, debtId, { amount, receiptId } = {}) {
  const payment = Number(amount) || 0;
  if (payment <= 0) return null;

  const ledger = readLedger(clubId);
  const index = ledger.debts.findIndex((row) => row.id === debtId);
  if (index < 0) return null;

  const debt = ledger.debts[index];
  const nextPaid = Math.min(Number(debt.amount) || 0, (Number(debt.paidAmount) || 0) + payment);
  debt.paidAmount = nextPaid;
  debt.status = normalizeDebtStatus(debt);
  debt.updatedAt = new Date().toISOString();
  if (receiptId) {
    debt.lastReceiptId = receiptId;
  }
  ledger.debts[index] = debt;
  writeLedger(clubId, ledger);
  return { ...debt, balance: debtBalance(debt) };
}

export function getDebtAgingReport(clubId, { asOf = new Date() } = {}) {
  const openDebts = listDebts(clubId).filter((debt) => debt.balance > 0);
  const buckets = {
    current: { label: "Chưa đến hạn", count: 0, amount: 0, items: [] },
    days1to30: { label: "1–30 ngày", count: 0, amount: 0, items: [] },
    days31to60: { label: "31–60 ngày", count: 0, amount: 0, items: [] },
    days61to90: { label: "61–90 ngày", count: 0, amount: 0, items: [] },
    over90: { label: "> 90 ngày", count: 0, amount: 0, items: [] },
  };

  const asOfDate = asOf instanceof Date ? asOf : new Date(asOf);

  for (const debt of openDebts) {
    const overdueDays = daysBetween(debt.dueDate, asOfDate);
    let key = "current";
    if (overdueDays > 90) key = "over90";
    else if (overdueDays > 60) key = "days61to90";
    else if (overdueDays > 30) key = "days31to60";
    else if (overdueDays > 0) key = "days1to30";

    buckets[key].count += 1;
    buckets[key].amount += debt.balance;
    buckets[key].items.push(debt);
  }

  const totalOutstanding = openDebts.reduce((sum, debt) => sum + debt.balance, 0);

  return {
    asOf: asOfDate.toISOString(),
    totalOutstanding,
    openCount: openDebts.length,
    buckets: Object.values(buckets),
  };
}

// --- Receipts ---

export function listReceipts(clubId) {
  const ledger = readLedger(clubId);
  return [...ledger.receipts].sort((a, b) =>
    String(b.createdAt).localeCompare(String(a.createdAt))
  );
}

export function createReceipt(clubId, payload = {}) {
  const ledger = readLedger(clubId);
  const amount = Number(payload.amount) || 0;
  const receipt = {
    id: makeId("rcpt"),
    customerId: String(payload.customerId || "").trim(),
    customerName: String(payload.customerName || "").trim() || "Khách",
    amount,
    method: String(payload.method || "cash").trim(),
    reference: String(payload.reference || "").trim(),
    debtId: payload.debtId || null,
    note: String(payload.note || "").trim(),
    createdAt: new Date().toISOString(),
  };

  ledger.receipts.push(receipt);

  if (receipt.debtId) {
    const debtIndex = ledger.debts.findIndex((row) => row.id === receipt.debtId);
    if (debtIndex >= 0) {
      const debt = ledger.debts[debtIndex];
      debt.paidAmount = Math.min(
        Number(debt.amount) || 0,
        (Number(debt.paidAmount) || 0) + amount
      );
      debt.status = normalizeDebtStatus(debt);
      debt.lastReceiptId = receipt.id;
      debt.updatedAt = new Date().toISOString();
      ledger.debts[debtIndex] = debt;
    }
  }

  writeLedger(clubId, ledger);
  return receipt;
}

// --- Refunds ---

export function listRefunds(clubId, { status } = {}) {
  const ledger = readLedger(clubId);
  let refunds = [...ledger.refunds];
  if (status) {
    refunds = refunds.filter((row) => row.status === status);
  }
  return refunds.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function createRefund(clubId, payload = {}) {
  const ledger = readLedger(clubId);
  const refund = {
    id: makeId("rfnd"),
    receiptId: payload.receiptId || null,
    customerId: String(payload.customerId || "").trim(),
    customerName: String(payload.customerName || "").trim() || "Khách",
    amount: Number(payload.amount) || 0,
    reason: String(payload.reason || "").trim(),
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  ledger.refunds.push(refund);
  writeLedger(clubId, ledger);
  return refund;
}

export function updateRefundStatus(clubId, refundId, status) {
  const ledger = readLedger(clubId);
  const index = ledger.refunds.findIndex((row) => row.id === refundId);
  if (index < 0) return null;

  ledger.refunds[index] = {
    ...ledger.refunds[index],
    status,
    updatedAt: new Date().toISOString(),
  };
  writeLedger(clubId, ledger);
  return ledger.refunds[index];
}

export function clearFinanceLedger(clubId) {
  localStorage.removeItem(storageKey(clubId));
}
