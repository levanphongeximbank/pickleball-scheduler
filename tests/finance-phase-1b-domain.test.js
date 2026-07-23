import test from "node:test";
import assert from "node:assert/strict";

import * as Finance from "../src/features/finance/index.js";
import {
  FINANCE_ERROR_CODES,
  FinanceError,
  createMoney,
  addMoney,
  subtractMoney,
  compareMoney,
  moneyEquals,
  serializeMoney,
  applyPercentBps,
  createFeeDefinition,
  evaluateFeeDefinition,
  FEE_TYPE,
  FEE_STATUS,
  createFeePolicy,
  evaluateFeePolicy,
  createObligation,
  openObligation,
  applyObligationSettlement,
  cancelObligation,
  expireObligation,
  assertObligationAmountImmutable,
  OBLIGATION_STATUS,
  createInvoice,
  createInvoiceItem,
  sumInvoiceItems,
  issueInvoice,
  assertIssuedInvoiceImmutable,
  voidInvoice,
  applyInvoicePaymentHint,
  INVOICE_STATUS,
  createPayment,
  addPaymentAttempt,
  confirmPayment,
  failPayment,
  cancelPayment,
  expirePayment,
  createPaymentAttempt,
  confirmPaymentAttempt,
  failPaymentAttempt,
  PAYMENT_STATUS,
  PAYMENT_ATTEMPT_STATUS,
  issueReceiptFromPayment,
  serializeReceipt,
  requestRefund,
  approveRefund,
  rejectRefund,
  completeRefund,
  REFUND_STATUS,
  buildFinanceIdempotencyKey,
  normalizeIdempotencyInput,
  createFinanceEvent,
  serializeFinanceEvent,
  FINANCE_EVENT_TYPE,
  FINANCE_OWNING_MODULE,
  FINANCE_EVENT_TYPE_VALUES,
} from "../src/features/finance/index.js";

function assertThrowsCode(fn, code) {
  assert.throws(fn, (err) => {
    assert.ok(err instanceof FinanceError, "expected FinanceError");
    assert.equal(err.code, code);
    return true;
  });
}

// ---------------------------------------------------------------------------
// A. Money
// ---------------------------------------------------------------------------

test("Money: valid VND amount and zero", () => {
  const m = createMoney(150000, "VND");
  assert.equal(m.amountMinor, 150000);
  assert.equal(m.currency, "VND");
  const z = createMoney(0, "VND");
  assert.equal(z.amountMinor, 0);
});

test("Money: addition, subtraction, comparison, equality, serialization", () => {
  const a = createMoney(1000, "VND");
  const b = createMoney(250, "VND");
  assert.equal(addMoney(a, b).amountMinor, 1250);
  assert.equal(subtractMoney(a, b).amountMinor, 750);
  assert.equal(compareMoney(a, b), 1);
  assert.equal(compareMoney(b, a), -1);
  assert.equal(compareMoney(a, createMoney(1000, "VND")), 0);
  assert.equal(moneyEquals(a, createMoney(1000, "VND")), true);
  assert.deepEqual(serializeMoney(a), { amountMinor: 1000, currency: "VND" });
});

test("Money: currency mismatch and invalid inputs", () => {
  assertThrowsCode(() => addMoney(createMoney(1, "VND"), { amountMinor: 1, currency: "USD" }), FINANCE_ERROR_CODES.UNSUPPORTED_CURRENCY);
  assertThrowsCode(() => createMoney(1.5, "VND"), FINANCE_ERROR_CODES.INVALID_MONEY);
  assertThrowsCode(() => createMoney(Number.NaN, "VND"), FINANCE_ERROR_CODES.INVALID_MONEY);
  assertThrowsCode(() => createMoney(Number.POSITIVE_INFINITY, "VND"), FINANCE_ERROR_CODES.INVALID_MONEY);
  assertThrowsCode(() => createMoney(Number.MAX_SAFE_INTEGER + 1, "VND"), FINANCE_ERROR_CODES.INVALID_MONEY);
  assertThrowsCode(() => createMoney(-1, "VND"), FINANCE_ERROR_CODES.INVALID_MONEY);
  assertThrowsCode(() => createMoney(1, "usd"), FINANCE_ERROR_CODES.UNSUPPORTED_CURRENCY);
  assertThrowsCode(() => createMoney(1, "EUR"), FINANCE_ERROR_CODES.UNSUPPORTED_CURRENCY);
  assertThrowsCode(() => createMoney(1, null), FINANCE_ERROR_CODES.UNSUPPORTED_CURRENCY);
});

