/**
 * Provider capability declaration (Phase 1D).
 * Immutable and deterministic.
 */

import { FINANCE_ERROR_CODES } from "../errors/codes.js";
import { FinanceError } from "../errors/FinanceError.js";
import { requireSupportedCurrency } from "../domain/currency.js";
import { PROVIDER_OPERATION } from "./catalogue.js";
import { throwProviderError } from "./errors.js";

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {boolean}
 */
function requireBoolean(value, field) {
  if (typeof value !== "boolean") {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_INPUT,
      `${field} must be a boolean.`,
      { field }
    );
  }
  return value;
}

/**
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function createProviderCapabilities(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_INPUT,
      "Provider capabilities must be an object."
    );
  }

  const providerCode =
    typeof input.providerCode === "string" && input.providerCode.trim()
      ? input.providerCode.trim()
      : (() => {
          throw new FinanceError(
            FINANCE_ERROR_CODES.INVALID_INPUT,
            "providerCode is required.",
            { field: "providerCode" }
          );
        })();

  const currenciesRaw = Array.isArray(input.supportedCurrencies)
    ? input.supportedCurrencies
    : [];
  if (currenciesRaw.length === 0) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_INPUT,
      "supportedCurrencies must be a non-empty array.",
      { field: "supportedCurrencies" }
    );
  }
  const supportedCurrencies = Object.freeze(
    currenciesRaw.map((c, i) => {
      try {
        return requireSupportedCurrency(c);
      } catch {
        throw new FinanceError(
          FINANCE_ERROR_CODES.PROVIDER_UNSUPPORTED_CURRENCY,
          `Unsupported currency in capabilities at index ${i}.`,
          { field: "supportedCurrencies", index: i }
        );
      }
    })
  );

  return Object.freeze({
    providerCode,
    paymentInitiation: requireBoolean(
      input.paymentInitiation ?? true,
      "paymentInitiation"
    ),
    synchronousConfirmation: requireBoolean(
      input.synchronousConfirmation ?? false,
      "synchronousConfirmation"
    ),
    asynchronousConfirmation: requireBoolean(
      input.asynchronousConfirmation ?? true,
      "asynchronousConfirmation"
    ),
    paymentStatusQuery: requireBoolean(
      input.paymentStatusQuery ?? true,
      "paymentStatusQuery"
    ),
    cancellation: requireBoolean(input.cancellation ?? true, "cancellation"),
    partialRefund: requireBoolean(input.partialRefund ?? true, "partialRefund"),
    fullRefund: requireBoolean(input.fullRefund ?? true, "fullRefund"),
    refundStatusQuery: requireBoolean(
      input.refundStatusQuery ?? true,
      "refundStatusQuery"
    ),
    webhookDelivery: requireBoolean(
      input.webhookDelivery ?? true,
      "webhookDelivery"
    ),
    idempotencySupport: requireBoolean(
      input.idempotencySupport ?? true,
      "idempotencySupport"
    ),
    supportedCurrencies,
  });
}

/**
 * @param {object} capabilities
 * @param {string} operation
 */
export function assertProviderOperationSupported(capabilities, operation) {
  const caps = createProviderCapabilities(capabilities);
  switch (operation) {
    case PROVIDER_OPERATION.INITIATE_PAYMENT:
      if (!caps.paymentInitiation) break;
      return;
    case PROVIDER_OPERATION.QUERY_PAYMENT_STATUS:
      if (!caps.paymentStatusQuery) break;
      return;
    case PROVIDER_OPERATION.VERIFY_PAYMENT_CONFIRMATION:
      if (!caps.synchronousConfirmation && !caps.asynchronousConfirmation) break;
      return;
    case PROVIDER_OPERATION.CANCEL_PAYMENT:
      if (!caps.cancellation) break;
      return;
    case PROVIDER_OPERATION.INITIATE_REFUND:
      if (!caps.fullRefund && !caps.partialRefund) break;
      return;
    case PROVIDER_OPERATION.QUERY_REFUND_STATUS:
      if (!caps.refundStatusQuery) break;
      return;
    case PROVIDER_OPERATION.PARSE_WEBHOOK:
      if (!caps.webhookDelivery) break;
      return;
    default:
      throwProviderError(
        FINANCE_ERROR_CODES.PROVIDER_UNSUPPORTED_OPERATION,
        `Unknown provider operation: ${operation}.`,
        { providerCode: caps.providerCode, operation }
      );
  }
  throwProviderError(
    FINANCE_ERROR_CODES.PROVIDER_UNSUPPORTED_OPERATION,
    `Provider ${caps.providerCode} does not support ${operation}.`,
    { providerCode: caps.providerCode, operation }
  );
}

/**
 * @param {object} capabilities
 * @param {string} currency
 */
export function assertProviderCurrencySupported(capabilities, currency) {
  const caps = createProviderCapabilities(capabilities);
  const code = requireSupportedCurrency(currency);
  if (!caps.supportedCurrencies.includes(code)) {
    throwProviderError(
      FINANCE_ERROR_CODES.PROVIDER_UNSUPPORTED_CURRENCY,
      `Provider ${caps.providerCode} does not support currency ${code}.`,
      { providerCode: caps.providerCode, currency: code }
    );
  }
  return code;
}
