/**
 * Database / Supabase client error → FinanceError normalization (Phase 1G).
 */

import { FINANCE_ERROR_CODES } from "../../errors/codes.js";
import { FinanceError } from "../../errors/FinanceError.js";

const SAFE_CONTEXT_KEYS = new Set([
  "entity",
  "tenantId",
  "id",
  "table",
  "constraint",
  "code",
  "retryable",
  "operation",
  "expectedVersion",
  "actualVersion",
  "providerCode",
  "field",
]);

/**
 * @param {object} [raw]
 * @returns {Readonly<object>}
 */
export function sanitizePersistenceErrorContext(raw = {}) {
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!SAFE_CONTEXT_KEYS.has(key)) continue;
    if (value == null) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      out[key] = value;
    }
  }
  return Object.freeze(out);
}

/**
 * @param {unknown} err
 * @returns {{ code: string|null, message: string, details: string|null, hint: string|null, status: number|null }}
 */
export function extractClientErrorParts(err) {
  if (err == null) {
    return { code: null, message: "Unknown persistence failure.", details: null, hint: null, status: null };
  }
  if (typeof err === "string") {
    return { code: null, message: err.slice(0, 200), details: null, hint: null, status: null };
  }
  const obj = /** @type {Record<string, unknown>} */ (err);
  const code =
    typeof obj.code === "string"
      ? obj.code
      : typeof obj.error_code === "string"
        ? obj.error_code
        : null;
  const message =
    typeof obj.message === "string"
      ? obj.message.slice(0, 200)
      : err instanceof Error
        ? err.message.slice(0, 200)
        : "Persistence client failure.";
  const details = typeof obj.details === "string" ? obj.details.slice(0, 200) : null;
  const hint = typeof obj.hint === "string" ? obj.hint.slice(0, 120) : null;
  const status =
    typeof obj.status === "number"
      ? obj.status
      : typeof obj.statusCode === "number"
        ? obj.statusCode
        : null;
  return { code, message, details, hint, status };
}

/**
 * Map PostgREST / Postgres-shaped errors to typed Finance errors.
 *
 * @param {unknown} err
 * @param {{ entity?: string, tenantId?: string, id?: string, table?: string, operation?: string }} [context]
 * @returns {FinanceError}
 */
export function mapSupabaseFinanceError(err, context = {}) {
  if (err instanceof FinanceError) return err;

  const parts = extractClientErrorParts(err);
  const base = sanitizePersistenceErrorContext({
    ...context,
    code: parts.code || undefined,
  });

  const code = (parts.code || "").toUpperCase();
  const messageLower = `${parts.message} ${parts.details || ""}`.toLowerCase();
  const status = parts.status;

  // Unique violation (Postgres 23505 / PostgREST)
  if (code === "23505" || messageLower.includes("duplicate key") || messageLower.includes("unique constraint")) {
    return new FinanceError(
      FINANCE_ERROR_CODES.PERSISTENCE_UNIQUENESS_CONFLICT,
      `${context.entity || "Finance record"} uniqueness conflict.`,
      { ...base, constraint: parts.details || undefined }
    );
  }

  // Foreign key
  if (code === "23503" || messageLower.includes("foreign key")) {
    return new FinanceError(
      FINANCE_ERROR_CODES.PERSISTENCE_CONSTRAINT_VIOLATION,
      `${context.entity || "Finance record"} reference constraint violation.`,
      base
    );
  }

  // Check constraint
  if (code === "23514" || messageLower.includes("check constraint")) {
    return new FinanceError(
      FINANCE_ERROR_CODES.PERSISTENCE_CONSTRAINT_VIOLATION,
      `${context.entity || "Finance record"} check constraint violation.`,
      base
    );
  }

  // RLS / permission
  if (
    status === 401 ||
    status === 403 ||
    code === "42501" ||
    messageLower.includes("row-level security") ||
    messageLower.includes("permission denied") ||
    messageLower.includes("rls")
  ) {
    return new FinanceError(
      FINANCE_ERROR_CODES.PERSISTENCE_PERMISSION_DENIED,
      "Finance persistence permission or RLS denial.",
      base
    );
  }

  // Timeout / unavailable
  if (
    status === 408 ||
    status === 503 ||
    status === 504 ||
    code === "57014" ||
    messageLower.includes("timeout") ||
    messageLower.includes("unavailable") ||
    messageLower.includes("connection")
  ) {
    return new FinanceError(
      FINANCE_ERROR_CODES.PERSISTENCE_UNAVAILABLE,
      "Finance persistence backend unavailable or timed out.",
      { ...base, retryable: true }
    );
  }

  return new FinanceError(
    FINANCE_ERROR_CODES.PERSISTENCE_UNKNOWN_FAILURE,
    "Unknown Finance persistence failure.",
    base
  );
}

/**
 * @param {string} entity
 * @param {object} [context]
 * @returns {FinanceError}
 */
export function malformedRowError(entity, context = {}) {
  return new FinanceError(
    FINANCE_ERROR_CODES.CORRUPT_FINANCIAL_RECORD,
    `${entity} returned an invalid or corrupt database row.`,
    sanitizePersistenceErrorContext({ entity, ...context })
  );
}