test("Money: percent bps uses integer rounding (half-away-from-zero)", () => {
  // 1001 * 500 bps / 10000 = 50.05 → 50
  assert.equal(applyPercentBps(createMoney(1001, "VND"), 500).amountMinor, 50);
  // 1000 * 1500 / 10000 = 150
  assert.equal(applyPercentBps(createMoney(1000, "VND"), 1500).amountMinor, 150);
});

// ---------------------------------------------------------------------------
// B. Fee contracts
// ---------------------------------------------------------------------------

test("Fee: valid definition and deterministic evaluation", () => {
  const fee = createFeeDefinition({
    feeId: "fee-1",
    feeType: FEE_TYPE.TOURNAMENT_ENTRY,
    amountMinor: 200000,
    currency: "VND",
    tenantId: "tenant-a",
    venueId: "venue-1",
    competitionRef: "comp-9",
    status: FEE_STATUS.ACTIVE,
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    effectiveTo: "2026-12-31T23:59:59.000Z",
    policyVersion: 1,
  });
  assert.equal(fee.feeId, "fee-1");
  assert.equal(fee.amountMinor, 200000);

  const ok = evaluateFeeDefinition(fee, {
    at: "2026-06-01T00:00:00.000Z",
    tenantId: "tenant-a",
    venueId: "venue-1",
  });
  assert.equal(ok.applicable, true);
  assert.equal(ok.amount.amountMinor, 200000);

  const again = evaluateFeeDefinition(fee, {
    at: "2026-06-01T00:00:00.000Z",
    tenantId: "tenant-a",
    venueId: "venue-1",
  });
  assert.deepEqual(ok, again);
});

test("Fee: invalid amount, period, and scope", () => {
  assertThrowsCode(
    () =>
      createFeeDefinition({
        feeId: "f",
        feeType: FEE_TYPE.OPERATIONAL,
        amountMinor: 1.2,
        currency: "VND",
        tenantId: "t1",
      }),
    FINANCE_ERROR_CODES.INVALID_MONEY
  );
  assertThrowsCode(
    () =>
      createFeeDefinition({
        feeId: "f",
        feeType: FEE_TYPE.OPERATIONAL,
        amountMinor: 100,
        currency: "VND",
        tenantId: "t1",
        effectiveFrom: "2026-06-01T00:00:00.000Z",
        effectiveTo: "2026-01-01T00:00:00.000Z",
      }),
    FINANCE_ERROR_CODES.INVALID_FEE_DEFINITION
  );

  const fee = createFeeDefinition({
    feeId: "f2",
    feeType: FEE_TYPE.CLUB_MEMBERSHIP,
    amountMinor: 1000,
    currency: "VND",
    tenantId: "t1",
    clubId: "club-a",
    status: FEE_STATUS.ACTIVE,
  });
  const mismatch = evaluateFeeDefinition(fee, { tenantId: "t1", clubId: "club-b" });
  assert.equal(mismatch.applicable, false);
  assert.equal(mismatch.reason, "CLUB_SCOPE_MISMATCH");
});

test("Fee policy: evaluate sums applicable fees", () => {
  const policy = createFeePolicy({
    policyId: "pol-1",
    tenantId: "t1",
    version: 2,
    fees: [
      {
        feeId: "a",
        feeType: FEE_TYPE.VENUE_BOOKING,
        amountMinor: 1000,
        currency: "VND",
        status: FEE_STATUS.ACTIVE,
      },
      {
        feeId: "b",
        feeType: FEE_TYPE.COURT_BOOKING,
        amountMinor: 500,
        currency: "VND",
        status: FEE_STATUS.ACTIVE,
      },
      {
        feeId: "c",
        feeType: FEE_TYPE.OTHER,
        amountMinor: 999,
        currency: "VND",
        status: FEE_STATUS.INACTIVE,
      },
    ],
  });
  const result = evaluateFeePolicy(policy, { tenantId: "t1" });
  assert.equal(result.total.amountMinor, 1500);
  assert.equal(result.applicableFees.length, 2);
});

