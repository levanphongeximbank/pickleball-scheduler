import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createIdempotencyKey,
  isIdempotencyKey,
  IDEMPOTENCY_KEY_ERROR,
} from "./idempotencyKey.js";

test("valid UUID key is accepted", () => {
  const key = "550e8400-e29b-41d4-a716-446655440000";
  const result = createIdempotencyKey(key);
  assert.equal(result.ok, true);
  assert.equal(result.value, key);
});

test("prefixed key is accepted", () => {
  const result = createIdempotencyKey("idem_abc123");
  assert.equal(result.ok, true);
  assert.equal(result.value, "idem_abc123");
});

test("opaque key is accepted", () => {
  const result = createIdempotencyKey("plain-opaque-key");
  assert.equal(result.ok, true);
  assert.equal(result.value, "plain-opaque-key");
});

test("surrounding whitespace is trimmed", () => {
  const result = createIdempotencyKey("  key-77  ");
  assert.equal(result.ok, true);
  assert.equal(result.value, "key-77");
});

test("empty string is rejected", () => {
  const result = createIdempotencyKey("");
  assert.equal(result.ok, false);
  assert.equal(result.error.code, IDEMPOTENCY_KEY_ERROR.EMPTY);
});

test("whitespace-only string is rejected", () => {
  const result = createIdempotencyKey("   ");
  assert.equal(result.ok, false);
  assert.equal(result.error.code, IDEMPOTENCY_KEY_ERROR.EMPTY);
});

test("non-string values are rejected", () => {
  for (const value of [null, undefined, 9, true, {}, []]) {
    const result = createIdempotencyKey(value);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, IDEMPOTENCY_KEY_ERROR.NOT_STRING);
    assert.equal(isIdempotencyKey(value), false);
  }
});

test("does not generate, hash, or persist", () => {
  const source = fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "idempotencyKey.js"),
    "utf8"
  );
  assert.equal(source.includes("Date.now"), false);
  assert.equal(source.includes("randomUUID"), false);
  assert.equal(/createHash|crypto\.|supabase/i.test(source), false);
  assert.equal(/function\s+generate/i.test(source), false);
  assert.equal(/database|localStorage|fs\.write/.test(source), false);
});

test("isIdempotencyKey true/false is correct", () => {
  assert.equal(isIdempotencyKey("k1"), true);
  assert.equal(isIdempotencyKey(""), false);
  assert.equal(isIdempotencyKey(null), false);
});
