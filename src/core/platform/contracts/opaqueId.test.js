import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  normalizeOpaqueId,
  isOpaqueId,
  OPAQUE_ID_ERROR,
} from "./opaqueId.js";

test("UUID string is accepted", () => {
  const id = "550e8400-e29b-41d4-a716-446655440000";
  const result = normalizeOpaqueId(id);
  assert.equal(result.ok, true);
  assert.equal(result.value, id);
  assert.equal(isOpaqueId(id), true);
});

test("prefixed opaque string is accepted", () => {
  const id = "tenant_abc123";
  const result = normalizeOpaqueId(id);
  assert.equal(result.ok, true);
  assert.equal(result.value, id);
});

test("ordinary opaque string is accepted", () => {
  const id = "plain-opaque-id";
  const result = normalizeOpaqueId(id);
  assert.equal(result.ok, true);
  assert.equal(result.value, id);
});

test("surrounding whitespace is normalized", () => {
  const result = normalizeOpaqueId("  club-77  ");
  assert.equal(result.ok, true);
  assert.equal(result.value, "club-77");
});

test("empty string is rejected", () => {
  const result = normalizeOpaqueId("");
  assert.equal(result.ok, false);
  assert.equal(result.error.code, OPAQUE_ID_ERROR.EMPTY);
  assert.equal(result.error.message, "OpaqueId must be a non-empty string");
});

test("whitespace-only string is rejected", () => {
  const result = normalizeOpaqueId("   \t  ");
  assert.equal(result.ok, false);
  assert.equal(result.error.code, OPAQUE_ID_ERROR.EMPTY);
});

test("non-string values are rejected", () => {
  for (const value of [null, undefined, 12, true, {}, [], Symbol("x")]) {
    const result = normalizeOpaqueId(value);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, OPAQUE_ID_ERROR.NOT_STRING);
    assert.equal(result.error.message, "OpaqueId must be a string");
    assert.equal(isOpaqueId(value), false);
  }
});

test("opaqueId module does not generate Date.now-based identifiers", () => {
  const sourcePath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "opaqueId.js"
  );
  const source = fs.readFileSync(sourcePath, "utf8");
  assert.equal(source.includes("Date.now"), false);
  assert.equal(/function\s+generate/i.test(source), false);
  assert.equal(source.includes("createOpaqueId"), false);
});