// ---------------------------------------------------------------------------
// C. Obligation lifecycle
// ---------------------------------------------------------------------------

test("Obligation: open, partial, full settlement, cancel, expire", () => {
  let ob = createObligation({
    obligationId: "ob-1",
    tenantId: "t1",
    amountMinor: 1000,
    currency: "VND",
  });
  assert.equal(ob.status, OBLIGATION_STATUS.CREATED);
  ob = openObligation(ob);
  assert.equal(ob.status, OBLIGATION_STATUS.OPEN);
  ob = applyObligationSettlement(ob, { amountMinor: 400 });
  assert.equal(ob.status, OBLIGATION_STATUS.PARTIALLY_SETTLED);
  assert.equal(ob.settledAmount.amountMinor, 400);
  ob = applyObligationSettlement(ob, { amountMinor: 600 });
  assert.equal(ob.status, OBLIGATION_STATUS.SETTLED);

  let cancelable = openObligation(
    createObligation({
      obligationId: "ob-2",
      tenantId: "t1",
      amountMinor: 100,
      currency: "VND",
    })
  );
  cancelable = cancelObligation(cancelable, { reason: "customer_request" });
  assert.equal(cancelable.status, OBLIGATION_STATUS.CANCELLED);

  let expirable = openObligation(
    createObligation({
      obligationId: "ob-3",
      tenantId: "t1",
      amountMinor: 100,
      currency: "VND",
    })
  );
  expirable = expireObligation(expirable);
  assert.equal(expirable.status, OBLIGATION_STATUS.EXPIRED);
});

test("Obligation: overpayment, invalid transition, immutability", () => {
  let ob = openObligation(
    createObligation({
      obligationId: "ob-4",
      tenantId: "t1",
      amountMinor: 100,
      currency: "VND",
    })
  );
  assertThrowsCode(
    () => applyObligationSettlement(ob, { amountMinor: 101 }),
    FINANCE_ERROR_CODES.OVERPAYMENT
  );
  ob = applyObligationSettlement(ob, { amountMinor: 50 });
  assertThrowsCode(() => cancelObligation({ ...ob, status: OBLIGATION_STATUS.SETTLED }), FINANCE_ERROR_CODES.INVALID_TRANSITION);
  assertThrowsCode(
    () =>
      assertObligationAmountImmutable(ob, { amountMinor: 999, currency: "VND" }),
    FINANCE_ERROR_CODES.IMMUTABLE_RECORD
  );
});

// ---------------------------------------------------------------------------
// D. Invoice lifecycle
// ---------------------------------------------------------------------------

test("Invoice: item totals, issue, void, immutability", () => {
  const items = [
    createInvoiceItem({ itemId: "i1", amountMinor: 1000, quantity: 2 }, "VND"),
    createInvoiceItem({ itemId: "i2", amountMinor: 500, quantity: 1 }, "VND"),
  ];
  assert.equal(sumInvoiceItems(items, "VND").amountMinor, 2500);

  assertThrowsCode(
    () =>
      createInvoice({
        invoiceId: "inv-bad",
        tenantId: "t1",
        currency: "VND",
        items: [
          { itemId: "x", amountMinor: 100, currency: "VND" },
          { itemId: "y", amountMinor: 100, currency: "USD" },
        ],
      }),
    FINANCE_ERROR_CODES.CURRENCY_MISMATCH
  );

  let inv = createInvoice({
    invoiceId: "inv-1",
    tenantId: "t1",
    currency: "VND",
    items: [
      { itemId: "i1", amountMinor: 1000, quantity: 1 },
      { itemId: "i2", amountMinor: 500, quantity: 1 },
    ],
  });
  assert.equal(inv.total.amountMinor, 1500);
  assert.equal(inv.status, INVOICE_STATUS.DRAFT);

  assertThrowsCode(
    () =>
      issueInvoice(
        createInvoice({
          invoiceId: "inv-empty",
          tenantId: "t1",
          currency: "VND",
          items: [],
        })
      ),
    FINANCE_ERROR_CODES.INVALID_INPUT
  );

  inv = issueInvoice(inv, { issuedAt: "2026-07-01T00:00:00.000Z" });
  assert.equal(inv.status, INVOICE_STATUS.ISSUED);
  assertThrowsCode(
    () =>
      assertIssuedInvoiceImmutable(inv, {
        ...inv,
        items: [{ itemId: "i1", amountMinor: 1, quantity: 1 }],
      }),
    FINANCE_ERROR_CODES.IMMUTABLE_RECORD
  );

  inv = applyInvoicePaymentHint(inv, { amountMinor: 500 });
  assert.equal(inv.status, INVOICE_STATUS.PARTIALLY_PAID);
  const voided = voidInvoice(inv, { reason: "duplicate" });
  assert.equal(voided.status, INVOICE_STATUS.VOID);
});

