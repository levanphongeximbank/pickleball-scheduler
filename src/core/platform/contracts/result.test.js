import test from "node:test";
import assert from "node:assert/strict";

import { ok, fail, isOk, isFail } from "./result.js";

test("success result has stable ok discriminant and value", () => {
  const result = ok(42);
  assert.equal(result.ok, true);
  assert.equal(result.value, 42);
  assert.equal("error" in result, false);
  assert.equal(isOk(result), true);
  assert.equal(isFail(result), false);
});

test("failure result has stable ok discriminant and error", () => {
  const err = Object.freeze({ code: "DEMO", message: "demo failure" });
  const result = fail(err);
  assert.equal(result.ok, false);
  assert.equal(result.error, err);
  assert.equal("value" in result, false);
  assert.equal(isOk(result), false);
  assert.equal(isFail(result), true);
});

test("optional metadata is preserved on success and failure", () => {
  const meta = Object.freeze({ requestId: "req-1" });
  const success = ok("yes", meta);
  const failure = fail({ code: "X" }, meta);
  assert.equal(success.metadata, meta);
  assert.equal(failure.metadata, meta);
});

test("omitted metadata leaves no metadata property", () => {
  const success = ok("plain");
  const failure = fail({ code: "Y" });
  assert.equal("metadata" in success, false);
  assert.equal("metadata" in failure, false);
});

test("result serialization is predictable", () => {
  assert.equal(
    JSON.stringify(ok({ id: "a" }, { trace: 1 })),
    '{"ok":true,"value":{"id":"a"},"metadata":{"trace":1}}'
  );
  assert.equal(
    JSON.stringify(fail({ code: "E", message: "no" })),
    '{"ok":false,"error":{"code":"E","message":"no"}}'
  );
});

test("result objects are frozen against mutation", () => {
  const result = ok("locked");
  assert.throws(() => {
    result.ok = false;
  }, TypeError);
  assert.throws(() => {
    result.value = "changed";
  }, TypeError);
  assert.equal(result.ok, true);
  assert.equal(result.value, "locked");
});
