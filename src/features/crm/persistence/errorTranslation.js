/**
 * Translate persistence / database errors into CRM error contracts (Phase 1G).
 */

import { CRM_ERROR_CODES, CrmError } from "../constants/errorCodes.js";

/**
 * @param {unknown} err
 * @param {{ conflictMessage?: string, notFoundMessage?: string }} [options]
 * @returns {never}
 */
export function translatePersistenceError(err, options = {}) {
  if (err instanceof CrmError) {
    throw err;
  }

  const code = String(err?.code || err?.error?.code || "");
  const message = String(err?.message || err?.error?.message || err || "Persistence error");
  const details = err?.details != null ? err.details : undefined;

  // Postgres unique_violation / common client conflict markers
  if (
    code === "23505" ||
    /duplicate|unique|conflict/i.test(message) ||
    err?.name === "CrmUniqueViolation"
  ) {
    throw new CrmError(
      CRM_ERROR_CODES.IDEMPOTENCY_CONFLICT,
      options.conflictMessage || "CRM persistence conflict (unique constraint).",
      details
    );
  }

  if (
    code === "PGRST116" ||
    code === "CRM_NOT_FOUND" ||
    err?.name === "CrmNotFound" ||
    /not found/i.test(message)
  ) {
    throw new CrmError(
      CRM_ERROR_CODES.NOT_FOUND,
      options.notFoundMessage || "CRM persistence row not found.",
      details
    );
  }

  if (
    code === "42501" ||
    /permission denied|scope denied|forbidden/i.test(message)
  ) {
    throw new CrmError(
      CRM_ERROR_CODES.FORBIDDEN_SCOPE,
      "CRM persistence scope or permission denied.",
      details
    );
  }

  throw new CrmError(CRM_ERROR_CODES.INVALID_INPUT, message, details);
}

/**
 * Wrap async persistence work with stable CRM error translation.
 * @template T
 * @param {() => Promise<T>|T} fn
 * @param {object} [options]
 * @returns {Promise<T>}
 */
export async function withPersistenceErrors(fn, options = {}) {
  try {
    return await fn();
  } catch (err) {
    translatePersistenceError(err, options);
  }
}