// ---------------------------------------------------------------------------
// E. Payment + attempt lifecycle
// ---------------------------------------------------------------------------

test("Payment: pending to confirmed with evidence; duplicate confirmation", () => {
  let payment = createPayment({
    paymentId: "pay-1",
    tenantId: "t1",
    amountMinor: 10000,
    currency: "VND",
  });
  payment = addPaymentAttempt(payment, {
    attemptId: "att-1",
    providerReference: "prov-1",
  });
  assert.equal(payment.status, PAYMENT_STATUS.PENDING);

  assertThrowsCode(
    () =>
      confirmPayment(payment, {
        attemptId: "att-1",
      }),
    FINANCE_ERROR_CODES.PAYMENT_EVIDENCE_REQUIRED
  );

  const confirmed = confirmPayment(payment, {
    attemptId: "att-1",
    evidenceRef: "ev-1",
    providerTransactionReference: "txn-1",
    confirmedAt: "2026-07-02T00:00:00.000Z",
  });
  assert.equal(confirmed.financialEffectApplied, true);
  assert.equal(confirmed.payment.status, PAYMENT_STATUS.CONFIRMED);
  assert.equal(confirmed.payment.providerTransactionReference, "txn-1");

  const idempotent = confirmPayment(confirmed.payment, {
    attemptId: "att-1",
    evidenceRef: "ev-1",
  });
  assert.equal(idempotent.financialEffectApplied, false);

  assertThrowsCode(
    () =>
      confirmPayment(confirmed.payment, {
        attemptId: "att-other",
        evidenceRef: "ev-2",
      }),
    FINANCE_ERROR_CODES.DUPLICATE_FINANCIAL_EFFECT
  );
});

test("Payment: fail/cancel/expire and new attempt after failure", () => {
  let payment = createPayment({
    paymentId: "pay-2",
    tenantId: "t1",
    amountMinor: 1000,
    currency: "VND",
  });
  payment = addPaymentAttempt(payment, { attemptId: "a1" });
  const failedAttempt = failPaymentAttempt(payment.attempts[0], { reason: "declined" });
  assert.equal(failedAttempt.status, PAYMENT_ATTEMPT_STATUS.FAILED);
  assertThrowsCode(
    () => confirmPaymentAttempt(failedAttempt, { evidenceRef: "e" }),
    FINANCE_ERROR_CODES.INVALID_TRANSITION
  );

  payment = {
    ...payment,
    attempts: Object.freeze([failedAttempt]),
  };
  payment = addPaymentAttempt(payment, { attemptId: "a2" });
  assert.equal(payment.attempts.length, 2);
  assert.equal(payment.attempts[1].attemptNumber, 2);

  assert.equal(failPayment(createPayment({
    paymentId: "pay-3",
    tenantId: "t1",
    amountMinor: 1,
    currency: "VND",
  })).status, PAYMENT_STATUS.FAILED);
  assert.equal(cancelPayment(createPayment({
    paymentId: "pay-4",
    tenantId: "t1",
    amountMinor: 1,
    currency: "VND",
  })).status, PAYMENT_STATUS.CANCELLED);
  assert.equal(expirePayment(createPayment({
    paymentId: "pay-5",
    tenantId: "t1",
    amountMinor: 1,
    currency: "VND",
  })).status, PAYMENT_STATUS.EXPIRED);
});

test("Payment: provider reference immutability", () => {
  let payment = createPayment({
    paymentId: "pay-6",
    tenantId: "t1",
    amountMinor: 100,
    currency: "VND",
    providerTransactionReference: "txn-fixed",
  });
  payment = addPaymentAttempt(payment, { attemptId: "a1" });
  assertThrowsCode(
    () =>
      confirmPayment(payment, {
        attemptId: "a1",
        evidenceRef: "ev",
        providerTransactionReference: "txn-other",
      }),
    FINANCE_ERROR_CODES.IMMUTABLE_RECORD
  );
});

