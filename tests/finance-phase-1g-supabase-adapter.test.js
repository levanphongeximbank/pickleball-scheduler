/**
 * Phase 1G — Finance durable Supabase repository adapter (contract tests).
 * Uses deterministic fake client only. No network. No SQL apply. No credentials.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  FINANCE_ERROR_CODES,
  isFinanceError,
  isRetryableFinanceError,
  createSupabaseFinanceRepositories,
  createFakeSupabaseFinanceClient,
  assertSupabaseFinanceClient,
  mapSupabaseFinanceError,
  FINANCE_TABLES,
  FINANCE_TABLE_NAME_VALUES,
  FORBIDDEN_BILLING_TABLES,
  FINANCE_COLUMN_MAPS,
  createBoundedListQuery,
} from "../src/features/finance/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const forwardSqlPath = path.join(root, "docs/supabase-finance-phase1f.sql");

const TS = "2024-01-01T00:00:00.000Z";

function baseMoney(overrides = {}) {
  return {
    tenantId: "tenant-a",
    currency: "VND",
    amountMinor: 100000,
    createdAt: TS,
    updatedAt: TS,
    ...overrides,
  };
}

function createRepos() {
  const client = createFakeSupabaseFinanceClient();
  const repos = createSupabaseFinanceRepositories(client);
  return { client, repos };
}

test("1G client injection: missing client rejected; no global client; isolated factories", () => {
  assert.throws(() => assertSupabaseFinanceClient(null), (err) => {
    assert.equal(err.code, FINANCE_ERROR_CODES.PERSISTENCE_CAPABILITY_UNSUPPORTED);
    return true;
  });
  assert.throws(() => createSupabaseFinanceRepositories({}), (err) => {
    assert.equal(err.code, FINANCE_ERROR_CODES.PERSISTENCE_CAPABILITY_UNSUPPORTED);
    return true;
  });

  const a = createFakeSupabaseFinanceClient();
  const b = createFakeSupabaseFinanceClient();
  assert.notEqual(a, b);
  a.seedRow(FINANCE_TABLES.obligations, {
    id: "o1",
    tenant_id: "t1",
    version: 1,
    status: "CREATED",
    amount_minor: 1,
    currency: "VND",
    settled_amount_minor: 0,
    settlement_started: false,
    evidence_refs: [],
    metadata: {},
    created_at: TS,
    updated_at: TS,
  });
  assert.equal(b.getRows(FINANCE_TABLES.obligations).length, 0);
  assert.equal(a.__testOnly, true);
});

test("1G schema mapping: Finance tables only; align with Phase 1F SQL; no Billing", () => {
  const sql = fs.readFileSync(forwardSqlPath, "utf8");
  for (const table of FINANCE_TABLE_NAME_VALUES) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}\\b`, "i"));
    assert.ok(FINANCE_COLUMN_MAPS[table], `column map for ${table}`);
  }
  for (const billing of FORBIDDEN_BILLING_TABLES) {
    assert.ok(!FINANCE_TABLE_NAME_VALUES.includes(billing));
  }
  assert.equal(FINANCE_TABLES.payments, "finance_payments");
  assert.equal(FINANCE_TABLES.invoices, "finance_invoices");
  assert.notEqual(FINANCE_TABLES.payments, "payments");
  assert.match(sql, /amount_minor\s+bigint/i);
  assert.match(sql, /tenant_id/i);
  assert.ok(Object.values(FINANCE_COLUMN_MAPS[FINANCE_TABLES.payments]).includes("amount_minor"));
  assert.ok(Object.values(FINANCE_COLUMN_MAPS[FINANCE_TABLES.payments]).includes("tenant_id"));
  assert.ok(Object.values(FINANCE_COLUMN_MAPS[FINANCE_TABLES.idempotency]).includes("request_fingerprint"));
});

test("1G tenant isolation: required filters on get/update/list/provider/idempotency", async () => {
  const { client, repos } = createRepos();
  await assert.rejects(() => repos.obligations.getById("", "x"), (err) => {
    assert.equal(err.code, FINANCE_ERROR_CODES.TENANT_OWNERSHIP_MISMATCH);
    return true;
  });

  const created = await repos.obligations.create("tenant-a", baseMoney({ id: "ob-1", status: "CREATED" }));
  assert.equal(created.tenantId, "tenant-a");

  const getCalls = client.getCalls().filter((c) => c.type === "select" || c.type === "insert");
  assert.ok(getCalls.some((c) => c.table === FINANCE_TABLES.obligations));

  client.clearCalls();
  await repos.obligations.getById("tenant-a", "ob-1");
  const readCall = client.getCalls().find((c) => c.type === "select");
  assert.ok(readCall);
  assert.ok(readCall.filters.some((f) => f.column === "tenant_id" && f.value === "tenant-a"));
  assert.ok(readCall.filters.some((f) => f.column === "id" && f.value === "ob-1"));

  client.clearCalls();
  await repos.payments.create(
    "tenant-a",
    baseMoney({
      id: "pay-1",
      status: "PENDING",
      paymentReference: "pay-1",
      providerCode: "mock",
      providerTransactionReference: "txn-1",
    })
  );
  client.clearCalls();
  await repos.payments.findByProviderTransactionReference("tenant-a", "mock", "txn-1");
  const providerCall = client.getCalls().find((c) => c.type === "select");
  assert.ok(providerCall.filters.some((f) => f.column === "tenant_id" && f.value === "tenant-a"));
  assert.ok(
    providerCall.filters.some(
      (f) => f.column === "provider_transaction_reference" && f.value === "txn-1"
    )
  );

  // Cross-tenant miss
  const other = await repos.payments.findByProviderTransactionReference("tenant-b", "mock", "txn-1");
  assert.equal(other, null);

  client.clearCalls();
  await repos.idempotency.begin("tenant-a", {
    operationType: "confirmPayment",
    idempotencyKey: "idem-1",
    requestFingerprint: "fp-1",
    createdAt: TS,
    updatedAt: TS,
  });
  const idemInsert = client.getCalls().find((c) => c.type === "insert");
  assert.equal(idemInsert.payload.tenant_id, "tenant-a");
});

test("1G create/read round trip; corrupt row; uniqueness; RLS denial", async () => {
  const { client, repos } = createRepos();
  const payment = await repos.payments.create(
    "tenant-a",
    baseMoney({
      id: "pay-rt",
      status: "PENDING",
      paymentReference: "pay-rt",
    })
  );
  assert.equal(payment.amountMinor, 100000);
  assert.equal(payment.version, 1);
  const loaded = await repos.payments.getById("tenant-a", "pay-rt");
  assert.equal(loaded.id, "pay-rt");

  // Uniqueness conflict
  await assert.rejects(
    () =>
      repos.payments.create(
        "tenant-a",
        baseMoney({ id: "pay-rt", status: "PENDING", paymentReference: "pay-rt" })
      ),
    (err) => {
      assert.equal(err.code, FINANCE_ERROR_CODES.PERSISTENCE_UNIQUENESS_CONFLICT);
      return true;
    }
  );

  // RLS denial
  client.setError("finance_payments:insert", {
    code: "42501",
    message: "permission denied for table finance_payments",
    status: 403,
  });
  await assert.rejects(
    () =>
      repos.payments.create(
        "tenant-a",
        baseMoney({ id: "pay-rls", status: "PENDING", paymentReference: "pay-rls" })
      ),
    (err) => {
      assert.equal(err.code, FINANCE_ERROR_CODES.PERSISTENCE_PERMISSION_DENIED);
      return true;
    }
  );
  client.clearErrors();

  // Corrupt returned row
  client.seedRow(FINANCE_TABLES.payments, {
    id: "pay-bad",
    tenant_id: "tenant-a",
    version: 1,
    payment_reference: "pay-bad",
    status: "NOT_A_STATUS",
    amount_minor: 100,
    currency: "VND",
    refunded_amount_minor: 0,
    metadata: {},
    created_at: TS,
    updated_at: TS,
  });
  await assert.rejects(() => repos.payments.getById("tenant-a", "pay-bad"), (err) => {
    assert.ok(isFinanceError(err));
    assert.ok(
      err.code === FINANCE_ERROR_CODES.CORRUPT_FINANCIAL_RECORD ||
        err.code === FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID ||
        err.message.toLowerCase().includes("status")
    );
    return true;
  });
});

test("1G optimistic concurrency: version increment and stale rejection; immutable fields excluded", async () => {
  const { client, repos } = createRepos();
  await repos.obligations.create("tenant-a", baseMoney({ id: "ob-v", status: "CREATED" }));
  const updated = await repos.obligations.update("tenant-a", "ob-v", 1, { status: "OPEN" });
  assert.equal(updated.version, 2);
  assert.equal(updated.status, "OPEN");

  const updateCall = client.getCalls().find((c) => c.type === "update");
  assert.ok(updateCall);
  assert.ok(updateCall.filters.some((f) => f.column === "version" && f.value === 1));
  assert.ok(updateCall.filters.some((f) => f.column === "tenant_id"));
  assert.equal(updateCall.payload.version, 2);
  assert.equal(Object.prototype.hasOwnProperty.call(updateCall.payload, "tenant_id"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(updateCall.payload, "id"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(updateCall.payload, "created_at"), false);

  await assert.rejects(
    () => repos.obligations.update("tenant-a", "ob-v", 1, { status: "OPEN" }),
    (err) => {
      assert.equal(err.code, FINANCE_ERROR_CODES.OPTIMISTIC_CONCURRENCY_CONFLICT);
      return true;
    }
  );
});

test("1G idempotency: begin, replay, fingerprint conflict, in-progress, complete with version", async () => {
  const { client, repos } = createRepos();
  const started = await repos.idempotency.begin("tenant-a", {
    operationType: "confirmPayment",
    idempotencyKey: "k1",
    requestFingerprint: "fp-a",
    createdAt: TS,
    updatedAt: TS,
  });
  assert.equal(started.executionStatus, "STARTED");
  assert.equal(started.version, 1);

  await assert.rejects(
    () =>
      repos.idempotency.begin("tenant-a", {
        operationType: "confirmPayment",
        idempotencyKey: "k1",
        requestFingerprint: "fp-a",
        createdAt: TS,
        updatedAt: TS,
      }),
    (err) => {
      assert.equal(err.code, FINANCE_ERROR_CODES.IDEMPOTENCY_IN_PROGRESS);
      return true;
    }
  );

  const completed = await repos.idempotency.complete("tenant-a", "confirmPayment", "k1", 1, {
    entityType: "Payment",
    entityId: "pay-1",
  });
  assert.equal(completed.executionStatus, "COMPLETED");
  assert.equal(completed.version, 2);
  assert.equal(completed.resultEntityId, "pay-1");

  const replay = await repos.idempotency.begin("tenant-a", {
    operationType: "confirmPayment",
    idempotencyKey: "k1",
    requestFingerprint: "fp-a",
    createdAt: TS,
    updatedAt: TS,
  });
  assert.equal(replay.executionStatus, "COMPLETED");
  assert.equal(replay.resultEntityId, "pay-1");

  await assert.rejects(
    () =>
      repos.idempotency.begin("tenant-a", {
        operationType: "confirmPayment",
        idempotencyKey: "k1",
        requestFingerprint: "fp-OTHER",
        createdAt: TS,
        updatedAt: TS,
      }),
    (err) => {
      assert.equal(err.code, FINANCE_ERROR_CODES.PERSISTENCE_UNIQUENESS_CONFLICT);
      return true;
    }
  );

  await assert.rejects(
    () =>
      repos.idempotency.begin("tenant-a", {
        operationType: "op",
        idempotencyKey: "raw",
        requestFingerprint: "fp",
        requestPayload: { foo: 1 },
        createdAt: TS,
        updatedAt: TS,
      }),
    (err) => {
      assert.equal(err.code, FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID);
      return true;
    }
  );

  const insertPayloads = client
    .getCalls()
    .filter((c) => c.type === "insert" && c.table === FINANCE_TABLES.idempotency)
    .map((c) => c.payload);
  for (const payload of insertPayloads) {
    assert.equal(payload.request_payload, undefined);
    assert.equal(payload.raw_request, undefined);
  }
});

test("1G provider transaction uniqueness and nullable behavior", async () => {
  const { repos } = createRepos();
  await repos.payments.create(
    "tenant-a",
    baseMoney({
      id: "p1",
      status: "PENDING",
      paymentReference: "p1",
      providerCode: "mock",
      providerTransactionReference: "TX-9",
    })
  );
  await assert.rejects(
    () =>
      repos.payments.create(
        "tenant-a",
        baseMoney({
          id: "p2",
          status: "PENDING",
          paymentReference: "p2",
          providerCode: "mock",
          providerTransactionReference: "TX-9",
        })
      ),
    (err) => err.code === FINANCE_ERROR_CODES.PERSISTENCE_UNIQUENESS_CONFLICT
  );

  // Other tenant may use same provider reference
  const other = await repos.payments.create(
    "tenant-b",
    baseMoney({
      id: "p3",
      tenantId: "tenant-b",
      status: "PENDING",
      paymentReference: "p3",
      providerCode: "mock",
      providerTransactionReference: "TX-9",
    })
  );
  assert.equal(other.tenantId, "tenant-b");

  // Null provider refs allowed twice
  await repos.payments.create(
    "tenant-a",
    baseMoney({ id: "p4", status: "PENDING", paymentReference: "p4" })
  );
  await repos.payments.create(
    "tenant-a",
    baseMoney({ id: "p5", status: "PENDING", paymentReference: "p5" })
  );
});

test("1G events append-only; duplicate conflict; bounded list; ordering", async () => {
  const { client, repos } = createRepos();
  const event = await repos.events.append("tenant-a", {
    id: "evt-1",
    eventType: "PAYMENT_PENDING",
    occurredAt: TS,
    recordedAt: TS,
    correlationId: "corr-1",
    amountMinor: 1000,
    currency: "VND",
    createdAt: TS,
    updatedAt: TS,
  });
  assert.equal(event.id, "evt-1");

  await assert.rejects(
    () =>
      repos.events.append("tenant-a", {
        id: "evt-1",
        eventType: "PAYMENT_PENDING",
        occurredAt: TS,
        recordedAt: TS,
        correlationId: "corr-1",
        createdAt: TS,
        updatedAt: TS,
      }),
    (err) => err.code === FINANCE_ERROR_CODES.EVENT_APPEND_CONFLICT
  );

  await assert.rejects(() => repos.events.update(), (err) => {
    assert.equal(err.code, FINANCE_ERROR_CODES.IMMUTABLE_RECORD);
    return true;
  });
  await assert.rejects(() => repos.events.delete(), (err) => {
    assert.equal(err.code, FINANCE_ERROR_CODES.IMMUTABLE_RECORD);
    return true;
  });

  await repos.events.append("tenant-a", {
    id: "evt-2",
    eventType: "PAYMENT_CONFIRMED",
    occurredAt: "2024-01-02T00:00:00.000Z",
    recordedAt: "2024-01-02T00:00:00.000Z",
    correlationId: "corr-1",
    amountMinor: 1000,
    currency: "VND",
    evidenceRefs: ["ev-1"],
    createdAt: "2024-01-02T00:00:00.000Z",
    updatedAt: "2024-01-02T00:00:00.000Z",
  });

  assert.throws(() => createBoundedListQuery({ tenantId: "tenant-a", limit: 9999 }), (err) => {
    assert.equal(err.code, FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID);
    return true;
  });

  client.clearCalls();
  const listed = await repos.events.listByCorrelationId("tenant-a", "corr-1", {
    limit: 10,
    sort: "occurredAtAsc",
  });
  assert.equal(listed.length, 2);
  assert.equal(listed[0].id, "evt-1");
  const listCall = client.getCalls().find((c) => c.type === "select");
  assert.ok(listCall.filters.some((f) => f.column === "tenant_id"));
  assert.ok(listCall.filters.some((f) => f.column === "correlation_id" && f.value === "corr-1"));
  assert.equal(listCall.limit, 10);
  assert.ok(listCall.order);
});

test("1G receipt immutable API; audit evidence rejects secrets", async () => {
  const { client, repos } = createRepos();
  await repos.payments.create(
    "tenant-a",
    baseMoney({
      id: "pay-r",
      status: "CONFIRMED",
      paymentReference: "pay-r",
      evidenceRef: "ev-1",
      confirmedAt: TS,
    })
  );
  const receipt = await repos.receipts.create(
    "tenant-a",
    baseMoney({
      id: "rcpt-1",
      paymentId: "pay-r",
      paymentReference: "pay-r",
      evidenceRef: "ev-1",
      issuedAt: TS,
    })
  );
  assert.equal(receipt.paymentId, "pay-r");
  await assert.rejects(() => repos.receipts.update(), (err) => {
    assert.equal(err.code, FINANCE_ERROR_CODES.IMMUTABLE_RECORD);
    return true;
  });
  await assert.rejects(() => repos.receipts.delete(), (err) => {
    assert.equal(err.code, FINANCE_ERROR_CODES.IMMUTABLE_RECORD);
    return true;
  });

  await assert.rejects(
    () =>
      repos.auditEvidence.create("tenant-a", {
        id: "ae-1",
        evidenceType: "PROVIDER_CALLBACK",
        capturedAt: TS,
        createdAt: TS,
        updatedAt: TS,
        rawPayload: { hello: true },
      }),
    (err) => err.code === FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID
  );

  await assert.rejects(
    () =>
      repos.auditEvidence.create("tenant-a", {
        id: "ae-2",
        evidenceType: "PROVIDER_CALLBACK",
        capturedAt: TS,
        createdAt: TS,
        updatedAt: TS,
        metadata: { apiKey: "secret-value" },
      }),
    (err) => err.code === FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID
  );

  const evidence = await repos.auditEvidence.create("tenant-a", {
    id: "ae-3",
    evidenceType: "PROVIDER_CALLBACK",
    capturedAt: TS,
    createdAt: TS,
    updatedAt: TS,
    metadata: { providerStatus: "ok" },
    integrityDigest: "digest-1",
  });
  assert.equal(evidence.id, "ae-3");
  const insert = client
    .getCalls()
    .filter((c) => c.type === "insert" && c.table === FINANCE_TABLES.auditEvidence)
    .at(-1);
  assert.equal(insert.payload.raw_payload, undefined);
  assert.equal(insert.payload.metadata.apiKey, undefined);
  assert.equal(insert.payload.metadata.providerStatus, "ok");
});

test("1G transaction capability: single-statement ok; multi-record fails closed", async () => {
  const { repos } = createRepos();
  assert.equal(repos.capabilities.supportsSingleStatementWrites, true);
  assert.equal(repos.capabilities.supportsAtomicMultiRecord, false);
  assert.equal(repos.capabilities.atomicityClaim, "none");

  await assert.rejects(
    () =>
      repos.unitOfWork.runAtomicGroup("confirmPaymentSettlement", async () => ({ ok: true })),
    (err) => {
      assert.equal(err.code, FINANCE_ERROR_CODES.PERSISTENCE_CAPABILITY_UNSUPPORTED);
      return true;
    }
  );

  await assert.rejects(
    () =>
      repos.invoices.create("tenant-a", {
        id: "inv-1",
        tenantId: "tenant-a",
        status: "DRAFT",
        amountMinor: 100,
        currency: "VND",
        createdAt: TS,
        updatedAt: TS,
        items: [
          {
            id: "item-1",
            quantity: 1,
            unitAmountMinor: 100,
            lineTotalMinor: 100,
            currency: "VND",
          },
        ],
      }),
    (err) => {
      assert.equal(err.code, FINANCE_ERROR_CODES.PERSISTENCE_CAPABILITY_UNSUPPORTED);
      return true;
    }
  );

  const emptyInvoice = await repos.invoices.create("tenant-a", {
    id: "inv-empty",
    tenantId: "tenant-a",
    status: "DRAFT",
    amountMinor: 0,
    currency: "VND",
    createdAt: TS,
    updatedAt: TS,
    items: [],
  });
  assert.equal(emptyInvoice.id, "inv-empty");

  // With injected executor, atomic multi-record becomes available
  const client2 = createFakeSupabaseFinanceClient();
  const repos2 = createSupabaseFinanceRepositories(client2, {
    transactionalExecutor: async (work) => work(),
  });
  assert.equal(repos2.capabilities.supportsAtomicMultiRecord, true);
  const withItems = await repos2.invoices.create("tenant-a", {
    id: "inv-2",
    tenantId: "tenant-a",
    status: "DRAFT",
    amountMinor: 100,
    currency: "VND",
    createdAt: TS,
    updatedAt: TS,
    items: [
      {
        id: "item-2",
        quantity: 1,
        unitAmountMinor: 100,
        lineTotalMinor: 100,
        currency: "VND",
      },
    ],
  });
  assert.equal(withItems.items.length, 1);
});

test("1G error mapping: unique, constraint, RLS, timeout; safe context; no secrets", () => {
  const unique = mapSupabaseFinanceError(
    { code: "23505", message: "duplicate key", details: "finance_payments_pkey" },
    { entity: "Payment", tenantId: "t1" }
  );
  assert.equal(unique.code, FINANCE_ERROR_CODES.PERSISTENCE_UNIQUENESS_CONFLICT);

  const check = mapSupabaseFinanceError(
    { code: "23514", message: "check constraint" },
    { entity: "Payment" }
  );
  assert.equal(check.code, FINANCE_ERROR_CODES.PERSISTENCE_CONSTRAINT_VIOLATION);

  const rls = mapSupabaseFinanceError(
    { status: 403, message: "row-level security policy" },
    { entity: "Payment" }
  );
  assert.equal(rls.code, FINANCE_ERROR_CODES.PERSISTENCE_PERMISSION_DENIED);

  const timeout = mapSupabaseFinanceError(
    { status: 504, message: "timeout contacting upstream" },
    { entity: "Payment" }
  );
  assert.equal(timeout.code, FINANCE_ERROR_CODES.PERSISTENCE_UNAVAILABLE);
  assert.equal(isRetryableFinanceError(timeout), true);

  const leaked = mapSupabaseFinanceError(
    {
      code: "XX",
      message: "fail",
      authorization: "Bearer secret-token",
      rawBody: "SUPER_SECRET",
    },
    { entity: "Payment", tenantId: "t1" }
  );
  assert.equal(leaked.context?.authorization, undefined);
  assert.equal(leaked.context?.rawBody, undefined);
  assert.equal(leaked.context?.tenantId, "t1");
  assert.doesNotMatch(JSON.stringify(leaked.context || {}), /Bearer|SUPER_SECRET/i);
});

test("1G public factory does not expose mutable fake store; fee create works", async () => {
  const { repos } = createRepos();
  assert.equal(repos.resetAllForTests, undefined);
  assert.equal(repos.client, undefined);
  const fee = await repos.feeDefinitions.create("tenant-a", {
    id: "fee-1",
    feeType: "VENUE_BOOKING",
    status: "ACTIVE",
    amountMinor: 50000,
    currency: "VND",
    name: "Court hour",
    createdAt: TS,
    updatedAt: TS,
  });
  assert.equal(fee.id, "fee-1");
  assert.equal(fee.amountMinor, 50000);
});
