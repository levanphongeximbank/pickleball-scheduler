import test from "node:test";
import assert from "node:assert/strict";
import {
  API_ERROR_CODES,
  ERROR_CODE_DOMAINS,
  isRegisteredApiErrorCode,
  listRegisteredApiErrorCodes,
} from "../src/features/api/constants/apiErrors.js";
import { PRIVATE_PAIRING_DB_CODE } from "../src/features/private-pairing-rules/constants/dbCodes.js";

// Frozen snapshot of the PRE-EXISTING core codes. These values are external/runtime
// stable — this test fails loudly if any is renamed or its value changes.
const STABLE_CORE = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  FEATURE_DISABLED: "FEATURE_DISABLED",
  INVALID_SIGNATURE: "INVALID_SIGNATURE",
  INSUFFICIENT_SCOPE: "INSUFFICIENT_SCOPE",
  TENANT_MISMATCH: "TENANT_MISMATCH",
};

// Domain codes registered (at minimum) by Phase 44B.0. Values must stay stable.
const STABLE_DOMAIN = {
  CLUB_REQUIRED: "CLUB_REQUIRED",
  CLUB_OUT_OF_SCOPE: "CLUB_OUT_OF_SCOPE",
  V2_DISABLED: "V2_DISABLED",
  CROSS_TENANT_ACCESS: "CROSS_TENANT_ACCESS",
  AUDIT_APPEND_ONLY: "AUDIT_APPEND_ONLY",
};

test("core error codes retain their exact stable values", () => {
  for (const [key, value] of Object.entries(STABLE_CORE)) {
    assert.equal(API_ERROR_CODES[key], value, `core code ${key} changed`);
  }
});

test("foundation domain codes are registered with stable values", () => {
  for (const [key, value] of Object.entries(STABLE_DOMAIN)) {
    assert.equal(API_ERROR_CODES[key], value, `domain code ${key} missing/changed`);
  }
});

test("registry is frozen and immutable", () => {
  assert.ok(Object.isFrozen(API_ERROR_CODES));
  assert.throws(() => {
    "use strict";
    API_ERROR_CODES.NEW_CODE = "x";
  });
});

test("no duplicate code values", () => {
  const values = listRegisteredApiErrorCodes();
  assert.equal(values.length, new Set(values).size, "duplicate error-code value detected");
});

test("every registered code belongs to exactly one domain group", () => {
  const values = listRegisteredApiErrorCodes();
  const counts = new Map(values.map((v) => [v, 0]));
  for (const members of Object.values(ERROR_CODE_DOMAINS)) {
    for (const m of members) {
      assert.ok(values.includes(m), `group member ${m} not registered`);
      counts.set(m, counts.get(m) + 1);
    }
  }
  for (const [value, count] of counts) {
    assert.equal(count, 1, `code ${value} appears in ${count} groups (must be 1)`);
  }
});

test("isRegisteredApiErrorCode reflects membership", () => {
  assert.equal(isRegisteredApiErrorCode("FORBIDDEN"), true);
  assert.equal(isRegisteredApiErrorCode("CLUB_OUT_OF_SCOPE"), true);
  assert.equal(isRegisteredApiErrorCode("DEFINITELY_NOT_A_CODE"), false);
});

test("shared domain codes stay consistent across sub-registries", () => {
  assert.equal(PRIVATE_PAIRING_DB_CODE.CROSS_TENANT_ACCESS, API_ERROR_CODES.CROSS_TENANT_ACCESS);
  assert.equal(PRIVATE_PAIRING_DB_CODE.AUDIT_APPEND_ONLY, API_ERROR_CODES.AUDIT_APPEND_ONLY);
});
