/**
 * Finance repository ports (Phase 1C).
 *
 * Provider-neutral and persistence-neutral contracts. No Supabase, SQL,
 * localStorage, or browser APIs. Implementations may be in-memory (tests)
 * or durable adapters (later phases).
 *
 * Database uniqueness for idempotency keys and provider transaction
 * references is still required in a later persistence phase.
 */

export const FINANCE_REPOSITORY_PORTS = Object.freeze({
  FeeDefinitionRepository: "FeeDefinitionRepository",
  FinancialObligationRepository: "FinancialObligationRepository",
  InvoiceRepository: "InvoiceRepository",
  PaymentRepository: "PaymentRepository",
  PaymentAttemptRepository: "PaymentAttemptRepository",
  ReceiptRepository: "ReceiptRepository",
  RefundRepository: "RefundRepository",
  IdempotencyRepository: "IdempotencyRepository",
  FinanceEventRepository: "FinanceEventRepository",
});

/**
 * @typedef {object} FeeDefinitionRepository
 * @property {(tenantId: string, feeId: string) => object|null} findById
 * @property {(tenantId: string, feeId: string) => object} getById
 * @property {(fee: object) => object} save
 * @property {(tenantId: string, feeId: string, next: object) => object} update
 */

/**
 * @typedef {object} FinancialObligationRepository
 * @property {(tenantId: string, obligationId: string) => object|null} findById
 * @property {(tenantId: string, obligationId: string) => object} getById
 * @property {(obligation: object) => object} save
 * @property {(tenantId: string, obligationId: string, next: object) => object} update
 */

/**
 * @typedef {object} InvoiceRepository
 * @property {(tenantId: string, invoiceId: string) => object|null} findById
 * @property {(tenantId: string, invoiceId: string) => object} getById
 * @property {(invoice: object) => object} save
 * @property {(tenantId: string, invoiceId: string, next: object) => object} update
 */

/**
 * @typedef {object} PaymentRepository
 * @property {(tenantId: string, paymentId: string) => object|null} findById
 * @property {(tenantId: string, paymentId: string) => object} getById
 * @property {(tenantId: string, providerTransactionReference: string) => object|null} findByProviderTransactionReference
 * @property {(payment: object) => object} save
 * @property {(tenantId: string, paymentId: string, next: object) => object} update
 */

/**
 * @typedef {object} PaymentAttemptRepository
 * @property {(tenantId: string, attemptId: string) => object|null} findById
 * @property {(tenantId: string, attemptId: string) => object} getById
 * @property {(tenantId: string, paymentId: string) => object[]} listByPaymentId
 * @property {(attempt: object) => object} save
 * @property {(tenantId: string, attemptId: string, next: object) => object} update
 */

/**
 * @typedef {object} ReceiptRepository
 * @property {(tenantId: string, receiptId: string) => object|null} findById
 * @property {(tenantId: string, receiptId: string) => object} getById
 * @property {(tenantId: string, paymentId: string) => object|null} findByPaymentId
 * @property {(receipt: object) => object} save
 */

/**
 * @typedef {object} RefundRepository
 * @property {(tenantId: string, refundId: string) => object|null} findById
 * @property {(tenantId: string, refundId: string) => object} getById
 * @property {(tenantId: string, paymentId: string) => object[]} listByPaymentId
 * @property {(refund: object) => object} save
 * @property {(tenantId: string, refundId: string, next: object) => object} update
 */

/**
 * @typedef {object} IdempotencyRecord
 * @property {string} tenantId
 * @property {string} operationType
 * @property {string} idempotencyKey
 * @property {string} requestFingerprint
 * @property {object} result
 * @property {string[]} eventIds
 * @property {string} createdAt
 */

/**
 * @typedef {object} IdempotencyRepository
 * @property {(tenantId: string, operationType: string, idempotencyKey: string) => IdempotencyRecord|null} find
 * @property {(record: IdempotencyRecord) => IdempotencyRecord} save
 */

/**
 * FinanceEventRepository (also usable as FinanceEventSink).
 *
 * @typedef {object} FinanceEventRepository
 * @property {(event: object) => object} append
 * @property {(tenantId: string, eventId: string) => object|null} findById
 * @property {(tenantId: string, idempotencyKey: string) => object|null} findByIdempotencyKey
 * @property {(tenantId: string) => object[]} listByTenant
 */
