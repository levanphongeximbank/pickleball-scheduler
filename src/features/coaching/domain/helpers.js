/**
 * Shared domain helpers for Coaching aggregates (COACHING-01).
 * Pure — clock and ids must be injected; no wall-clock or entropy APIs.
 */

import { COACHING_ERROR_CODES } from "../constants/errorCodes.js";
import { throwCoachingError } from "../errors/CoachingError.js";
import { requireIsoTimestamp } from "../constants/timestamps.js";
import {
  createCoachingScope,
  requireNonEmptyId,
  requireVersion,
} from "./scope.js";

/**
 * @param {{ nowIso?: () => string }} [deps]
 * @returns {string}
 */
export function resolveNowIso(deps = {}) {
  if (typeof deps.nowIso !== "function") {
    throwCoachingError(
      COACHING_ERROR_CODES.DEPENDENCY_UNAVAILABLE,
      "Deterministic clock (nowIso) must be injected for Coaching domain writes."
    );
  }
  return requireIsoTimestamp(deps.nowIso(), "nowIso");
}

/**
 * @param {{ nextId?: (prefix: string) => string }} [deps]
 * @param {string} prefix
 * @param {unknown} [explicitId]
 * @param {string} fieldName
 * @returns {string}
 */
export function resolveId(deps = {}, prefix, explicitId, fieldName) {
  if (explicitId != null && String(explicitId).trim()) {
    return requireNonEmptyId(explicitId, fieldName);
  }
  if (typeof deps.nextId !== "function") {
    throwCoachingError(
      COACHING_ERROR_CODES.DEPENDENCY_UNAVAILABLE,
      "Deterministic identifier generator (nextId) must be injected.",
      { field: fieldName }
    );
  }
  return requireNonEmptyId(deps.nextId(prefix), fieldName);
}

/**
 * @param {object} input
 * @param {{ nowIso?: () => string, nextId?: (prefix: string) => string }} deps
 * @param {{ idField: string, idPrefix: string, status: string, extra?: object }} opts
 */
export function createScopedAggregateBase(input, deps, opts) {
  const scope = createCoachingScope(input);
  const id = resolveId(deps, opts.idPrefix, input[opts.idField] ?? input.id, opts.idField);
  const now = resolveNowIso(deps);
  const version =
    input.version == null ? 1 : requireVersion(input.version, "version");
  const createdAt = input.createdAt
    ? requireIsoTimestamp(input.createdAt, "createdAt")
    : now;
  const updatedAt = input.updatedAt
    ? requireIsoTimestamp(input.updatedAt, "updatedAt")
    : now;

  return Object.freeze({
    [opts.idField]: id,
    tenantId: scope.tenantId,
    clubId: scope.clubId,
    venueId: scope.venueId,
    status: opts.status,
    version,
    createdAt,
    updatedAt,
    ...(opts.extra || {}),
  });
}

/**
 * @param {object} entity
 * @param {object} patch
 * @param {string} nowIso
 * @returns {object}
 */
export function bumpVersion(entity, patch, nowIso) {
  return Object.freeze({
    ...entity,
    ...patch,
    version: entity.version + 1,
    updatedAt: requireIsoTimestamp(nowIso, "updatedAt"),
  });
}

/**
 * @param {unknown} value
 * @param {string} field
 * @param {number} [max]
 * @returns {string|null}
 */
export function optionalTrimmedString(value, field, max = 2000) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") {
    throwCoachingError(
      COACHING_ERROR_CODES.INVALID_INPUT,
      `${field} must be a string when provided.`,
      { field }
    );
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > max) {
    throwCoachingError(
      COACHING_ERROR_CODES.INVALID_INPUT,
      `${field} exceeds max length ${max}.`,
      { field, max }
    );
  }
  return trimmed;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @param {number} [max]
 * @returns {string}
 */
export function requireTrimmedString(value, field, max = 2000) {
  const out = optionalTrimmedString(value, field, max);
  if (!out) {
    throwCoachingError(
      COACHING_ERROR_CODES.INVALID_INPUT,
      `${field} is required.`,
      { field }
    );
  }
  return out;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {number}
 */
export function requireNonNegativeInt(value, field) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throwCoachingError(
      COACHING_ERROR_CODES.INVALID_INPUT,
      `${field} must be a non-negative safe integer.`,
      { field, value }
    );
  }
  return value;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {number}
 */
export function requirePositiveInt(value, field) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throwCoachingError(
      COACHING_ERROR_CODES.INVALID_INPUT,
      `${field} must be a positive safe integer.`,
      { field, value }
    );
  }
  return value;
}
