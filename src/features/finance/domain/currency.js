/**
 * Currency policy for Finance Foundation (Phase 1B).
 *
 * Version 1 allowlist is VND only. Money is structurally ready for additional
 * ISO 4217 codes later without changing the Money shape.
 *
 * VND (ISO 4217): 0 decimal places — minor unit equals the đồng.
 */

import { FINANCE_ERROR_CODES } from "../errors/codes.js";
import { FinanceError } from "../errors/FinanceError.js";

export const FINANCE_CURRENCY_VND = "VND";

/** @type {Readonly<Record<string, { code: string, minorUnitExponent: number, name: string }>>} */
export const FINANCE_SUPPORTED_CURRENCIES = Object.freeze({
  VND: Object.freeze({
    code: FINANCE_CURRENCY_VND,
    minorUnitExponent: 0,
    name: "Vietnamese đồng",
  }),
});

export const FINANCE_ALLOWED_CURRENCY_CODES = Object.freeze(
  Object.keys(FINANCE_SUPPORTED_CURRENCIES)
);

const ISO_CURRENCY_RE = /^[A-Z]{3}$/;

/**
 * @param {unknown} value
 * @returns {string|null}
 */
export function normalizeCurrencyCode(value) {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  if (!ISO_CURRENCY_RE.test(upper)) return null;
  return upper;
}

/**
 * Require an explicitly supported currency. Does not silently coerce lowercase —
 * callers must pass a value that normalizes to a supported uppercase ISO code.
 *
 * @param {unknown} value
 * @param {{ allowNormalization?: boolean }} [options]
 * @returns {string}
 */
export function requireSupportedCurrency(value, options = {}) {
  const { allowNormalization = false } = options;

  if (value == null || value === "") {
    throw new FinanceError(
      FINANCE_ERROR_CODES.UNSUPPORTED_CURRENCY,
      "Currency is required.",
      { field: "currency" }
    );
  }

  if (typeof value !== "string") {
    throw new FinanceError(
      FINANCE_ERROR_CODES.UNSUPPORTED_CURRENCY,
      "Currency must be a string ISO code.",
      { field: "currency" }
    );
  }

  const trimmed = value.trim();
  if (!allowNormalization && trimmed !== trimmed.toUpperCase()) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.UNSUPPORTED_CURRENCY,
      "Currency must be uppercase ISO-4217 (e.g. VND). Pass allowNormalization to coerce.",
      { field: "currency", received: trimmed }
    );
  }

  const code = normalizeCurrencyCode(trimmed);
  if (!code) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.UNSUPPORTED_CURRENCY,
      "Currency must be a 3-letter ISO-4217 code.",
      { field: "currency", received: String(value) }
    );
  }

  if (!FINANCE_SUPPORTED_CURRENCIES[code]) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.UNSUPPORTED_CURRENCY,
      `Currency ${code} is not supported in Finance v1.`,
      { field: "currency", currency: code, allowed: FINANCE_ALLOWED_CURRENCY_CODES }
    );
  }

  return code;
}

/**
 * @param {string} code
 * @returns {boolean}
 */
export function isSupportedCurrency(code) {
  const normalized = normalizeCurrencyCode(code);
  return Boolean(normalized && FINANCE_SUPPORTED_CURRENCIES[normalized]);
}

/**
 * @param {string} code
 * @returns {{ code: string, minorUnitExponent: number, name: string }}
 */
export function getCurrencyMeta(code) {
  const supported = requireSupportedCurrency(code);
  return FINANCE_SUPPORTED_CURRENCIES[supported];
}
