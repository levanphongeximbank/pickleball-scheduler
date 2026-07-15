#!/usr/bin/env node
/**
 * Phase 44B.0 — Canonical error-registry validation (CI only, no runtime dependency).
 *
 * Verifies:
 *  1. No duplicate VALUES in the canonical API_ERROR_CODES registry.
 *  2. Every ERROR_CODE_DOMAINS member exists in API_ERROR_CODES and every registered
 *     code belongs to exactly one domain group (full, non-overlapping coverage).
 *  3. Required foundation domain codes are present with their expected stable values.
 *  4. Cross-registry consistency: shared codes in domain sub-registries
 *     (PRIVATE_PAIRING_DB_CODE) match the canonical value.
 *
 * Exit code 0 = OK, 1 = violation(s).
 */
import { API_ERROR_CODES, ERROR_CODE_DOMAINS } from "../../src/features/api/constants/apiErrors.js";
import { PRIVATE_PAIRING_DB_CODE } from "../../src/features/private-pairing-rules/constants/dbCodes.js";

const REQUIRED_STABLE_CODES = Object.freeze({
  CLUB_OUT_OF_SCOPE: "CLUB_OUT_OF_SCOPE",
  CLUB_REQUIRED: "CLUB_REQUIRED",
  V2_DISABLED: "V2_DISABLED",
  CROSS_TENANT_ACCESS: "CROSS_TENANT_ACCESS",
  AUDIT_APPEND_ONLY: "AUDIT_APPEND_ONLY",
});

const errors = [];

// 1. No duplicate values.
const values = Object.values(API_ERROR_CODES);
const seen = new Map();
for (const v of values) {
  seen.set(v, (seen.get(v) || 0) + 1);
}
for (const [value, count] of seen) {
  if (count > 1) errors.push(`Duplicate error-code value in API_ERROR_CODES: "${value}" (x${count})`);
}

// 2. Domain grouping coverage (every code in exactly one group; every group member registered).
const groupedCounts = new Map(values.map((v) => [v, 0]));
for (const [group, members] of Object.entries(ERROR_CODE_DOMAINS)) {
  for (const member of members) {
    if (!values.includes(member)) {
      errors.push(`ERROR_CODE_DOMAINS.${group} references "${member}" which is not in API_ERROR_CODES`);
      continue;
    }
    groupedCounts.set(member, (groupedCounts.get(member) || 0) + 1);
  }
}
for (const [value, count] of groupedCounts) {
  if (count === 0) errors.push(`Registered code "${value}" is not assigned to any ERROR_CODE_DOMAINS group`);
  if (count > 1) errors.push(`Registered code "${value}" is assigned to ${count} ERROR_CODE_DOMAINS groups (must be exactly 1)`);
}

// 3. Required stable codes present with expected values.
for (const [key, expected] of Object.entries(REQUIRED_STABLE_CODES)) {
  if (API_ERROR_CODES[key] !== expected) {
    errors.push(`Required code ${key} must equal "${expected}" but is "${API_ERROR_CODES[key]}"`);
  }
}

// 4. Cross-registry consistency (shared codes must not drift).
const SHARED = ["CROSS_TENANT_ACCESS", "AUDIT_APPEND_ONLY"];
for (const key of SHARED) {
  if (PRIVATE_PAIRING_DB_CODE[key] !== API_ERROR_CODES[key]) {
    errors.push(
      `Cross-registry drift for ${key}: PRIVATE_PAIRING_DB_CODE="${PRIVATE_PAIRING_DB_CODE[key]}" vs API_ERROR_CODES="${API_ERROR_CODES[key]}"`
    );
  }
}

if (errors.length > 0) {
  console.error("error-registry-check: FAIL");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(`error-registry-check: OK (${values.length} codes, ${Object.keys(ERROR_CODE_DOMAINS).length} domain groups)`);
process.exit(0);