// ---------------------------------------------------------------------------
// F. Receipt
// ---------------------------------------------------------------------------

test("Receipt: issue from confirmed only; deterministic serialization", () => {
  let payment = createPayment({
    paymentId: "pay-r",
    tenantId: "t1",
    amountMinor: 5000,
    currency: "VND",
  });
  payment = addPaymentAttempt(payment, { attemptId: "a1" });
  payment = confirmPayment(payment, {
    attemptId: "a1",
    evidenceRef: "ev-r",
    confirmedAt: "2026-07-03T00:00:00.000Z",
  }).payment;

  const receipt = issueReceiptFromPayment(payment, {
    receiptId: "rcpt-1",
    issuedAt: "2026-07-03T00:01:00.000Z",
  });
  assert.equal(receipt.paymentId, "pay-r");
  assert.equal(receipt.amount.amountMinor, 5000);
  assert.deepEqual(serializeReceipt(receipt), serializeReceipt(receipt));

  assertThrowsCode(
    () =>
      issueReceiptFromPayment(
        createPayment({
          paymentId: "pay-pending",
          tenantId: "t1",
          amountMinor: 1,
          currency: "VND",
        }),
        { receiptId: "r", issuedAt: "2026-07-03T00:00:00.000Z" }
      ),
    FINANCE_ERROR_CODES.INVALID_TRANSITION
  );

  assertThrowsCode(
    () =>
      issueReceiptFromPayment(
        failPayment(
          createPayment({
            paymentId: "pay-failed",
            tenantId: "t1",
            amountMinor: 1,
            currency: "VND",
          })
        ),
        { receiptId: "r2", issuedAt: "2026-07-03T00:00:00.000Z" }
      ),
    FINANCE_ERROR_CODES.INVALID_TRANSITION
  );
});

// ---------------------------------------------------------------------------
// G. Refund
// ---------------------------------------------------------------------------

test("Refund: request, approve, reject, complete, partial, over-refund", () => {
  let payment = createPayment({
    paymentId: "pay-rf",
    tenantId: "t1",
    amountMinor: 1000,
    currency: "VND",
  });
  payment = addPaymentAttempt(payment, { attemptId: "a1" });
  payment = confirmPayment(payment, {
    attemptId: "a1",
    evidenceRef: "ev",
  }).payment;

  let { refund } = requestRefund(payment, {
    refundId: "rf-1",
    amountMinor: 400,
    reason: "partial",
  });
  refund = approveRefund(refund);
  assert.equal(refund.status, REFUND_STATUS.APPROVED);

  assertThrowsCode(
    () => completeRefund(refund, payment, {}),
    FINANCE_ERROR_CODES.PAYMENT_EVIDENCE_REQUIRED
  );

  const completed = completeRefund(refund, payment, {
    evidenceRef: "rf-ev-1",
    completedAt: "2026-07-04T00:00:00.000Z",
  });
  assert.equal(completed.refund.status, REFUND_STATUS.COMPLETED);
  assert.equal(completed.payment.refundedAmount.amountMinor, 400);
  assert.equal(completed.payment.amount.amountMinor, 1000);

  payment = completed.payment;
  const second = requestRefund(payment, {
    refundId: "rf-2",
    amountMinor: 600,
  });
  let refund2 = approveRefund(second.refund);
  const done2 = completeRefund(refund2, payment, { evidenceRef: "rf-ev-2" });
  assert.equal(done2.payment.refundedAmount.amountMinor, 1000);

  assertThrowsCode(
    () =>
      requestRefund(done2.payment, {
        refundId: "rf-3",
        amountMinor: 1,
      }),
    FINANCE_ERROR_CODES.INVALID_REFUND_AMOUNT
  );

  let rejected = requestRefund(
    confirmPayment(
      addPaymentAttempt(
        createPayment({
          paymentId: "pay-rj",
          tenantId: "t1",
          amountMinor: 100,
          currency: "VND",
        }),
        { attemptId: "a1" }
      ),
      { attemptId: "a1", evidenceRef: "e" }
    ).payment,
    { refundId: "rf-rj", amountMinor: 10 }
  ).refund;
  rejected = rejectRefund(rejected, { reason: "policy" });
  assert.equal(rejected.status, REFUND_STATUS.REJECTED);
  assertThrowsCode(
    () => completeRefund(rejected, payment, { evidenceRef: "x" }),
    FINANCE_ERROR_CODES.INVALID_TRANSITION
  );
});

