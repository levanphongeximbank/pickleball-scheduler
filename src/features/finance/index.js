/**
 * Finance Foundation — public facade (Phase 1B).
 *
 * Export only canonical public contracts. Consumers must import from this
 * index — not from internal file paths — once wiring begins in later phases.
 *
 * Does NOT export:
 * - private helper internals beyond documented contracts
 * - persistence adapters (none in Phase 1B)
 * - payment provider ports (deferred)
 * - UI, SQL, or Billing/SaaS surfaces
 */

// Errors
export {
  FINANCE_ERROR_CODES,
  FINANCE_ERROR_CODE_VALUES,
  isFinanceErrorCode,
  FinanceError,
  isFinanceError,
} from "./errors/index.js";

// Currency
export {
  FINANCE_CURRENCY_VND,
  FINANCE_SUPPORTED_CURRENCIES,
  FINANCE_ALLOWED_CURRENCY_CODES,
  normalizeCurrencyCode,
  requireSupportedCurrency,
  isSupportedCurrency,
  getCurrencyMeta,
} from "./domain/currency.js";

// Money
export {
  assertMinorAmount,
  createMoney,
  isMoney,
  requireMoney,
  zeroMoney,
  addMoney,
  subtractMoney,
  moneyEquals,
  compareMoney,
  divideWithHalfAwayFromZero,
  applyPercentBps,
  serializeMoney,
  deserializeMoney,
} from "./domain/money.js";

// Fee definition + policy
export {
  FEE_TYPE,
  FEE_TYPE_VALUES,
  FEE_STATUS,
  FEE_STATUS_VALUES,
  createFeeDefinition,
  evaluateFeeDefinition,
} from "./domain/feeDefinition.js";
export { createFeePolicy, evaluateFeePolicy } from "./contracts/feePolicy.js";

// Obligation
export {
  OBLIGATION_STATUS,
  OBLIGATION_STATUS_VALUES,
  OBLIGATION_TERMINAL_STATUSES,
  OBLIGATION_ALLOWED_TRANSITIONS,
  createObligation,
  openObligation,
  applyObligationSettlement,
  cancelObligation,
  expireObligation,
  assertObligationAmountImmutable,
} from "./domain/obligation.js";

// Invoice
export {
  INVOICE_STATUS,
  INVOICE_STATUS_VALUES,
  INVOICE_TERMINAL_STATUSES,
  INVOICE_ALLOWED_TRANSITIONS,
  createInvoiceItem,
  sumInvoiceItems,
  createInvoice,
  issueInvoice,
  assertIssuedInvoiceImmutable,
  applyInvoicePaymentHint,
  voidInvoice,
} from "./domain/invoice.js";

// Payment attempt
export {
  PAYMENT_ATTEMPT_STATUS,
  PAYMENT_ATTEMPT_STATUS_VALUES,
  PAYMENT_ATTEMPT_TERMINAL_STATUSES,
  PAYMENT_ATTEMPT_ALLOWED_TRANSITIONS,
  createPaymentAttempt,
  confirmPaymentAttempt,
  failPaymentAttempt,
  cancelPaymentAttempt,
  expirePaymentAttempt,
  assertProviderTransactionReferenceImmutable,
} from "./domain/paymentAttempt.js";

// Payment
export {
  PAYMENT_STATUS,
  PAYMENT_STATUS_VALUES,
  PAYMENT_TERMINAL_STATUSES,
  PAYMENT_ALLOWED_TRANSITIONS,
  createPayment,
  addPaymentAttempt,
  confirmPayment,
  failPayment,
  cancelPayment,
  expirePayment,
  getRefundableAmount,
  recordPaymentRefund,
} from "./domain/payment.js";

// Receipt
export {
  createReceipt,
  serializeReceipt,
  issueReceiptFromPayment,
} from "./domain/receipt.js";

// Refund
export {
  REFUND_STATUS,
  REFUND_STATUS_VALUES,
  REFUND_TERMINAL_STATUSES,
  REFUND_ALLOWED_TRANSITIONS,
  createRefund,
  requestRefund,
  approveRefund,
  rejectRefund,
  completeRefund,
  assertCompletedRefundImmutable,
} from "./domain/refund.js";

// Idempotency
export {
  FINANCE_IDEMPOTENCY_VERSION,
  normalizeIdempotencyInput,
  buildFinanceIdempotencyKey,
  assertIdempotencyKeyMatch,
} from "./domain/idempotency.js";

// Events
export {
  FINANCE_OWNING_MODULE,
  FINANCE_EVENT_VERSION,
  FINANCE_EVENT_TYPE,
  FINANCE_EVENT_TYPE_VALUES,
  FINANCE_PRIVACY_CLASSIFICATION,
  FINANCE_PRIVACY_CLASSIFICATION_VALUES,
  FINANCE_EVENTS_REQUIRING_AMOUNT,
  FINANCE_EVENTS_REQUIRING_EVIDENCE,
  isFinanceEventType,
} from "./events/catalogue.js";
export { createFinanceEvent, serializeFinanceEvent } from "./events/envelope.js";
