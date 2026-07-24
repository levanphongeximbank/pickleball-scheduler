/**
 * Translate persistence / database errors into Customer error contracts (CUSTOMER-03).
 */

import { CUSTOMER_ERROR_CODES } from "../errors/codes.js";
import { CustomerError, isCustomerError } from "../errors/CustomerError.js";

/**
 * @param {unknown} err
 * @param {{ conflictMessage?: string, notFoundMessage?: string }} [options]
 * @returns {never}
 */
export function translateCustomerPersistenceError(err, options = {}) {
  if (isCustomerError(err)) {
    throw err;
  }

  const code = String(err?.code || err?.error?.code || "");
  const message = String(err?.message || err?.error?.message || err || "Persistence error");
  const detail = String(err?.detail || err?.error?.detail || "");
  const combined = `${message} ${detail}`;

  if (
    /CUSTOMER_VERSION_CONFLICT/i.test(combined) ||
    err?.name === "CustomerVersionConflict"
  ) {
    throw new CustomerError(
      CUSTOMER_ERROR_CODES.VERSION_CONFLICT,
      "Customer version conflict.",
      { detail: detail || undefined }
    );
  }

  if (
    code === "23505" ||
    /duplicate|unique|conflict/i.test(combined) ||
    err?.name === "CustomerUniqueViolation"
  ) {
    throw new CustomerError(
      CUSTOMER_ERROR_CODES.DUPLICATE,
      options.conflictMessage || "Customer persistence conflict (unique constraint).",
      { detail: detail || undefined }
    );
  }

  if (
    code === "PGRST116" ||
    err?.name === "CustomerNotFound" ||
    /not found/i.test(message)
  ) {
    throw new CustomerError(
      CUSTOMER_ERROR_CODES.NOT_FOUND,
      options.notFoundMessage || "Customer persistence row not found."
    );
  }

  if (
    code === "42501" ||
    /permission denied|scope denied|forbidden/i.test(combined)
  ) {
    throw new CustomerError(
      CUSTOMER_ERROR_CODES.TENANT_SCOPE_MISMATCH,
      "Customer persistence scope or permission denied."
    );
  }

  if (code === "23514" || /scope mismatch|check constraint/i.test(combined)) {
    throw new CustomerError(
      CUSTOMER_ERROR_CODES.TENANT_SCOPE_MISMATCH,
      "Customer persistence scope consistency violation.",
      { detail: detail || undefined }
    );
  }

  throw new CustomerError(CUSTOMER_ERROR_CODES.INVALID_INPUT, message);
}

/**
 * @template T
 * @param {() => Promise<T>|T} fn
 * @param {object} [options]
 * @returns {Promise<T>}
 */
export async function withCustomerPersistenceErrors(fn, options = {}) {
  try {
    return await fn();
  } catch (err) {
    translateCustomerPersistenceError(err, options);
  }
}
