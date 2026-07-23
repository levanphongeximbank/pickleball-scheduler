/**
 * Finance application composition root (Phase 1C).
 *
 * Explicit dependency injection — no hidden global state.
 * In-memory repositories are for capability proof / tests only.
 */

import { FINANCE_ERROR_CODES } from "../errors/codes.js";
import { FinanceError } from "../errors/FinanceError.js";
import { createInMemoryFinanceRepositories } from "../repositories/inMemory.js";
import { createFinanceEventRecorder } from "./FinanceEventRecorder.js";
import { createFeeApplicationService } from "./FeeApplicationService.js";
import { createObligationApplicationService } from "./ObligationApplicationService.js";
import { createInvoiceApplicationService } from "./InvoiceApplicationService.js";
import { createPaymentApplicationService } from "./PaymentApplicationService.js";
import { createReceiptApplicationService } from "./ReceiptApplicationService.js";
import { createRefundApplicationService } from "./RefundApplicationService.js";

/**
 * Deterministic sequential id generator for tests / injected callers.
 * @param {string} [prefix]
 * @returns {() => string}
 */
export function createSequentialIdGenerator(prefix = "fin") {
  let n = 0;
  return (kind = "id") => {
    n += 1;
    return `${prefix}-${kind}-${String(n).padStart(4, "0")}`;
  };
}

/**
 * Create a fully wired Finance application with injected repositories.
 *
 * @param {object} [options]
 * @param {object} [options.repositories] — prebuilt repository bundle
 * @param {() => string} [options.idGenerator]
 * @param {boolean} [options.useInMemoryRepositories]
 * @returns {object}
 */
export function createFinanceApplication(options = {}) {
  const idGenerator =
    typeof options.idGenerator === "function"
      ? options.idGenerator
      : createSequentialIdGenerator("fin");

  let repositories = options.repositories;
  if (!repositories) {
    if (options.useInMemoryRepositories === false) {
      throw new FinanceError(
        FINANCE_ERROR_CODES.INVALID_INPUT,
        "repositories must be provided when useInMemoryRepositories is false."
      );
    }
    repositories = createInMemoryFinanceRepositories();
  }

  const eventRecorder = createFinanceEventRecorder({
    eventRepository: repositories.events,
    idGenerator,
  });

  const feeService = createFeeApplicationService({
    feeDefinitionRepository: repositories.feeDefinitions,
    idempotencyRepository: repositories.idempotency,
  });

  const obligationService = createObligationApplicationService({
    obligationRepository: repositories.obligations,
    feeDefinitionRepository: repositories.feeDefinitions,
    idempotencyRepository: repositories.idempotency,
    eventRecorder,
    idGenerator,
  });

  const invoiceService = createInvoiceApplicationService({
    invoiceRepository: repositories.invoices,
    obligationRepository: repositories.obligations,
    idempotencyRepository: repositories.idempotency,
    eventRecorder,
    idGenerator,
  });

  const paymentService = createPaymentApplicationService({
    paymentRepository: repositories.payments,
    paymentAttemptRepository: repositories.paymentAttempts,
    invoiceRepository: repositories.invoices,
    obligationRepository: repositories.obligations,
    idempotencyRepository: repositories.idempotency,
    eventRecorder,
    obligationService,
    invoiceService,
    idGenerator,
  });

  const receiptService = createReceiptApplicationService({
    receiptRepository: repositories.receipts,
    paymentRepository: repositories.payments,
    idempotencyRepository: repositories.idempotency,
    eventRecorder,
    idGenerator,
  });

  const refundService = createRefundApplicationService({
    refundRepository: repositories.refunds,
    paymentRepository: repositories.payments,
    idempotencyRepository: repositories.idempotency,
    eventRecorder,
    idGenerator,
  });

  return Object.freeze({
    /** In-memory only when created via default path — not production persistence. */
    repositories,
    eventRecorder,
    fees: feeService,
    obligations: obligationService,
    invoices: invoiceService,
    payments: paymentService,
    receipts: receiptService,
    refunds: refundService,
  });
}
