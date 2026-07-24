/**
 * Registry-level metric definition validation.
 * Composes I&A-01 createAnalyticsMetricDefinition and adds governance checks.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { createAnalyticsMetricDefinition } from "../contracts/metricDefinition.js";
import { isNonEmptyString, isPlainObject } from "../contracts/shared.js";

const FORBIDDEN_SOURCE_KINDS = new Set([
  "sql",
  "database_table",
  "supabase_table",
  "postgres_table",
]);

const FORBIDDEN_CONTRACT_PATTERNS = [
  /\bSELECT\b.+\bFROM\b/i,
  /\bINSERT\s+INTO\b/i,
  /\bUPDATE\s+[a-z_][a-z0-9_]*\s+SET\b/i,
  /\bDELETE\s+FROM\b/i,
  /\bcreateClient\s*\(/,
  /\bfrom\s+["']react["']/,
  /\bfrom\s+["']react-dom["']/,
  /\bfrom\s+["']@supabase\//,
  /\bsrc\/core\/platform\b/,
];

/**
 * @param {string} text
 * @param {string} field
 * @returns {import("../contracts/result.js").Result | null}
 */
function rejectForbiddenContractText(text, field) {
  for (const pattern of FORBIDDEN_CONTRACT_PATTERNS) {
    if (pattern.test(text)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.REGISTRY_FORBIDDEN_CONTRACT,
          "Metric definition contract must not encode SQL, React, Supabase client, or Platform Core references",
          field,
          { pattern: String(pattern) }
        )
      );
    }
  }
  return null;
}

/**
 * Validate a metric definition for registry registration.
 * Reuses I&A-01 definition validation; does not duplicate its field rules.
 *
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function validateMetricDefinition(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.DEFINITION_INVALID,
        "AnalyticsMetricDefinition must be a plain object",
        "definition"
      )
    );
  }

  if (isNonEmptyString(input.definition)) {
    const forbidden = rejectForbiddenContractText(
      String(input.definition),
      "definition.definition"
    );
    if (forbidden) return forbidden;
  }

  if (isPlainObject(input.source)) {
    const kind = isNonEmptyString(input.source.sourceKind)
      ? String(input.source.sourceKind).trim().toLowerCase()
      : "";
    if (FORBIDDEN_SOURCE_KINDS.has(kind)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.REGISTRY_FORBIDDEN_CONTRACT,
          "Metric sourceKind must not be a SQL/database table contract",
          "definition.source.sourceKind",
          { sourceKind: kind }
        )
      );
    }

    for (const field of ["sourceId", "sourceKind", "ownerModule", "reference"]) {
      if (input.source[field] !== undefined && isNonEmptyString(input.source[field])) {
        const forbidden = rejectForbiddenContractText(
          String(input.source[field]),
          `definition.source.${field}`
        );
        if (forbidden) return forbidden;
      }
    }
  }

  const created = createAnalyticsMetricDefinition(input);
  if (!created.ok) return created;

  // Unit is always present after I&A-01 validation (including DIMENSIONLESS).
  return ok(created.value);
}