// ---------------------------------------------------------------------------
// H. Idempotency
// ---------------------------------------------------------------------------

test("Idempotency: deterministic key, separation, malformed rejection, no secrets", () => {
  const key1 = buildFinanceIdempotencyKey({
    tenantId: "t1",
    operationType: "PAYMENT_CONFIRM",
    businessReference: "pay-1",
    version: 1,
  });
  const key2 = buildFinanceIdempotencyKey({
    tenantId: "t1",
    operationType: "PAYMENT_CONFIRM",
    businessReference: "pay-1",
    version: 1,
  });
  assert.equal(key1, key2);

  const otherTenant = buildFinanceIdempotencyKey({
    tenantId: "t2",
    operationType: "PAYMENT_CONFIRM",
    businessReference: "pay-1",
  });
  assert.notEqual(key1, otherTenant);

  const otherOp = buildFinanceIdempotencyKey({
    tenantId: "t1",
    operationType: "REFUND_COMPLETE",
    businessReference: "pay-1",
  });
  assert.notEqual(key1, otherOp);

  const otherBiz = buildFinanceIdempotencyKey({
    tenantId: "t1",
    operationType: "PAYMENT_CONFIRM",
    businessReference: "pay-2",
  });
  assert.notEqual(key1, otherBiz);

  assertThrowsCode(
    () => normalizeIdempotencyInput({ tenantId: "", operationType: "X", businessReference: "Y" }),
    FINANCE_ERROR_CODES.IDEMPOTENCY_CONFLICT
  );
  assertThrowsCode(
    () =>
      buildFinanceIdempotencyKey({
        tenantId: "t1",
        operationType: "secret_token",
        businessReference: "pay-1",
      }),
    FINANCE_ERROR_CODES.IDEMPOTENCY_CONFLICT
  );
  assert.equal(key1.includes("password"), false);
  assert.equal(key1.includes("secret"), false);
});

// ---------------------------------------------------------------------------
// I. Events
// ---------------------------------------------------------------------------

function baseEvent(overrides = {}) {
  return {
    eventId: "evt-1",
    occurredAt: "2026-07-05T00:00:00.000Z",
    tenantId: "t1",
    correlationId: "corr-1",
    idempotencyKey: "v1|t1|OP|ref-1",
    amountMinor: 1000,
    currency: "VND",
    financialReferences: {},
    payload: {},
    ...overrides,
  };
}

test("Events: every approved type + envelope validation", () => {
  const specs = [
    {
      eventType: FINANCE_EVENT_TYPE.FINANCE_OBLIGATION_CREATED,
      financialReferences: { obligationId: "ob-1" },
    },
    {
      eventType: FINANCE_EVENT_TYPE.INVOICE_CREATED,
      financialReferences: { invoiceId: "inv-1" },
    },
    {
      eventType: FINANCE_EVENT_TYPE.INVOICE_ISSUED,
      financialReferences: { invoiceId: "inv-1" },
    },
    {
      eventType: FINANCE_EVENT_TYPE.PAYMENT_PENDING,
      financialReferences: { paymentId: "pay-1" },
    },
    {
      eventType: FINANCE_EVENT_TYPE.PAYMENT_CONFIRMED,
      financialReferences: { paymentId: "pay-1" },
      evidenceRef: "ev-1",
    },
    {
      eventType: FINANCE_EVENT_TYPE.PAYMENT_FAILED,
      financialReferences: { paymentId: "pay-1" },
    },
    {
      eventType: FINANCE_EVENT_TYPE.PAYMENT_CANCELLED,
      financialReferences: { paymentId: "pay-1" },
    },
    {
      eventType: FINANCE_EVENT_TYPE.PAYMENT_EXPIRED,
      financialReferences: { paymentId: "pay-1" },
    },
    {
      eventType: FINANCE_EVENT_TYPE.RECEIPT_ISSUED,
      financialReferences: { receiptId: "rcpt-1", paymentId: "pay-1" },
      evidenceRef: "ev-1",
    },
    {
      eventType: FINANCE_EVENT_TYPE.REFUND_REQUESTED,
      financialReferences: { refundId: "rf-1" },
    },
    {
      eventType: FINANCE_EVENT_TYPE.REFUND_APPROVED,
      financialReferences: { refundId: "rf-1" },
    },
    {
      eventType: FINANCE_EVENT_TYPE.REFUND_REJECTED,
      financialReferences: { refundId: "rf-1" },
    },
    {
      eventType: FINANCE_EVENT_TYPE.REFUND_COMPLETED,
      financialReferences: { refundId: "rf-1" },
      evidenceRef: "ev-1",
    },
    {
      eventType: FINANCE_EVENT_TYPE.RECONCILIATION_COMPLETED,
      financialReferences: { reconciliationId: "rec-1" },
      evidenceRef: "ev-1",
      amountMinor: undefined,
      currency: undefined,
    },
    {
      eventType: FINANCE_EVENT_TYPE.FINANCIAL_ADJUSTMENT_RECORDED,
      financialReferences: { adjustmentId: "adj-1" },
    },
  ];

  assert.equal(specs.length, FINANCE_EVENT_TYPE_VALUES.length);

  for (const spec of specs) {
    const event = createFinanceEvent(baseEvent(spec));
    assert.equal(event.owningModule, FINANCE_OWNING_MODULE);
    assert.equal(event.eventType, spec.eventType);
    assert.ok(event.privacyClassification);
    assert.ok(Object.isFrozen(event));
    const serialized = serializeFinanceEvent(event);
    assert.equal(serialized.eventId, event.eventId);
  }
});

