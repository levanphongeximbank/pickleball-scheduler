/**
 * CORE-13 — stable identifier and array normalization helpers.
 */

import { compareStableString } from "./compare.js";
import { REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE } from "../errors/diagnosticCodes.js";
import { RefereeAssignmentContractError } from "../errors/RefereeAssignmentContractError.js";

/**
 * Normalize a required stable ID: trim string, reject empty.
 * @param {unknown} value
 * @param {string} field
 * @param {string} [code]
 * @returns {string}
 */
export function normalizeStableId(
  value,
  field,
  code = REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST
) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new RefereeAssignmentContractError(
      code,
      `${field} must be a non-empty stable string ID`,
      { field, value: value ?? null }
    );
  }
  return value.trim();
}

/**
 * Optional ID: null if absent/empty; otherwise trimmed string.
 * @param {unknown} value
 * @param {string} field
 * @returns {string|null}
 */
export function normalizeOptionalStableId(value, field) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST,
      `${field} must be a string ID or null`,
      { field, value }
    );
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Normalize string array: trim, drop empties, optionally sort stably.
 * Preserves caller order when sort=false; when sort=true uses compareStableString.
 * Dedupes after normalization when unique=true.
 *
 * @param {unknown} values
 * @param {object} [options]
 * @param {boolean} [options.sort]
 * @param {boolean} [options.unique]
 * @param {string} [options.field]
 * @returns {string[]}
 */
export function normalizeStableIdArray(values, options = {}) {
  const field = options.field || "ids";
  if (values == null) return [];
  if (!Array.isArray(values)) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST,
      `${field} must be an array`,
      { field }
    );
  }

  /** @type {string[]} */
  const out = [];
  for (let i = 0; i < values.length; i += 1) {
    const item = values[i];
    if (item == null || item === "") continue;
    if (typeof item !== "string") {
      throw new RefereeAssignmentContractError(
        REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.NON_DETERMINISTIC_INPUT,
        `${field}[${i}] must be a string`,
        { field, index: i }
      );
    }
    const trimmed = item.trim();
    if (trimmed) out.push(trimmed);
  }

  let result = out;
  if (options.unique) {
    const seen = new Set();
    result = [];
    for (const id of out) {
      if (seen.has(id)) continue;
      seen.add(id);
      result.push(id);
    }
  }

  if (options.sort) {
    result = [...result].sort(compareStableString);
  }

  return result;
}

/**
 * Normalize preference/tag string array (stable sort + unique by default).
 * @param {unknown} values
 * @param {string} [field]
 * @returns {string[]}
 */
export function normalizePreferenceTags(values, field = "preferenceTags") {
  return normalizeStableIdArray(values, { field, sort: true, unique: true });
}
