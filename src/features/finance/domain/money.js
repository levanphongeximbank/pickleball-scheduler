/**
 * Immutable Money value object — integer minor units only.
 *
 * Rounding policy for percentage calculations (applyPercentBps):
 * - Input percentage is integer basis points (bps): 10000 bps = 100%.
 * - Product = amountMinor * bps, then divide by 10000.
 * - Rounding: half-away-from-zero integer division
 *   (Math.trunc(n / d) + sign adjustment when remainder * 2 >= d).
 * - No floating-point multiplication is used for fee/discount math.
 */

import { FINANCE_ERROR_CODES } from "../errors/codes.js";
import { FinanceError } from "../errors/FinanceError.js";
import { requireSupportedCurrency } from "./currency.js";

/**
 * @param {unknown} amountMinor
 * @param {{ allowNegative?: boolean }} [options]
 * @returns {number}
 */
export function assertMinorAmount(amountMinor, options = {}) {
  const { allowNegative = false } = options;

  if (typeof amountMinor !== "number") {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_MONEY,
      "Money amountMinor must be a number (integer minor units).",
      { field: "amountMinor" }
    );
  }
  if (!Number.isFinite(amountMinor)) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_MONEY,
      "Money amountMinor must be finite.",
      { field: "amountMinor" }
    );
  }
  if (!Number.isInteger(amountMinor)) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_MONEY,
      "Money amountMinor must be an integer (no floating-point).",
      { field: "amountMinor", received: amountMinor }
    );
  }
  if (!Number.isSafeInteger(amountMinor)) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_MONEY,
      "Money amountMinor must be a safe integer.",
      { field: "amountMinor" }
    );
  }
  if (!allowNegative && amountMinor < 0) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_MONEY,
      "Money amountMinor must be non-negative.",
      { field: "amountMinor", amountMinor }
    );
  }
  return amountMinor;
}

/**
 * @param {unknown} amountMinor
 * @param {unknown} currency
 * @param {{ allowNegative?: boolean, allowCurrencyNormalization?: boolean }} [options]
 * @returns {Readonly<{ amountMinor: number, currency: string }>}
 */
export function createMoney(amountMinor, currency, options = {}) {
  const amount = assertMinorAmount(amountMinor, {
    allowNegative: options.allowNegative === true,
  });
  const code = requireSupportedCurrency(currency, {
    allowNormalization: options.allowCurrencyNormalization === true,
  });

  return Object.freeze({
    amountMinor: amount,
    currency: code,
  });
}

/**
 * @param {unknown} value
 * @returns {value is { amountMinor: number, currency: string }}
 */
export function isMoney(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof value.amountMinor === "number" &&
      Number.isSafeInteger(value.amountMinor) &&
      typeof value.currency === "string"
  );
}

/**
 * @param {unknown} value
 * @param {{ allowNegative?: boolean }} [options]
 * @returns {Readonly<{ amountMinor: number, currency: string }>}
 */
export function requireMoney(value, options = {}) {
  if (!isMoney(value)) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_MONEY,
      "A Money value is required.",
      { field: "money" }
    );
  }
  return createMoney(value.amountMinor, value.currency, options);
}

/**
 * @param {string} currency
 * @returns {Readonly<{ amountMinor: number, currency: string }>}
 */
export function zeroMoney(currency) {
  return createMoney(0, currency);
}

/**
 * @param {{ amountMinor: number, currency: string }} a
 * @param {{ amountMinor: number, currency: string }} b
 */
function assertSameCurrency(a, b) {
  if (a.currency !== b.currency) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.CURRENCY_MISMATCH,
      `Currency mismatch: ${a.currency} vs ${b.currency}.`,
      { left: a.currency, right: b.currency }
    );
  }
}

/**
 * @param {{ amountMinor: number, currency: string }} left
 * @param {{ amountMinor: number, currency: string }} right
 * @returns {Readonly<{ amountMinor: number, currency: string }>}
 */
export function addMoney(left, right) {
  const a = requireMoney(left, { allowNegative: true });
  const b = requireMoney(right, { allowNegative: true });
  assertSameCurrency(a, b);
  const sum = a.amountMinor + b.amountMinor;
  if (!Number.isSafeInteger(sum)) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_MONEY,
      "Money addition overflowed safe integer range.",
      { left: a.amountMinor, right: b.amountMinor }
    );
  }
  return createMoney(sum, a.currency, { allowNegative: true });
}

