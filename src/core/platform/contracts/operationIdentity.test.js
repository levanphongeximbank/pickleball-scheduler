import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createOperationIdentity,
  isOperationIdentity,
  OPERATION_IDENTITY_ERROR,
} from "./operationIdentity.js";

test("valid minimal operation identity", () => {
  const result = createOperationIdentity({
    operationId: "op-1",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.operationId, "op-1");
  assert.equal("idempotencyKey" in result.value, false);
  assert.equal("correlationId" in result.value, false);
});

test("valid full operation identity", () => {
  const result = createOperationIdentity({
    operationId: "  op-full  ",
    idempotencyKey: "  idem-1  ",
    correlationId: "  corr-1  ",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.operationId, "op-full");
  assert.equal(result.value.idempotencyKey, "idem-1");
  assert.equal(result.value.correlationId, "corr-1");
});

test("missing operationId is rejected", () => {
  const result = createOperationIdentity({});
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    OPERATION_IDENTITY_ERROR.OPERATION_ID_INVALID
  );
});

test("empty operationId is rejected", () => {
  const result = createOperationIdentity({ operationId: "   " });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    OPERATION_IDENTITY_ERROR.OPERATION_ID_INVALID
  );
});

test("non-string operationId is rejected", () => {
  const result = createOperationIdentity({ operationId: 12 });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    OPERATION_IDENTITY_ERROR.OPERATION_ID_INVALID
  );
});

test("invalid idempotencyKey is rejected", () => {
  const result = createOperationIdentity({
    operationId: "op-1",
    idempotencyKey: "   ",
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    OPERATION_IDENTITY_ERROR.IDEMPOTENCY_KEY_INVALID
  );
});

test("invalid correlationId is rejected", () => {
  const result = createOperationIdentity({
    operationId: "op-1",
    correlationId: "",
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    OPERATION_IDENTITY_ERROR.CORRELATION_ID_INVALID
  );
});

test("optional fields absent are not auto-created", () => {
  const result = createOperationIdentity({ operationId: "op-1" });
  assert.equal(result.ok, true);
  assert.equal("idempotencyKey" in result.value, false);
  assert.equal("correlationId" in result.value, false);
});

test("output is frozen", () => {
  const result = createOperationIdentity({ operationId: "op-1" });
  assert.equal(result.ok, true);
  assert.equal(Object.isFrozen(result.value), true);
  assert.throws(() => {
    result.value.operationId = "other";
  }, TypeError);
});

test("does not generate IDs or run retry/recovery", () => {
  const source = fs.readFileSync(
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "operationIdentity.js"
    ),
    "utf8"
  );
  assert.equal(source.includes("Date.now"), false);
  assert.equal(source.includes("randomUUID"), false);
  assert.equal(/retryEngine|recoverFrom|supabase/.test(source), false);
  assert.equal(/function\s+generate/i.test(source), false);
});

test("isOperationIdentity true/false is correct", () => {
  const valid = createOperationIdentity({ operationId: "op-1" });
  assert.equal(valid.ok, true);
  assert.equal(isOperationIdentity(valid.value), true);
  assert.equal(isOperationIdentity({}), false);
  assert.equal(isOperationIdentity(null), false);
});
