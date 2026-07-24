/**
 * Forbidden-contract scanners for dashboard/report definitions (I&A-04).
 * Rejects React/JSX, route callbacks, database/SQL/Supabase coupling,
 * executable functions, and chart-library option bags.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";

const FORBIDDEN_KEYS = Object.freeze(
  new Set([
    "component",
    "Component",
    "reactComponent",
    "jsx",
    "JSX",
    "element",
    "render",
    "renderer",
    "onClick",
    "onChange",
    "callback",
    "formatter",
    "formatFn",
    "valueFormatter",
    "chartOptions",
    "chartConfig",
    "muiProps",
    "sx",
    "className",
    "css",
    "style",
    "route",
    "routePath",
    "path",
    "href",
    "url",
    "navigate",
    "to",
    "tableName",
    "sql",
    "SQL",
    "supabase",
    "Supabase",
    "localStorage",
    "databaseTable",
    "dbTable",
  ])
);

const FORBIDDEN_STRING_PATTERNS = Object.freeze([
  // Match JSX-like tags without ending the regex literal early.
  new RegExp("<\\s*[A-Za-z/][A-Za-z0-9.]*"),
  /\bfrom\s+['"]react['"]/i,
  /\bimport\s+React\b/,
  /\bcreateElement\b/,
  /\bsupabase\b/i,
  /\blocalStorage\b/,
  /\bSELECT\b.+\bFROM\b/i,
  /\.from\s*\(\s*['"][a-z0-9_]+['"]\s*\)/,
]);

/**
 * @param {unknown} value
 * @param {string} path
 * @returns {import("../contracts/result.js").Result | null}
 */
function scanNode(value, path) {
  if (value === null || value === undefined) return null;

  if (typeof value === "function") {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FORBIDDEN_CONTRACT,
        "Executable functions are forbidden in dashboard/report contracts",
        path,
        { reason: "executable_function" }
      )
    );
  }

  if (typeof value === "string") {
    for (const pattern of FORBIDDEN_STRING_PATTERNS) {
      if (pattern.test(value)) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.FORBIDDEN_CONTRACT,
            "Forbidden presentation or data-coupling pattern in contract string",
            path,
            { reason: "forbidden_string_pattern", pattern: String(pattern) }
          )
        );
      }
    }
    return null;
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const child = scanNode(value[i], `${path}[${i}]`);
      if (child) return child;
    }
    return null;
  }

  if (typeof value === "object") {
    for (const key of Object.keys(value)) {
      if (FORBIDDEN_KEYS.has(key)) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.FORBIDDEN_CONTRACT,
            `Forbidden contract key: ${key}`,
            path ? `${path}.${key}` : key,
            { reason: "forbidden_key", key }
          )
        );
      }
      const child = scanNode(
        /** @type {Record<string, unknown>} */ (value)[key],
        path ? `${path}.${key}` : key
      );
      if (child) return child;
    }
  }

  return null;
}

/**
 * @param {unknown} value
 * @param {string} [field]
 * @returns {import("../contracts/result.js").Result}
 */
export function assertNoForbiddenContractContent(value, field = "definition") {
  const found = scanNode(value, field);
  if (found) return found;
  return ok(true);
}