test("Events: reject unsupported type, eligibility fields, missing evidence", () => {
  assertThrowsCode(
    () => createFinanceEvent(baseEvent({ eventType: "BillingPaymentSucceeded" })),
    FINANCE_ERROR_CODES.INVALID_EVENT_PAYLOAD
  );
  assertThrowsCode(
    () =>
      createFinanceEvent(
        baseEvent({
          eventType: FINANCE_EVENT_TYPE.PAYMENT_CONFIRMED,
          financialReferences: { paymentId: "pay-1" },
          payload: { eligible: true },
          evidenceRef: "ev",
        })
      ),
    FINANCE_ERROR_CODES.INVALID_EVENT_PAYLOAD
  );
  assertThrowsCode(
    () =>
      createFinanceEvent(
        baseEvent({
          eventType: FINANCE_EVENT_TYPE.PAYMENT_CONFIRMED,
          financialReferences: { paymentId: "pay-1" },
        })
      ),
    FINANCE_ERROR_CODES.PAYMENT_EVIDENCE_REQUIRED
  );
  assertThrowsCode(
    () =>
      createFinanceEvent(
        baseEvent({
          eventType: FINANCE_EVENT_TYPE.PAYMENT_PENDING,
          financialReferences: { paymentId: "pay-1" },
          owningModule: "Billing",
        })
      ),
    FINANCE_ERROR_CODES.INVALID_EVENT_PAYLOAD
  );
});

// ---------------------------------------------------------------------------
// J. Public exports
// ---------------------------------------------------------------------------

test("Public exports: canonical contracts available; internal helpers not required", () => {
  assert.equal(typeof Finance.createMoney, "function");
  assert.equal(typeof Finance.createFeeDefinition, "function");
  assert.equal(typeof Finance.createFeePolicy, "function");
  assert.equal(typeof Finance.createObligation, "function");
  assert.equal(typeof Finance.createInvoice, "function");
  assert.equal(typeof Finance.createPayment, "function");
  assert.equal(typeof Finance.createPaymentAttempt, "function");
  assert.equal(typeof Finance.issueReceiptFromPayment, "function");
  assert.equal(typeof Finance.requestRefund, "function");
  assert.equal(typeof Finance.buildFinanceIdempotencyKey, "function");
  assert.equal(typeof Finance.createFinanceEvent, "function");
  assert.equal(typeof Finance.FinanceError, "function");
  assert.equal(Finance.FINANCE_OWNING_MODULE, "Finance");
  assert.equal("assertMinorAmount" in Finance, true);
  // Intentionally not exporting ad-hoc private names
  assert.equal("FORBIDDEN_PAYLOAD_KEYS" in Finance, false);
  assert.equal("requireId" in Finance, false);
});
