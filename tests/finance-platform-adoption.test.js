/**
 * Finance Platform Core adoption certification.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  FINANCE_PLATFORM_ADAPTER_ERROR,
  projectFinanceActor,
  projectFinanceTenantScope,
  projectFinanceSecurityContext,
  projectFinanceOperationIdentity,
  projectFinanceIdempotencyKey,
  projectFinanceContractVersion,
  projectFinanceCompatibilityDecision,
  projectFinanceEventEnvelope,
  projectFinanceErrorDescriptor,
  projectFinanceCapabilityDescriptor,
  createMoney,
  FINANCE_CURRENCY_VND,
} from "../src/features/finance/index.js";
import {
  isOk,
  isFail,
  isActorReference,
  isPlatformScope,
  isSecurityContext,
  isOperationIdentity,
  isIdempotencyKey,
  isContractVersion,
  isCompatibilityDecision,
  isCommonEventEnvelope,
  isPlatformErrorDescriptor,
  isPlatformCapabilityDescriptor,
} from "../src/core/platform/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLATFORM_DIR = path.join(ROOT, "src/features/finance/platform");

function readPlatformSources() {
  return fs
    .readdirSync(PLATFORM_DIR)
    .filter((name) => name.endsWith(".js"))
    .map((name) => ({
      name,
      source: fs.readFileSync(path.join(PLATFORM_DIR, name), "utf8"),
    }));
}

test("finance platform imports only canonical public entry", () => {
  for (const { name, source } of readPlatformSources()) {
    if (name === "index.js") continue;
    assert.match(
      source,
      /from\s+["']\.\.\/\.\.\/\.\.\/core\/platform\/index\.js["']/,
      name
    );
    assert.equal(/core\/platform\/contracts\//.test(source), false, name);
    assert.equal(/core\/platform\/adapters\//.test(source), false, name);
  }
});

test("finance actor, tenant scope, and security context require explicit ids", () => {
  assert.equal(
    projectFinanceActor({}).error.code,
    FINANCE_PLATFORM_ADAPTER_ERROR.ACTOR_ID_REQUIRED
  );
  assert.equal(
    projectFinanceTenantScope({}).error.code,
    FINANCE_PLATFORM_ADAPTER_ERROR.TENANT_ID_REQUIRED
  );

  const actor = projectFinanceActor({ userId: "user-fin-1" });
  assert.equal(isOk(actor), true);
  assert.equal(isActorReference(actor.value), true);

  const scope = projectFinanceTenantScope({ tenantId: "tenant-fin-1" });
  assert.equal(isOk(scope), true);
  assert.equal(isPlatformScope(scope.value), true);

  const ctxInput = Object.freeze({
    userId: "user-fin-2",
    tenantId: "tenant-fin-2",
  });
  const ctx = projectFinanceSecurityContext(ctxInput);
  assert.equal(isOk(ctx), true);
  assert.equal(isSecurityContext(ctx.value), true);
  assert.deepEqual(ctxInput, { userId: "user-fin-2", tenantId: "tenant-fin-2" });
});

test("finance operation identity and idempotency key require explicit values", () => {
  assert.equal(
    projectFinanceOperationIdentity({}).error.code,
    FINANCE_PLATFORM_ADAPTER_ERROR.OPERATION_ID_REQUIRED
  );
  assert.equal(
    projectFinanceIdempotencyKey({}).error.code,
    FINANCE_PLATFORM_ADAPTER_ERROR.IDEMPOTENCY_KEY_REQUIRED
  );

  const opInput = Object.freeze({
    operationId: "INITIATE_PAYMENT:req-1",
    idempotencyKey: "idem-fin-1",
  });
  const op = projectFinanceOperationIdentity(opInput);
  assert.equal(isOk(op), true);
  assert.equal(isOperationIdentity(op.value), true);
  assert.deepEqual(opInput, {
    operationId: "INITIATE_PAYMENT:req-1",
    idempotencyKey: "idem-fin-1",
  });

  const key = projectFinanceIdempotencyKey({ idempotencyKey: "idem-fin-2" });
  assert.equal(isOk(key), true);
  assert.equal(isIdempotencyKey(key.value), true);
});

test("finance contract version, compatibility, event, error, capability", () => {
  const version = projectFinanceContractVersion({ version: "FINANCE_EVENT_V1" });
  assert.equal(isOk(version), true);
  assert.equal(isContractVersion(version.value), true);

  const decision = projectFinanceCompatibilityDecision({
    compatible: true,
    decisionCode: "COMPATIBLE",
    currentVersion: "FINANCE_EVENT_V1",
    requiredVersion: "FINANCE_EVENT_V1",
  });
  assert.equal(isOk(decision), true);
  assert.equal(isCompatibilityDecision(decision.value), true);
  assert.equal(Object.isFrozen(decision.value), true);

  const envelope = projectFinanceEventEnvelope({
    eventId: "evt-fin-1",
    eventType: "PAYMENT_CONFIRMED",
    occurredAt: "2026-07-24T02:00:00.000Z",
    sourceModule: "Finance",
    payloadVersion: "1",
    actor: { actorType: "USER", actorId: "user-fin-evt" },
    payload: Object.freeze({ paymentId: "pay-1" }),
    tenantId: "tenant-fin-evt",
  });
  assert.equal(isOk(envelope), true);
  assert.equal(isCommonEventEnvelope(envelope.value), true);
  assert.equal(Object.isFrozen(envelope.value), true);

  const error = projectFinanceErrorDescriptor({
    code: "FINANCE_INVALID_AMOUNT",
    message: "Amount rejected by Finance domain",
    retryable: false,
  });
  assert.equal(isOk(error), true);
  assert.equal(isPlatformErrorDescriptor(error.value), true);

  const capability = projectFinanceCapabilityDescriptor({
    capabilityCode: "FINANCE_PUBLIC_FACADE",
    ownerModule: "Finance",
    version: "1.0.0",
    status: "ADAPTER_AVAILABLE",
  });
  assert.equal(isOk(capability), true);
  assert.equal(isPlatformCapabilityDescriptor(capability.value), true);
});

test("finance money remains module-owned and untouched by platform adapters", () => {
  const money = createMoney(10000, FINANCE_CURRENCY_VND);
  assert.equal(money.amountMinor, 10000);
  assert.equal(money.currency, FINANCE_CURRENCY_VND);

  for (const { name, source } of readPlatformSources()) {
    assert.equal(/createMoney|addMoney|subtractMoney|divideWithHalfAwayFromZero|applyPercentBps/.test(source), false, name);
    assert.equal(/amountMinor|rounding|normalizeAmount/.test(source), false, name);
  }
});

test("finance platform adapters generate no identifiers and avoid persistence/business rules", () => {
  for (const { name, source } of readPlatformSources()) {
    assert.equal(/Date\.now\s*\(/.test(source), false, name);
    assert.equal(/randomUUID\s*\(/.test(source), false, name);
    assert.equal(/Math\.random\s*\(/.test(source), false, name);
    assert.equal(/supabase/i.test(source), false, name);
    assert.equal(/localStorage/.test(source), false, name);
    assert.equal(/process\.env/.test(source), false, name);
    assert.equal(/import\.meta\.env/.test(source), false, name);
    assert.equal(
      /confirmPayment|requestRefund|buildFinanceIdempotencyKey|createPayment|postLedger/.test(
        source
      ),
      false,
      name
    );
  }
});

test("finance public exports remain compatible", () => {
  const barrel = fs.readFileSync(
    path.join(ROOT, "src/features/finance/index.js"),
    "utf8"
  );
  assert.match(barrel, /projectFinanceActor/);
  assert.match(barrel, /from\s+["']\.\/platform\/index\.js["']/);
  assert.equal(typeof projectFinanceActor, "function");
  assert.equal(typeof createMoney, "function");
  assert.equal(isFail(projectFinanceActor(null)), true);
});
