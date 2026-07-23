/**
 * Phase 1C — Finance application services + in-memory repositories.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  FINANCE_ERROR_CODES,
  FinanceError,
  FEE_TYPE,
  FEE_STATUS,
  OBLIGATION_STATUS,
  INVOICE_STATUS,
  PAYMENT_STATUS,
  PAYMENT_ATTEMPT_STATUS,
  REFUND_STATUS,
  FINANCE_EVENT_TYPE,
  FINANCE_REPOSITORY_PORTS,
  createInMemoryFinanceRepositories,
  createFinanceApplication,
  createSequentialIdGenerator,
  createFeeDefinition,
  createObligation,
  createPayment,
  buildCanonicalRequestFingerprint,
} from "../src/features/finance/index.js";

function assertThrowsCode(fn, code) {
  assert.throws(fn, (err) => {
    assert.ok(err instanceof FinanceError, "expected FinanceError");
    assert.equal(err.code, code);
    return true;
  });
}

function baseCmd(overrides = {}) {
  return {
    tenantId: "tenant-a",
    idempotencyKey: "cmd-1",
    correlationId: "corr-1",
    actor: { actorId: "actor-1", actorType: "USER" },
    occurredAt: "2026-07-23T10:00:00.000Z",
    ...overrides,
  };
}

function createApp(seed = "t") {
  return createFinanceApplication({
    idGenerator: createSequentialIdGenerator(seed),
    useInMemoryRepositories: true,
  });
}

function happyPath(app, tenantId = "tenant-a") {
  const fee = app.fees.registerFeeDefinition(
    baseCmd({
      tenantId,
      idempotencyKey: "fee-reg",
      feeId: "fee-1",
      feeType: FEE_TYPE.OPERATIONAL,
      amountMinor: 100000,
      currency: "VND",
      status: FEE_STATUS.ACTIVE,
      policyVersion: 1,
    })
  );
  const obligation = app.obligations.createObligation(
    baseCmd({
      tenantId,
      idempotencyKey: "obl-create",
      obligationId: "obl-1",
      feeId: fee.fee.feeId,
      amountMinor: 100000,
      currency: "VND",
    })
  );
  app.obligations.openObligation(
    baseCmd({
      tenantId,
      idempotencyKey: "obl-open",
      obligationId: "obl-1",
    })
  );
  const invoice = app.invoices.createInvoice(
    baseCmd({
      tenantId,
      idempotencyKey: "inv-create",
      invoiceId: "inv-1",
      obligationIds: ["obl-1"],
    })
  );
  app.invoices.issueInvoice(
    baseCmd({
      tenantId,
      idempotencyKey: "inv-issue",
      invoiceId: "inv-1",
    })
  );
  const payment = app.payments.initiatePayment(
    baseCmd({
      tenantId,
      idempotencyKey: "pay-init",
      paymentId: "pay-1",
      invoiceId: "inv-1",
      obligationId: "obl-1",
    })
  );
  const attempt = app.payments.createPaymentAttempt(
    baseCmd({
      tenantId,
      idempotencyKey: "pay-attempt",
      paymentId: "pay-1",
      attemptId: "att-1",
    })
  );
  const confirmed = app.payments.confirmPayment(
    baseCmd({
      tenantId,
      idempotencyKey: "pay-confirm",
      paymentId: "pay-1",
      attemptId: "att-1",
      evidenceRef: "ev-confirm-1",
      providerTransactionReference: "prov-txn-1",
    })
  );
  const receipt = app.receipts.issueReceipt(
    baseCmd({
      tenantId,
      idempotencyKey: "rcpt-issue",
      paymentId: "pay-1",
      receiptId: "rcpt-1",
    })
  );
  return { fee, obligation, invoice, payment, attempt, confirmed, receipt };
}

// ---------------------------------------------------------------------------
// A. Repository contracts / in-memory
// ---------------------------------------------------------------------------

test("In-memory repos: save/read, not found, duplicate identity, isolation", () => {
  const repos = createInMemoryFinanceRepositories();
  const fee = createFeeDefinition({
    feeId: "f1",
    feeType: FEE_TYPE.OPERATIONAL,
    amountMinor: 1000,
    currency: "VND",
    tenantId: "t1",
    status: FEE_STATUS.ACTIVE,
  });
  repos.feeDefinitions.save(fee);
  assert.equal(repos.feeDefinitions.getById("t1", "f1").feeId, "f1");
  assert.equal(repos.feeDefinitions.findById("t2", "f1"), null);
  assertThrowsCode(() => repos.feeDefinitions.getById("t2", "f1"), FINANCE_ERROR_CODES.NOT_FOUND);
  assertThrowsCode(() => repos.feeDefinitions.save(fee), FINANCE_ERROR_CODES.CONFLICT);

  const a = createInMemoryFinanceRepositories();
  const b = createInMemoryFinanceRepositories();
  a.feeDefinitions.save(fee);
  assert.equal(b.feeDefinitions.findById("t1", "f1"), null);
  assert.ok(FINANCE_REPOSITORY_PORTS.FeeDefinitionRepository);
});

test("In-memory repos: immutable clone + provider txn uniqueness + idempotency", () => {
  const repos = createInMemoryFinanceRepositories();
  const obl = createObligation({
    obligationId: "o1",
    tenantId: "t1",
    amountMinor: 5000,
    currency: "VND",
  });
  const saved = repos.obligations.save(obl);
  const leaked = { ...saved, amount: { ...saved.amount } };
  leaked.amount.amountMinor = 1;
  assert.equal(repos.obligations.getById("t1", "o1").amount.amountMinor, 5000);

  const p1 = createPayment({
    paymentId: "p1",
    tenantId: "t1",
    amountMinor: 5000,
    currency: "VND",
    providerTransactionReference: "txn-x",
  });
  repos.payments.save(p1);
  assertThrowsCode(
    () =>
      repos.payments.save(
        createPayment({
          paymentId: "p2",
          tenantId: "t1",
          amountMinor: 100,
          currency: "VND",
          providerTransactionReference: "txn-x",
        })
      ),
    FINANCE_ERROR_CODES.CONFLICT
  );
  // Different tenant may reuse the same provider reference (documented policy).
  repos.payments.save(
    createPayment({
      paymentId: "p2",
      tenantId: "t2",
      amountMinor: 100,
      currency: "VND",
      providerTransactionReference: "txn-x",
    })
  );

  repos.idempotency.save({
    tenantId: "t1",
    operationType: "OP",
    idempotencyKey: "k1",
    requestFingerprint: "fp1",
    result: { ok: true },
    eventIds: [],
    createdAt: "2026-07-23T10:00:00.000Z",
  });
  assertThrowsCode(
    () =>
      repos.idempotency.save({
        tenantId: "t1",
        operationType: "OP",
        idempotencyKey: "k1",
        requestFingerprint: "fp2",
        result: { ok: false },
        eventIds: [],
        createdAt: "2026-07-23T10:00:00.000Z",
      }),
    FINANCE_ERROR_CODES.IDEMPOTENCY_CONFLICT
  );
  repos.resetAllForTests();
  assert.equal(repos.payments.findById("t1", "p1"), null);
});

test("Canonical fingerprint is order-independent and rejects secrets", () => {
  const a = buildCanonicalRequestFingerprint({ b: 1, a: 2 });
  const b = buildCanonicalRequestFingerprint({ a: 2, b: 1 });
  assert.equal(a, b);
  assertThrowsCode(
    () => buildCanonicalRequestFingerprint({ apiKey: "x" }),
    FINANCE_ERROR_CODES.INVALID_INPUT
  );
});

// ---------------------------------------------------------------------------
// B. Happy-path orchestration
// ---------------------------------------------------------------------------

test("Happy path: fee → obligation → invoice → payment → receipt + events", () => {
  const app = createApp("hp");
  const result = happyPath(app);
  assert.equal(result.confirmed.payment.status, PAYMENT_STATUS.CONFIRMED);
  assert.equal(result.receipt.receipt.receiptId, "rcpt-1");

  const obligation = app.repositories.obligations.getById("tenant-a", "obl-1");
  assert.equal(obligation.status, OBLIGATION_STATUS.SETTLED);
  const invoice = app.repositories.invoices.getById("tenant-a", "inv-1");
  assert.equal(invoice.status, INVOICE_STATUS.PAID);

  const events = app.repositories.events.listByTenant("tenant-a");
  const types = events.map((e) => e.eventType);
  assert.ok(types.includes(FINANCE_EVENT_TYPE.FINANCE_OBLIGATION_CREATED));
  assert.ok(types.includes(FINANCE_EVENT_TYPE.INVOICE_CREATED));
  assert.ok(types.includes(FINANCE_EVENT_TYPE.INVOICE_ISSUED));
  assert.ok(types.includes(FINANCE_EVENT_TYPE.PAYMENT_PENDING));
  assert.ok(types.includes(FINANCE_EVENT_TYPE.PAYMENT_CONFIRMED));
  assert.ok(types.includes(FINANCE_EVENT_TYPE.RECEIPT_ISSUED));
  for (const e of events) {
    assert.equal(e.correlationId, "corr-1");
    assert.equal(e.payload.eligible, undefined);
  }
});

// ---------------------------------------------------------------------------
// C. Payment failure paths
// ---------------------------------------------------------------------------

test("Payment failure paths: fail/cancel/expire attempts; new attempt; no settle", () => {
  const app = createApp("fail");
  app.fees.registerFeeDefinition(
    baseCmd({
      idempotencyKey: "f",
      feeId: "fee-1",
      feeType: FEE_TYPE.OPERATIONAL,
      amountMinor: 10000,
      currency: "VND",
      status: FEE_STATUS.ACTIVE,
    })
  );
  app.obligations.createObligation(
    baseCmd({
      idempotencyKey: "o",
      obligationId: "obl-1",
      feeId: "fee-1",
    })
  );
  app.obligations.openObligation(
    baseCmd({ idempotencyKey: "oo", obligationId: "obl-1" })
  );
  app.payments.initiatePayment(
    baseCmd({
      idempotencyKey: "p",
      paymentId: "pay-1",
      obligationId: "obl-1",
      amountMinor: 10000,
      currency: "VND",
    })
  );
  app.payments.createPaymentAttempt(
    baseCmd({
      idempotencyKey: "a1",
      paymentId: "pay-1",
      attemptId: "att-1",
    })
  );
  app.payments.failPaymentAttempt(
    baseCmd({
      idempotencyKey: "fail-att",
      paymentId: "pay-1",
      attemptId: "att-1",
      reason: "declined",
    })
  );
  assertThrowsCode(
    () =>
      app.payments.confirmPayment(
        baseCmd({
          idempotencyKey: "confirm-bad",
          paymentId: "pay-1",
          attemptId: "att-1",
          evidenceRef: "ev",
        })
      ),
    FINANCE_ERROR_CODES.INVALID_TRANSITION
  );

  app.payments.createPaymentAttempt(
    baseCmd({
      idempotencyKey: "a2",
      paymentId: "pay-1",
      attemptId: "att-2",
    })
  );
  assert.equal(
    app.repositories.obligations.getById("tenant-a", "obl-1").status,
    OBLIGATION_STATUS.OPEN
  );

  // cancel / expire attempt paths
  app.payments.cancelPaymentAttempt(
    baseCmd({
      idempotencyKey: "cancel-att",
      paymentId: "pay-1",
      attemptId: "att-2",
    })
  );
  app.payments.createPaymentAttempt(
    baseCmd({
      idempotencyKey: "a3",
      paymentId: "pay-1",
      attemptId: "att-3",
    })
  );
  app.payments.expirePaymentAttempt(
    baseCmd({
      idempotencyKey: "exp-att",
      paymentId: "pay-1",
      attemptId: "att-3",
    })
  );
  assert.equal(
    app.repositories.paymentAttempts.getById("tenant-a", "att-3").status,
    PAYMENT_ATTEMPT_STATUS.EXPIRED
  );
});

// ---------------------------------------------------------------------------
// D. Idempotency
// ---------------------------------------------------------------------------

test("Idempotency: replay same result; no duplicate records/events; conflict; isolation", () => {
  const app = createApp("idem");
  const cmd = baseCmd({
    idempotencyKey: "fee-same",
    feeId: "fee-1",
    feeType: FEE_TYPE.OPERATIONAL,
    amountMinor: 1000,
    currency: "VND",
    status: FEE_STATUS.ACTIVE,
  });
  const first = app.fees.registerFeeDefinition(cmd);
  const second = app.fees.registerFeeDefinition(cmd);
  assert.equal(second.replayed, true);
  assert.equal(second.financialEffectApplied, false);
  assert.equal(first.fee.feeId, second.fee.feeId);
  assert.equal(app.repositories.feeDefinitions._sizeForTests(), 1);

  assertThrowsCode(
    () =>
      app.fees.registerFeeDefinition({
        ...cmd,
        amountMinor: 2000,
      }),
    FINANCE_ERROR_CODES.IDEMPOTENCY_CONFLICT
  );

  // Different tenant, same key — independent
  const other = app.fees.registerFeeDefinition({
    ...cmd,
    tenantId: "tenant-b",
    feeId: "fee-b",
  });
  assert.equal(other.replayed, false);
  assert.ok(app.repositories.feeDefinitions.getById("tenant-b", "fee-b"));
});

test("Idempotent confirm/receipt: no second settlement or receipt/event", () => {
  const app = createApp("idem2");
  happyPath(app);
  const eventsBefore = app.repositories.events.listByTenant("tenant-a").length;
  const replayConfirm = app.payments.confirmPayment(
    baseCmd({
      idempotencyKey: "pay-confirm",
      paymentId: "pay-1",
      attemptId: "att-1",
      evidenceRef: "ev-confirm-1",
      providerTransactionReference: "prov-txn-1",
    })
  );
  assert.equal(replayConfirm.replayed, true);
  assert.equal(replayConfirm.financialEffectApplied, false);
  const replayReceipt = app.receipts.issueReceipt(
    baseCmd({
      idempotencyKey: "rcpt-issue",
      paymentId: "pay-1",
      receiptId: "rcpt-1",
    })
  );
  assert.equal(replayReceipt.replayed, true);
  assert.equal(app.repositories.receipts._sizeForTests(), 1);
  assert.equal(
    app.repositories.events.listByTenant("tenant-a").length,
    eventsBefore
  );
  assert.equal(
    app.repositories.obligations.getById("tenant-a", "obl-1").settledAmount
      .amountMinor,
    100000
  );
});

// ---------------------------------------------------------------------------
// E. Duplicate financial effects
// ---------------------------------------------------------------------------

test("Duplicate confirmation / provider txn / receipt prevented", () => {
  const app = createApp("dup");
  happyPath(app);

  assertThrowsCode(
    () =>
      app.payments.confirmPayment(
        baseCmd({
          idempotencyKey: "confirm-again",
          paymentId: "pay-1",
          attemptId: "att-other",
          evidenceRef: "ev-2",
          providerTransactionReference: "prov-txn-other",
        })
      ),
    FINANCE_ERROR_CODES.DUPLICATE_FINANCIAL_EFFECT
  );

  app.payments.initiatePayment(
    baseCmd({
      idempotencyKey: "pay2",
      paymentId: "pay-2",
      amountMinor: 1000,
      currency: "VND",
    })
  );
  app.payments.createPaymentAttempt(
    baseCmd({
      idempotencyKey: "att2",
      paymentId: "pay-2",
      attemptId: "att-2",
    })
  );
  assertThrowsCode(
    () =>
      app.payments.confirmPayment(
        baseCmd({
          idempotencyKey: "reuse-txn",
          paymentId: "pay-2",
          attemptId: "att-2",
          evidenceRef: "ev-x",
          providerTransactionReference: "prov-txn-1",
        })
      ),
    FINANCE_ERROR_CODES.CONFLICT
  );

  assertThrowsCode(
    () =>
      app.receipts.issueReceipt(
        baseCmd({
          idempotencyKey: "rcpt-2",
          paymentId: "pay-1",
          receiptId: "rcpt-2",
        })
      ),
    FINANCE_ERROR_CODES.DUPLICATE_FINANCIAL_EFFECT
  );
});

// ---------------------------------------------------------------------------
// F. Refund
// ---------------------------------------------------------------------------

test("Refund: request/approve/reject/complete, partials, over-refund, replay", () => {
  const app = createApp("ref");
  happyPath(app);

  const r1 = app.refunds.requestRefund(
    baseCmd({
      idempotencyKey: "ref-req-1",
      refundId: "ref-1",
      paymentId: "pay-1",
      amountMinor: 40000,
      reason: "partial",
    })
  );
  assert.equal(r1.remainingRefundable.amountMinor, 100000);
  app.refunds.approveRefund(
    baseCmd({ idempotencyKey: "ref-appr-1", refundId: "ref-1" })
  );
  const completed = app.refunds.completeRefund(
    baseCmd({
      idempotencyKey: "ref-comp-1",
      refundId: "ref-1",
      evidenceRef: "ev-ref-1",
    })
  );
  assert.equal(completed.payment.refundedAmount.amountMinor, 40000);
  assert.equal(completed.remainingRefundable.amountMinor, 60000);
  assert.equal(completed.payment.amount.amountMinor, 100000);

  const r2 = app.refunds.requestRefund(
    baseCmd({
      idempotencyKey: "ref-req-2",
      refundId: "ref-2",
      paymentId: "pay-1",
      amountMinor: 60000,
    })
  );
  app.refunds.approveRefund(
    baseCmd({ idempotencyKey: "ref-appr-2", refundId: "ref-2" })
  );
  app.refunds.completeRefund(
    baseCmd({
      idempotencyKey: "ref-comp-2",
      refundId: "ref-2",
      evidenceRef: "ev-ref-2",
    })
  );
  assert.equal(
    app.refunds.getRemainingRefundable("tenant-a", "pay-1").amountMinor,
    0
  );

  assertThrowsCode(
    () =>
      app.refunds.requestRefund(
        baseCmd({
          idempotencyKey: "ref-over",
          refundId: "ref-3",
          paymentId: "pay-1",
          amountMinor: 1,
        })
      ),
    FINANCE_ERROR_CODES.INVALID_REFUND_AMOUNT
  );

  // Reject path on a fresh payment
  const app2 = createApp("ref2");
  happyPath(app2, "tenant-a");
  // Need distinct payment — reuse happyPath keys would collide in same tenant via ids.
  // Use second app instance (isolated memory).
  app2.refunds.requestRefund(
    baseCmd({
      idempotencyKey: "rej-req",
      refundId: "ref-x",
      paymentId: "pay-1",
      amountMinor: 1000,
    })
  );
  app2.refunds.rejectRefund(
    baseCmd({
      idempotencyKey: "rej",
      refundId: "ref-x",
      reason: "no",
    })
  );
  assertThrowsCode(
    () =>
      app2.refunds.completeRefund(
        baseCmd({
          idempotencyKey: "rej-comp",
          refundId: "ref-x",
          evidenceRef: "ev",
        })
      ),
    FINANCE_ERROR_CODES.INVALID_TRANSITION
  );

  // Replay complete does not double-refund
  const eventsBefore = app.repositories.events.listByTenant("tenant-a").filter(
    (e) => e.eventType === FINANCE_EVENT_TYPE.REFUND_COMPLETED
  ).length;
  const replay = app.refunds.completeRefund(
    baseCmd({
      idempotencyKey: "ref-comp-1",
      refundId: "ref-1",
      evidenceRef: "ev-ref-1",
    })
  );
  assert.equal(replay.replayed, true);
  assert.equal(
    app.repositories.payments.getById("tenant-a", "pay-1").refundedAmount
      .amountMinor,
    100000
  );
  const eventsAfter = app.repositories.events.listByTenant("tenant-a").filter(
    (e) => e.eventType === FINANCE_EVENT_TYPE.REFUND_COMPLETED
  ).length;
  assert.equal(eventsAfter, eventsBefore);
  assert.ok(
    app.repositories.events
      .listByTenant("tenant-a")
      .some((e) => e.eventType === FINANCE_EVENT_TYPE.REFUND_REQUESTED)
  );
  assert.ok(
    app.repositories.events
      .listByTenant("tenant-a")
      .some((e) => e.eventType === FINANCE_EVENT_TYPE.REFUND_APPROVED)
  );
  assert.ok(
    app.repositories.events
      .listByTenant("tenant-a")
      .some((e) => e.eventType === FINANCE_EVENT_TYPE.REFUND_REJECTED) === false
  );
});

// ---------------------------------------------------------------------------
// G. Tenant isolation
// ---------------------------------------------------------------------------

test("Tenant isolation: cross-tenant read/update/idempotency", () => {
  const app = createApp("iso");
  happyPath(app, "tenant-a");
  assertThrowsCode(
    () => app.repositories.payments.getById("tenant-b", "pay-1"),
    FINANCE_ERROR_CODES.NOT_FOUND
  );
  assertThrowsCode(
    () =>
      app.repositories.payments.update("tenant-b", "pay-1", {
        paymentId: "pay-1",
        tenantId: "tenant-b",
        amountMinor: 1,
        currency: "VND",
      }),
    FINANCE_ERROR_CODES.NOT_FOUND
  );

  const feeB = app.fees.registerFeeDefinition(
    baseCmd({
      tenantId: "tenant-b",
      idempotencyKey: "fee-reg",
      feeId: "fee-1",
      feeType: FEE_TYPE.OPERATIONAL,
      amountMinor: 500,
      currency: "VND",
      status: FEE_STATUS.ACTIVE,
    })
  );
  assert.equal(feeB.replayed, false);
  assert.equal(feeB.fee.amountMinor, 500);
});

// ---------------------------------------------------------------------------
// H. Events
// ---------------------------------------------------------------------------

test("Events: no event on rejected command; correlation preserved; no sensitive payload", () => {
  const app = createApp("evt");
  const before = app.repositories.events.listByTenant("tenant-a").length;
  assertThrowsCode(
    () =>
      app.payments.confirmPayment(
        baseCmd({
          idempotencyKey: "bad",
          paymentId: "missing",
          attemptId: "a",
          evidenceRef: "e",
        })
      ),
    FINANCE_ERROR_CODES.NOT_FOUND
  );
  assert.equal(app.repositories.events.listByTenant("tenant-a").length, before);

  happyPath(app);
  const confirmed = app.repositories.events
    .listByTenant("tenant-a")
    .find((e) => e.eventType === FINANCE_EVENT_TYPE.PAYMENT_CONFIRMED);
  assert.equal(confirmed.correlationId, "corr-1");
  assert.ok(confirmed.evidenceReferences.length > 0);
  assert.equal(confirmed.payload.rawProviderPayload, undefined);
  assert.equal(confirmed.payload.eligible, undefined);
});

// ---------------------------------------------------------------------------
// I. Public exports
// ---------------------------------------------------------------------------

test("Public exports: application services and ports available; no store leakage", async () => {
  const Finance = await import("../src/features/finance/index.js");
  assert.equal(typeof Finance.createFinanceApplication, "function");
  assert.equal(typeof Finance.createInMemoryFinanceRepositories, "function");
  assert.equal(typeof Finance.createPaymentApplicationService, "function");
  assert.ok(Finance.FINANCE_REPOSITORY_PORTS.PaymentRepository);
  assert.equal(Finance.FINANCE_ERROR_CODES.NOT_FOUND, "FINANCE_NOT_FOUND");
  assert.equal(Finance.FINANCE_ERROR_CODES.CONFLICT, "FINANCE_CONFLICT");
  assert.equal(Finance.resetAllForTests, undefined);
  assert.equal(Finance._stores, undefined);
});
