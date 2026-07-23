/**
 * Phase 1L — Bounded remediation and recertification tests.
 *
 * Covers F-01, F-02, F-03, F-04, F-07 (and supports F-05 via CI registration).
 * No Staging reconnect. No Production. No live provider.
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
  REFUND_STATUS,
  FINANCE_EVENT_TYPE,
  createFinanceApplication,
  createSequentialIdGenerator,
  createFinanceRuntime,
  createFakeSupabaseFinanceClient,
  FINANCE_RUNTIME_MODE,
  FINANCE_READINESS_STATE,
  FINANCE_PROVIDER_STRATEGY,
  isFinanceError,
} from "../src/features/finance/index.js";
import {
  applySettlementEffectsFromConfirmedPayment,
  createConfirmedPaymentSettlementContext,
  isConfirmedPaymentSettlementContext,
} from "../src/features/finance/application/settlementFromConfirmedPayment.js";

function assertThrowsCode(fn, code) {
  assert.throws(fn, (err) => {
    assert.ok(err instanceof FinanceError || isFinanceError(err), "expected FinanceError");
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

function createApp(seed = "l") {
  return createFinanceApplication({
    idGenerator: createSequentialIdGenerator(seed),
    useInMemoryRepositories: true,
  });
}

function seedOpenInvoiceObligation(app, opts = {}) {
  const tenantId = opts.tenantId || "tenant-a";
  const amountMinor = opts.amountMinor ?? 100000;
  app.fees.registerFeeDefinition(
    baseCmd({
      tenantId,
      idempotencyKey: `fee-${tenantId}`,
      feeId: opts.feeId || "fee-1",
      feeType: FEE_TYPE.OPERATIONAL,
      amountMinor,
      currency: "VND",
      status: FEE_STATUS.ACTIVE,
      policyVersion: 1,
    })
  );
  app.obligations.createObligation(
    baseCmd({
      tenantId,
      idempotencyKey: `obl-${tenantId}`,
      obligationId: opts.obligationId || "obl-1",
      feeId: opts.feeId || "fee-1",
      amountMinor,
      currency: "VND",
    })
  );
  app.obligations.openObligation(
    baseCmd({
      tenantId,
      idempotencyKey: `obl-open-${tenantId}`,
      obligationId: opts.obligationId || "obl-1",
    })
  );
  app.invoices.createInvoice(
    baseCmd({
      tenantId,
      idempotencyKey: `inv-${tenantId}`,
      invoiceId: opts.invoiceId || "inv-1",
      obligationIds: [opts.obligationId || "obl-1"],
    })
  );
  app.invoices.issueInvoice(
    baseCmd({
      tenantId,
      idempotencyKey: `inv-issue-${tenantId}`,
      invoiceId: opts.invoiceId || "inv-1",
    })
  );
}

function initiateAndAttempt(app, overrides = {}) {
  const tenantId = overrides.tenantId || "tenant-a";
  const paymentId = overrides.paymentId || "pay-1";
  const attemptId = overrides.attemptId || "att-1";
  const initiated = app.payments.initiatePayment(
    baseCmd({
      tenantId,
      idempotencyKey: overrides.initKey || `pay-init-${paymentId}`,
      paymentId,
      invoiceId: overrides.invoiceId || "inv-1",
      obligationId: overrides.obligationId || "obl-1",
      amountMinor: overrides.amountMinor,
      currency: overrides.currency,
    })
  );
  app.payments.createPaymentAttempt(
    baseCmd({
      tenantId,
      idempotencyKey: overrides.attemptKey || `pay-att-${paymentId}`,
      paymentId,
      attemptId,
    })
  );
  return initiated;
}

// ---------------------------------------------------------------------------
// F-01 — confirmPayment settlement integrity + replay recovery
// ---------------------------------------------------------------------------

test("F-01: payment confirmed and settlement succeeds", () => {
  const app = createApp("f01a");
  seedOpenInvoiceObligation(app);
  initiateAndAttempt(app);
  const confirmed = app.payments.confirmPayment(
    baseCmd({
      idempotencyKey: "pay-confirm",
      paymentId: "pay-1",
      attemptId: "att-1",
      evidenceRef: "ev-1",
      providerTransactionReference: "txn-1",
    })
  );
  assert.equal(confirmed.payment.status, PAYMENT_STATUS.CONFIRMED);
  assert.equal(confirmed.payment.settlementEffectApplied, true);
  assert.equal(
    app.repositories.obligations.getById("tenant-a", "obl-1").status,
    OBLIGATION_STATUS.SETTLED
  );
  assert.equal(
    app.repositories.invoices.getById("tenant-a", "inv-1").status,
    INVOICE_STATUS.PAID
  );
  const events = app.repositories.events.listByTenant("tenant-a");
  assert.equal(
    events.filter((e) => e.eventType === FINANCE_EVENT_TYPE.PAYMENT_CONFIRMED)
      .length,
    1
  );
});

test("F-01: settlement failure leaves confirmed payment unsettled until replay reconciles", () => {
  const app = createApp("f01b");
  seedOpenInvoiceObligation(app);
  initiateAndAttempt(app);

  const originalUpdate = app.repositories.obligations.update.bind(
    app.repositories.obligations
  );
  let failOnce = true;
  app.repositories.obligations.update = (tenantId, id, next) => {
    if (failOnce) {
      failOnce = false;
      throw new FinanceError(
        FINANCE_ERROR_CODES.TRANSACTION_FAILED,
        "Simulated settlement failure."
      );
    }
    return originalUpdate(tenantId, id, next);
  };

  assertThrowsCode(
    () =>
      app.payments.confirmPayment(
        baseCmd({
          idempotencyKey: "pay-confirm-fail",
          paymentId: "pay-1",
          attemptId: "att-1",
          evidenceRef: "ev-fail",
          providerTransactionReference: "txn-fail",
        })
      ),
    FINANCE_ERROR_CODES.TRANSACTION_FAILED
  );

  const paymentAfterFail = app.repositories.payments.getById(
    "tenant-a",
    "pay-1"
  );
  assert.equal(paymentAfterFail.status, PAYMENT_STATUS.CONFIRMED);
  assert.equal(paymentAfterFail.settlementEffectApplied, false);
  assert.equal(
    app.repositories.obligations.getById("tenant-a", "obl-1").status,
    OBLIGATION_STATUS.OPEN
  );

  const reconciled = app.payments.confirmPayment(
    baseCmd({
      idempotencyKey: "pay-confirm-fail",
      paymentId: "pay-1",
      attemptId: "att-1",
      evidenceRef: "ev-fail",
      providerTransactionReference: "txn-fail",
    })
  );
  assert.equal(reconciled.payment.settlementEffectApplied, true);
  assert.equal(reconciled.settlementReconciled, true);
  assert.equal(
    app.repositories.obligations.getById("tenant-a", "obl-1").status,
    OBLIGATION_STATUS.SETTLED
  );
  assert.equal(
    app.repositories.invoices.getById("tenant-a", "inv-1").status,
    INVOICE_STATUS.PAID
  );

  const events = app.repositories.events.listByTenant("tenant-a");
  assert.equal(
    events.filter((e) => e.eventType === FINANCE_EVENT_TYPE.PAYMENT_CONFIRMED)
      .length,
    1
  );

  // Complete settlement replay via idempotency store creates no duplicate effect.
  const replay = app.payments.confirmPayment(
    baseCmd({
      idempotencyKey: "pay-confirm-fail",
      paymentId: "pay-1",
      attemptId: "att-1",
      evidenceRef: "ev-fail",
      providerTransactionReference: "txn-fail",
    })
  );
  assert.equal(replay.replayed, true);
  assert.equal(replay.financialEffectApplied, false);
  assert.equal(
    app.repositories.obligations.getById("tenant-a", "obl-1").settledAmount
      .amountMinor,
    100000
  );
  assert.equal(
    events.filter((e) => e.eventType === FINANCE_EVENT_TYPE.PAYMENT_CONFIRMED)
      .length,
    1
  );
});

test("F-01: wrong tenant cannot reconcile settlement", () => {
  const app = createApp("f01c");
  seedOpenInvoiceObligation(app);
  initiateAndAttempt(app);
  app.payments.confirmPayment(
    baseCmd({
      idempotencyKey: "pay-confirm-ok",
      paymentId: "pay-1",
      attemptId: "att-1",
      evidenceRef: "ev-ok",
      providerTransactionReference: "txn-ok",
    })
  );
  assertThrowsCode(
    () =>
      app.payments.confirmPayment(
        baseCmd({
          tenantId: "tenant-b",
          idempotencyKey: "pay-confirm-wrong-tenant",
          paymentId: "pay-1",
          attemptId: "att-1",
          evidenceRef: "ev-ok",
        })
      ),
    FINANCE_ERROR_CODES.NOT_FOUND
  );
});

// ---------------------------------------------------------------------------
// F-02 — settlement helper boundary
// ---------------------------------------------------------------------------

test("F-02: public application consumers cannot settle without confirmed payment context", () => {
  const app = createApp("f02a");
  seedOpenInvoiceObligation(app);
  assert.equal(
    typeof app.obligations.applySettlementFromConfirmedPayment,
    "undefined"
  );
  assert.equal(
    typeof app.invoices.applyPaymentHintFromConfirmedPayment,
    "undefined"
  );

  assert.equal(isConfirmedPaymentSettlementContext({ tenantId: "x" }), false);
  assertThrowsCode(
    () =>
      applySettlementEffectsFromConfirmedPayment(
        { obligationRepository: app.repositories.obligations },
        {
          tenantId: "tenant-a",
          obligationId: "obl-1",
          amountMinor: 100000,
          currency: "VND",
        }
      ),
    FINANCE_ERROR_CODES.INVALID_INPUT
  );

  initiateAndAttempt(app);
  const confirmed = app.payments.confirmPayment(
    baseCmd({
      idempotencyKey: "pay-confirm-bound",
      paymentId: "pay-1",
      attemptId: "att-1",
      evidenceRef: "ev-bound",
      providerTransactionReference: "txn-bound",
    })
  );
  assert.equal(confirmed.payment.settlementEffectApplied, true);
  const ctx = createConfirmedPaymentSettlementContext(confirmed.payment);
  assert.equal(isConfirmedPaymentSettlementContext(ctx), true);
});

// ---------------------------------------------------------------------------
// F-03 — in-flight refund reservation
// ---------------------------------------------------------------------------

test("F-03: requested/approved refunds reserve; rejected releases; aggregate capped", () => {
  const app = createApp("f03a");
  seedOpenInvoiceObligation(app);
  initiateAndAttempt(app);
  app.payments.confirmPayment(
    baseCmd({
      idempotencyKey: "pay-confirm-ref",
      paymentId: "pay-1",
      attemptId: "att-1",
      evidenceRef: "ev-ref",
      providerTransactionReference: "txn-ref",
    })
  );

  const r1 = app.refunds.requestRefund(
    baseCmd({
      idempotencyKey: "ref-1",
      refundId: "ref-1",
      paymentId: "pay-1",
      amountMinor: 60000,
    })
  );
  assert.equal(r1.remainingRefundable.amountMinor, 40000);
  assert.equal(r1.refund.status, REFUND_STATUS.REQUESTED);

  assertThrowsCode(
    () =>
      app.refunds.requestRefund(
        baseCmd({
          idempotencyKey: "ref-2-over",
          refundId: "ref-2",
          paymentId: "pay-1",
          amountMinor: 50000,
        })
      ),
    FINANCE_ERROR_CODES.INVALID_REFUND_AMOUNT
  );

  app.refunds.rejectRefund(
    baseCmd({
      idempotencyKey: "ref-1-rej",
      refundId: "ref-1",
      reason: "no",
    })
  );
  assert.equal(
    app.refunds.getRemainingRefundable("tenant-a", "pay-1").amountMinor,
    100000
  );

  app.refunds.requestRefund(
    baseCmd({
      idempotencyKey: "ref-3",
      refundId: "ref-3",
      paymentId: "pay-1",
      amountMinor: 40000,
    })
  );
  app.refunds.approveRefund(
    baseCmd({ idempotencyKey: "ref-3-appr", refundId: "ref-3" })
  );
  assert.equal(
    app.refunds.getRemainingRefundable("tenant-a", "pay-1").amountMinor,
    60000
  );

  app.refunds.requestRefund(
    baseCmd({
      idempotencyKey: "ref-4",
      refundId: "ref-4",
      paymentId: "pay-1",
      amountMinor: 60000,
    })
  );
  assertThrowsCode(
    () =>
      app.refunds.requestRefund(
        baseCmd({
          idempotencyKey: "ref-5",
          refundId: "ref-5",
          paymentId: "pay-1",
          amountMinor: 1,
        })
      ),
    FINANCE_ERROR_CODES.INVALID_REFUND_AMOUNT
  );

  app.refunds.approveRefund(
    baseCmd({ idempotencyKey: "ref-4-appr", refundId: "ref-4" })
  );
  app.refunds.completeRefund(
    baseCmd({
      idempotencyKey: "ref-3-comp",
      refundId: "ref-3",
      evidenceRef: "ev-r3",
    })
  );
  app.refunds.completeRefund(
    baseCmd({
      idempotencyKey: "ref-4-comp",
      refundId: "ref-4",
      evidenceRef: "ev-r4",
    })
  );
  assert.equal(
    app.repositories.payments.getById("tenant-a", "pay-1").refundedAmount
      .amountMinor,
    100000
  );
  assert.equal(
    app.refunds.getRemainingRefundable("tenant-a", "pay-1").amountMinor,
    0
  );
});

test("F-03: tenant isolation for refund reservation", () => {
  const app = createApp("f03b");
  seedOpenInvoiceObligation(app, { tenantId: "tenant-a" });
  initiateAndAttempt(app, { tenantId: "tenant-a" });
  app.payments.confirmPayment(
    baseCmd({
      tenantId: "tenant-a",
      idempotencyKey: "confirm-a",
      paymentId: "pay-1",
      attemptId: "att-1",
      evidenceRef: "ev-a",
      providerTransactionReference: "txn-a",
    })
  );
  assertThrowsCode(
    () =>
      app.refunds.requestRefund(
        baseCmd({
          tenantId: "tenant-b",
          idempotencyKey: "ref-wrong",
          refundId: "ref-x",
          paymentId: "pay-1",
          amountMinor: 1000,
        })
      ),
    FINANCE_ERROR_CODES.NOT_FOUND
  );
});

// ---------------------------------------------------------------------------
// F-07 — initiatePayment remaining amount
// ---------------------------------------------------------------------------

test("F-07: initiation uses remaining amount for unpaid / partial / settled", () => {
  const app = createApp("f07a");
  seedOpenInvoiceObligation(app, { amountMinor: 100000 });

  const unpaid = app.payments.initiatePayment(
    baseCmd({
      idempotencyKey: "init-full",
      paymentId: "pay-full",
      invoiceId: "inv-1",
      obligationId: "obl-1",
    })
  );
  assert.equal(unpaid.payment.amount.amountMinor, 100000);

  app.payments.createPaymentAttempt(
    baseCmd({
      idempotencyKey: "att-full",
      paymentId: "pay-full",
      attemptId: "att-full",
    })
  );
  // Partial confirm via smaller explicit amount is not allowed after init at full;
  // instead create a partial payment against remaining by settling half first.
  // Simulate partial settlement by confirming a separate smaller payment path:
  app.repositories.payments.update("tenant-a", "pay-full", {
    ...unpaid.payment,
    status: PAYMENT_STATUS.CANCELLED,
  });

  // Manually apply partial settlement to model a prior confirmed payment effect.
  const obl = app.repositories.obligations.getById("tenant-a", "obl-1");
  app.repositories.obligations.update("tenant-a", "obl-1", {
    ...obl,
    settledAmount: { amountMinor: 40000, currency: "VND" },
    status: OBLIGATION_STATUS.PARTIALLY_SETTLED,
    settlementStarted: true,
  });
  const inv = app.repositories.invoices.getById("tenant-a", "inv-1");
  app.repositories.invoices.update("tenant-a", "inv-1", {
    ...inv,
    amountPaid: { amountMinor: 40000, currency: "VND" },
    status: INVOICE_STATUS.PARTIALLY_PAID,
  });

  const partial = app.payments.initiatePayment(
    baseCmd({
      idempotencyKey: "init-partial",
      paymentId: "pay-partial",
      invoiceId: "inv-1",
      obligationId: "obl-1",
    })
  );
  assert.equal(partial.payment.amount.amountMinor, 60000);

  assertThrowsCode(
    () =>
      app.payments.initiatePayment(
        baseCmd({
          idempotencyKey: "init-over",
          paymentId: "pay-over",
          invoiceId: "inv-1",
          obligationId: "obl-1",
          amountMinor: 60001,
        })
      ),
    FINANCE_ERROR_CODES.OVERPAYMENT
  );

  // Fully settle remaining, then reject further initiation.
  app.repositories.obligations.update("tenant-a", "obl-1", {
    ...app.repositories.obligations.getById("tenant-a", "obl-1"),
    settledAmount: { amountMinor: 100000, currency: "VND" },
    status: OBLIGATION_STATUS.SETTLED,
    settlementStarted: true,
  });
  app.repositories.invoices.update("tenant-a", "inv-1", {
    ...app.repositories.invoices.getById("tenant-a", "inv-1"),
    amountPaid: { amountMinor: 100000, currency: "VND" },
    status: INVOICE_STATUS.PAID,
  });
  assertThrowsCode(
    () =>
      app.payments.initiatePayment(
        baseCmd({
          idempotencyKey: "init-settled",
          paymentId: "pay-settled",
          invoiceId: "inv-1",
          obligationId: "obl-1",
        })
      ),
    FINANCE_ERROR_CODES.INVALID_INPUT
  );
});

test("F-07: mismatched currency and wrong tenant rejected", () => {
  const app = createApp("f07b");
  seedOpenInvoiceObligation(app);
  assertThrowsCode(
    () =>
      app.payments.initiatePayment(
        baseCmd({
          idempotencyKey: "init-fx",
          paymentId: "pay-fx",
          invoiceId: "inv-1",
          amountMinor: 1000,
          currency: "USD",
        })
      ),
    FINANCE_ERROR_CODES.UNSUPPORTED_CURRENCY
  );
  assertThrowsCode(
    () =>
      app.payments.initiatePayment(
        baseCmd({
          tenantId: "tenant-b",
          idempotencyKey: "init-tenant",
          paymentId: "pay-t",
          invoiceId: "inv-1",
        })
      ),
    FINANCE_ERROR_CODES.NOT_FOUND
  );
});

// ---------------------------------------------------------------------------
// F-04 — runtime contract Option A
// ---------------------------------------------------------------------------

test("F-04: default disabled / Staging flag off path / Production hard-disable", () => {
  const disabled = createFinanceRuntime();
  assert.equal(disabled.enabled, false);
  assert.equal(disabled.application, null);
  assert.equal(disabled.capabilities.applicationCommandsAvailable, false);
  assertThrowsCode(
    () => disabled.requireApplication(),
    FINANCE_ERROR_CODES.RUNTIME_DISABLED
  );

  assertThrowsCode(
    () =>
      createFinanceRuntime({
        enabled: true,
        mode: "supabase",
        environment: "production",
      }),
    FINANCE_ERROR_CODES.ENVIRONMENT_NOT_AUTHORIZED
  );
});

test("F-04: Staging supabase exposes durable repos but fails closed on application commands", () => {
  const client = createFakeSupabaseFinanceClient();
  const before = client.getCalls().length;
  const runtime = createFinanceRuntime(
    {
      enabled: true,
      mode: FINANCE_RUNTIME_MODE.SUPABASE,
      environment: "staging",
      providerStrategy: FINANCE_PROVIDER_STRATEGY.NONE,
    },
    { supabaseClient: client }
  );
  assert.equal(client.getCalls().length, before);
  assert.equal(runtime.persistence.adapter, "supabase");
  assert.equal(runtime.application, null);
  assert.equal(runtime.capabilities.applicationCommandsAvailable, false);
  assert.equal(runtime.paymentProvider, null);
  assert.ok(
    runtime.capabilities.knownLimitations.some((l) =>
      /application command/i.test(l)
    )
  );
  assert.ok(
    runtime.readiness.warnings.some((w) => /application commands unavailable/i.test(w))
  );
  assert.notEqual(runtime.readiness.state, FINANCE_READINESS_STATE.DISABLED);
  assertThrowsCode(
    () => runtime.requireApplication(),
    FINANCE_ERROR_CODES.APPLICATION_COMMANDS_UNAVAILABLE
  );
  assertThrowsCode(
    () => runtime.commands.payments.initiatePayment({}),
    FINANCE_ERROR_CODES.APPLICATION_COMMANDS_UNAVAILABLE
  );
  assert.ok(runtime.repositories);
  assert.equal(runtime.repositories.isSupabaseCompatible, true);
});

test("F-04: memory mode still exposes application commands; no service_role / mock by default", () => {
  const memory = createFinanceRuntime({
    enabled: true,
    mode: FINANCE_RUNTIME_MODE.MEMORY,
    environment: "test",
  });
  assert.equal(memory.capabilities.applicationCommandsAvailable, true);
  assert.ok(memory.application);
  assert.equal(memory.paymentProvider, null);
  assert.equal(memory.config.providerStrategy, FINANCE_PROVIDER_STRATEGY.NONE);
});
