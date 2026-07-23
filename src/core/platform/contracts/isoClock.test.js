import test from "node:test";
import assert from "node:assert/strict";

import { nowIso, parseIsoStrict, ISO_INSTANT_ERROR } from "./isoClock.js";

test("nowIso returns a valid UTC ISO string ending with Z", () => {
  const value = nowIso();
  assert.equal(typeof value, "string");
  assert.match(value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  const parsed = parseIsoStrict(value);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.value, value);
});

test("valid UTC timestamp is accepted and normalized", () => {
  const result = parseIsoStrict("2024-01-15T08:30:00Z");
  assert.equal(result.ok, true);
  assert.equal(result.value, "2024-01-15T08:30:00.000Z");
});

test("valid explicit-offset timestamp is normalized to UTC Z", () => {
  const result = parseIsoStrict("2024-01-15T15:30:00+07:00");
  assert.equal(result.ok, true);
  assert.equal(result.value, "2024-01-15T08:30:00.000Z");
});

test("invalid text is rejected", () => {
  const result = parseIsoStrict("not-an-instant");
  assert.equal(result.ok, false);
  assert.equal(result.error.code, ISO_INSTANT_ERROR.INVALID);
});

test("invalid calendar date is rejected", () => {
  const result = parseIsoStrict("2024-02-30T00:00:00Z");
  assert.equal(result.ok, false);
  assert.equal(result.error.code, ISO_INSTANT_ERROR.INVALID);
  assert.equal(
    result.error.message,
    "ISO instant has an invalid calendar date or time"
  );
});

test("date-only value is rejected", () => {
  const result = parseIsoStrict("2024-01-15");
  assert.equal(result.ok, false);
  assert.equal(result.error.code, ISO_INSTANT_ERROR.INVALID);
});

test("time-only value is rejected", () => {
  const result = parseIsoStrict("08:30:00Z");
  assert.equal(result.ok, false);
  assert.equal(result.error.code, ISO_INSTANT_ERROR.INVALID);
});

test("local timestamp without offset is rejected", () => {
  const result = parseIsoStrict("2024-01-15T08:30:00");
  assert.equal(result.ok, false);
  assert.equal(result.error.code, ISO_INSTANT_ERROR.INVALID);
});

test("non-string values are rejected", () => {
  const result = parseIsoStrict(1700000000000);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, ISO_INSTANT_ERROR.NOT_STRING);
});

test("parse behavior is not dependent on host timezone", () => {
  const samples = [
    ["2024-06-15T12:00:00Z", "2024-06-15T12:00:00.000Z"],
    ["2024-06-15T12:00:00+07:00", "2024-06-15T05:00:00.000Z"],
    ["2024-12-31T23:30:00-05:00", "2025-01-01T04:30:00.000Z"],
  ];

  for (const [input, expected] of samples) {
    const result = parseIsoStrict(input);
    assert.equal(result.ok, true);
    assert.equal(result.value, expected);
  }

  // Local form must stay rejected regardless of host TZ interpretation.
  assert.equal(parseIsoStrict("2024-06-15T12:00:00").ok, false);
});
