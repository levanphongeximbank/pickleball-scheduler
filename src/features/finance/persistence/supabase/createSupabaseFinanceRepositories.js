/**
 * Finance-owned factory: createSupabaseFinanceRepositories (Phase 1G).
 *
 * Accepts an injected Supabase-compatible client. Does not initialize
 * credentials, env, network, router, venue, or auth UI.
 */

import { assertSupabaseFinanceClient } from "./clientContract.js";
import { createSupabaseFeeDefinitionRepository } from "./SupabaseFeeDefinitionRepository.js";
import { createSupabaseObligationRepository } from "./SupabaseObligationRepository.js";
import { createSupabaseInvoiceRepository } from "./SupabaseInvoiceRepository.js";
import { createSupabasePaymentRepository } from "./SupabasePaymentRepository.js";
import { createSupabasePaymentAttemptRepository } from "./SupabasePaymentAttemptRepository.js";
import { createSupabaseReceiptRepository } from "./SupabaseReceiptRepository.js";
import { createSupabaseRefundRepository } from "./SupabaseRefundRepository.js";
import { createSupabaseFinanceEventRepository } from "./SupabaseFinanceEventRepository.js";
import { createSupabaseIdempotencyRepository } from "./SupabaseIdempotencyRepository.js";
import { createSupabaseAuditEvidenceRepository } from "./SupabaseAuditEvidenceRepository.js";
import { createSupabaseFinanceUnitOfWork } from "./SupabaseFinanceUnitOfWork.js";
import { FINANCE_TABLES, FINANCE_TABLE_NAME_VALUES } from "./schema.js";

/**
 * @param {object} client - Injected Supabase-compatible client
 * @param {{
 *   transactionalExecutor?: (work: Function) => Promise<any>,
 *   supportsAtomicMultiRecord?: boolean
 * }} [config]
 */
export function createSupabaseFinanceRepositories(client, config = {}) {
  const safeClient = assertSupabaseFinanceClient(client);
  const unitOfWork = createSupabaseFinanceUnitOfWork(config);
  const invoiceCapabilities = {
    supportsAtomicMultiRecord: unitOfWork.supportsAtomicMultiRecord,
    runAtomic: unitOfWork.supportsAtomicMultiRecord
      ? (work) => unitOfWork.run(work, { requireAtomic: true, atomicGroup: "invoiceWithItems" })
      : undefined,
  };

  return Object.freeze({
    isDurable: true,
    isSupabaseCompatible: true,
    durabilityClaim: unitOfWork.supportsAtomicMultiRecord
      ? "supabase-adapter-with-injected-transaction"
      : "supabase-adapter-single-statement",
    tables: FINANCE_TABLES,
    tableNames: FINANCE_TABLE_NAME_VALUES,
    capabilities: unitOfWork.capabilities,
    unitOfWork,
    feeDefinitions: createSupabaseFeeDefinitionRepository(safeClient),
    obligations: createSupabaseObligationRepository(safeClient),
    invoices: createSupabaseInvoiceRepository(safeClient, invoiceCapabilities),
    payments: createSupabasePaymentRepository(safeClient),
    paymentAttempts: createSupabasePaymentAttemptRepository(safeClient),
    receipts: createSupabaseReceiptRepository(safeClient),
    refunds: createSupabaseRefundRepository(safeClient),
    events: createSupabaseFinanceEventRepository(safeClient),
    idempotency: createSupabaseIdempotencyRepository(safeClient),
    auditEvidence: createSupabaseAuditEvidenceRepository(safeClient),
  });
}
