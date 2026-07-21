/**
 * CORE-09 — fields forbidden on MatchPlan / LogicalMatch / request contracts.
 */

import { FORBIDDEN_MATCH_PLAN_FIELDS } from "../constants.js";

/**
 * Recursively collect forbidden scheduling / score / lifecycle field paths.
 *
 * @param {unknown} value
 * @param {string} [basePath]
 * @returns {string[]}
 */
export function collectForbiddenFieldPaths(value, basePath = "") {
  /** @type {string[]} */
  const found = [];
  if (!value || typeof value !== "object") {
    return found;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      found.push(
        ...collectForbiddenFieldPaths(
          item,
          basePath ? `${basePath}[${index}]` : `[${index}]`
        )
      );
    });
    return found;
  }

  for (const key of Object.keys(value)) {
    const path = basePath ? `${basePath}.${key}` : key;
    if (FORBIDDEN_MATCH_PLAN_FIELDS.has(key)) {
      found.push(path);
    }
    found.push(
      ...collectForbiddenFieldPaths(
        /** @type {Record<string, unknown>} */ (value)[key],
        path
      )
    );
  }
  return found;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function hasForbiddenSchedulingFields(value) {
  return collectForbiddenFieldPaths(value).length > 0;
}
