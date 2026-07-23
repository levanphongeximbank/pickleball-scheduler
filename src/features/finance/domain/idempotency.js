/**
 * Deterministic Finance idempotency key helpers (Phase 1B).
 *
 * IMPORTANT: An in-memory helper alone does NOT prevent database duplicates.
 * Persistence phases must enforce uniqueness (tenantId + idempotencyKey) at
 * the database / repository layer.
 *
 * Keys intentionally exclude secrets and raw sensitive payloads.
 */

import { FINANCE_ERROR_CODES } from "../errors/codes.js";
import { FinanceError } from "../errors/FinanceError.js";

export const FINANCE_IDEMPOTENCY_VERSION = 1;

const COMPONENT_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const FORBIDDEN_HINT_RE = /(secret|password|token|authorization|api[_-]?key|private[_-]?key)/i;

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
function requireComponent(value, field) {
  if (value == null || value === "") {
    throw new FinanceError(
      FINANCE_ERROR_CODES.IDEMPOTENCY_CONFLICT,
      `${field} is required for idempotency key.`,
      { field }
    );
  }
  if (typeof value !== "string") {
    throw new FinanceError(
      FINANCE_ERROR_CODES.IDEMPOTENCY_CONFLICT,
      `${field} must be a string.`,
      { field }
    );
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.IDEMPOTENCY_CONFLICT,
      `${field} must be non-empty.`,
      { field }
    );
  }
  if (FORBIDDEN_HINT_RE.test(trimmed)) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.IDEMPOTENCY_CONFLICT,
      `${field} must not contain secret-like material.`,
      { field }
    );
  }
  if (!COMPONENT_RE.test(trimmed)) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.IDEMPOTENCY_CONFLICT,
      `${field} has invalid idempotency component format.`,
      { field }
    );
  }
  return trimmed;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string|null}
 */
function optionalComponent(value, field) {
  if (value == null || value === "") return null;
  return requireComponent(value, field);
}

/**
 * Normalize canonical idempotency input.
 *
 * @param {object} input
 * @returns {Readonly<{
 *   tenantId: string,
 *   operationType: string,
 *   businessReference: string,
 *   providerReference: string|null,
 *   version: number
 * }>}
 */
export function normalizeIdempotencyInput(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.IDEMPOTENCY_CONFLICT,
      "Idempotency input must be an object.",
      { field: "input" }
    );
  }

  const versionRaw = input.version == null ? FINANCE_IDEMPOTENCY_VERSION : input.version;
  if (typeof versionRaw !== "number" || !Number.isInteger(versionRaw) || versionRaw < 1) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.IDEMPOTENCY_CONFLICT,
      "Idempotency version must be a positive integer.",
      { field: "version" }
    );
  }

  return Object.freeze({
    tenantId: requireComponent(input.tenantId, "tenantId"),
    operationType: requireComponent(input.operationType, "operationType"),
    businessReference: requireComponent(input.businessReference, "businessReference"),
    providerReference: optionalComponent(input.providerReference, "providerReference"),
    version: versionRaw,
  });
}

/**
 * Build a deterministic, non-cryptographic canonical key string.
 * Same canonical input → same key. Different tenant/operation/business ref → different key.
 *
 * @param {object} input
 * @returns {string}
 */
export function buildFinanceIdempotencyKey(input = {}) {
  const normalized = normalizeIdempotencyInput(input);
  const parts = [
    `v${normalized.version}`,
    normalized.tenantId,
    normalized.operationType,
    normalized.businessReference,
  ];
  if (normalized.providerReference) {
    parts.push(`p:${normalized.providerReference}`);
  }
  return parts.join("|");
}

/**
 * Assert two keys match; throw typed conflict on mismatch.
 *
 * @param {string} expectedKey
 * @param {string} actualKey
 */
export function assertIdempotencyKeyMatch(expectedKey, actualKey) {
  if (typeof expectedKey !== "string" || !expectedKey.trim()) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.IDEMPOTENCY_CONFLICT,
      "Expected idempotency key is missing.",
      { field: "expectedKey" }
    );
  }
  if (typeof actualKey !== "string" || !actualKey.trim()) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.IDEMPOTENCY_CONFLICT,
      "Actual idempotency key is missing.",
      { field: "actualKey" }
    );
  }
  if (expectedKey !== actualKey) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.IDEMPOTENCY_CONFLICT,
      "Idempotency key conflict.",
      { field: "idempotencyKey" }
    );
  }
}
