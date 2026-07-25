/**
 * Analytical money contracts for Finance, Ranking and Performance Analytics
 * (I&A-09). Integer minor-unit amounts only — no floating point, no
 * currency conversion. Mixed-currency arithmetic fails closed.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { deepFreeze, isNonEmptyString, isPlainObject } from "../contracts/shared.js";

/**
 * @typedef {{
 *   currencyCode: string,
 *   amountMinor: number,
 *   scale: number,
 * }} AnalyticalMoney
 */

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createAnalyticalMoney(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_MONETARY_INVALID,
        "AnalyticalMoney must be a plain object",
        "money"
      )
    );
  }

  if (!isNonEmptyString(input.currencyCode)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_MONETARY_INVALID,
        "AnalyticalMoney.currencyCode is required",
        "money.currencyCode"
      )
    );
  }

  if (!Number.isFinite(input.amountMinor) || !Number.isInteger(input.amountMinor)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_MONETARY_INVALID,
        "AnalyticalMoney.amountMinor must be a finite integer minor-unit amount (no floating point)",
        "money.amountMinor",
        { amountMinor: input.amountMinor }
      )
    );
  }

  let scale = 0;
  if (input.scale !== undefined) {
    if (
      !Number.isFinite(input.scale) ||
      !Number.isInteger(input.scale) ||
      input.scale < 0
    ) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_MONETARY_INVALID,
          "AnalyticalMoney.scale must be a non-negative finite integer when provided",
          "money.scale",
          { scale: input.scale }
        )
      );
    }
    scale = input.scale;
  }

  /** @type {AnalyticalMoney} */
  const money = {
    currencyCode: String(input.currencyCode).trim(),
    amountMinor: input.amountMinor,
    scale,
  };

  return ok(deepFreeze(money));
}

/**
 * Fails closed on mixed-currency collections — never silently converts or
 * picks an arbitrary currency.
 * @param {unknown} moneys
 * @returns {import("../contracts/result.js").Result}
 */
export function assertSameCurrency(moneys) {
  if (!Array.isArray(moneys) || moneys.length === 0) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_MONETARY_INVALID,
        "assertSameCurrency requires a non-empty array of AnalyticalMoney",
        "moneys"
      )
    );
  }

  /** @type {Set<string>} */
  const currencyCodes = new Set();
  for (const money of moneys) {
    if (!isPlainObject(money) || !isNonEmptyString(money.currencyCode)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_MONETARY_INVALID,
          "Each entry must be a valid AnalyticalMoney",
          "moneys"
        )
      );
    }
    currencyCodes.add(String(money.currencyCode).trim());
  }

  if (currencyCodes.size > 1) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_CURRENCY_MISMATCH,
        "Mixed-currency amounts are not comparable or summable without conversion",
        "moneys",
        { currencyCodes: Object.freeze([...currencyCodes]) }
      )
    );
  }

  return ok([...currencyCodes][0]);
}

/**
 * Sums AnalyticalMoney amounts sharing the same currency and scale.
 * Rejects mixed currency/scale collections rather than silently converting.
 * @param {unknown} amounts
 * @returns {import("../contracts/result.js").Result}
 */
export function sumCompatibleAnalyticalMoney(amounts) {
  if (!Array.isArray(amounts)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_MONETARY_INVALID,
        "sumCompatibleAnalyticalMoney requires an array of AnalyticalMoney",
        "amounts"
      )
    );
  }

  if (amounts.length === 0) {
    return ok(null);
  }

  const currencyResult = assertSameCurrency(amounts);
  if (!currencyResult.ok) return currencyResult;

  const scale = amounts[0].scale;
  for (const money of amounts) {
    if (money.scale !== scale) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_MONETARY_INVALID,
          "Cannot sum AnalyticalMoney amounts with differing scale",
          "amounts",
          { expectedScale: scale, actualScale: money.scale }
        )
      );
    }
  }

  let total = 0;
  for (const money of amounts) {
    total += money.amountMinor;
  }

  return createAnalyticalMoney({
    currencyCode: currencyResult.value,
    amountMinor: total,
    scale,
  });
}