/**
 * @param {{ amountMinor: number, currency: string }} left
 * @param {{ amountMinor: number, currency: string }} right
 * @param {{ allowNegative?: boolean }} [options]
 * @returns {Readonly<{ amountMinor: number, currency: string }>}
 */
export function subtractMoney(left, right, options = {}) {
  const a = requireMoney(left, { allowNegative: true });
  const b = requireMoney(right, { allowNegative: true });
  assertSameCurrency(a, b);
  const diff = a.amountMinor - b.amountMinor;
  if (!Number.isSafeInteger(diff)) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_MONEY,
      "Money subtraction overflowed safe integer range.",
      { left: a.amountMinor, right: b.amountMinor }
    );
  }
  return createMoney(diff, a.currency, {
    allowNegative: options.allowNegative === true,
  });
}

/**
 * @param {{ amountMinor: number, currency: string }} left
 * @param {{ amountMinor: number, currency: string }} right
 * @returns {boolean}
 */
export function moneyEquals(left, right) {
  const a = requireMoney(left, { allowNegative: true });
  const b = requireMoney(right, { allowNegative: true });
  return a.currency === b.currency && a.amountMinor === b.amountMinor;
}

/**
 * @param {{ amountMinor: number, currency: string }} left
 * @param {{ amountMinor: number, currency: string }} right
 * @returns {-1|0|1}
 */
export function compareMoney(left, right) {
  const a = requireMoney(left, { allowNegative: true });
  const b = requireMoney(right, { allowNegative: true });
  assertSameCurrency(a, b);
  if (a.amountMinor < b.amountMinor) return -1;
  if (a.amountMinor > b.amountMinor) return 1;
  return 0;
}

/**
 * Half-away-from-zero integer division for percentage application.
 * @param {number} numerator
 * @param {number} denominator
 * @returns {number}
 */
export function divideWithHalfAwayFromZero(numerator, denominator) {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || denominator === 0) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_MONEY,
      "Invalid integer division inputs for percentage rounding.",
      { numerator, denominator }
    );
  }
  const absN = Math.abs(numerator);
  const absD = Math.abs(denominator);
  const q = Math.trunc(absN / absD);
  const rem = absN % absD;
  const rounded = rem * 2 >= absD ? q + 1 : q;
  const sign = numerator < 0 !== denominator < 0 ? -1 : 1;
  return sign * rounded;
}

/**
 * Apply a percentage expressed in basis points (bps) to money.
 * 10000 bps = 100%. Uses half-away-from-zero integer rounding.
 *
 * @param {{ amountMinor: number, currency: string }} money
 * @param {number} bps
 * @returns {Readonly<{ amountMinor: number, currency: string }>}
 */
export function applyPercentBps(money, bps) {
  const m = requireMoney(money, { allowNegative: true });
  if (typeof bps !== "number" || !Number.isSafeInteger(bps) || bps < 0) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_MONEY,
      "Percentage bps must be a non-negative safe integer.",
      { field: "bps", bps }
    );
  }
  const product = m.amountMinor * bps;
  if (!Number.isSafeInteger(product)) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_MONEY,
      "Percentage product overflowed safe integer range.",
      { amountMinor: m.amountMinor, bps }
    );
  }
  const result = divideWithHalfAwayFromZero(product, 10000);
  return createMoney(result, m.currency, { allowNegative: true });
}

/**
 * @param {{ amountMinor: number, currency: string }} money
 * @returns {{ amountMinor: number, currency: string }}
 */
export function serializeMoney(money) {
  const m = requireMoney(money, { allowNegative: true });
  return Object.freeze({
    amountMinor: m.amountMinor,
    currency: m.currency,
  });
}

/**
 * @param {unknown} raw
 * @param {{ allowNegative?: boolean }} [options]
 * @returns {Readonly<{ amountMinor: number, currency: string }>}
 */
export function deserializeMoney(raw, options = {}) {
  if (!raw || typeof raw !== "object") {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_MONEY,
      "Cannot deserialize Money from non-object.",
      { field: "money" }
    );
  }
  return createMoney(raw.amountMinor, raw.currency, options);
}
