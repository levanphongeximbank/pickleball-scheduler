/**
 * Phase 1E — Finance durable persistence contract tests.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  FINANCE_ERROR_CODES,
  createObligation,
  createInvoice,
  createInvoiceItem,
  createPayment,
  createPaymentAttempt,
  createReceipt,
  createRefund,
  createFinanceEvent,
  FINANCE_EVENT_TYPE,
  createObligationRecord,
  createInvoiceRecord,
  createPaymentRecord,
  createPaymentAttemptRecord,
  createReceiptRecord,
  createRefundRecord,
  createFinancialEventRecord,
  createIdempotencyRecord,
  createAuditEvidenceRecord,
  serializeRecordDeterministically,
  obligationToRecord,
  obligationFromRecord,
  invoiceToRecord,
  invoiceFromRecord,
  paymentToRecord,
  paymentFromRecord,
  paymentAttemptToRecord,
  paymentAttemptFromRecord,
  receiptToRecord,
  receiptFromRecord,
  refundToRecord,
  refundFromRecord,
  eventToRecord,
  eventFromRecord,
  createBoundedListQuery,
  requireTenantScope,
  requireExpectedVersion,
  createDurableFinanceContractHarness,
  createFinanceUnitOfWork,
  FINANCE_DURABLE_REPOSITORY_PORTS,
  IDEMPOTENCY_EXECUTION_STATUS,
  EXTERNAL_REFERENCE_KIND,
} from "../src/features/finance/index.js";

const NOW = "2026-07-23T10:00:00.000Z";
const TENANT = "tenant-a";

function assertCode(fn, code) {
  assert.throws(fn, (err) => err && err.code === code);
}

describe("Phase 1E persistence records — serialization", () => {
  it("valid obligation/invoice/payment/attempt/receipt/refund/event serialize deterministically", () => {
    const obligation = createObligationRecord({
      id: "ob-1",
      tenantId: TENANT,
      version: 1,
      status: "OPEN",
      amountMinor: 100000,
      currency: "VND",
      settledAmountMinor: 0,
      createdAt: NOW,
      updatedAt: NOW,
      externalReferences: [{ kind: EXTERNAL_REFERENCE_KIND.VENUE, id: "venue-1" }],
    });
    const invoice = createInvoiceRecord({
      id: "inv-1",
      tenantId: TENANT,
      version: 1,
      status: "DRAFT",
      currency: "VND",
      createdAt: NOW,
      updatedAt: NOW,
      items: [
        {
          id: "item-1",
          quantity: 2,
          unitAmountMinor: 50000,
          lineTotalMinor: 100000,
          currency: "VND",
        },
      ],
    });
    const payment = createPaymentRecord({
      id: "pay-1",
      tenantId: TENANT,
      version: 1,
      status: "PENDING",
      amountMinor: 100000,
      currency: "VND",
      createdAt: NOW,
      updatedAt: NOW,
    });
    const attempt = createPaymentAttemptRecord({
      id: "att-1",
      tenantId: TENANT,
      paymentId: "pay-1",
      version: 1,
      status: "PENDING",
      amountMinor: 100000,
      currency: "VND",
      createdAt: NOW,
      updatedAt: NOW,
    });
    const receipt = createReceiptRecord({
      id: "rcpt-1",
      tenantId: TENANT,
      paymentId: "pay-1",
      amountMinor: 100000,
      currency: "VND",
      evidenceRef: "ev-1",
      issuedAt: NOW,
    });
    const refund = createRefundRecord({
      id: "ref-1",
      tenantId: TENANT,
      paymentId: "pay-1",
      status: "REQUESTED",
      amountMinor: 10000,
      currency: "VND",
      requestedAt: NOW,
      createdAt: NOW,
      updatedAt: NOW,
    });
    const event = createFinancialEventRecord({
      id: "evt-1",
      tenantId: TENANT,
      eventType: FINANCE_EVENT_TYPE.FINANCE_OBLIGATION_CREATED,
      occurredAt: NOW,
      recordedAt: NOW,
      correlationId: "corr-1",
      amountMinor: 100000,
      currency: "VND",
      financialReferences: { obligationId: "ob-1" },
      payload: { note: "ok" },
    });

    assert.equal(serializeRecordDeterministically(obligation), serializeRecordDeterministically({ ...obligation }));
    assert.equal(invoice.amountMinor, 100000);
    assert.equal(payment.status, "PENDING");
    assert.equal(attempt.paymentId, "pay-1");
    assert.equal(receipt.evidenceRef, "ev-1");
    assert.equal(refund.amountMinor, 10000);
    assert.equal(event.eventType, FINANCE_EVENT_TYPE.FINANCE_OBLIGATION_CREATED);

    const a = serializeRecordDeterministically(obligation);
    const b = serializeRecordDeterministically({
      updatedAt: obligation.updatedAt,
      createdAt: obligation.createdAt,
      currency: obligation.currency,
      amountMinor: obligation.amountMinor,
      settledAmountMinor: obligation.settledAmountMinor,
      status: obligation.status,
      version: obligation.version,
      tenantId: obligation.tenantId,
      id: obligation.id,
      recordType: obligation.recordType,
      feeId: null,
      invoiceId: null,
      businessReference: null,
      externalReferences: obligation.externalReferences,
      dueAt: null,
      settlementStarted: false,
      correlationId: null,
      causationId: null,
      idempotencyKey: null,
      evidenceRefs: [],
    });
    assert.equal(a, b);
  });
});

describe("Phase 1E invalid stored records", () => {
  it("rejects unsafe amount, unsupported currency, unknown status, missing tenant, invalid version", () => {
    assertCode(
      () =>
        createObligationRecord({
          id: "ob",
          tenantId: TENANT,
          status: "OPEN",
          amountMinor: 1.5,
          currency: "VND",
          createdAt: NOW,
          updatedAt: NOW,
        }),
      FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID
    );
    assertCode(
      () =>
        createObligationRecord({
          id: "ob",
          tenantId: TENANT,
          status: "OPEN",
          amountMinor: 100,
          currency: "usd",
          createdAt: NOW,
          updatedAt: NOW,
        }),
      FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID
    );
    assertCode(
      () =>
        createObligationRecord({
          id: "ob",
          tenantId: TENANT,
          status: "NOPE",
          amountMinor: 100,
          currency: "VND",
          createdAt: NOW,
          updatedAt: NOW,
        }),
      FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID
    );
    assertCode(
      () =>
        createObligationRecord({
          id: "ob",
          status: "OPEN",
          amountMinor: 100,
          currency: "VND",
          createdAt: NOW,
          updatedAt: NOW,
        }),
      FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID
    );
    assertCode(
      () =>
        createObligationRecord({
          id: "ob",
          tenantId: TENANT,
          version: 0,
          status: "OPEN",
          amountMinor: 100,
          currency: "VND",
          createdAt: NOW,
          updatedAt: NOW,
        }),
      FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID
    );
  });

  it("rejects inconsistent invoice total, confirmed payment without evidence, completed refund without evidence", () => {
    assertCode(
      () =>
        createInvoiceRecord({
          id: "inv",
          tenantId: TENANT,
          status: "DRAFT",
          currency: "VND",
          amountMinor: 1,
          createdAt: NOW,
          updatedAt: NOW,
          items: [
            {
              id: "i1",
              quantity: 1,
              unitAmountMinor: 100,
              lineTotalMinor: 100,
              currency: "VND",
            },
          ],
        }),
      FINANCE_ERROR_CODES.CORRUPT_FINANCIAL_RECORD
    );
    assertCode(
      () =>
        createPaymentRecord({
          id: "pay",
          tenantId: TENANT,
          status: "CONFIRMED",
          amountMinor: 100,
          currency: "VND",
          createdAt: NOW,
          updatedAt: NOW,
        }),
      FINANCE_ERROR_CODES.CORRUPT_FINANCIAL_RECORD
    );
    assertCode(
      () =>
        createRefundRecord({
          id: "ref",
          tenantId: TENANT,
          paymentId: "pay",
          status: "COMPLETED",
          amountMinor: 10,
          currency: "VND",
          createdAt: NOW,
          updatedAt: NOW,
        }),
      FINANCE_ERROR_CODES.CORRUPT_FINANCIAL_RECORD
    );
  });
});

describe("Phase 1E mappers", () => {
  it("round-trips domain ↔ record preserving tenant, refs, evidence; rejects secrets", () => {
    const obligation = createObligation({
      obligationId: "ob-rt",
      tenantId: TENANT,
      venueId: "venue-9",
      clubId: "club-9",
      amountMinor: 250000,
      currency: "VND",
      status: "OPEN",
      createdAt: NOW,
      updatedAt: NOW,
    });
    const oblRecord = obligationToRecord(obligation, { version: 2 });
    const oblBack = obligationFromRecord(oblRecord);
    assert.equal(oblBack.tenantId, TENANT);
    assert.equal(oblBack.venueId, "venue-9");
    assert.equal(oblBack.amount.amountMinor, 250000);
    assert.equal(oblRecord.version, 2);

    const invoice = createInvoice({
      invoiceId: "inv-rt",
      tenantId: TENANT,
      currency: "VND",
      createdAt: NOW,
      updatedAt: NOW,
      items: [
        createInvoiceItem(
          { itemId: "it-1", quantity: 1, amountMinor: 250000 },
          "VND"
        ),
      ],
    });
    const invBack = invoiceFromRecord(invoiceToRecord(invoice));
    assert.equal(invBack.total.amountMinor, 250000);

    const payment = createPayment({
      paymentId: "pay-rt",
      tenantId: TENANT,
      amountMinor: 250000,
      currency: "VND",
      status: "CONFIRMED",
      evidenceRef: "ev-rt",
      createdAt: NOW,
      updatedAt: NOW,
      confirmedAt: NOW,
    });
    const payBack = paymentFromRecord(paymentToRecord(payment));
    assert.equal(payBack.evidenceRef, "ev-rt");

    const attempt = createPaymentAttempt({
      attemptId: "att-rt",
      paymentId: "pay-rt",
      tenantId: TENANT,
      amountMinor: 250000,
      currency: "VND",
      createdAt: NOW,
    });
    assert.equal(paymentAttemptFromRecord(paymentAttemptToRecord(attempt)).attemptId, "att-rt");

    const receipt = createReceipt({
      receiptId: "rcpt-rt",
      tenantId: TENANT,
      paymentId: "pay-rt",
      amountMinor: 250000,
      currency: "VND",
      issuedAt: NOW,
      evidenceRef: "ev-rt",
    });
    assert.equal(receiptFromRecord(receiptToRecord(receipt)).evidenceRef, "ev-rt");

    const refund = createRefund({
      refundId: "ref-rt",
      tenantId: TENANT,
      paymentId: "pay-rt",
      amountMinor: 1000,
      currency: "VND",
      status: "COMPLETED",
      evidenceRef: "ev-refund",
      completedAt: NOW,
      requestedAt: NOW,
    });
    assert.equal(refundFromRecord(refundToRecord(refund)).evidenceRef, "ev-refund");

    const event = createFinanceEvent({
      eventId: "evt-rt",
      eventType: FINANCE_EVENT_TYPE.PAYMENT_CONFIRMED,
      occurredAt: NOW,
      tenantId: TENANT,
      correlationId: "corr-rt",
      idempotencyKey: "idem-evt-rt",
      amountMinor: 250000,
      currency: "VND",
      financialReferences: { paymentId: "pay-rt" },
      evidenceReferences: ["ev-rt"],
      actor: { actorId: "actor-1", actorType: "user" },
      payload: { channel: "mock" },
    });
    const evtBack = eventFromRecord(eventToRecord(event));
    assert.equal(evtBack.eventId, "evt-rt");
    assert.equal(evtBack.tenantId, TENANT);

    assertCode(
      () =>
        createAuditEvidenceRecord({
          id: "ev-bad",
          tenantId: TENANT,
          evidenceType: "provider",
          capturedAt: NOW,
          token: "secret-token",
        }),
      FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID
    );
    assertCode(
      () =>
        createIdempotencyRecord({
          tenantId: TENANT,
          operationType: "pay.confirm",
          idempotencyKey: "k1",
          requestFingerprint: "fp1",
          createdAt: NOW,
          updatedAt: NOW,
          requestPayload: { secret: "x" },
        }),
      FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID
    );
  });
});

describe("Phase 1E repository contracts", () => {
  it("requires tenant, bounded query, expected version; scopes provider/idempotency lookups", () => {
    const harness = createDurableFinanceContractHarness();
    assert.equal(harness.isDurable, false);
    assert.equal(harness.isSupabase, false);
    assert.ok(FINANCE_DURABLE_REPOSITORY_PORTS.PaymentDurableRepository);

    assertCode(() => requireTenantScope(""), FINANCE_ERROR_CODES.TENANT_OWNERSHIP_MISMATCH);
    assertCode(() => createBoundedListQuery({}), FINANCE_ERROR_CODES.TENANT_OWNERSHIP_MISMATCH);
    assertCode(
      () => createBoundedListQuery({ tenantId: TENANT, filter: { anything: true } }),
      FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID
    );
    assertCode(() => requireExpectedVersion(undefined), FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID);

    harness.payments.create(TENANT, {
      id: "pay-1",
      status: "PENDING",
      amountMinor: 1000,
      currency: "VND",
      providerCode: "MOCK",
      providerTransactionReference: "txn-1",
      createdAt: NOW,
      updatedAt: NOW,
    });
    assert.equal(
      harness.payments.findByProviderTransactionReference(TENANT, "MOCK", "txn-1")?.id,
      "pay-1"
    );
    assert.equal(
      harness.payments.findByProviderTransactionReference("tenant-b", "MOCK", "txn-1"),
      null
    );

    harness.idempotency.begin(TENANT, {
      operationType: "pay.confirm",
      idempotencyKey: "idem-1",
      requestFingerprint: "fp-1",
      createdAt: NOW,
      updatedAt: NOW,
    });
    assert.equal(
      harness.idempotency.find(TENANT, "pay.confirm", "idem-1")?.requestFingerprint,
      "fp-1"
    );
    assert.equal(harness.idempotency.find("tenant-b", "pay.confirm", "idem-1"), null);
  });
});

describe("Phase 1E concurrency", () => {
  it("accepts expected version, rejects stale version, rejects terminal mutation", () => {
    const harness = createDurableFinanceContractHarness();
    const created = harness.obligations.create(TENANT, {
      id: "ob-c",
      status: "OPEN",
      amountMinor: 1000,
      currency: "VND",
      createdAt: NOW,
      updatedAt: NOW,
    });
    assert.equal(created.version, 1);
    const updated = harness.obligations.update(TENANT, "ob-c", 1, {
      status: "OPEN",
      settledAmountMinor: 0,
      updatedAt: "2026-07-23T11:00:00.000Z",
    });
    assert.equal(updated.version, 2);
    assertCode(
      () =>
        harness.obligations.update(TENANT, "ob-c", 1, {
          updatedAt: "2026-07-23T12:00:00.000Z",
        }),
      FINANCE_ERROR_CODES.OPTIMISTIC_CONCURRENCY_CONFLICT
    );

    harness.receipts.create(TENANT, {
      id: "rcpt-c",
      paymentId: "pay-c",
      amountMinor: 1000,
      currency: "VND",
      evidenceRef: "ev-c",
      issuedAt: NOW,
    });
    assertCode(
      () => harness.receipts.update(),
      FINANCE_ERROR_CODES.IMMUTABLE_RECORD
    );

    const settled = harness.obligations.create(TENANT, {
      id: "ob-term",
      status: "SETTLED",
      amountMinor: 1000,
      currency: "VND",
      settledAmountMinor: 1000,
      createdAt: NOW,
      updatedAt: NOW,
    });
    assertCode(
      () =>
        harness.obligations.update(TENANT, "ob-term", settled.version, {
          updatedAt: NOW,
        }),
      FINANCE_ERROR_CODES.IMMUTABLE_RECORD
    );
  });
});

describe("Phase 1E idempotency persistence", () => {
  it("replays same fingerprint, conflicts on different fingerprint, blocks in-progress, stores result ref only", () => {
    const harness = createDurableFinanceContractHarness();
    const started = harness.idempotency.begin(TENANT, {
      operationType: "pay.confirm",
      idempotencyKey: "k-idem",
      requestFingerprint: "fp-a",
      createdAt: NOW,
      updatedAt: NOW,
    });
    assert.equal(started.executionStatus, IDEMPOTENCY_EXECUTION_STATUS.STARTED);
    assertCode(
      () =>
        harness.idempotency.begin(TENANT, {
          operationType: "pay.confirm",
          idempotencyKey: "k-idem",
          requestFingerprint: "fp-a",
          createdAt: NOW,
          updatedAt: NOW,
        }),
      FINANCE_ERROR_CODES.IDEMPOTENCY_IN_PROGRESS
    );

    const completed = harness.idempotency.complete(
      TENANT,
      "pay.confirm",
      "k-idem",
      started.version,
      "result:pay-1"
    );
    assert.equal(completed.executionStatus, IDEMPOTENCY_EXECUTION_STATUS.COMPLETED);
    assert.equal(completed.resultReference, "result:pay-1");
    assert.equal(completed.requestPayload, undefined);

    const replay = harness.idempotency.begin(TENANT, {
      operationType: "pay.confirm",
      idempotencyKey: "k-idem",
      requestFingerprint: "fp-a",
      createdAt: NOW,
      updatedAt: NOW,
    });
    assert.equal(replay.resultReference, "result:pay-1");
    assert.equal(replay.version, completed.version);

    assertCode(
      () =>
        harness.idempotency.begin(TENANT, {
          operationType: "pay.confirm",
          idempotencyKey: "k-idem",
          requestFingerprint: "fp-other",
          createdAt: NOW,
          updatedAt: NOW,
        }),
      FINANCE_ERROR_CODES.PERSISTENCE_UNIQUENESS_CONFLICT
    );
  });
});

describe("Phase 1E events", () => {
  it("append-only, rejects duplicate id and cross-tenant/unbounded queries", () => {
    const harness = createDurableFinanceContractHarness();
    harness.events.append(TENANT, {
      id: "evt-1",
      eventType: FINANCE_EVENT_TYPE.INVOICE_CREATED,
      occurredAt: NOW,
      recordedAt: NOW,
      correlationId: "corr-1",
      amountMinor: 1000,
      currency: "VND",
      financialReferences: { invoiceId: "inv-1" },
    });
    assertCode(
      () =>
        harness.events.append(TENANT, {
          id: "evt-1",
          eventType: FINANCE_EVENT_TYPE.INVOICE_CREATED,
          occurredAt: NOW,
          recordedAt: NOW,
          correlationId: "corr-1",
          amountMinor: 1000,
          currency: "VND",
          financialReferences: { invoiceId: "inv-1" },
        }),
      FINANCE_ERROR_CODES.EVENT_APPEND_CONFLICT
    );
    assertCode(
      () => harness.events.update(),
      FINANCE_ERROR_CODES.IMMUTABLE_RECORD
    );
    assertCode(() => harness.events.list({}), FINANCE_ERROR_CODES.TENANT_OWNERSHIP_MISMATCH);
    assert.equal(harness.events.list({ tenantId: "tenant-b", limit: 10 }).length, 0);
    assert.equal(harness.events.list({ tenantId: TENANT, limit: 10 }).length, 1);
  });
});

describe("Phase 1E transaction contract", async () => {
  it("atomic callback commits, rolls back on failure, rejects nesting, no partial success", async () => {
    const log = [];
    const uow = createFinanceUnitOfWork({
      onCommit: () => log.push("commit"),
      onRollback: () => log.push("rollback"),
    });
    assert.equal(uow.isNestedSupported, false);

    const result = await uow.run(async (tx) => {
      tx.stage(() => log.push("effect-a"));
      tx.stage(() => log.push("effect-b"));
      return { ok: true };
    });
    assert.deepEqual(result, { ok: true });
    assert.deepEqual(log, ["effect-a", "effect-b", "commit"]);
    assert.equal(uow.wasCommitted, true);

    const uow2 = createFinanceUnitOfWork({
      onRollback: () => log.push("rollback-2"),
    });
    const partial = { applied: false };
    await assert.rejects(
      () =>
        uow2.run(async (tx) => {
          tx.stage(() => {
            partial.applied = true;
          });
          throw new Error("boom");
        }),
      (err) => err.code === FINANCE_ERROR_CODES.TRANSACTION_FAILED
    );
    assert.equal(partial.applied, false);
    assert.equal(uow2.wasRolledBack, true);

    const uow3 = createFinanceUnitOfWork();
    uow3.begin();
    assertCode(() => uow3.begin(), FINANCE_ERROR_CODES.TRANSACTION_FAILED);
    uow3.rollback();
  });
});

describe("Phase 1E public exports", () => {
  it("exposes persistence contracts without durability claims", async () => {
    const mod = await import("../src/features/finance/index.js");
    assert.equal(typeof mod.createDurableFinanceContractHarness, "function");
    assert.equal(typeof mod.createFinanceUnitOfWork, "function");
    assert.equal(typeof mod.createObligationRecord, "function");
    assert.equal(typeof mod.obligationToRecord, "function");
    const harness = mod.createDurableFinanceContractHarness();
    assert.equal(harness.durabilityClaim, "contract-harness-only");
  });
});
